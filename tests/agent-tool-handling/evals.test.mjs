// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WidgetStore, validateInput } from './store.mjs';
import { createRuntime } from './runtime.mjs';
import { toolDefinitions, scenarioFiles } from './tools.mjs';
import { coverage } from './scripts/coverage.mjs';

const suites = Object.fromEntries(await Promise.all(['evals', 'simulations'].map(async name =>
  [name, JSON.parse(await readFile(new URL(`./evals/${name}.json`, import.meta.url), 'utf8'))])));
const definitions = new Map(toolDefinitions.map(tool => [tool.name, tool]));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed, required = allowed) {
  assert(isObject(value), 'Expected an object');
  for (const key of Object.keys(value)) assert(allowed.includes(key), `Unsupported field: ${key}`);
  for (const key of required) assert(Object.hasOwn(value, key), `Missing field: ${key}`);
}
function call(request) {
  assert(definitions.has(request.functionName), `Unknown tool: ${request.functionName}`);
  assert(isObject(request.arguments), 'Arguments must be concrete objects');
  validateInput(request.arguments, definitions.get(request.functionName).inputSchema);
}
function resultPattern(pattern) {
  if (Array.isArray(pattern)) return pattern.forEach(resultPattern);
  if (!isObject(pattern)) return;
  if (Object.keys(pattern).some(key => key.startsWith('$'))) {
    keys(pattern, ['$type']);
    assert(['string', 'number', 'boolean', 'object', 'array', 'null'].includes(pattern.$type));
  } else Object.values(pattern).forEach(resultPattern);
}
function expectedNode(node) {
  if (Object.hasOwn(node, 'ordered') || Object.hasOwn(node, 'unordered')) {
    const group = Object.hasOwn(node, 'ordered') ? 'ordered' : 'unordered';
    keys(node, [group]);
    assert(Array.isArray(node[group]) && node[group].length > 0);
    return node[group].forEach(expectedNode);
  }
  keys(node, ['functionName', 'arguments', 'result', 'optional'], ['functionName', 'arguments', 'result']);
  if (Object.hasOwn(node, 'optional')) assert.equal(typeof node.optional, 'boolean');
  call(node);
  resultPattern(node.result);
}
function simulation(entry) {
  keys(entry, ['name', 'setup', 'userMessage', 'userScenario', 'maxTurns', 'maxDurationMs', 'assertions', 'successCriteria'],
    ['name', 'setup', 'maxDurationMs', 'assertions', 'successCriteria']);
  assert.equal(Object.hasOwn(entry, 'userMessage'), !Object.hasOwn(entry, 'userScenario'));
  assert((entry.userMessage ?? entry.userScenario).trim().length > 0);
  assert(Number.isSafeInteger(entry.maxDurationMs) && entry.maxDurationMs > 0);
  if (Object.hasOwn(entry, 'maxTurns')) {
    assert(Object.hasOwn(entry, 'userScenario'));
    assert(Number.isSafeInteger(entry.maxTurns) && entry.maxTurns > 0);
  }
  assert(Array.isArray(entry.setup) && entry.setup.length > 0);
  assert.deepEqual(entry.setup[0], { functionName: 'reset_widget_test_store', arguments: {} });
  for (const request of entry.setup) {
    keys(request, ['functionName', 'arguments']);
    call(request);
  }
  assert(entry.successCriteria.trim().length > 0);
  assert(Array.isArray(entry.assertions) && entry.assertions.length > 0);
  for (const assertion of entry.assertions) {
    keys(assertion, ['type', 'selector', 'expect']);
    assert.equal(assertion.type, 'dom');
    assert(assertion.selector.startsWith('#'));
    assert.equal(Object.keys(assertion.expect).length, 1);
    const [kind] = Object.keys(assertion.expect);
    assert(['exists', 'count', 'text', 'attribute'].includes(kind));
    const value = assertion.expect[kind];
    if (kind === 'exists') assert.equal(typeof value, 'boolean');
    if (kind === 'count') assert(Number.isSafeInteger(value) && value >= 0);
    if (kind === 'text') {
      keys(value, ['$contains']);
      assert.equal(typeof value.$contains, 'string');
    }
    if (kind === 'attribute') {
      keys(value, ['name', 'value']);
      assert(value.name.startsWith('data-'));
      assert.equal(typeof value.value, 'string');
    }
  }
}
const flatten = nodes => nodes.flatMap(node => node.ordered || node.unordered
  ? flatten(node.ordered ?? node.unordered) : [node]);

