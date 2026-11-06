# Widget Works: agent tool-handling fixture

A static, synthetic widget store for exercising **real native WebMCP** with an
external browsing agent. No backend, build, dependencies, CDN, telemetry, real
payment, or MCP server. The UI also works without WebMCP; native tests then
explicitly report UNSUPPORTED. No polyfill or legacy API fallback is installed.

## Run

From the repository root in PowerShell:

```powershell
python tests\agent-tool-handling\scripts\serve.py --port 8765
```

Open `http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/`.
Use an up-to-date WebMCP-capable Edge Canary/Dev and enable
`about://flags/#enable-webmcp-testing`, then restart. Browser availability and
flags can change. Check the lab's capability details and native diagnostics
instead of assuming the flag guarantees the current API.
The development helper serves static files only and explicitly maps `.mjs` to
JavaScript MIME, avoiding Windows registry mappings that can make Python's
default server return `text/plain`. It is not deployed or required by Pages.

Published location after the normal Pages deployment:
<https://sjdallst2.github.io/webmcp-test-harness/tests/agent-tool-handling/>.
The repository root opens this fixture. The standalone
[deployment setup](https://github.com/sjdallst2/webmcp-test-harness#github-pages) validates and stages only the
root entry, license and allowlisted fixture assets. No deployment is required to
run locally.

## Native contract and draft references

Consulted **2026-11-05**:

- [Document / secure context](https://webmachinelearning.github.io/webmcp/#document-extension).
- [Registration, discovery, execution algorithms](https://webmachinelearning.github.io/webmcp/#model-context-container).
- [Tool dictionary and output schemas](https://webmachinelearning.github.io/webmcp/#model-context-tool).
- [Registration options / lifetime signal](https://webmachinelearning.github.io/webmcp/#model-context-register-tool-options).
- [Execution callback signal](https://webmachinelearning.github.io/webmcp/#tool-execute-callback-options).
- [Unregistration and in-flight calls](https://webmachinelearning.github.io/webmcp/#model-context-unregister-a-tool).
- [Pending execution cancellation](https://webmachinelearning.github.io/webmcp/#pending-tool-executions).
- [Events](https://webmachinelearning.github.io/webmcp/#events).
- [Permissions policy](https://webmachinelearning.github.io/webmcp/#permissions-policy).
- [Browser-agent observations](https://webmachinelearning.github.io/webmcp/#observations).
- [Trust and security considerations](https://webmachinelearning.github.io/webmcp/#security-privacy).

This is a living draft. `document.modelContext.registerTool()` returns a promise;
unregistration aborts its **registration** signal. That does not cancel a
callback already running. A different **execution** signal reaches the callback.
`getTools()` returns descriptors with owning window and origin; tool name alone
is not a global identity. `executeTool()` returns JSON text, not an assumed MCP
`content` envelope. A fulfilled domain error is distinct from callback rejection
or native serialization failure. Annotations are hints, not authorization.
The fixture does not implement full JSON Schema validation; it runtime-validates
the documented object/string/integer/boolean/array subset for its own inputs.

## Store contracts

| ID | Emoji | Unit price | Seed stock |
|---|---|---:|---:|
| `robot-widget` | 🤖 | $12.00 | 10 |
| `gear-widget` | ⚙️ | $3.50 | 20 |
| `screw-widget` | 🔩 | $0.25 | 100 |
| `sold-out-widget` | 🧰 | $5.00 | 0 |

Prices and all calculations use integer USD cents. Quantity is an integer 1–100;
updating to 0 removes a line. Each product has one cart line. Cart additions do
not reserve stock. Stock is rechecked at checkout. Reservations reduce available
stock independently, do not expire, and must be released before buying held
stock. Releasing a known released reservation is idempotent.

`WIDGET10` is case-sensitive and discounts `floor(subtotalCents / 10)`.
Shipping is standard 500 cents or express 1000 cents; an empty cart has no
shipping charge. Tax is deliberately zero. Two robots + four gears + WIDGET10
+ standard shipping = `3800 - 380 + 500 = 3920` cents (**$39.20**).

Only Robot Widgets can be engraved. Nested `engraving` requires nonblank `text`
(at most 40 Unicode code points), optional `style` (`plain`/`bold`), and optional
`tags` (up to 3 nonblank strings, at most 12 code points each). Unknown fields fail.
Simulated checkout intentionally carries `consequentialHint:true` to exercise
agent confirmation handling; no real-world consequential action occurs.

`place_widget_order` requires explicit user authorization, `confirmPurchase:
true`, a nonblank `idempotencyKey` (at most 80 characters), and `expectedRevision`
from the latest cart. Authorization is an agent policy as well as a fixture input:
a tool cannot prove that the agent obtained the user's consent. Successful
checkout decrements inventory, clears cart/coupon, and returns a generated ID
with status `simulated-confirmed`. Capture that ID. A retry of the same key and
original revision returns the same order even after cart clearing; a different
revision with that key is `IDEMPOTENCY_CONFLICT`. Do not invent a new revision
for a retry. There is no real charge, fulfillment or stock service.

Domain validation failures return `{ok:false, code, message}` and leave state
unchanged. Unexpected exceptions are not converted into success. UI and tools
share the store implementation. The read-only shipping quote does not select
shipping; `select_widget_shipping` does.

## Tools and coverage

[tools.mjs](./tools.mjs) is the authoritative descriptor/schema/annotation/
behavior/scenario source. [coverage.json](./coverage.json) is generated from it:

```powershell
node tests\agent-tool-handling\scripts\coverage.mjs --write
node --test tests\agent-tool-handling\contracts.test.mjs tests\agent-tool-handling\evals.test.mjs
```

The test verifies manifest equality, handler coverage, scenario files, skill
links and staged Pages assets. Read the manifest for every exact schema and
default availability. The storefront registers 30 baseline tools; `engrave_widget`
starts absent and is dynamically registered by `enable_widget_engraving`.
`close_widget_flash_sale` unregisters itself. The destination document registers
only `get_widget_order_status`, `inspect_widget_test_state`, and
`return_to_widget_shop`. Invalid registration probes are opt-in only.

Core behavior families:

- Shopping: catalog/details, add/update/view cart, coupon/shipping selection,
  delayed shipping quote, authorized idempotent order/status.
- Timing: immediate throw, delayed rejection, never-settling supplier,
  cooperative slow and deliberately noncooperative slow estimates.
- Lifetime: enable/disable engraving, self-unregistering flash sale, real
  local-document navigation, generation-invalidating reset.
- State: stock snapshot, abort-aware delayed reservation/release, delayed stale
  cart detection and retryable first-attempt failure.
- Results: exact structured/number/false/null/empty/large samples, intentional
  circular/BigInt serialization failure, output-schema mismatch, untrusted reviews.

Tool descriptions explain intentional failures. Diagnostics do not wrap bad
results in a successful response. The bounded large report is exactly 65,536
ASCII characters in its `report` field, not including the JSON envelope.

## Timing, interruption and reset

Lab presets: success **1500 ms**, failure **2000 ms**, slow **30000 ms**.
Finite calls accept `delayMs` from 0 to 600000. Never-settling supplier checks
have no page timeout. No tool busy-waits or blocks the UI.

For external-agent timeout tests, first record the agent product/version and
actual configured/measured budget **T**. The lab records T and can set slow delay
to `2*T + 2000` (T at most 299000). It **does not enforce the agent timeout**.
Unknown T makes those scenarios BLOCKED. Local diagnostics enforce their own
3000 ms caller deadline and label it separately. The agent's timeout notification
and stale-turn suppression require the real external agent and driver transcript.

Reset aborts local cooperative work, restores seed data/presets, removes engraving
and restores flash sale. Every invocation has an original session/generation ID.
Noncooperative work can finish later; it is read-only and logged with
`staleSession:true`, not relabeled as cancelled. Generation checks prevent old
state-changing work from committing. History retains the latest 400 entries;
clear it explicitly when desired.

The log distinguishes callback start/fulfillment/rejection/domain failure, native
activation/cancel/change events, registration lifetime, abort receipt, timers,
navigation, reset and storage errors. Native caller outcomes are separately
recorded by the diagnostic runner. A callback fulfillment log is not proof of
successful native serialization or of agent consumption. Native events only
carry tool names; they cannot identify concurrent invocations by themselves.
Exception messages may be generic across origins, so require exception names/
outcome classes rather than leaked callback stack traces.

## Navigation and storage

Navigation uses real `location.assign()` to a fixed relative HTML document.
Do not assert a successful result from the old document after it unloads.
`pagehide.persisted:true` indicates bfcache suspension, not guaranteed unloading.
The diagnostic target-removal fixture guarantees document destruction instead.
Recoverable back/forward/bfcache behavior is a manual observation, not an unload
conformance pass.

Versioned, namespaced `sessionStorage` stores only synthetic store data for
same-tab continuity. Invalid/unavailable storage is visibly reported. A failed
write blocks tool-initiated navigation rather than losing the order silently.
Separate browser tabs are not live-synchronized; a duplicated/opened tab may
inherit a browser-provided sessionStorage snapshot, so reset each test tab.
Local invocation logs are not persisted across navigation; export them first
when evidence is needed.

## Run scenarios and diagnostics

Invoke the
[webmcp-agent-tool-handling skill](https://github.com/sjdallst2/webmcp-test-harness/blob/main/.github/skills/webmcp-agent-tool-handling/SKILL.md).
The [scenario index](https://github.com/sjdallst2/webmcp-test-harness/blob/main/.github/skills/webmcp-agent-tool-handling/scenarios/index.md)
maps 28 independent scenario files to tools, API branches and execution methods.
The **driver** reads evaluator instructions; the **agent under test** receives
only the quoted user prompts. Reset between cases.

For compatible tool-trajectory evals and conversation simulations, see
[JSON agent evals](./evals/README.md). These add nine trajectories and fifteen
simulations for selected branches of 14 scenarios, not replacements for the
Markdown recipes. They include exact cart/stock/order DOM checks and judged
failure notices, clarification and trust behavior. The generated manifest links
each JSON case to a scenario ID. Timed interruption, timeout/late-result, raw
native and frame/policy cases remain with the existing driver/diagnostics.
Upstream smoke does not check result matchers; see the mode-specific limits.

Open [diagnostics.html](./diagnostics.html), select a group and run. It uses real
discovered descriptors with `executeTool()`. It is not a chatbot and does not
emulate the native API. Expected diagnostic console errors are intentional.
Each native case has bounded deadlines, unique temporary registrations and
cleanup. Download JSON results to capture exact probe outcomes.
Reentrant schema probes are a special case: a native mutex/reentrancy defect can
deadlock an entire renderer, preventing its own JavaScript deadline from firing.
Ordinary browser runs mark these BLOCKED. Run them only in an isolated browser
with the external watchdog below, not in an important browsing session.

An optional dependency-free **Node 22+** driver starts a separate headless browser
with a new temporary profile, enables WebMCP features, runs real CDP/native probes,
prints individual results and closes only its own browser:

```powershell
node tests\agent-tool-handling\scripts\browser-check.mjs "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/" store
```

Replace `store` with `registration`, `execution`, `lifetime`, `frames`,
`permissions`, or `all`. `reentrant` is separately opt-in and uses an external
15-second watchdog because an in-renderer timeout cannot contain a native
deadlock. Exit 1 indicates native expectation failures (including watchdog
expiry); exit 2 indicates unavailable native API. Neither is silently converted
to success.

Optional second-origin probes:

1. Keep the first server running on port 8765.
2. In another terminal run the same static server command using port **8766**.
3. Use `http://127.0.0.1:8766` in the diagnostics second-origin field.
4. Select `cross-origin`. The second server must expose the same project-prefix
   files. The child exposes one public tool to the first origin and keeps a second
   private. The runner checks filtering, execution denial and stale-origin identity.

The optional URL is limited to loopback origins; no remote service is contacted.
GitHub Pages alone supplies only one origin and cannot set arbitrary response
headers. Header-only policies need a suitable manual host. An opaque sandbox
origin is not a substitute. Browser-agent observation is implementation-defined
and distinct from in-page `getTools()` visibility.

## Validation and publishing

Run the dependency-free Node test command above (Node 20+), plus `node --check`
for changed modules. The tests cover calculations, atomic failure, validation,
stock conflicts, checkout idempotency, reset/abort isolation, result distinctions,
manifest/scenario consistency and actual staging output.

The additional tests validate JSON contracts and concrete callback trajectories,
not actual-agent behavior. The static allowlist also publishes the two JSON
suites and their usage README.

To inspect an artifact locally, supply a **new** staging directory:

```powershell
node tests\agent-tool-handling\scripts\stage-pages.mjs "$env:TEMP\widget-pages-inspect"
```

Staging refuses existing output directories and never deletes/overwrites them.
It copies the root entry and license plus an explicit static-site allowlist for
this fixture; no dependencies, skill, test runner or repository internals.
The workflow uses a unique runner-temp directory and deploys only from `main`
after validation. An administrator must first select GitHub Actions in the
repository's Pages settings.

External-agent scenarios remain **MANUAL/NOT RUN** until executed with the actual
product. Native cases require an actual WebMCP-enabled browser, and absent API is
**UNSUPPORTED**, not PASS. Second-origin/header-policy/bfcache limitations must be
recorded honestly. See the scenario index for evidence and classification.

### Implementation verification (2026-11-05)

These historical fixture checks predate the standalone repository migration.
They remain evidence for the unchanged fixture behavior, not proof of a Pages
deployment or an actual-agent eval in this repository.

- Node v26.13.0: all **18** dependency-free fixture/domain/manifest/link/staging
  checks passed, and all JavaScript modules passed syntax checks.
- Integrated browser without native WebMCP: storefront remained usable with an
  explicit UNSUPPORTED notice. UI shopping produced 3920 cents with zero orders;
  unconfirmed checkout was refused, confirmed synthetic checkout persisted the
  exact order ID/total to the destination document, with zero page exceptions.
  Keyboard add preserved focus, cart changes cleared old confirmation, and a
  390-pixel viewport had no horizontal overflow.
- Isolated real Edge **156.0.4314.58**, with WebMCP features enabled: all **30**
  baseline registrations settled without registration errors. The final bounded
  native run across ports 8765/8766 reported **36 PASS, 18 FAIL, 2 BLOCKED**.
  Passing cases included five distinct shopping tools / 3920 cents / zero orders,
  dynamic engraving registration/execution, self-unregistration, cancellation
  and late callback handling, input-schema snapshots, permissions and public/
  private cross-origin discovery.
- The native failures are retained against the consulted draft, not hidden by a
  compatibility shim: this browser omitted/ignored `outputSchema`, returned
  `UnknownError` where the draft requires more specific errors, fulfilled a
  BigInt result, and did not serialize empty strings as the draft requires.
  Stale descriptors and unload/private-tool failures therefore fail exact
  exception-name assertions even where the action was correctly denied.
- The two ordinary-run BLOCKED cases are hazardous reentrant schema probes.
  A separate isolated reentrant run hit a native renderer hang; the external
  15-second watchdog terminated that run and closed its browser. The subsequent
  detach-owner reentrancy case was NOT RUN. Do not remove the watchdog or run
  these probes in an important tab.
- Actual external-agent conversation scenarios, configured external timeout T,
  next-prompt awareness and user interruption UX remain **MANUAL/NOT RUN**.
  Back/Forward cache and header-only policy variants also remain manual/blocked.

These are environment-specific observations, not expected future baseline
failures. Rerun diagnostics on the browser being evaluated and keep fixture,
native and external-agent verdicts separate.

### Standalone migration verification (2026-11-06)

- All 28 fixture/eval/link/staging checks passed in the standalone repository;
  two callback replays requiring a real registry remained explicitly skipped.
  JavaScript syntax and deployment workflow YAML checks passed.
- The actual allowlisted Pages artifact loaded through
  `/webmcp-test-harness/`, redirected to the store, and served modules with the
  JavaScript MIME type. Ten asset endpoints and both JSON suites loaded.
  Rendered-document UI handlers produced the exact 3920-cent cart, zero orders
  and an explicit refusal of unconfirmed checkout. This was not a pointer
  actionability or actual-agent test.
- Isolated Edge 156.0.4314.58 registered all 30 baseline tools at the new URL
  without registration errors. Native `store` diagnostics reported **3 PASS,
  1 FAIL**: shopping, dynamic engraving and self-unregistration passed; stale
  engraving execution still returned `UnknownError` rather than the draft's
  `NotFoundError`. This is the previously observed browser/spec mismatch, not a
  new migration regression.
- A remote Pages deployment and actual-agent evals were not run. Deployment
  requires the repository owner to select GitHub Actions as its Pages source
  and push the workflow/site files to `main`.
