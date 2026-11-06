# JSON agent evals

These are **additional automation**, not replacements for the 28 Markdown
scenarios or the native diagnostics. They use the
[GoogleChromeLabs webmcp-evals format](https://github.com/GoogleChromeLabs/webmcp-tools/tree/fe69ca43dc84966995f803431e35d8fa2748081c/webmcp-evals),
reviewed at revision `fe69ca43dc84966995f803431e35d8fa2748081c`.
The runner is external; the static site does not import it, install dependencies
or contact a model provider.

- [evals.json](./evals.json): nine successful tool trajectories, concrete inputs
  and result matchers. Strict tool choices/order are intentional; the two cart
  additions can run in either order. Extra reads are allowed only where marked
  optional. Use simulations when several valid plans should be accepted.
- [simulations.json](./simulations.json): fifteen goal/conversation cases, with
  final DOM assertions **and** transcript-based success criteria. Setup calls
  establish state before the agent joins; they never count as agent actions.
- [coverage.json](../coverage.json) derives the case-to-scenario mapping from
  names such as `[WW-02-shopping]`. These IDs refer to the unchanged Markdown
  scenario numbers. A mapping is not a full-coverage or passing verdict.

## Run from this repository

Serve the fixture using the [setup instructions](../README.md#run). Check native
registration readiness, then use an installed `webmcp-evals` CLI or a built
checkout of the upstream revision. The reviewed CLI defaults to Chrome Canary;
install a compatible WebMCP-enabled browser and select the appropriate upstream
`--chrome-channel` if needed. Our native Edge diagnostic driver is separate;
these commands do not configure Edge automatically.

The following PowerShell commands assume `webmcp-evals` is on PATH:

```powershell
$site = 'http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/'
$suite = 'tests\agent-tool-handling\evals'

# No model or API key. Executes required concrete calls, not the user prompts.
webmcp-evals smoke -u $site -e "$suite\evals.json" --timeout 10000

# Configure an upstream-supported provider/key and replace the example model.
webmcp-evals browser -u $site -e "$suite\evals.json" --model 'your-supported-model' --max-steps 20

# Agent + judge; the clarification case also uses a model-driven user.
webmcp-evals simulate -u $site -s "$suite\simulations.json" --model 'your-supported-model' --judge-model 'your-judge-model'
```

For a built checkout, replace `webmcp-evals` with
`node 'C:\path\to\webmcp-tools\webmcp-evals\dist\bin\webmcp-evals.js'`.
Follow upstream installation/provider documentation; no package is added to this
repository. Actual model runs incur provider usage and send synthetic fixture
tool data to the chosen provider. Do not include private data or credentials in
prompts. The built-in live browser agent uses upstream's `vercel` backend.

### What a pass means

| Mode | Checks | Does not establish |
|---|---|---|
| `smoke` | Required tools can be discovered and execute without recognized errors; dynamic tools are rediscovered | Agent behavior, response wording, **any `result` matcher**, or `{ok:false}` being recognized as a domain failure |
| `browser` | Actual agent trajectory, arguments and normalized result matchers | User-facing explanation correctness or exact native serialization/errors |
| `simulate` | Final DOM assertions and judged conversation/tool behavior | Exact timed interruptions, pending-tool abort propagation, stale-turn isolation or native conformance |

In the reviewed upstream smoke implementation, `result` expectations are **not
checked** and `{ok:false}` is not an automatically recognized failure payload.
Do not use smoke success as proof of the $39.20 total or checkout idempotency.
Those are checked by browser result expectations, simulation DOM/transcript
checks and local fixture tests. No thrown-error trajectory is included in the
smoke-compatible suite; failure communication belongs to simulations.

The harness normalizes outputs. In particular, the falsy-result cases test
semantic interpretation, not the exact native JSON text from `executeTool()`.
Result object matching is partial, arrays have exact lengths/order, and generated
order IDs use `$type: "string"`, not invented values. The simulation judge also
compares the two real checkout IDs; the trajectory matcher alone cannot bind one
generated value to a later call.

## Scenario mapping and limits

| Markdown scenario | JSON case suffixes | Automated subset / remaining checks |
|---|---|---|
| 01 Success | `catalog`, `shipping`, `catalog-response` | Catalog/details, finite fulfillment, accurate response; not precise elapsed-time conformance |
| 02 Shopping | `shopping`, `shopping-response` | Five distinct successful tools, quantities, coupon, shipping, exact total, no purchase |
| 03 Immediate failure | `failure-notice` | One failing invocation and user notification |
| 04 Delayed failure | `failure-notice` | Finite rejection and notification; not timeout handling |
| 09 Registration | `engraving`, `same-turn` | Same-turn discovery only; separate-next-prompt guarantee remains driver-run |
| 10 Unregistration | `disable`, `flash`, `disable-response` | Disable/repeat/self-unregister results and final registry; stale descriptors, next prompt and in-flight lifetime remain native/driver-run |
| 12 Domain failure | `domain-failures` | Sold out, unknown widget, invalid coupon and empty checkout, with no mutation |
| 13 Checkout | `checkout`, `review-only`, `checkout-response` | Explicit consent, identical retry, one order, stock and total; other revision/key conflicts remain in Markdown/domain tests |
| 14 Retries | `retry-response` | One permitted read-only retry and accurate explanation |
| 19 Clarification | `clarification` | Model-driven multi-turn missing engraving text; not a fixed scripted turn sequence |
| 20 Inputs | `boundary`, `unicode-response` | Maximum quantity, zero removal, nested Unicode/style/tags; invalid schema boundaries remain native/domain tests |
| 21 Results | `values`, `values-response` | Structured/number/false/null/empty; large payload and raw serialization remain native/driver-run |
| 22 Result failures | `mismatch-response` | Agent interpretation of output mismatch only; no circular/BigInt or native validation-enforcement claim |
| 23 Trust | `untrusted-response` | Review instructions treated as data, truthful price, no mutation |

All suffixes are prefixed with the scenario number in JSON names, so the two
`failure-notice` cases are distinct. Read the
[full scenario index](https://github.com/sjdallst2/webmcp-test-harness/blob/main/.github/skills/webmcp-agent-tool-handling/scenarios/index.md)
for complete contracts and evidence requirements.

Cases **05-08, 11, 15-18 and 24-28** intentionally have no JSON counterpart.
They require timed driver actions, native API observations, navigation/lifetime
control, races, frame identity or permissions that the reviewed runner cannot
faithfully express. In particular:

- A simulation's duration budget is a harness limit, **not** the real agent's
  tool timeout T. It does not propagate cancellation into page tools. Do not run
  the never-settling tool in this suite.
- Final DOM assertions run once immediately after the conversation. They do not
  prove absence of late mutation after a required observation window.
- A `userMessage` is one actual prompt. `userScenario` uses a nondeterministic
  simulated user; `messages` history is not a scripted timed multi-turn driver.
- Built-in tool lookup is by name. It cannot verify same-name owning-window
  identity, raw DOMException names, registration event ordering or permissions.

## Testing an actual extension

The default browser/simulation agent is upstream's model-backed harness, not
automatically WebMCP Explorer or another installed browsing agent. To evaluate
an actual extension, configure upstream's `--extension` and profile/debugging
options plus its supported automation bridge/UI integration. For example, after
that integration is configured:

```powershell
webmcp-evals simulate -u $site -s "$suite\simulations.json" --extension 'your-extension-id' --user-data-dir 'C:\path\to\dedicated-test-profile' --judge-model 'your-judge-model'
```

Use an isolated test profile, not a personal browsing profile. This change does
not add an automation bridge to any extension. Even extension mode does not
replace the timed interruption/late-result driver scenarios.

## Local validation and evidence

```powershell
node --test tests\agent-tool-handling\contracts.test.mjs tests\agent-tool-handling\evals.test.mjs
node tests\agent-tool-handling\scripts\coverage.mjs --write
```

Local tests validate our authored subset of the upstream shapes, concrete inputs,
scenario links and manifest, and replay non-registration trajectories against
fixture callbacks with result assertions. They deliberately skip the two cases
requiring a real registry, rather than installing a fake native API. Callback
replay is neither native verification nor an agent eval.

Authoring verification: 28 local tests passed, with the two registry-dependent
callback replays explicitly skipped. The reviewed upstream parser accepted all
15 simulations, and its actual matcher accepted 28 callback results across seven
non-registration trajectories. Integrated-browser fixture/render checks verified
18 DOM assertions covering catalog, shopping, checkout, falsy values and Unicode;
every authored selector parsed. These are fixture/format checks, not executions
of the upstream CLI, model judge or actual agent.

Record runner revision, browser/agent/model versions, URL, setup, transcripts,
tool results, DOM/judge reports and verdicts for real runs. JSON authoring and
local validation alone leave external-agent verdicts **MANUAL/NOT RUN**.