// Only the literal/subset/$type patterns authored in these suites, not an upstream matcher replacement.
function assertResult(expected, actual) {
  if (isObject(expected)) {
    if (Object.hasOwn(expected, '$type')) {
      const actualType = actual === null ? 'null' : Array.isArray(actual) ? 'array' : typeof actual;
      assert.equal(actualType, expected.$type);
      return;
    }
    assert(isObject(actual), `Expected object, got ${JSON.stringify(actual)}`);
    for (const [key, value] of Object.entries(expected)) {
      assert(Object.hasOwn(actual, key), `Missing result field: ${key}`);
      assertResult(value, actual[key]);
    }
  } else if (Array.isArray(expected)) {
    assert(Array.isArray(actual));
    assert.equal(actual.length, expected.length);
    expected.forEach((value, index) => assertResult(value, actual[index]));
  } else assert.deepEqual(actual, expected);
}

test('JSON suites use the supported upstream shapes and real scenario IDs', () => {
  const caseNames = new Set();
  for (const [suiteName, entries] of Object.entries(suites)) {
    assert(Array.isArray(entries) && entries.length > 0);
    for (const entry of entries) {
      assert(!caseNames.has(entry.name), `Duplicate case: ${entry.name}`);
      caseNames.add(entry.name);
      const match = /^\[WW-(\d{2})-[a-z0-9-]+\] .+/.exec(entry.name);
      assert(match && scenarioFiles[match[1]], `Missing scenario: ${entry.name}`);
      assert(coverage.agentEvals.suites[suiteName].cases.some(item =>
        item.name === entry.name && item.scenarioId === match[1]));
      if (suiteName === 'evals') {
        keys(entry, ['name', 'messages', 'expectedCall']);
        assert.equal(entry.messages.length, 1);
        keys(entry.messages[0], ['role', 'type', 'content']);
        assert.equal(entry.messages[0].role, 'user');
        assert.equal(entry.messages[0].type, 'message');
        assert(entry.messages[0].content.trim().length > 0);
        assert(entry.expectedCall.length > 0);
        entry.expectedCall.forEach(expectedNode);
      } else simulation(entry);
    }
  }
});
test('suite contract guards reject unsupported keys, missing results and bad inputs', () => {
  assert.throws(() => expectedNode({ functionName: 'view_widget_cart', arguments: {} }), /Missing field: result/);
  assert.throws(() => expectedNode({ functionName: 'unknown', arguments: {}, result: {} }), /Unknown tool/);
  assert.throws(() => expectedNode({
    functionName: 'add_widgets_to_cart', arguments: { productId: 'robot-widget', quantity: 101 }, result: {}
  }));
  assert.throws(() => simulation({ ...suites.simulations[0], maxDuration: 1000 }), /Unsupported field/);
  assert.throws(() => simulation({ ...suites.simulations[0], maxTurns: 2 }));
  assert.throws(() => assertResult(false, true));
  assert.throws(() => assertResult({ ok: true }, { ok: false }));
});
for (const entry of suites.evals) {
  const calls = flatten(entry.expectedCall);
  const registrationRequired = calls.some(request => ['enable_widget_engraving', 'disable_widget_engraving', 'engrave_widget']
    .includes(request.functionName));
  test(`concrete fixture callback replay: ${entry.name}`, {
    skip: registrationRequired ? 'Requires a real native registry; run browser/smoke, not a shim.' : false
  }, async () => {
    const store = new WidgetStore();
    const runtime = createRuntime(store);
    const checkoutIds = [];
    for (const request of calls) {
      const result = await runtime.invoke(request.functionName, request.arguments);
      assertResult(request.result, result);
      if (request.functionName === 'place_widget_order') checkoutIds.push(result.order.id);
    }
    if (checkoutIds.length) {
      assert.equal(checkoutIds.length, 2);
      assert.equal(checkoutIds[0], checkoutIds[1]);
      assert.equal(store.orders.length, 1);
    }
  });
}
test('shopping trajectory uses five distinct successful tools and never checks out', () => {
  const entry = suites.evals.find(entry => entry.name.startsWith('[WW-02-'));
  const calls = flatten(entry.expectedCall).filter(request => !request.optional);
  assert(new Set(calls.map(request => request.functionName)).size >= 5);
  assert(!calls.some(request => request.functionName === 'place_widget_order'));
  for (const request of calls) assert.equal(request.result.ok, true);
  assert.equal(calls.at(-1).result.cart.totalCents, 3920);
});
