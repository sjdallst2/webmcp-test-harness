# 24 Registration and schema serialization boundaries

## Classification
Native/spec diagnostic. Does not prove conversational agent behavior.

## Setup
Open `http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/diagnostics.html`. Native API must exist; otherwise UNSUPPORTED. Select `registration`. Runner uses unique temporary names, 3000 ms native deadlines and 10000 ms per-case safety deadlines.

## Prompt
> Open Widget Works native diagnostics, run the registration group, and summarize the actual pass/fail results. Do not alter browser settings or treat unsupported tests as passes.

Driver may operate the UI if the agent lacks browser-UI tools; label this a driver/native run.

## Expected tools
No invented WebMCP "run diagnostics" tool. The UI runner invokes real `registerTool`, `getTools`, `executeTool` and lifetime aborts.

Expected cases:

- Duplicate, empty/129-character/disallowed name and empty description → `InvalidStateError`; 128-character name succeeds.
- Missing required name/description/callback or non-object schema → `TypeError`.
- Omitted input/output schema remains absent; circular schema/undefined `toJSON()` → `TypeError`; throwing `toJSON()` preserves `RangeError`.
- Pre-aborted registration → `AbortError`; later/repeated abort removes only its registration; stale call → `NotFoundError`; stable replacement succeeds.
- Source/exposed schema mutation does not alter registered snapshot; title and annotations/defaults match; absent annotations remain null/absent.
- Separately isolated reentrant schema registration of the same name should trigger the second duplicate guard; detaching the owner during serialization should trigger `InvalidStateError`. These are BLOCKED in ordinary UI runs because a native deadlock can also stop JavaScript timeout tasks. Use the README's `browser-check.mjs` with group `reentrant`, a fresh browser profile and an external 15-second watchdog. A watchdog expiry is a recorded failure/hang, not PASS; later probes in that deadlocked renderer are NOT RUN.

## Expected response
Report per-probe results from downloaded JSON, including exact failures/unsupported cases. No blanket "WebMCP works" from API presence.

## Assertions
Existing tools survive failed duplicates. Temporary registrations/frames are removed after each probe. No false pass based on a direct callback call. If draft expectations changed, cite the new section and preserve observed results.

## Cleanup
Download results; runner cleans its controllers/frames. Reload diagnostics only if a browser defect left resources behind, and record that defect.

## References
[Registration algorithms](https://webmachinelearning.github.io/webmcp/#model-context-container), [schema serialization](https://webmachinelearning.github.io/webmcp/#serialize-a-tool-schema).
