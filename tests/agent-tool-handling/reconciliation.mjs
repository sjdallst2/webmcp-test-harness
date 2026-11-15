import { requireCondition, validateInput } from './store.mjs';

const emptyInput = { type: 'object', additionalProperties: false, properties: {}, required: [] };
const incrementInput = {
  type: 'object', additionalProperties: false,
  properties: { operationId: { type: 'string', minLength: 1, maxLength: 80 } },
  required: ['operationId']
};

export function createReconciliationCounter(changed = () => {}) {
  const runId = crypto.randomUUID();
  const executions = [];
  const snapshot = () => ({
    runId, count: executions.length,
    executions: executions.map(entry => ({ ...entry }))
  });
  return {
    read(input) {
      validateInput(input, emptyInput);
      return snapshot();
    },
    increment(input) {
      validateInput(input, incrementInput);
      requireCondition(executions.length < 100, 'COUNTER_LIMIT', 'This document reached its 100-execution limit.');
      executions.push({ sequence: executions.length + 1, operationId: input.operationId });
      changed(snapshot());
      return snapshot();
    }
  };
}

export async function registerReconciliationTools(modelContext, counter) {
  const lifetime = new AbortController();
  try {
    await modelContext.registerTool({
      name: 'increment_reconciliation_counter',
      description: 'TEST ONLY: increment a document-local counter once. No purchase, payment or network write. Repeating an operationId increments again; it is a label, NOT an idempotency key. Read the counter before considering a retry after an uncertain result.',
      inputSchema: incrementInput,
      annotations: { readOnlyHint: false, consequentialHint: false },
      execute: input => counter.increment(input)
    }, { signal: lifetime.signal });
    await modelContext.registerTool({
      name: 'read_reconciliation_counter',
      description: 'Read this test document runId, counter and execution labels without changing anything. A reload starts a new runId at zero; compare runId before interpreting counts.',
      inputSchema: emptyInput,
      annotations: { readOnlyHint: true },
      execute: input => counter.read(input)
    }, { signal: lifetime.signal });
  } catch (error) {
    lifetime.abort();
    throw error;
  }
}

if (typeof document !== 'undefined') {
  const status = document.getElementById('reconciliation-status');
  const render = state => {
    document.getElementById('reconciliation-run').textContent = state.runId;
    document.getElementById('reconciliation-count').textContent = String(state.count);
    document.getElementById('reconciliation-state').textContent = JSON.stringify(state, null, 2);
  };
  const counter = createReconciliationCounter(render);
  render(counter.read({}));
  if (typeof document.modelContext?.registerTool !== 'function') {
    status.textContent = 'UNSUPPORTED: native document.modelContext.registerTool is unavailable. No shim installed.';
  } else {
    void registerReconciliationTools(document.modelContext, counter).then(() => {
      status.textContent = 'READY: both native reconciliation tools registered.';
    }).catch(error => {
      status.textContent = `ERROR: native registration failed (${error.name}: ${error.message}).`;
      console.error('Reconciliation fixture registration failed', error);
    });
  }
}
