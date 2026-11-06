// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
export const products = Object.freeze([
  Object.freeze({ id: 'robot-widget', name: 'Robot Widget', emoji: '🤖', priceCents: 1200, stock: 10 }),
  Object.freeze({ id: 'gear-widget', name: 'Gear Widget', emoji: '⚙️', priceCents: 350, stock: 20 }),
  Object.freeze({ id: 'screw-widget', name: 'Screw Widget', emoji: '🔩', priceCents: 25, stock: 100 }),
  Object.freeze({ id: 'sold-out-widget', name: 'Limited Widget', emoji: '🧰', priceCents: 500, stock: 0 })
]);
export const shippingPrices = Object.freeze({ standard: 500, express: 1000 });
export const storageKey = 'widget-works:store:v1';

export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function requireCondition(condition, code, message) {
  if (!condition) throw new DomainError(code, message);
}

export function domainResult(operation) {
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return { ok: false, code: error.code, message: error.message };
  }
}

// Only the documented schema subset is used here; this is not a JSON Schema engine.
export function validateInput(value, schema, path = 'input') {
  const validType = schema.type === 'object'
    ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'integer' ? Number.isSafeInteger(value) : typeof value === schema.type;
  requireCondition(validType, 'INVALID_INPUT', `${path} must be ${schema.type}.`);
  if (schema.enum) requireCondition(schema.enum.includes(value), 'INVALID_INPUT', `${path} must be one of ${schema.enum.join(', ')}.`);
  if (schema.type === 'object') {
    for (const key of schema.required ?? []) {
      requireCondition(Object.hasOwn(value, key), 'INVALID_INPUT', `${path}.${key} is required.`);
    }
    for (const key of Object.keys(value)) {
      requireCondition(Object.hasOwn(schema.properties, key), 'INVALID_INPUT', `${path}.${key} is not allowed.`);
      validateInput(value[key], schema.properties[key], `${path}.${key}`);
    }
  }
  if (schema.type === 'string') {
    requireCondition(value.trim().length > 0, 'INVALID_INPUT', `${path} cannot be blank.`);
    const length = Array.from(value).length;
    requireCondition(length >= (schema.minLength ?? 1) && length <= (schema.maxLength ?? 200),
      'INVALID_INPUT', `${path} has an invalid length.`);
  }
  if (schema.type === 'integer') {
    requireCondition(value >= (schema.minimum ?? 0) && value <= (schema.maximum ?? Number.MAX_SAFE_INTEGER),
      'INVALID_INPUT', `${path} is out of range.`);
  }
  if (schema.type === 'array') {
    requireCondition(value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 20),
      'INVALID_INPUT', `${path} has an invalid number of entries.`);
    value.forEach((item, index) => validateInput(item, schema.items, `${path}[${index}]`));
  }
}

