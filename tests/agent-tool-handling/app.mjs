// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { WidgetStore, storageKey, domainResult } from './store.mjs';
import { createRuntime } from './runtime.mjs';

const store = new WidgetStore();
const destination = document.body.dataset.page === 'destination';
const select = selector => document.querySelector(selector);
const money = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
let paintQueued = false;
let storageFailed = false;
let storageError;
let renderedStore = '';
let renderedPresets = '';
let renderedSession = store.sessionId;
try {
  const saved = sessionStorage.getItem(storageKey);
  if (saved) store.restore(JSON.parse(saved));
} catch (error) {
  storageError = error;
}

function message(text, error = false) {
  select('#message').textContent = text;
  select('#message').className = error ? 'error' : '';
}
function persist() {
  if (storageFailed) return false;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(store.snapshot()));
    return true;
  } catch (error) {
    storageFailed = true;
    runtime.record('storage-error', error);
    message('Session storage is unavailable. Navigation continuity is BLOCKED; the current store still works.', true);
    return false;
  }
}
function schedulePaint() {
  if (paintQueued) return;
  paintQueued = true;
  queueMicrotask(() => { paintQueued = false; paint(); });
}
const runtime = createRuntime(store, {
  modelContext: document.modelContext, destination, changed: schedulePaint,
  environment: { secureContext: isSecureContext, origin: location.origin, document: destination ? 'order-status' : 'storefront' },
  navigate: path => {
    if (!persist()) throw new Error('Navigation cancelled: could not preserve synthetic widget order state.');
    location.assign(new URL(path, location.href));
  }
});

