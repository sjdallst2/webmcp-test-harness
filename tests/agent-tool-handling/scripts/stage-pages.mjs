// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { cp, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const siteFiles = [
  'index.html', 'order-status.html', 'diagnostics.html', 'frame.html', 'styles.css',
  'app.mjs', 'store.mjs', 'tools.mjs', 'runtime.mjs', 'frame.mjs',
  'diagnostics.mjs', 'diagnostics-ui.mjs', 'coverage.json', 'README.md',
  'evals/README.md', 'evals/evals.json', 'evals/simulations.json'
];
export const rootFiles = ['index.html', 'LICENSE'];
const site = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));

export async function stagePages(directory) {
  const output = resolve(directory);
  // Refuse existing directories: staging never deletes or overwrites user data.
  await mkdir(output);
  for (const file of rootFiles) await cp(resolve(repository, file), resolve(output, file));
  const destination = resolve(output, 'tests', 'agent-tool-handling');
  await mkdir(destination, { recursive: true });
  for (const file of siteFiles) {
    await mkdir(dirname(resolve(destination, file)), { recursive: true });
    await cp(resolve(site, file), resolve(destination, file));
  }
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Provide a new output directory for Pages staging.');
  const output = resolve(process.argv[2]);
  await mkdir(dirname(output), { recursive: true });
  console.log(await stagePages(output));
}
