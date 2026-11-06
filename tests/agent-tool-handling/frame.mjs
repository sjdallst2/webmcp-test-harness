// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { waitForWidget } from './store.mjs';
const parameters = new URLSearchParams(location.search);
const supplier = parameters.get('supplier') ?? 'A';
const context = document.modelContext;
const events = [];
const controllers = [];
const callbacks = [];
let callerOutcome = 'not-started';
let calls = 0;
const report = message => {
  document.querySelector('#status').textContent = `Supplier ${supplier}: ${message}`;
};
const ready = (async () => {
  if (!context?.registerTool) { report('UNSUPPORTED: native API missing'); return { status: 'UNSUPPORTED' }; }
  for (const name of ['toolchange', 'toolactivated', 'toolcancel']) {
    context.addEventListener(name, event => events.push({ event: name, toolName: event.toolName }));
  }
  try {
    const exposedTo = parameters.has('exposedTo') ? [parameters.get('exposedTo')] : [];
    for (const name of ['supplier_widget_quote', 'private_supplier_widget_quote']) {
      const controller = new AbortController();
      controllers.push(controller);
      await context.registerTool({
        name, title: `Widget supplier ${supplier}`, description: `Synthetic widget supplier ${supplier}. Finite delayed read-only quote.`,
        annotations: { readOnlyHint: true, debugging: true },
        inputSchema: { type: 'object', properties: { delayMs: { type: 'integer', minimum: 0, maximum: 10000 } } },
        async execute(input, options) {
          const call = { id: ++calls, name, aborted: false, settled: false };
          callbacks.push(call);
          options.signal.addEventListener('abort', () => { call.aborted = true; }, { once: true });
          try {
            await waitForWidget(input.delayMs ?? 0, options.signal);
            return { supplier, priceCents: supplier === 'A' ? 350 : 375 };
          } finally {
            call.settled = true;
          }
        }
      }, { signal: controller.signal, exposedTo: name === 'supplier_widget_quote' ? exposedTo : [] });
    }
    report('native tools ready');
    return { status: 'READY' };
  } catch (error) {
    report(`${error.name}: ${error.message}`);
    return { status: 'ERROR', name: error.name, message: error.message };
  }
})();
globalThis.widgetFrame = {
  context, ready, events, callbacks, controllers,
  get callerOutcome() { return callerOutcome; },
  async startCaller(tool) {
    callerOutcome = 'pending';
    try {
      await context.executeTool(tool, { delayMs: 2000 });
      callerOutcome = 'fulfilled';
    } catch (error) {
      callerOutcome = error.name;
    }
  }
};
