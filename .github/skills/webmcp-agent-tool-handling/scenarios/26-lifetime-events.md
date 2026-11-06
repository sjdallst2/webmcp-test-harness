# 26 Cancellation, native events and document destruction

## Classification
Native/spec lifecycle probes. External-agent UX remains separately evaluated in 05–08.

## Setup
Native diagnostics URL; select `lifetime`. Require actual event support and same-origin frames. Missing event feature is BLOCKED/UNSUPPORTED, not synthesized. Native caller deadline 3000 ms.

## Prompt
> Run the lifetime group in Widget Works native diagnostics. Distinguish cancellation, registration removal and document destruction, including any blocked branches.

## Expected tools
Runner uses real registration/execution signals, lifecycle listeners and removable frame documents:

- Already-aborted execution does not invoke callback.
- Mid-call abort rejects caller, delivers native callback abort/cancel event, and an intentionally late callback cannot resurrect caller.
- `toolactivated.toolName` and `toolcancel.toolName` match; `toolchange` is observed, without requiring ordering against unrelated timer tasks.
- Unregistration/self-unregistration leaves an already-started callback able to finish.
- Post-settlement abort does not change result; five abort/settlement races each have one outcome (fulfillment or AbortError).
- Removed target frame rejects a surviving caller with AbortError; inactive saved context rejects registration/discovery with InvalidStateError.
- Removed caller frame causes surviving target callback's signal to abort.

## Expected response
Separate actual native pass/fail results for each case. Explain that registration abort is not execution cancellation and caller destruction is not target destruction.

## Assertions
No duplicate terminal caller results, no leaked active timers/controllers after cleanup. Frame removal forces destruction; do not call bfcache suspension an unload. Queued inactive/bfcache execution is BLOCKED until browser lifecycle control is available; scenario 11 supplies the manual Back/Forward observation.

## Cleanup
Download JSON, verify temporary frames gone. Do not reset a fixture in lieu of testing native caller cancellation.

## References
[Pending execution maps and unload](https://webmachinelearning.github.io/webmcp/#pending-tool-executions), [events](https://webmachinelearning.github.io/webmcp/#events), [unregistration](https://webmachinelearning.github.io/webmcp/#model-context-unregister-a-tool).
