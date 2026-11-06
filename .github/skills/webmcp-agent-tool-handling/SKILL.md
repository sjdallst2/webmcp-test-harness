---
name: webmcp-agent-tool-handling
description: "Test a browsing agent against the Widget Works WebMCP fixture. Use for tool discovery, registration, unregistration, errors, timeouts, interruption, cancellation, navigation, schemas, and multi-tool shopping scenarios."
---

# Widget Works WebMCP testing

## Roles and prerequisites

You are the **test driver**, not the agent under test. Read scenario expectations
privately. Send only each quoted user prompt to the **agent under test**, in its
own browsing-agent conversation attached to the fixture tab. Do not feed expected
answers/tool sequences to that agent or count your own JavaScript as its behavior.

Use the [fixture README](../../../tests/agent-tool-handling/README.md) to serve the
site from localhost or use
`https://sjdallst2.github.io/webmcp-test-harness/tests/agent-tool-handling/` after
deployment. Enable WebMCP in a current supported browser, restart, and verify
native capability and registration readiness in the lab. No shim is allowed.
Record URL, browser/agent versions, flags, time, spec date and session ID.

## Procedure

1. Choose a scenario below; read its setup, contracts, forbidden actions and
   capability gates. Reset the store and clear logs before each independent case.
2. Record the external agent's actual timeout T when required. Unknown T is
   BLOCKED, not a guessed 30 seconds. Set finite delays within the fixture limit.
3. Send prompts in the specified turns. Wait for callback-start logs before
   injecting an interruption through the agent product's supported interaction.
   Record a Stop-button action if the product cannot accept a new prompt mid-call.
4. Capture transcript, tool names/arguments, native caller outcome when available,
   event log, timings and before/after state. Export old-document logs before
   navigation. Capture generated IDs from real results, never invent them.
5. Judge fixture correctness, native API behavior and agent UX **separately**.
   Approximate wording is acceptable; wrong totals, phantom success, unexpected
   mutation, missed failures or stale results are not.
6. Clean up after the observation window. A late-result case is incomplete until
   the original delay plus the stated margin has elapsed.

## Verdicts

- **PASS**: specified assertions observed with evidence.
- **FAIL**: an executed assertion is false; report the responsible layer.
- **BLOCKED**: a required prerequisite such as known T/second origin is missing.
- **UNSUPPORTED**: native API/feature unavailable in the actual browser.
- **MANUAL/NOT RUN**: recipe exists but the relevant product interaction was not run.

In-page native diagnostics exercise real `executeTool()` on real descriptors.
They do not prove external-agent timeout messaging, interruption priority,
authorization, next-prompt discovery or stale-turn suppression. Direct callback
unit tests are fixture tests, never native conformance. Do not repair the agent,
silently weaken expectations or relabel failures as passes.

## Scenarios

### Optional JSON automation

Use the [JSON eval guide](../../../tests/agent-tool-handling/evals/README.md)
for upstream-compatible tool trajectories and judged/DOM simulations. It maps
selected branches back to the scenario IDs below. Keep evaluator criteria
private; the runner sends only user prompts/briefs to the agent.
Smoke checks execution, not result matchers or agent responses. Built-in model
runs do not test an installed extension unless extension automation is configured.
Do not promote partial JSON coverage to a full scenario PASS: timed interruption,
late results, next-prompt registration and raw native conformance retain their
driver/diagnostic requirements.

- [01 Immediate/delayed success](./scenarios/01-success.md)
- [02 Five-tool shopping](./scenarios/02-shopping.md)
- [03 Immediate failure](./scenarios/03-immediate-failure.md)
- [04 Delayed failure](./scenarios/04-delayed-failure.md)
- [05 Never-settling timeout](./scenarios/05-timeout.md)
- [06 Result after timeout](./scenarios/06-late-result.md)
- [07 Cooperative interruption](./scenarios/07-interruption.md)
- [08 Noncooperative interruption](./scenarios/08-noncooperative-interruption.md)
- [09 Next-prompt registration](./scenarios/09-registration.md)
- [10 Unregistration/in-flight lifetime](./scenarios/10-unregistration.md)
- [11 Navigation/rediscovery](./scenarios/11-navigation.md)
- [12 Domain failures](./scenarios/12-domain-failures.md)
- [13 Authorization/idempotent checkout](./scenarios/13-checkout.md)
- [14 Bounded retries](./scenarios/14-retries.md)
- [15 Concurrent read results](./scenarios/15-concurrency.md)
- [16 Reservation cancellation](./scenarios/16-reservation-abort.md)
- [17 Stale cart/stock conflicts](./scenarios/17-conflicts.md)
- [18 Reset isolation](./scenarios/18-reset.md)
- [19 Missing information](./scenarios/19-clarification.md)
- [20 Input boundaries/Unicode](./scenarios/20-inputs.md)
- [21 Exact result shapes](./scenarios/21-result-shapes.md)
- [22 Serialization/schema failures](./scenarios/22-result-failures.md)
- [23 Untrusted reviews](./scenarios/23-trust.md)
- [24 Registration/schema probes](./scenarios/24-registration-probes.md)
- [25 Input/native execution probes](./scenarios/25-execution-probes.md)
- [26 Abort/events/document destruction](./scenarios/26-lifetime-events.md)
- [27 Frame identity/discovery](./scenarios/27-frame-identity.md)
- [28 Permissions/origins](./scenarios/28-permissions.md)

See the [coverage and evidence index](./scenarios/index.md) and
[generated tool manifest](../../../tests/agent-tool-handling/coverage.json).
