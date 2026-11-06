# Scenario/spec coverage and evidence

Specification consulted **2026-11-05**. Generated schema/tool mapping:
[coverage.json](../../../../tests/agent-tool-handling/coverage.json).
Fixture/setup: [README](../../../../tests/agent-tool-handling/README.md).

## Execution matrix

Every external-agent verdict initially remains **MANUAL/NOT RUN**. Node unit/static
checks do not change that verdict. Record native probe results from the actual
browser separately; unsupported API is **UNSUPPORTED**, missing T/second host is
**BLOCKED**. Use downloaded native JSON and exported page logs as evidence.

| Cases | Surface / distinct branches | Execution |
|---|---|---|
| 01–02 | Immediate/delayed results, five distinct tools, exact 3920-cent cart | Agent; native `store`; domain tests |
| 03–04, 12, 14 | Throw, reject, domain failure, bounded transient retry | Agent; native `execution`; domain tests |
| 05–08 | Never resolve, caller timeout, interruption, late ignored result | Actual external agent + timed driver |
| 09–10 | Register during call, next-prompt discovery, unregister/self-unregister, in-flight persistence | Agent; native `store`, `registration`, `lifetime` |
| 11 | Full document navigation, destination tools, storage, return/bfcache observation | Agent; native `frames`; manual bfcache |
| 13 | Explicit simulated consent, revision conflicts, idempotency | Agent; domain tests |
| 15–18 | Completion ordering, abort vs local reset, no late mutation, stock/cart conflict | Agent; native `lifetime`; domain tests |
| 19–20 | Clarification, schema bounds, nested arrays, unknown fields, Unicode | Agent; domain tests |
| 21–23 | Null/false/empty/large output, serialization, schema mismatch, trust boundary | Agent; native `execution`; domain tests |
| 24 | Readiness, duplicate, 128/129 name, required members, schema serialization/deep copy, signals | Native `registration`; isolated-watchdog `reentrant` |
| 25 | Default object, nested/non-object input, serialization/parse paths, no callback before failure | Native `execution` |
| 26 | Pre-abort, mid-abort, post-settlement abort, races, lifecycle events, caller/target destruction, inactive context | Native `lifetime` |
| 27 | Same-name tools in separate windows, sort/filter, frame removal/navigation | Native `frames` |
| 28 | Secure context, denied/default policy, invalid origins, public/private cross-origin exposure | Native `permissions`; optional `cross-origin` |

## Exact spec references

- [Document / secure context](https://webmachinelearning.github.io/webmcp/#document-extension): 28.
- [ModelContext algorithms](https://webmachinelearning.github.io/webmcp/#model-context-container): 01–18, 24–28.
- [Schema serialization](https://webmachinelearning.github.io/webmcp/#serialize-a-tool-schema): 24.
- [Invoke callback / JSON input and output](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback): 03–04, 12, 21–22, 25.
- [Registration lifetime](https://webmachinelearning.github.io/webmcp/#model-context-register-tool-options): 09–10, 24.
- [Unregister algorithm](https://webmachinelearning.github.io/webmcp/#model-context-unregister-a-tool): 10, 24, 26.
- [Pending executions, cancellation and unload](https://webmachinelearning.github.io/webmcp/#pending-tool-executions): 05–08, 11, 16, 26.
- [Events](https://webmachinelearning.github.io/webmcp/#events): 09–10, 26–27.
- [Tool dictionaries and annotations](https://webmachinelearning.github.io/webmcp/#model-context-tool): 13, 20–24.
- [Permissions policy](https://webmachinelearning.github.io/webmcp/#permissions-policy): 28.
- [Browser-agent observations](https://webmachinelearning.github.io/webmcp/#observations): 09–11, 27–28.
- [Security/privacy](https://webmachinelearning.github.io/webmcp/#security-privacy): 13, 19, 23, 28.

## Limits and unordered branches

- Agent UX (failure notice, time budget, new-turn priority, retries) is a product
  expectation, not a normative browser algorithm.
- An unregister/re-register race can target old/new definitions depending on
  scheduling. The runner checks stable replacement, not an invented race winner.
  To inspect the unordered branch, retain a descriptor, start a call while
  aborting/re-registering under the same name, and record which definition ran.
  Either supported draft outcome is evidence, not a universal ordering rule.
- The frame-removal probe forces destruction. Full tab navigation can enter
  bfcache; record `pagehide.persisted` and observe Back/Forward manually in 11.
  Reliable inactive queued execution while a document is in bfcache needs browser
  lifecycle control not supplied by this static page: **BLOCKED** until available.
- Cross-origin tests need a second local host/port with identical prefix files.
  Arbitrary response-header policy variants need a suitable host, not a fake meta
  tag. These are **BLOCKED** on single-origin GitHub Pages alone.
- Native `getTools()` filtering is not the browser-agent observation mechanism.
  Test browser-agent tool exposure directly with the actual product; do not infer
  privacy guarantees from only the in-page list.
- Required schema dictionary conversion, stringify errors, reentrant duplicate/
  inactive guards and snapshot isolation have executable native probes. Full
  JSON Schema enforcement is not invented where the draft leaves it to agents.

For each run, record: date, URL, browser/agent build and flags, spec date,
session/generation, T/delays, fixture verdict, native verdict, agent verdict,
probe JSON/transcript/log evidence, limitations and cleanup completion.

## Optional upstream-compatible JSON suites

The [JSON eval guide](../../../../tests/agent-tool-handling/evals/README.md)
documents nine [tool trajectories](../../../../tests/agent-tool-handling/evals/evals.json)
and fifteen [conversation simulations](../../../../tests/agent-tool-handling/evals/simulations.json),
with case-to-scenario mappings in the generated manifest.
They cover selected agent-level branches of 01-04, 09-10, 12-14 and 19-23.
They do not replace these Markdown scenarios or change any verdict automatically.

Same-turn discovery is only partial coverage of 09; 10 omits stale/in-flight
lifetimes; 19 uses a model-driven user, not fixed scripted turns; 21 uses
normalized values; 22 judges mismatch interpretation, not native enforcement or
circular/BigInt failures. Cases 05-08, 11, 15-18 and 24-28 remain timed/manual/native.
Smoke ignores `result` expectations and does not recognize `{ok:false}` itself;
use browser result matching or simulation state/transcript checks as appropriate.

## Implementation checkpoint: 2026-11-05

The fixture README's
[verification section](../../../../tests/agent-tool-handling/README.md#implementation-verification-2026-11-05)
records actual execution results:

- Fixture/domain/static checks: 18 PASS; unsupported-browser UI flow, exact
  totals, authorization, navigation continuity, keyboard and mobile checks PASS.
- Native Edge 156.0.4314.58 with WebMCP enabled, two loopback origins: 36 PASS,
  18 FAIL, 2 BLOCKED in the final bounded suite. Browser/draft differences are
  preserved, especially output schemas, specific exception names and result
  serialization. Native failures do not imply the external agent was tested.
- Reentrant duplicate-schema case: isolated external watchdog expired after
  15 seconds (native hang/failure); detach-owner variant NOT RUN afterward.
- All agent conversation scenarios: MANUAL/NOT RUN. Native `store` success does
  not promote cases 02 or 09 to an agent PASS. Unknown external T remains BLOCKED.