export class WidgetStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.sessionId = crypto.randomUUID();
    this.generation = (this.generation ?? 0) + 1;
    this.revision = 0;
    this.stock = Object.fromEntries(products.map(product => [product.id, product.stock]));
    this.lines = [];
    this.coupon = null;
    this.shipping = 'standard';
    this.orders = [];
    this.reservations = [];
    this.idempotency = [];
  }

  product(productId) {
    const product = products.find(candidate => candidate.id === productId);
    requireCondition(product, 'UNKNOWN_WIDGET', `Unknown widget: ${productId}.`);
    return product;
  }

  available(productId) {
    this.product(productId);
    return this.stock[productId] - this.reservations
      .filter(reservation => reservation.productId === productId && reservation.status === 'held')
      .reduce((sum, reservation) => sum + reservation.quantity, 0);
  }

  catalog() {
    return {
      ok: true, currency: 'USD',
      products: products.map(product => ({ ...product, stock: this.stock[product.id], available: this.available(product.id) })),
      rules: { maxQuantity: 100, coupon: 'WIDGET10', discount: 'floor(subtotalCents / 10)', taxCents: 0, shippingPrices }
    };
  }

  cart() {
    const lines = this.lines.map(line => ({
      ...structuredClone(line), name: this.product(line.productId).name,
      unitPriceCents: this.product(line.productId).priceCents,
      totalCents: this.product(line.productId).priceCents * line.quantity
    }));
    const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
    const discountCents = this.coupon === 'WIDGET10' ? Math.floor(subtotalCents / 10) : 0;
    const shippingCents = lines.length ? shippingPrices[this.shipping] : 0;
    return {
      ok: true, revision: this.revision, lines, coupon: this.coupon, shipping: this.shipping,
      subtotalCents, discountCents, shippingCents, taxCents: 0,
      totalCents: subtotalCents - discountCents + shippingCents, currency: 'USD'
    };
  }

  add(productId, quantity) {
    this.product(productId);
    requireCondition(Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 100,
      'INVALID_QUANTITY', 'Add quantity must be an integer from 1 to 100.');
    const line = this.lines.find(candidate => candidate.productId === productId);
    return this.setQuantity(productId, (line?.quantity ?? 0) + quantity);
  }

  setQuantity(productId, quantity) {
    this.product(productId);
    requireCondition(Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 100,
      'INVALID_QUANTITY', 'Quantity must be an integer from 0 to 100; 0 removes the line.');
    requireCondition(quantity <= this.available(productId), 'OUT_OF_STOCK', 'Not enough available widget stock.');
    const index = this.lines.findIndex(line => line.productId === productId);
    if (quantity === 0) {
      if (index >= 0) this.lines.splice(index, 1);
    } else if (index >= 0) {
      this.lines[index].quantity = quantity;
    } else {
      this.lines.push({ productId, quantity });
    }
    this.revision++;
    return this.cart();
  }

  applyCoupon(code) {
    requireCondition(code === 'WIDGET10', 'INVALID_COUPON', 'Only WIDGET10 is valid; coupon codes are case-sensitive.');
    this.coupon = code;
    this.revision++;
    return this.cart();
  }

  selectShipping(method) {
    requireCondition(Object.hasOwn(shippingPrices, method), 'INVALID_SHIPPING', 'Choose standard or express shipping.');
    if (method !== this.shipping) {
      this.shipping = method;
      this.revision++;
    }
    return this.cart();
  }

  engrave(productId, engraving) {
    validateInput(engraving, engravingSchema);
    const line = this.lines.find(candidate => candidate.productId === productId);
    requireCondition(line && productId === 'robot-widget', 'INELIGIBLE_WIDGET', 'Add a Robot Widget to the cart first.');
    line.engraving = structuredClone(engraving);
    this.revision++;
    return this.cart();
  }

  reserve(productId, quantity) {
    this.product(productId);
    requireCondition(Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 100, 'INVALID_QUANTITY', 'Reservation quantity must be 1 to 100.');
    requireCondition(quantity <= this.available(productId), 'OUT_OF_STOCK', 'Not enough available stock for a reservation.');
    const reservation = { id: crypto.randomUUID(), productId, quantity, status: 'held' };
    this.reservations.push(reservation);
    return { ok: true, reservation: structuredClone(reservation) };
  }

  release(reservationId) {
    const reservation = this.reservations.find(candidate => candidate.id === reservationId);
    requireCondition(reservation, 'UNKNOWN_RESERVATION', 'Unknown widget reservation.');
    const alreadyReleased = reservation.status === 'released';
    reservation.status = 'released';
    return { ok: true, alreadyReleased, reservation: structuredClone(reservation) };
  }

  checkout({ confirmPurchase, idempotencyKey, expectedRevision }) {
    requireCondition(confirmPurchase === true, 'AUTHORIZATION_REQUIRED', 'Explicit simulated-purchase confirmation is required.');
    requireCondition(typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0 && idempotencyKey.length <= 80,
      'INVALID_INPUT', 'A nonblank idempotency key of at most 80 characters is required.');
    const previous = this.idempotency.find(entry => entry.key === idempotencyKey);
    if (previous) {
      requireCondition(previous.revision === expectedRevision, 'IDEMPOTENCY_CONFLICT', 'This key was used with a different cart revision.');
      return { ok: true, repeated: true, order: structuredClone(previous.order) };
    }
    requireCondition(expectedRevision === this.revision, 'STALE_CART', 'Read the cart again; its revision changed.');
    requireCondition(this.lines.length > 0, 'EMPTY_CART', 'Add widgets before placing an order.');
    for (const line of this.lines) {
      requireCondition(line.quantity <= this.available(line.productId), 'OUT_OF_STOCK', 'Stock changed. Release reservations or update the cart.');
    }
    const cart = this.cart();
    const order = { ...cart, id: crypto.randomUUID(), status: 'simulated-confirmed', simulated: true };
    for (const line of this.lines) this.stock[line.productId] -= line.quantity;
    this.orders.push(order);
    this.idempotency.push({ key: idempotencyKey, revision: expectedRevision, order: structuredClone(order) });
    this.lines = [];
    this.coupon = null;
    this.revision++;
    return { ok: true, repeated: false, order: structuredClone(order) };
  }

  order(orderId) {
    const order = orderId ? this.orders.find(candidate => candidate.id === orderId) : this.orders.at(-1);
    requireCondition(order, 'UNKNOWN_ORDER', 'No matching simulated widget order.');
    return { ok: true, order: structuredClone(order) };
  }

  snapshot() {
    return structuredClone({
      version: 1, sessionId: this.sessionId, generation: this.generation, revision: this.revision,
      stock: this.stock, lines: this.lines, coupon: this.coupon, shipping: this.shipping,
      orders: this.orders, reservations: this.reservations, idempotency: this.idempotency
    });
  }

  restore(snapshot) {
    requireCondition(snapshot?.version === 1 && typeof snapshot.sessionId === 'string' &&
      Number.isSafeInteger(snapshot.generation) && snapshot.generation > 0 &&
      Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0 &&
      Array.isArray(snapshot.lines) && Array.isArray(snapshot.orders) && Array.isArray(snapshot.reservations) &&
      Array.isArray(snapshot.idempotency) && snapshot.stock && typeof snapshot.stock === 'object',
    'CORRUPT_STORAGE', 'Saved widget state is invalid. Reset the test store.');
    requireCondition(Object.hasOwn(shippingPrices, snapshot.shipping) && [null, 'WIDGET10'].includes(snapshot.coupon),
      'CORRUPT_STORAGE', 'Saved widget settings are invalid.');
    for (const product of products) {
      requireCondition(Number.isSafeInteger(snapshot.stock[product.id]) && snapshot.stock[product.id] >= 0 &&
        snapshot.stock[product.id] <= product.stock, 'CORRUPT_STORAGE', 'Saved stock is invalid.');
    }
    const identifiers = new Set();
    for (const line of snapshot.lines) {
      this.product(line.productId);
      requireCondition(!identifiers.has(line.productId) && Number.isSafeInteger(line.quantity) &&
        line.quantity >= 1 && line.quantity <= 100, 'CORRUPT_STORAGE', 'Saved cart line is invalid.');
      identifiers.add(line.productId);
      if (line.engraving) validateInput(line.engraving, engravingSchema);
    }
    for (const reservation of snapshot.reservations) {
      this.product(reservation.productId);
      requireCondition(typeof reservation.id === 'string' && ['held', 'released'].includes(reservation.status) &&
        Number.isSafeInteger(reservation.quantity) && reservation.quantity > 0 && reservation.quantity <= 100,
      'CORRUPT_STORAGE', 'Saved reservation is invalid.');
    }
    const orderIds = new Set();
    for (const order of snapshot.orders) {
      requireCondition(typeof order.id === 'string' && order.simulated === true && order.status === 'simulated-confirmed' &&
        !orderIds.has(order.id) && Array.isArray(order.lines) && order.lines.length > 0 &&
        Number.isSafeInteger(order.revision) && order.revision >= 0 && order.currency === 'USD',
      'CORRUPT_STORAGE', 'Saved order is invalid.');
      orderIds.add(order.id);
      const expectedOrder = new WidgetStore();
      const lineIds = new Set();
      for (const line of order.lines) {
        requireCondition(!lineIds.has(line.productId) && line.quantity > 0, 'CORRUPT_STORAGE', 'Saved order line is invalid.');
        lineIds.add(line.productId);
        expectedOrder.setQuantity(line.productId, line.quantity);
        if (line.engraving) expectedOrder.engrave(line.productId, line.engraving);
      }
      expectedOrder.selectShipping(order.shipping);
      if (order.coupon !== null) expectedOrder.applyCoupon(order.coupon);
      const expected = expectedOrder.cart();
      for (const key of ['subtotalCents', 'discountCents', 'shippingCents', 'taxCents', 'totalCents']) {
        requireCondition(order[key] === expected[key], 'CORRUPT_STORAGE', 'Saved order totals are invalid.');
      }
    }
    for (const product of products) {
      const sold = snapshot.orders.flatMap(order => order.lines)
        .filter(line => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
      const held = snapshot.reservations.filter(reservation => reservation.productId === product.id && reservation.status === 'held')
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
      requireCondition(snapshot.stock[product.id] === product.stock - sold && held <= snapshot.stock[product.id],
        'CORRUPT_STORAGE', 'Saved inventory does not match orders and reservations.');
    }
    const idempotencyKeys = new Set();
    for (const entry of snapshot.idempotency) {
      requireCondition(typeof entry.key === 'string' && entry.key.trim().length > 0 && entry.key.length <= 80 &&
        !idempotencyKeys.has(entry.key) && Number.isSafeInteger(entry.revision) &&
        snapshot.orders.some(order => order.id === entry.order?.id && order.revision === entry.revision &&
          JSON.stringify(order) === JSON.stringify(entry.order)), 'CORRUPT_STORAGE', 'Saved idempotency entry is invalid.');
      idempotencyKeys.add(entry.key);
    }
    const copy = structuredClone(snapshot);
    for (const key of ['sessionId', 'generation', 'revision', 'stock', 'lines', 'coupon', 'shipping', 'orders', 'reservations', 'idempotency']) {
      this[key] = copy[key];
    }
  }
}

export const engravingSchema = {
  type: 'object', additionalProperties: false, required: ['text'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 40 },
    style: { type: 'string', enum: ['plain', 'bold'] },
    tags: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 12 } }
  }
};

export function waitForWidget(delayMs, signal, ignoreAbort = false) {
  return new Promise((resolve, reject) => {
    let timer;
    const aborted = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Widget execution aborted.', 'AbortError'));
    };
    if (!ignoreAbort && signal?.aborted) {
      aborted();
      return;
    }
    if (!ignoreAbort) signal?.addEventListener('abort', aborted, { once: true });
    if (delayMs !== null) {
      timer = setTimeout(() => {
        signal?.removeEventListener('abort', aborted);
        resolve();
      }, delayMs);
    }
  });
}
