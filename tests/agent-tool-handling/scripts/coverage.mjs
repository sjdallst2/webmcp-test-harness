// Copyright (c) Microsoft Corporation. Licensed under the MIT License.
import { readFile, writeFile } from 'node:fs/promises';
import { toolDefinitions, scenarioFiles, specDate } from '../tools.mjs';
const agentSuites = Object.fromEntries(await Promise.all(['evals', 'simulations'].map(async name => {
  const file = `evals/${name}.json`;
  const cases = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  return [name, {
    file, cases: cases.map(entry => {
      const match = /^\[WW-(\d{2})-[a-z0-9-]+\] /.exec(entry.name);
      if (!match || !scenarioFiles[match[1]]) throw new Error(`Unknown scenario in agent case: ${entry.name}`);
      return { name: entry.name, scenarioId: match[1] };
    })
  }];
})));
export const coverage = {
  specification: 'https://webmachinelearning.github.io/webmcp/', consulted: specDate,
  tools: toolDefinitions, scenarios: scenarioFiles,
  probes: {
    registration: ['24', '26'], reentrant: ['24'], execution: ['21', '22', '25'], lifetime: ['10', '16', '26'],
    frames: ['11', '27'], permissions: ['28'], store: ['02', '09', '10'], 'cross-origin': ['28']
  },
  agentEvals: {
    format: 'GoogleChromeLabs/webmcp-tools/webmcp-evals',
    reviewedRevision: 'fe69ca43dc84966995f803431e35d8fa2748081c',
    suites: agentSuites,
    scope: 'Selected agent-level branches only. See evals/README.md; a mapped scenario is not fully covered or a PASS.'
  },
  verdicts: {
    externalAgent: 'MANUAL/NOT RUN until the actual agent product and driver execute each scenario.',
    nativeAPI: 'Run diagnostics.html in the target browser; API presence alone is not a pass.',
    crossOrigin: 'BLOCKED until a second trustworthy static origin is provided.',
    bfcache: 'MANUAL/NOT RUN; pagehide.persisted is not unload.'
  }
};
if (process.argv.includes('--write')) {
  await writeFile(new URL('../coverage.json', import.meta.url), `${JSON.stringify(coverage, null, 2)}\n`);
}
