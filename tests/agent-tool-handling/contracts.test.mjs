// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WidgetStore, DomainError, validateInput, domainResult, waitForWidget, engravingSchema } from './store.mjs';
import { createRuntime, summarize } from './runtime.mjs';
import { toolDefinitions, scenarioFiles } from './tools.mjs';
import { coverage } from './scripts/coverage.mjs';
import { stagePages, siteFiles, rootFiles } from './scripts/stage-pages.mjs';

const site = fileURLToPath(new URL('./', import.meta.url));
const skill = fileURLToPath(new URL('../../.github/skills/webmcp-agent-tool-handling/', import.meta.url));
const fresh = () => {
  const store = new WidgetStore();
  return { store, runtime: createRuntime(store) };
};
const cartFixture = store => {
  store.add('robot-widget', 2);
  store.add('gear-widget', 4);
  store.applyCoupon('WIDGET10');
};

test('exact shopping total, rounding and shipping rules', () => {
  const store = new WidgetStore();
  cartFixture(store);
  assert.equal(store.cart().subtotalCents, 3800);
  assert.equal(store.cart().discountCents, 380);
  assert.equal(store.cart().totalCents, 3920);
  store.selectShipping('express');
  assert.equal(store.cart().totalCents, 4420);
  store.reset();
  store.add('screw-widget', 1);
  store.applyCoupon('WIDGET10');
  assert.equal(store.cart().discountCents, 2);
  assert.equal(store.cart().totalCents, 523);
});
test('failed domain operations are atomic', () => {
  const store = new WidgetStore();
  for (const action of [
    () => store.add('unknown', 1), () => store.add('robot-widget', -1), () => store.add('robot-widget', 11),
    () => store.add('sold-out-widget', 1), () => store.setQuantity('gear-widget', 1.5),
    () => store.applyCoupon('expired'), () => store.selectShipping('__proto__'),
    () => store.engrave('robot-widget', { text: 'Robo' }), () => store.reserve('robot-widget', 11)
  ]) {
    const before = store.snapshot();
    assert.throws(action, DomainError);
    assert.deepEqual(store.snapshot(), before);
  }
});
test('quantity zero removes, while add zero fails', () => {
  const store = new WidgetStore();
  store.add('gear-widget', 1);
  assert.throws(() => store.add('gear-widget', 0), DomainError);
  store.setQuantity('gear-widget', 0);
  assert.equal(store.cart().lines.length, 0);
  assert.equal(store.cart().totalCents, 0);
});
test('checkout authorization, revisions, idempotency and stock', () => {
  const store = new WidgetStore();
  cartFixture(store);
  const request = { confirmPurchase: true, expectedRevision: store.revision, idempotencyKey: 'checkout-test' };
  assert.throws(() => store.checkout({ ...request, confirmPurchase: false }), /confirmation/);
  assert.throws(() => store.checkout({ ...request, expectedRevision: 999 }), /revision/);
  const result = store.checkout(request);
  assert.equal(result.order.totalCents, 3920);
  assert.equal(store.stock['robot-widget'], 8);
  assert.equal(store.stock['gear-widget'], 16);
  assert.equal(store.cart().lines.length, 0);
  assert.equal(store.checkout(request).order.id, result.order.id);
  assert.equal(store.orders.length, 1);
  assert.throws(() => store.checkout({ ...request, expectedRevision: request.expectedRevision + 1 }), /different cart/);
  assert.equal(store.orders.length, 1);
  assert.equal(store.order(result.order.id).order.status, 'simulated-confirmed');
});
test('reservation release is idempotent and stock is revalidated at checkout', () => {
  const store = new WidgetStore();
  store.add('robot-widget', 10);
  const held = store.reserve('robot-widget', 1);
  assert.equal(store.available('robot-widget'), 9);
  assert.throws(() => store.checkout({ confirmPurchase: true, expectedRevision: store.revision, idempotencyKey: 'held' }), /Stock changed/);
  assert.equal(store.orders.length, 0);
  assert.equal(store.release(held.reservation.id).alreadyReleased, false);
  assert.equal(store.release(held.reservation.id).alreadyReleased, true);
  assert.equal(store.available('robot-widget'), 10);
});
test('nested Unicode engraving and strict runtime inputs', () => {
  validateInput({ text: '🤖 Café', style: 'bold', tags: ['robot', 'gift'] }, engravingSchema);
  for (const value of [
    { text: ' ' }, { text: 'x'.repeat(41) }, { text: 'Robo', style: 'italic' },
    { text: 'Robo', tags: ['a', 'b', 'c', 'd'] }, { text: 'Robo', unknown: true }, {}
  ]) assert.throws(() => validateInput(value, engravingSchema), DomainError);
  const store = new WidgetStore();
  store.add('robot-widget', 1);
  store.engrave('robot-widget', { text: '🤖 Café' });
  assert.equal(store.cart().lines[0].engraving.text, '🤖 Café');
});
test('state survives a validated storage round-trip; corrupt storage is rejected atomically', () => {
  const original = new WidgetStore();
  cartFixture(original);
  original.checkout({ confirmPurchase: true, expectedRevision: original.revision, idempotencyKey: 'persist' });
  const restored = new WidgetStore();
  restored.restore(JSON.parse(JSON.stringify(original.snapshot())));
  assert.deepEqual(restored.snapshot(), original.snapshot());
  const before = restored.snapshot();
  for (const corrupted of [null, {}, { ...before, shipping: 'bad' }, { ...before, lines: [{ productId: 'gear-widget', quantity: -1 }] }]) {
    assert.throws(() => restored.restore(corrupted));
    assert.deepEqual(restored.snapshot(), before);
  }
  for (const corrupt of [
    snapshot => { snapshot.orders[0].totalCents++; },
    snapshot => { snapshot.idempotency[0].order.totalCents++; },
    snapshot => { snapshot.stock['robot-widget']++; },
    snapshot => { snapshot.reservations.push({ id: 'overbooked', productId: 'robot-widget', quantity: 9, status: 'held' }); }
  ]) {
    const corrupted = structuredClone(before);
    corrupt(corrupted);
    assert.throws(() => restored.restore(corrupted), DomainError);
    assert.deepEqual(restored.snapshot(), before);
  }
});
test('genuine callback throw, delayed rejection and fulfilled domain error stay distinct (unit only)', async () => {
  const { runtime } = fresh();
  assert.throws(() => runtime.invoke('fail_widget_quote_immediately', {}), /immediate/);
  await assert.rejects(runtime.invoke('reject_widget_quote_after_delay', { delayMs: 5 }), /delayed/);
  assert.equal(runtime.invoke('get_widget_details', { productId: 'unknown' }).ok, false);
  assert.equal(runtime.invoke('add_widgets_to_cart', { productId: 'gear-widget', quantity: 0 }).code, 'INVALID_INPUT');
  assert.equal(runtime.active.size, 0);
});
test('pre-aborted and midflight cooperative waits reject', async () => {
  const first = new AbortController();
  first.abort();
  await assert.rejects(waitForWidget(10, first.signal), { name: 'AbortError' });
  const second = new AbortController();
  const pending = waitForWidget(null, second.signal);
  second.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('never-completing callback has no natural completion and can be cleaned up', async () => {
  const { runtime } = fresh();
  let settled = false;
  const pending = runtime.invoke('check_widget_supplier_forever', {});
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(settled, false);
  await runtime.reset();
  await observed;
  assert.equal(runtime.active.size, 0);
  assert(runtime.log.some(entry => entry.event === 'fixture-cleanup-request'));
});
test('abort and reset prevent delayed reservation commits beyond the original timer', async () => {
  const { store, runtime } = fresh();
  const controller = new AbortController();
  const pending = runtime.invoke('reserve_widget_stock', { productId: 'robot-widget', quantity: 2, delayMs: 30 }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const resetting = runtime.invoke('reserve_widget_stock', { productId: 'robot-widget', quantity: 2, delayMs: 30 });
  const rejected = assert.rejects(resetting, { name: 'AbortError' });
  await runtime.reset();
  store.add('gear-widget', 1);
  await rejected;
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(store.reservations.length, 0);
  assert.equal(store.cart().lines[0].productId, 'gear-widget');
});
test('noncooperative late result is read-only and explicitly logged as stale after reset', async () => {
  const { store, runtime } = fresh();
  const oldSession = store.sessionId;
  const pending = runtime.invoke('get_uncancellable_widget_estimate', { delayMs: 20 });
  await runtime.reset();
  store.add('gear-widget', 1);
  assert.equal((await pending).originalSession, oldSession);
  assert.equal(store.cart().lines.length, 1);
  assert(runtime.log.some(entry => entry.event === 'callback-fulfilled' && entry.detail.staleSession === true));
});
test('stock conflict and stale cart are checked at delayed completion', async () => {
  const { store, runtime } = fresh();
  const reservation = runtime.invoke('reserve_widget_stock', { productId: 'robot-widget', quantity: 10, delayMs: 20 });
  store.reserve('robot-widget', 1);
  assert.equal((await reservation).code, 'OUT_OF_STOCK');
  const stale = runtime.invoke('check_widget_cart_freshness', { delayMs: 10 });
  store.add('gear-widget', 1);
  assert.equal((await stale).code, 'STALE_CART');
});
test('transient failure counter resets; untrusted content remains plain data', async () => {
  const { runtime } = fresh();
  assert.throws(() => runtime.invoke('retry_widget_supplier', {}), /first-attempt/);
  assert.equal(runtime.invoke('retry_widget_supplier', {}).attempt, 2);
  await runtime.reset();
  assert.throws(() => runtime.invoke('retry_widget_supplier', {}), /first-attempt/);
  assert.match(runtime.invoke('get_widget_supplier_reviews', {}).reviews[1].text, /WIDGET_WOBBLE/);
});
test('result shapes are not normalized and safe logging does not mask bad serialization', () => {
  const { runtime } = fresh();
  assert.equal(runtime.invoke('get_widget_result_sample', { shape: 'empty' }), '');
  assert.equal(runtime.invoke('get_widget_result_sample', { shape: 'null' }), null);
  assert.equal(runtime.invoke('get_widget_result_sample', { shape: 'false' }), false);
  assert.equal(runtime.invoke('get_widget_result_sample', { shape: 'large' }).report.length, 65536);
  assert.throws(() => JSON.stringify(runtime.invoke('get_unserializable_widget_report', { shape: 'circular' })), TypeError);
  assert.throws(() => JSON.stringify(runtime.invoke('get_unserializable_widget_report', { shape: 'bigint' })), TypeError);
  assert.equal(summarize(42n), '[BigInt 42]');
  assert.equal(runtime.active.size, 0);
});
test('no native fallback; manifest definitions and callbacks match exactly', async () => {
  const { runtime } = fresh();
  assert.deepEqual(await runtime.initialize(), []);
  await assert.rejects(runtime.register('browse_widgets'), DomainError);
  assert.equal(runtime.capabilities.nativeAPI, false);
  assert.deepEqual([...runtime.handlerNames].sort(), toolDefinitions.map(tool => tool.name).sort());
  assert.deepEqual(JSON.parse(await readFile(join(site, 'coverage.json'), 'utf8')), coverage);
  for (const tool of toolDefinitions) {
    assert(tool.description.length > 10 && tool.title);
    assert(tool.scenarios.length);
    for (const id of tool.scenarios) assert(scenarioFiles[id], `${tool.name} maps to missing scenario ${id}`);
  }
});
test('skill frontmatter, scenario content and relative Markdown links are complete', async () => {
  const skillText = await readFile(join(skill, 'SKILL.md'), 'utf8');
  assert.match(skillText, /^---\r?\nname: webmcp-agent-tool-handling\r?\ndescription: ".+"\r?\n---/);
  for (const [id, file] of Object.entries(scenarioFiles)) {
    assert(skillText.includes(file), `Skill does not link ${file}`);
    const text = await readFile(join(skill, 'scenarios', file), 'utf8');
    assert(text.includes(`# ${id} `), `Scenario ${id} missing stable ID`);
    for (const section of ['Classification', 'Setup', 'Prompt', 'Expected tools', 'Expected response', 'Assertions', 'Cleanup', 'References']) {
      assert(text.includes(`## ${section}`), `${file} missing ${section}`);
    }
    assert(!/\b(TODO|TBD|lorem ipsum)\b/.test(text), `${file} contains a stub`);
  }
  for (const file of [resolve(site, '..', '..', 'README.md'), join(site, 'README.md'), join(site, 'evals', 'README.md'), join(skill, 'SKILL.md'), join(skill, 'scenarios', 'index.md'),
    ...Object.values(scenarioFiles).map(file => join(skill, 'scenarios', file))]) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(match[1])) continue;
      const target = resolve(dirname(file), decodeURIComponent(match[1].split('#')[0]));
      assert((await stat(target)).isFile() || (await stat(target)).isDirectory(), `Broken link ${match[1]} in ${file}`);
    }
  }
});
test('standalone Pages staging includes the root entry and only allowlisted fixture assets', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'widget-pages-'));
  try {
    const output = join(temporary, 'public');
    await stagePages(output);
    assert.deepEqual((await readdir(output)).sort(), [...rootFiles, 'tests'].sort());
    for (const file of rootFiles) {
      assert.equal(await readFile(join(output, file), 'utf8'), await readFile(resolve(site, '..', '..', file), 'utf8'));
    }
    const rootEntry = await readFile(join(output, 'index.html'), 'utf8');
    assert.match(rootEntry, /http-equiv="refresh" content="0;url=\.\/tests\/agent-tool-handling\/"/);
    for (const match of rootEntry.matchAll(/href="(\.[^"#]+)"/g)) {
      const link = new URL(match[1], 'https://sjdallst2.github.io/webmcp-test-harness/');
      assert(link.pathname.startsWith('/webmcp-test-harness/'), `Link escaped the project prefix: ${match[1]}`);
      const target = resolve(output, match[1]);
      assert((await stat(match[1].endsWith('/') ? join(target, 'index.html') : target)).isFile());
    }
    const target = join(output, 'tests', 'agent-tool-handling');
    const stagedFiles = (await readdir(target, { recursive: true, withFileTypes: true }))
      .filter(entry => entry.isFile())
      .map(entry => resolve(entry.parentPath, entry.name));
    assert.deepEqual(stagedFiles.sort(), siteFiles.map(file => resolve(target, file)).sort());
    for (const file of siteFiles.filter(file => file.endsWith('.json') || file.startsWith('evals/'))) {
      assert.equal(await readFile(join(target, file), 'utf8'), await readFile(join(site, file), 'utf8'));
    }
    await assert.rejects(stat(join(output, '.github')), { code: 'ENOENT' });
    for (const file of siteFiles.filter(file => file.endsWith('.html') || file.endsWith('.mjs'))) {
      const text = await readFile(join(target, file), 'utf8');
      const references = [...text.matchAll(/(?:src|href)="(\.[^"#]+)"/g), ...text.matchAll(/(?:from |import )['"](\.[^'"]+)['"]/g)];
      for (const match of references) assert((await stat(resolve(dirname(join(target, file)), match[1]))).isFile(), `Missing asset ${match[1]}`);
    }
    for (const file of siteFiles.filter(file => file.endsWith('.md'))) {
      const text = await readFile(join(target, file), 'utf8');
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#)/.test(match[1])) continue;
        const link = resolve(dirname(join(target, file)), decodeURIComponent(match[1].split('#')[0]));
        assert((await stat(link)).isFile(), `Missing published documentation ${match[1]} in ${file}`);
      }
    }
    await assert.rejects(stagePages(output), { code: 'EEXIST' });
  } finally {
    await rm(temporary, { recursive: true });
  }
});
