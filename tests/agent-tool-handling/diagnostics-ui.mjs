// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { runDiagnostics } from './diagnostics.mjs';
let results = [];
document.querySelector('#run').addEventListener('click', async () => {
  const button = document.querySelector('#run');
  button.disabled = true;
  document.querySelector('#results').textContent = '';
  document.querySelector('#status').textContent = 'Running bounded native probes...';
  try {
    results = await runDiagnostics({
      group: document.querySelector('#group').value,
      secondOrigin: document.querySelector('#second-origin').value,
      onResult(result) {
        document.querySelector('#results').textContent += `${JSON.stringify(result)}\n`;
      }
    });
    const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'UNSUPPORTED'].map(status => [status, results.filter(result => result.status === status).length]));
    document.querySelector('#status').textContent = JSON.stringify(counts);
  } catch (error) {
    document.querySelector('#status').textContent = `Diagnostic runner error: ${error.message}`;
    console.error('Widget diagnostics failed', error);
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'widget-native-results.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
globalThis.widgetDiagnostics = { run: runDiagnostics };
