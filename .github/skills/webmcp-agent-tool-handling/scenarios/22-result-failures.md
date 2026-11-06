# 22 Callback fulfillment can still fail native serialization

## Classification
Native serialization failures; agent/output-schema validation observation.

## Setup
Reset native storefront, no cart mutation. Use one prompt per variant, and record callback logs independently from native outcomes.

## Prompt
> Exercise get_unserializable_widget_report with shape circular once. Report what actually happened; do not retry.

> Exercise get_unserializable_widget_report with shape bigint once. Report what actually happened; do not retry.

> Exercise get_mismatched_widget_report once and tell me whether its count satisfies the declared output schema.

## Expected tools
Two unserializable calls `{shape:"circular"}` and `{shape:"bigint"}`, then mismatch `{}`. No result-normalizing wrapper or purchase.

## Expected response
Circular/BigInt reports failed to become usable native results. The mismatched count is a string, not an integer; it does not satisfy the schema. If the agent rejects that output, record its validation behavior; do not require browser enforcement absent from the draft.

## Assertions
Callback fulfillment logs remain possible for both serialization failures; native promise rejects `OperationError`. Safe summaries must not mask this with `{ok:true}`. Mismatch result is `{count:"not-an-integer"}` if delivered. No fabricated count. Native `execution` group tests all three.

## Cleanup
Capture both layers of evidence; reset. Console diagnostics are expected, but no unhandled runner failure is acceptable.

## References
[Native output serialization](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback), [outputSchema](https://webmachinelearning.github.io/webmcp/#model-context-tool).
