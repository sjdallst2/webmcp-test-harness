# 21 Structured, primitive, null, empty and large output

## Classification
Native JSON serialization; agent interpretation and truthful truncation.

## Setup
Reset native storefront. `get_widget_result_sample` ready. Caller budget above 5000 ms. Driver records raw native strings separately from parsed results.

## Prompt
> Run get_widget_result_sample for structured, number, false, null, empty, and large, once each. Explain the meaning and size of each result without printing the whole large report or changing my cart.

## Expected tools
Six calls `{shape:"structured"}`, `"number"`, `"false"`, `"null"`, `"empty"`, `"large"`. No mutation/retry.

## Expected response
Structured sample contains Gear Widget at 350 cents; number is 350; false is a valid boolean; null is a valid explicit null; empty is a valid empty string. Large report contains 65,536 W characters, plus envelope metadata. Do not call these failures merely because values are falsy.

## Assertions
Native result strings are JSON text: `350`, `false`, `null`, `""` respectively. The large parsed `report.length` and `characters` both equal 65536. Agent may summarize/truncate, but must say so and not invent report content or output size. State unchanged. Native `execution` probes independently cover falsy values.

## Cleanup
Record raw versus parsed outputs and reset. Avoid copying 64 KiB verbatim into the conversation.

## References
[Result serialization](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback). Agent rendering/truncation is product behavior.
