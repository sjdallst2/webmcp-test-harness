# 25 Native execution input and result branches

## Classification
Native/spec probes; separate from external-agent UX.

## Setup
Open diagnostics at the project-prefix URL, native API ready; select `execution`. The runner registers isolated widget probe tools with permissive/no input schemas to reach native conversion paths.

## Prompt
> Run the execution group in Widget Works native diagnostics. Summarize input conversion, callback errors and result serialization separately.

## Expected tools
UI runner uses genuine descriptors and `executeTool()`. Expected probes:

- Omitted input reaches callback as `{}`; nested object/array round-trips exactly.
- Numeric input → `TypeError` before callback.
- Circular/BigInt input serialization → `TypeError` before callback.
- Object whose `toJSON()` yields `1` → `DataError`, no callback.
- Synchronous throw and delayed rejection → `OperationError`.
- Circular/BigInt callback result → `OperationError`.
- Null/empty/false/number/domain-failure values serialize exactly; domain failure fulfills.
- Output-schema mismatch is observed without invented browser validation.

## Expected response
Use exact observed exception names and distinguish pre-callback failure, callback rejection and post-callback serialization failure. Report unexpected behavior as a failure rather than substituting a legacy argument-string API.

## Assertions
Callback counters stay zero for invalid native inputs. Genuine callbacks run for callback/result probes. Missing/stale tool is covered by registration/lifetime groups, not conflated with invalid input. No leaked provider message required. No stateful store mutation.

## Cleanup
Download JSON; runner aborts temporary lifetimes. No automatic retries of failed probes.

## References
[executeTool algorithm](https://webmachinelearning.github.io/webmcp/#model-context-container), [invoke callback](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback).
