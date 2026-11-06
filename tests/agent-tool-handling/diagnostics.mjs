// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { toolDefinitions } from './tools.mjs';

class Blocked extends Error {}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, description) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 2500) throw new Error(`Timed out waiting for ${description}.`);
    await sleep(10);
  }
}

async function expectError(operation, expectedName) {
  try { await operation(); } catch (error) {
    assert(error.name === expectedName, `Expected ${expectedName}, observed ${error.name}: ${error.message}`);
    return { name: error.name };
  }
  throw new Error(`Expected ${expectedName}; operation fulfilled.`);
}

async function bounded(promise, deadlineMs = 3000, cleanup = () => {}) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Diagnostic caller deadline exceeded (${deadlineMs} ms); not an external-agent timeout.`));
      }, deadlineMs);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runDiagnostics({ group = 'all', onResult = () => {}, secondOrigin = '', allowReentrant = false } = {}) {
  const context = document.modelContext;
  const results = [];
  const resources = [];
  const frames = [];
  let index = 0;
  const emit = result => { results.push(result); onResult(result); };
  if (!context || !['registerTool', 'getTools', 'executeTool'].every(name => typeof context[name] === 'function')) {
    emit({ group, name: 'native-capability', status: 'UNSUPPORTED', detail: 'Current document.modelContext API unavailable; no probes executed.' });
    return results;
  }
  const probe = async (probeGroup, name, operation) => {
    if (group !== 'all' && group !== probeGroup) return;
    const start = performance.now();
    const resourceStart = resources.length;
    const frameStart = frames.length;
    try {
      const detail = await bounded(Promise.resolve().then(operation), 10000);
      emit({ group: probeGroup, name, status: 'PASS', elapsedMs: Math.round(performance.now() - start), detail });
    } catch (error) {
      emit({ group: probeGroup, name, status: error instanceof Blocked ? 'BLOCKED' : 'FAIL',
        elapsedMs: Math.round(performance.now() - start), detail: `${error.name}: ${error.message}` });
    } finally {
      resources.splice(resourceStart).forEach(controller => controller.abort());
      frames.splice(frameStart).forEach(frame => frame.remove());
    }
  };
  const name = () => `widget_probe_${++index}`;
  const base = overrides => ({ name: name(), title: 'Widget probe', description: 'Opt-in synthetic widget native diagnostic.', execute: input => input, ...overrides });
  const rawRegister = async (definition, options = {}, target = context) => {
    const controller = new AbortController();
    resources.push(controller);
    await bounded(Promise.resolve().then(() => target.registerTool(definition, { signal: controller.signal, ...options })), 3000, () => controller.abort());
    return controller;
  };
  const register = async (definition, options = {}, target = context) => {
    const controller = await rawRegister(definition, options, target);
    const tools = await bounded(context.getTools());
    const descriptor = tools.find(tool => tool.name === definition.name && (!tool.window || tool.window === window));
    return { definition, descriptor, controller };
  };
  const ownTools = async () => (await bounded(context.getTools())).filter(tool => tool.window === window);
  const call = async (tool, input = {}, options = {}) => {
    const controller = new AbortController();
    resources.push(controller);
    return bounded(Promise.resolve().then(() => context.executeTool(tool, input, { signal: controller.signal, ...options })),
      3000, () => controller.abort(new DOMException('Diagnostic caller deadline.', 'AbortError')));
  };
  const frame = async (supplier = 'A', attributes = {}, path = './frame.html') => {
    const node = document.createElement('iframe');
    frames.push(node);
    node.title = `Widget supplier ${supplier}`;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    const loaded = new Promise((resolve, reject) => {
      node.addEventListener('load', resolve, { once: true });
      node.addEventListener('error', () => reject(new Error('Widget frame failed to load.')), { once: true });
    });
    const url = new URL(path, location.href);
    url.searchParams.set('supplier', supplier);
    node.src = url.href;
    document.querySelector('#frames').append(node);
    await bounded(loaded);
    if (url.origin === location.origin) {
      await bounded((async () => {
        await until(() => node.contentWindow.widgetFrame, 'supplier frame module');
        return node.contentWindow.widgetFrame.ready;
      })());
    }
    return node;
  };

  try {
    await probe('registration', 'readiness-and-duplicate', async () => {
      const registered = await register(base({ annotations: { readOnlyHint: true } }));
      assert(registered.descriptor, 'Tool missing after registration readiness.');
      await expectError(() => rawRegister(registered.definition), 'InvalidStateError');
      assert(JSON.parse(await call(registered.descriptor, { widget: 1 })).widget === 1, 'Duplicate registration damaged original callback.');
    });
    for (const [label, overrides, error] of [
      ['empty-name', { name: '' }, 'InvalidStateError'],
      ['name-129', { name: 'w'.repeat(129) }, 'InvalidStateError'],
      ['disallowed-name', { name: 'widget space' }, 'InvalidStateError'],
      ['empty-description', { description: '' }, 'InvalidStateError'],
      ['missing-name', { name: undefined }, 'TypeError'],
      ['missing-description', { description: undefined }, 'TypeError'],
      ['missing-callback', { execute: undefined }, 'TypeError']
    ]) await probe('registration', label, () => expectError(() => rawRegister(base(overrides)), error));
    await probe('registration', 'name-128-and-schema-omission', async () => {
      const registered = await register(base({ name: 'w'.repeat(128) }));
      assert(registered.descriptor.name.length === 128, '128-character name not exposed.');
      assert(registered.descriptor.inputSchema === undefined, 'Omitted input schema was not omitted.');
      assert(registered.descriptor.outputSchema === undefined, 'Omitted output schema was not omitted.');
    });
    for (const field of ['inputSchema', 'outputSchema']) {
      for (const [label, schema, error] of [
        ['non-object', 'not-an-object', 'TypeError'],
        ['circular', (() => { const object = {}; object.self = object; return object; })(), 'TypeError'],
        ['undefined-json', { toJSON() { return undefined; } }, 'TypeError'],
        ['throwing-json', { toJSON() { throw new RangeError('Widget schema diagnostic'); } }, 'RangeError']
      ]) await probe('registration', `${field}-${label}`, () => expectError(() => rawRegister(base({ [field]: schema })), error));
    }
    await probe('registration', 'pre-aborted-registration', async () => {
      const controller = new AbortController();
      controller.abort();
      return expectError(() => rawRegister(base(), { signal: controller.signal }), 'AbortError');
    });
    await probe('registration', 'lifetime-controllers-and-reregistration', async () => {
      const first = await register(base());
      const second = await register(base());
      first.controller.abort();
      first.controller.abort();
      const tools = await ownTools();
      assert(!tools.some(tool => tool.name === first.definition.name), 'Aborted registration is still discoverable.');
      assert(tools.some(tool => tool.name === second.definition.name), 'Unrelated controller was affected.');
      await expectError(() => call(first.descriptor), 'NotFoundError');
      const replacement = await register({ ...first.definition, execute: () => ({ version: 2 }) });
      assert(JSON.parse(await call(replacement.descriptor)).version === 2, 'Replacement tool not used.');
    });
    await probe('registration', 'input-schema-snapshots-and-annotations', async () => {
      const schema = { type: 'object', properties: { count: { type: 'integer' } } };
      const registered = await register(base({ inputSchema: schema, annotations: { readOnlyHint: true } }));
      schema.properties.count.type = 'string';
      registered.descriptor.inputSchema.properties.count.type = 'boolean';
      const snapshot = (await ownTools()).find(tool => tool.name === registered.definition.name);
      assert(snapshot.inputSchema.properties.count.type === 'integer', 'Input schema snapshot was mutated.');
      assert(snapshot.title === 'Widget probe' && snapshot.annotations.readOnlyHint === true &&
        snapshot.annotations.debugging === false && snapshot.annotations.untrustedContentHint === false &&
        snapshot.annotations.consequentialHint === false, 'Metadata/defaulted annotations mismatch.');
      const absent = await register(base());
      assert(absent.descriptor.annotations == null, 'Absent annotations must remain null/absent.');
    });
    await probe('registration', 'output-schema-snapshots', async () => {
      const schema = { type: 'object', properties: { count: { type: 'integer' } } };
      const registered = await register(base({ outputSchema: schema }));
      assert(registered.descriptor.outputSchema?.properties?.count, 'Registered outputSchema is not exposed by this browser.');
      schema.properties.count.type = 'string';
      registered.descriptor.outputSchema.properties.count.type = 'boolean';
      const snapshot = (await ownTools()).find(tool => tool.name === registered.definition.name);
      assert(snapshot.outputSchema.properties.count.type === 'integer', 'Output schema snapshot was mutated.');
    });
    await probe('reentrant', 'reentrant-schema-duplicate-guard', async () => {
      if (!allowReentrant) throw new Blocked('Potential renderer deadlock: run reentrant group only through the isolated browser-check watchdog.');
      const controller = new AbortController();
      resources.push(controller);
      const toolName = name();
      let nested;
      const definition = base({ name: toolName, inputSchema: { toJSON() {
        nested = context.registerTool(base({ name: toolName }), { signal: controller.signal });
        return {};
      } } });
      await expectError(() => context.registerTool(definition, { signal: controller.signal }), 'InvalidStateError');
      await bounded(nested);
    });
    await probe('reentrant', 'reentrant-schema-detaches-owner', async () => {
      if (!allowReentrant) throw new Blocked('Potential renderer deadlock: run reentrant group only through the isolated browser-check watchdog.');
      const owner = await frame();
      const ownerContext = owner.contentWindow.widgetFrame.context;
      await expectError(() => ownerContext.registerTool(base({ inputSchema: { toJSON() { owner.remove(); return {}; } } })), 'InvalidStateError');
    });

    await probe('execution', 'omitted-input-and-nested-input', async () => {
      const registered = await register(base());
      assert(await bounded(context.executeTool(registered.descriptor)) === '{}', 'Omitted input was not {}.');
      const nested = { widget: { tags: ['robot', 'gear'], enabled: true } };
      assert(await call(registered.descriptor, nested) === JSON.stringify(nested), 'Nested input changed.');
    });
    for (const [label, input, error] of [
      ['non-object-input', 1, 'TypeError'],
      ['circular-input', (() => { const object = {}; object.self = object; return object; })(), 'TypeError'],
      ['bigint-input', { count: 1n }, 'TypeError'],
      ['primitive-json-input', { toJSON() { return 1; } }, 'DataError']
    ]) await probe('execution', label, async () => {
      let started = 0;
      const registered = await register(base({ execute: () => { started++; return {}; } }));
      await expectError(() => call(registered.descriptor, input), error);
      assert(started === 0, 'Invalid input reached the callback.');
    });
    for (const [label, execute] of [
      ['synchronous-throw', () => { throw new Error('Intentional widget throw.'); }],
      ['async-rejection', async () => { await sleep(30); throw new Error('Intentional widget rejection.'); }],
      ['circular-result', () => { const value = {}; value.self = value; return value; }],
      ['bigint-result', () => 1n]
    ]) await probe('execution', label, async () => {
      const registered = await register(base({ execute }));
      return expectError(() => call(registered.descriptor), 'OperationError');
    });
    await probe('execution', 'result-shapes-and-domain-failure', async () => {
      for (const value of [null, '', false, 350, { ok: false, code: 'OUT_OF_STOCK' }]) {
        const registered = await register(base({ execute: () => value }));
        assert(await call(registered.descriptor) === JSON.stringify(value), `Incorrect serialization for ${JSON.stringify(value)}`);
      }
    });
    await probe('execution', 'output-schema-validation-observation', async () => {
      const registered = await register(base({ outputSchema: { type: 'object', properties: { count: { type: 'integer' } } }, execute: () => ({ count: 'wrong' }) }));
      const raw = await call(registered.descriptor);
      assert(JSON.parse(raw).count === 'wrong', 'Unexpected output transformation.');
      return 'Draft does not enforce output schema here. Agent validation remains a separate observation.';
    });

    await probe('lifetime', 'pre-aborted-execution', async () => {
      let started = false;
      const registered = await register(base({ execute: () => { started = true; return {}; } }));
      const controller = new AbortController();
      controller.abort();
      await expectError(() => call(registered.descriptor, {}, { signal: controller.signal }), 'AbortError');
      await sleep(30);
      assert(!started, 'Pre-aborted execution started the callback.');
    });
    await probe('lifetime', 'native-events-abort-and-late-callback', async () => {
      if (!['ontoolactivated', 'ontoolcancel', 'ontoolchange'].every(key => key in context)) throw new Blocked('Native lifecycle event handlers missing.');
      const events = [];
      const collect = event => events.push({ type: event.type, name: event.toolName });
      ['toolchange', 'toolactivated', 'toolcancel'].forEach(event => context.addEventListener(event, collect));
      try {
        let started;
        const start = new Promise(resolve => { started = resolve; });
        let late = false;
        let abortObserved = false;
        const registered = await register(base({ async execute(_input, options) {
          options.signal.addEventListener('abort', () => { abortObserved = true; }, { once: true });
          started();
          await sleep(150);
          late = true;
          return { late: true };
        } }));
        const controller = new AbortController();
        const pending = call(registered.descriptor, {}, { signal: controller.signal });
        const rejection = expectError(() => pending, 'AbortError');
        await bounded(start);
        controller.abort();
        await rejection;
        await sleep(200);
        assert(late && abortObserved, 'Late callback or native execution abort not observed.');
        assert(events.some(event => event.type === 'toolactivated' && event.name === registered.definition.name), 'Missing activation event.');
        assert(events.some(event => event.type === 'toolcancel' && event.name === registered.definition.name), 'Missing cancellation event.');
        assert(events.some(event => event.type === 'toolchange'), 'Missing change event.');
      } finally {
        ['toolchange', 'toolactivated', 'toolcancel'].forEach(event => context.removeEventListener(event, collect));
      }
    });
    await probe('lifetime', 'unregister-inflight-and-self-unregister', async () => {
      let started;
      const start = new Promise(resolve => { started = resolve; });
      const registered = await register(base({ async execute() { started(); await sleep(80); return { finished: true }; } }));
      const pending = call(registered.descriptor);
      await bounded(start);
      registered.controller.abort();
      assert(JSON.parse(await pending).finished, 'Registration abort cancelled an in-flight call.');
      await expectError(() => call(registered.descriptor), 'NotFoundError');
      let self;
      self = await register(base({ execute() { self.controller.abort(); return 'closed'; } }));
      assert(await call(self.descriptor) === '"closed"', 'Self-unregistered callback did not finish.');
      await expectError(() => call(self.descriptor), 'NotFoundError');
    });
    await probe('lifetime', 'abort-after-settlement-and-race', async () => {
      const registered = await register(base({ execute: () => ({ widget: true }) }));
      const controller = new AbortController();
      const result = await call(registered.descriptor, {}, { signal: controller.signal });
      controller.abort();
      assert(JSON.parse(result).widget === true, 'Post-settlement result was corrupted.');
      for (let attempt = 0; attempt < 5; attempt++) {
        const racing = new AbortController();
        let outcomes = 0;
        const pending = call(registered.descriptor, {}, { signal: racing.signal }).then(
          value => { outcomes++; assert(JSON.parse(value).widget === true, 'Race result corrupted.'); },
          error => { outcomes++; assert(error.name === 'AbortError', 'Unexpected race rejection.'); });
        setTimeout(() => racing.abort(), 0);
        await pending;
        await sleep(10);
        assert(outcomes === 1, 'More than one terminal caller outcome.');
      }
    });
    await probe('lifetime', 'target-removal-and-inactive-owner', async () => {
      const target = await frame();
      const owner = target.contentWindow.widgetFrame;
      const descriptor = (await context.getTools()).find(tool => tool.name === 'supplier_widget_quote' && tool.window === target.contentWindow);
      assert(descriptor, 'Frame tool not discovered.');
      const pending = call(descriptor, { delayMs: 2000 });
      const rejection = expectError(() => pending, 'AbortError');
      await until(() => owner.callbacks.length > 0, 'target callback start');
      target.remove();
      await rejection;
      await expectError(() => owner.context.getTools(), 'InvalidStateError');
      await expectError(() => owner.context.registerTool(base()), 'InvalidStateError');
    });
    await probe('lifetime', 'caller-removal-cancels-target', async () => {
      const caller = await frame('caller');
      let abortSeen = false;
      let started;
      const start = new Promise(resolve => { started = resolve; });
      const tracked = await register(base({ execute: (_input, options) => {
        started();
        return new Promise(resolve => options.signal.addEventListener('abort', () => { abortSeen = true; resolve('aborted'); }, { once: true }));
      } }));
      // The child cannot discover its parent, but a genuine descriptor can be passed by the same-origin driver.
      caller.contentWindow.widgetFrame.startCaller(tracked.descriptor);
      await bounded(start);
      caller.remove();
      await sleep(150);
      assert(abortSeen, 'Destroyed caller did not deliver abort to surviving target.');
      return { observedTargetAbort: true };
    });
    await probe('lifetime', 'inactive-document-context', async () => {
      const owner = await frame();
      const inactiveContext = owner.contentWindow.widgetFrame.context;
      owner.remove();
      await expectError(() => inactiveContext.getTools(), 'InvalidStateError');
      await expectError(() => inactiveContext.registerTool(base()), 'InvalidStateError');
    });

    await probe('frames', 'same-name-owning-window-and-sorted-discovery', async () => {
      const first = await frame('A');
      const second = await frame('B');
      const tools = await context.getTools();
      const names = tools.map(tool => tool.name);
      assert(JSON.stringify(names) === JSON.stringify([...names].sort()), 'Discovery is not in code-unit name order.');
      const a = tools.find(tool => tool.name === 'supplier_widget_quote' && tool.window === first.contentWindow);
      const b = tools.find(tool => tool.name === 'supplier_widget_quote' && tool.window === second.contentWindow);
      assert(a && b && a.origin === location.origin && b.origin === location.origin, 'Origin/window identity missing.');
      assert(JSON.parse(await call(a)).supplier === 'A', 'Supplier A dispatched incorrectly.');
      assert(JSON.parse(await call(b)).supplier === 'B', 'Supplier B dispatched incorrectly.');
      const filtered = await context.getTools({ fromOrigins: [] });
      assert(filtered.length === tools.length, 'Empty origin filter excluded same-origin tools.');
      const oldWindow = first.contentWindow;
      first.remove();
      const remaining = await context.getTools();
      assert(!remaining.some(tool => tool.window === oldWindow), 'Removed frame still discoverable.');
    });
    await probe('frames', 'frame-navigation-invalidates-old-tools', async () => {
      const target = await frame('A');
      const stale = (await context.getTools()).find(tool => tool.name === 'supplier_widget_quote' && tool.window === target.contentWindow);
      const loaded = new Promise(resolve => target.addEventListener('load', resolve, { once: true }));
      target.src = new URL('./order-status.html', location.href).href;
      await bounded(loaded);
      await until(() => target.contentWindow.widgetFixture, 'destination module');
      await bounded(target.contentWindow.widgetFixture.ready);
      await expectError(() => call(stale), 'NotFoundError');
      assert((await context.getTools()).some(tool => tool.window === target.contentWindow && tool.name === 'get_widget_order_status'), 'Destination tools not discovered.');
    });

    for (const [option, action] of [
      ['exposedTo', value => rawRegister(base(), { exposedTo: [value] })],
      ['fromOrigins', value => context.getTools({ fromOrigins: [value] })]
    ]) {
      for (const origin of ['not a URL', 'http://widget.example.invalid']) {
        await probe('permissions', `${option}-${origin}`, () => expectError(() => action(origin), 'SecurityError'));
      }
    }
    await probe('permissions', 'denied-tools-policy-frame', async () => {
      const target = await frame('denied', { allow: "tools 'none'" });
      const owner = target.contentWindow.widgetFrame;
      const readiness = await owner.ready;
      if (readiness.status === 'UNSUPPORTED') throw new Blocked('Frame native API unavailable, cannot distinguish policy denial.');
      assert(readiness.name === 'NotAllowedError', `Expected NotAllowedError, got ${JSON.stringify(readiness)}`);
      await expectError(() => owner.context.getTools(), 'NotAllowedError');
    });
    await probe('permissions', 'secure-context-and-default-allow', async () => {
      assert(isSecureContext, 'Diagnostics must be served from a secure context (localhost or HTTPS).');
      const target = await frame('A', { allow: "tools 'self'" });
      assert((await target.contentWindow.widgetFrame.ready).status === 'READY', 'Same-origin tools policy failed.');
    });

    const shopTools = async () => {
      const shop = document.createElement('iframe');
      frames.push(shop);
      shop.title = 'Isolated Widget Works integration store';
      shop.src = new URL('./index.html', location.href).href;
      const loaded = new Promise(resolve => shop.addEventListener('load', resolve, { once: true }));
      document.querySelector('#frames').append(shop);
      await bounded(loaded);
      await until(() => shop.contentWindow.widgetFixture, 'storefront module');
      await bounded(shop.contentWindow.widgetFixture.ready);
      const get = async name => {
        const found = (await context.getTools()).find(tool => tool.window === shop.contentWindow && tool.name === name);
        assert(found, `Store tool ${name} missing.`);
        return found;
      };
      const execute = async (name, input = {}) => JSON.parse(await call(await get(name), input));
      await execute('reset_widget_test_store');
      return { shop, get, execute };
    };
    await probe('store', 'five-tools-exact-totals', async () => {
      const { shop, execute } = await shopTools();
      assert(!(await context.getTools()).some(tool => tool.window === shop.contentWindow && tool.name === 'engrave_widget'), 'Engraving should start absent.');
      assert((await execute('browse_widgets')).products.length === 4, 'Catalog mismatch.');
      await execute('add_widgets_to_cart', { productId: 'robot-widget', quantity: 2 });
      await execute('add_widgets_to_cart', { productId: 'gear-widget', quantity: 4 });
      await execute('view_widget_cart');
      await execute('apply_widget_coupon', { code: 'WIDGET10' });
      const quote = await execute('quote_widget_shipping', { delayMs: 10 });
      assert(quote.cart.totalCents === 3920 && shop.contentWindow.widgetFixture.store.orders.length === 0, 'Wrong total or unauthorized purchase.');
      return { totalCents: quote.cart.totalCents, distinctShoppingTools: 5, orders: 0 };
    });
    const engraveCart = async () => {
      const { shop, get, execute } = await shopTools();
      await execute('add_widgets_to_cart', { productId: 'robot-widget', quantity: 1 });
      await execute('enable_widget_engraving');
      const engraving = await get('engrave_widget');
      await call(engraving, { productId: 'robot-widget', engraving: { text: 'Robo #1' } });
      assert(shop.contentWindow.widgetFixture.store.cart().lines[0].engraving.text === 'Robo #1', 'Engraving not applied.');
      return { shop, execute, engraving };
    };
    await probe('store', 'dynamic-engraving-registration', async () => {
      await engraveCart();
      return { registrationReady: true, engraving: 'Robo #1', externalAgentNextPrompt: 'MANUAL/NOT RUN' };
    });
    await probe('store', 'stale-engraving-descriptor', async () => {
      const { shop, execute, engraving } = await engraveCart();
      await execute('disable_widget_engraving');
      assert(!(await context.getTools()).some(tool => tool.name === 'engrave_widget' && tool.window === shop.contentWindow), 'Disabled engraving remains discoverable.');
      await expectError(() => call(engraving, { productId: 'robot-widget', engraving: { text: 'stale' } }), 'NotFoundError');
    });
    await probe('store', 'self-unregistering-flash-sale', async () => {
      const { shop, execute } = await shopTools();
      await execute('close_widget_flash_sale');
      assert(!(await context.getTools()).some(tool => tool.window === shop.contentWindow && tool.name === 'close_widget_flash_sale'), 'Flash tool still available.');
    });
    const crossFixture = async () => {
      if (!secondOrigin) throw new Blocked('Supply a second local origin serving the same static files; see README.');
      const origin = new URL(secondOrigin);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.origin === location.origin ||
        !['http:', 'https:'].includes(origin.protocol)) throw new Blocked('Use a distinct trustworthy local HTTP(S) origin.');
      const path = new URL('./frame.html', location.href);
      path.protocol = origin.protocol;
      path.host = origin.host;
      path.searchParams.set('supplier', 'B');
      path.searchParams.set('exposedTo', location.origin);
      const target = await frame('B', { allow: 'tools *' }, path.href);
      const discovered = async () => (await context.getTools({ fromOrigins: [origin.origin] }))
        .filter(tool => tool.window === target.contentWindow);
      let tools = [];
      for (let retry = 0; retry < 30 && !tools.length; retry++) { tools = await discovered(); if (!tools.length) await sleep(50); }
      assert(tools.some(tool => tool.name === 'supplier_widget_quote'), 'Explicitly exposed public tool missing.');
      assert(!tools.some(tool => tool.name === 'private_supplier_widget_quote'), 'Private tool leaked to parent discovery.');
      assert(!(await context.getTools()).some(tool => tool.window === target.contentWindow), 'Default filter included cross-origin tools.');
      const publicTool = tools.find(tool => tool.name === 'supplier_widget_quote');
      assert(JSON.parse(await call(publicTool)).supplier === 'B', 'Cross-origin tool routed incorrectly.');
      return { target, publicTool };
    };
    await probe('cross-origin', 'second-origin-public-private-discovery', async () => {
      await crossFixture();
      return { publicVisible: true, privateVisible: false, publicSupplier: 'B', defaultFilterExcludesForeign: true };
    });
    await probe('cross-origin', 'second-origin-private-execution-denial', async () => {
      const { publicTool } = await crossFixture();
      await expectError(() => call({ ...publicTool, name: 'private_supplier_widget_quote' }), 'NotFoundError');
    });
    await probe('cross-origin', 'second-origin-stale-origin-descriptor', async () => {
      const { target, publicTool } = await crossFixture();
      const loaded = new Promise(resolve => target.addEventListener('load', resolve, { once: true }));
      target.src = new URL('./order-status.html', location.href).href;
      await bounded(loaded);
      await expectError(() => call(publicTool), 'NotFoundError');
    });
  } finally {
    resources.forEach(controller => controller.abort());
    frames.forEach(node => node.remove());
  }
  return results;
}
