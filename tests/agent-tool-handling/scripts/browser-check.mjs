// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
// Optional real-browser validation. Node 22+ provides the built-in WebSocket client.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const [executable, address = 'http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/', group = 'all', secondOrigin = ''] = process.argv.slice(2);
if (!executable) throw new Error('Provide the browser executable path, then optionally the local fixture URL.');
const url = new URL(address);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Use a loopback fixture URL.');
const profile = await mkdtemp(join(tmpdir(), 'widget-browser-'));
const browser = spawn(executable, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--disable-sync',
  '--enable-features=WebMCP,WebMCPTesting', '--enable-blink-features=WebMCP,WebMCPTesting', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserLog = '';
browser.stderr.on('data', chunk => { browserLog = (browserLog + chunk).slice(-3000); });
let socket;
let sequence = 0;
const completedProbes = [];
const pending = new Map();
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(operation, description, milliseconds = 10000) {
  const start = Date.now();
  while (Date.now() - start < milliseconds) {
    const result = await operation();
    if (result) return result;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}. Browser log: ${browserLog}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP deadline: ${method}. An isolated renderer may have hung; completed probes: ${completedProbes.length}.`));
    }, group === 'reentrant' ? 15000 : 90000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

try {
  let spawnError;
  browser.on('error', error => { spawnError = error; });
  const port = await until(async () => {
    if (spawnError) throw spawnError;
    if (browser.exitCode !== null && browser.exitCode !== 0) throw new Error(`Browser exited: ${browser.exitCode}. ${browserLog}`);
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
  }, 'isolated browser debugger');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(target => target.type === 'page');
  if (!target) throw new Error('Browser debugger exposed no page target.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data);
    if (response.method === 'Runtime.bindingCalled' && response.params.name === 'widgetProbeResult') {
      completedProbes.push(JSON.parse(response.params.payload));
      console.log(response.params.payload);
    }
    const request = pending.get(response.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(response.id);
    if (response.error) request.reject(new Error(JSON.stringify(response.error)));
    else request.resolve(response.result);
  });
  await once(socket, 'open');
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Runtime.addBinding', { name: 'widgetProbeResult' });
  const version = await send('Browser.getVersion');
  await send('Page.navigate', { url: url.href });
  await until(() => evaluate('!!globalThis.widgetFixture'), 'fixture module');
  const fixture = await evaluate(`(async () => {
    const readiness = await Promise.race([widgetFixture.ready.then(()=>'settled'), new Promise(resolve=>setTimeout(()=>resolve('BLOCKED: registration readiness exceeded 4000 ms'),4000))]);
    return {capabilities:widgetFixture.runtime.capabilities, registered:[...widgetFixture.runtime.registrations.keys()],
      readiness, registrationErrors:widgetFixture.runtime.log.filter(e=>e.event==='registration-error')};
  })()`);
  console.log(JSON.stringify({ browser: version.product, fixture }, null, 2));
  await send('Page.navigate', { url: new URL('./diagnostics.html', url).href });
  await until(() => evaluate('!!globalThis.widgetDiagnostics'), 'native diagnostic module');
  const probes = await evaluate(`(async () => {
    const results=[];
    for (const group of ${JSON.stringify(group.split(','))}) {
      results.push(...await widgetDiagnostics.run({group,secondOrigin:${JSON.stringify(secondOrigin)},allowReentrant:group==='reentrant',onResult:result=>widgetProbeResult(JSON.stringify(result))}));
    }
    return results;
  })()`);
  console.log(JSON.stringify({ browser: version.product, counts: Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'UNSUPPORTED'].map(status => [status, probes.filter(probe => probe.status === status).length])) }));
  process.exitCode = probes.some(probe => probe.status === 'FAIL') ? 1 :
    probes.some(probe => probe.status === 'UNSUPPORTED') ? 2 : 0;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++sequence, method: 'Browser.close' }));
    await delay(1000);
    socket.close();
  }
  for (const request of pending.values()) clearTimeout(request.timer);
  if (browser.exitCode === null && browser.pid) {
    if (process.platform !== 'win32') throw new Error(`Browser PID ${browser.pid} did not exit after Browser.close.`);
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Stop-Process -Id ${browser.pid} -ErrorAction Stop`]);
    await delay(500);
  }
  await rm(profile, { recursive: true, maxRetries: 5, retryDelay: 200 });
}