function operate(operation, success = 'Widget store updated.') {
  try {
    const result = domainResult(operation);
    if (result?.ok === false) message(`${result.code}: ${result.message}`, true);
    else message(success);
    persist();
    paint();
    return result;
  } catch (error) {
    runtime.record('ui-error', error);
    console.error('Widget UI operation failed', error);
    message(error.message, true);
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action) {
  const node = element('button', text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function paintStore() {
  const signature = JSON.stringify(store.snapshot());
  if (renderedStore === signature) return;
  renderedStore = signature;
  const focusKey = document.activeElement?.dataset.focus;
  const cart = store.cart();
  const state = select('#store-state');
  if (state) {
    const heldReservations = store.reservations.filter(reservation => reservation.status === 'held').length;
    state.textContent = `Cart revision ${cart.revision}. Simulated orders: ${store.orders.length}. Held reservations: ${heldReservations}.`;
    Object.assign(state.dataset, {
      cartRevision: String(cart.revision), coupon: cart.coupon ?? '',
      orderCount: String(store.orders.length), heldReservationCount: String(heldReservations),
      lastOrderTotalCents: store.orders.length ? String(store.orders.at(-1).totalCents) : ''
    });
  }
  const catalog = select('#catalog');
  if (catalog) {
    catalog.replaceChildren(...store.catalog().products.map(product => {
      const card = element('article', undefined, 'product');
      card.dataset.productId = product.id;
      card.dataset.available = String(product.available);
      const emoji = element('div', product.emoji, 'emoji');
      emoji.setAttribute('aria-hidden', 'true');
      const add = button('Add one to cart', () => operate(() => store.add(product.id, 1), `${product.name} added.`));
      add.disabled = product.available === 0;
      add.setAttribute('aria-label', `Add one ${product.name} to cart`);
      add.dataset.focus = `add-${product.id}`;
      card.append(emoji, element('h3', product.name), element('p', `${money(product.priceCents)} · ${product.available} available`), add);
      return card;
    }));
    const lines = select('#cart-lines');
    lines.replaceChildren();
    if (!cart.lines.length) lines.append(element('p', 'Your cart is waiting for its first widget.'));
    for (const line of cart.lines) {
      const row = element('div', undefined, 'cart-line');
      row.dataset.productId = line.productId;
      row.dataset.quantity = String(line.quantity);
      if (line.engraving) row.dataset.engraving = line.engraving.text;
      const label = element('label', `${line.name} quantity `);
      const input = element('input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.value = line.quantity;
      input.dataset.focus = `quantity-${line.productId}`;
      label.append(input);
      const update = button('Update', () => operate(() => store.setQuantity(line.productId, Number(input.value))));
      update.dataset.focus = `update-${line.productId}`;
      update.setAttribute('aria-label', `Update ${line.name} quantity`);
      const remove = button('Remove', () => operate(() => store.setQuantity(line.productId, 0)));
      remove.dataset.focus = `remove-${line.productId}`;
      remove.setAttribute('aria-label', `Remove ${line.name} from cart`);
      row.append(label, element('span', money(line.totalCents)), update, remove);
      if (line.engraving) row.append(element('p', `Engraving: ${line.engraving.text}`));
      lines.append(row);
    }
    select('#shipping').value = cart.shipping;
    const totals = select('#totals');
    totals.replaceChildren(...[
      ['Subtotal', cart.subtotalCents, 'subtotalCents'], ['Discount', -cart.discountCents, 'discountCents'],
      ['Shipping', cart.shippingCents, 'shippingCents'], ['Tax (fixture)', 0, 'taxCents'], ['Total', cart.totalCents, 'totalCents']
    ].map(([label, cents, field]) => {
      const row = element('p', undefined, label === 'Total' ? 'totals total' : 'totals');
      row.dataset.total = field;
      row.append(element('span', label), element('span', money(cents)));
      return row;
    }));
    totals.append(element('small', `Cart revision ${cart.revision}. Coupon: ${cart.coupon ?? 'none'}.`));
    select('#confirm').checked = false;
  }
  const status = select('#order-status');
  if (status) {
    const result = domainResult(() => store.order());
    status.textContent = result.ok ? JSON.stringify(result.order, null, 2) : result.message;
  }
  if (focusKey) {
    const target = document.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`) ?? select('#cart-heading');
    if (target.tabIndex < 0) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
}
function paint() {
  paintStore();
  if (select('#presets')) {
    const signature = JSON.stringify(runtime.presets);
    if (renderedPresets !== signature) {
      for (const [key, value] of Object.entries(runtime.presets)) select('#presets').elements.namedItem(key).value = value;
      renderedPresets = signature;
    }
    if (renderedSession !== store.sessionId) {
      select('#agent-timeout').value = '';
      select('#confirm').checked = false;
      renderedSession = store.sessionId;
    }
  }
  const failures = runtime.log.filter(entry => entry.event === 'registration-error');
  select('#capabilities').textContent = runtime.capabilities.nativeAPI
    ? `Native API present. ${runtime.registrations.size} registration(s); ${failures.length} registration error(s). ${runtime.capabilities.outputSchemaExposed === false ? 'Current-draft outputSchema metadata is not exposed by this browser. ' : ''}${runtime.capabilities.discoveryError ? `Discovery failed: ${runtime.capabilities.discoveryError}. ` : ''}Signature and behavior require diagnostics; API presence is not conformance.`
    : 'Native agent tests UNSUPPORTED: document.modelContext or its current methods are unavailable. Enable WebMCP in a supported browser. The storefront UI still works; no shim is installed.';
  if (!select('#events')) return;
  select('#capability-details').textContent = JSON.stringify(runtime.capabilities, null, 2);
  select('#tools').replaceChildren(...[...runtime.registrations].map(([name, entry]) => {
    const row = element('li', `${name}: ${entry.status}`);
    row.dataset.toolName = name;
    return row;
  }));
  if (!runtime.registrations.size) select('#tools').append(element('li', 'No native tools registered.'));
  select('#active').replaceChildren(...[...runtime.active.values()].map(invocation =>
    element('li', `${invocation.tool} · ${invocation.id} · ${invocation.sessionId === store.sessionId ? 'current' : 'old session'} · running`)));
  if (!runtime.active.size) select('#active').append(element('li', 'No active callbacks.'));
  select('#events').textContent = runtime.log.map(entry => JSON.stringify(entry)).join('\n');
}

select('#coupon-form')?.addEventListener('submit', event => {
  event.preventDefault();
  operate(() => store.applyCoupon(new FormData(event.currentTarget).get('code')));
});
select('#shipping')?.addEventListener('change', event => operate(() => store.selectShipping(event.target.value)));
select('#checkout')?.addEventListener('click', () => {
  const result = operate(() => store.checkout({
    confirmPurchase: select('#confirm').checked, idempotencyKey: crypto.randomUUID(), expectedRevision: store.revision
  }), 'Simulated order placed. No real charge.');
  if (result?.ok) select('#confirm').checked = false;
});
select('#reset')?.addEventListener('click', async () => {
  try {
    await runtime.reset();
    if (select('#presets')) {
      for (const [key, value] of Object.entries(runtime.presets)) select('#presets').elements.namedItem(key).value = value;
      select('#agent-timeout').value = '';
      select('#confirm').checked = false;
    }
    persist();
    message('Seed store restored. Old work invalidated; history retained under old session IDs.');
  } catch (error) {
    runtime.record('reset-error', error);
    message(`Reset could not restore native tools: ${error.message}`, true);
  }
});
select('#clear-log')?.addEventListener('click', () => runtime.clearLog());
select('#presets')?.addEventListener('submit', event => {
  event.preventDefault();
  operate(() => runtime.setPresets(Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, Number(value)]))));
});
select('#record-timeout')?.addEventListener('click', () => {
  const timeoutMs = Number(select('#agent-timeout').value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 299000) {
    message('Record a known external timeout T between 1 and 299000 ms. Unknown T means timeout cases are BLOCKED.', true);
    return;
  }
  operate(() => runtime.setPresets({ slow: 2 * timeoutMs + 2000 }), 'External timeout recorded; the page does not enforce it.');
  select('#presets').elements.namedItem('slow').value = 2 * timeoutMs + 2000;
  runtime.record('driver-timeout-record', { timeoutMs, note: 'Driver-provided budget, not measured by this site.' });
});
select('#export-log')?.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(runtime.log, null, 2)], { type: 'application/json' }));
  const link = element('a');
  link.href = url;
  link.download = 'widget-works-events.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
select('#copy-log')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(runtime.log, null, 2));
    message('Event log copied.');
  } catch (error) {
    runtime.record('clipboard-error', error);
    message('Clipboard unavailable. Use Download JSON log instead.', true);
  }
});
addEventListener('pagehide', event => {
  runtime.record('pagehide', { persisted: event.persisted, note: 'persisted=true means bfcache, not guaranteed unload.' });
  persist();
});
addEventListener('pageshow', event => runtime.record('pageshow', { persisted: event.persisted }));
if (storageError) {
  runtime.record('storage-restore-error', storageError);
  message('Saved state was corrupt or inaccessible. A fresh seed store is shown; reset before testing navigation.', true);
}
paint();
const ready = runtime.initialize().then(results => {
  if (results.some(result => result.status === 'rejected')) message('Some native registrations failed. Inspect the lab log; native tests are not ready.', true);
  return results;
});
// Exposed for the local test driver, not a substitute for native tool execution.
globalThis.widgetFixture = { store, runtime, ready };
