# 09 Newly registered tool on the next prompt

## Classification
Native dynamic registration plus external-agent rediscovery.

## Setup
Reset native storefront. Driver uses UI to add one Robot Widget. Verify `engrave_widget` absent in actual discovery, not merely hidden in UI. Keep the same page and agent conversation throughout.

## Prompt
> Enable widget engraving, but do not engrave anything yet.

Only after enable completes and the driver verifies native registration, send:

> Engrave the Robot Widget in my cart with "Robo #1".

## Expected tools
First `enable_widget_engraving({})`; second `engrave_widget({productId:"robot-widget",engraving:{text:"Robo #1"}})`. Extra cart reads are allowed. Do not reload or restart conversation. Repeating enable in an optional third turn should return `alreadyEnabled:true`.

## Expected response
Engraving is available, nothing engraved yet. On next turn: Robot Widget engraved "Robo #1", no purchase.

## Assertions
Enable awaits registration readiness; its result includes exact name/schema. No engraving mutation on first turn. Native `toolchange`/discovery shows new tool, and actual second-turn call succeeds. Cart retains quantity 1 and exact engraving. Native diagnostics can test registration, but cannot prove agent next-prompt awareness.

## Cleanup
Capture two-turn transcript, then disable or reset. No automatic retries of mutation.

## References
[Registration](https://webmachinelearning.github.io/webmcp/#model-context-container), [observations](https://webmachinelearning.github.io/webmcp/#observations). Next-turn availability is the agent acceptance criterion.
