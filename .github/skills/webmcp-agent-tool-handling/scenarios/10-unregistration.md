# 10 Unregister another tool, itself, and an in-flight call

## Classification
Native registration lifetime versus execution lifetime; agent stale-tool handling.

## Setup
Reset native storefront, add one Robot Widget, enable engraving. Retain the genuine engraving descriptor for the driver-only stale-call check. Caller budget over 8000 ms.

## Prompt
> Disable widget engraving. Do not change my cart.

Then:

> Engrave my Robot Widget with "Not available".

Separate reset run:

> Close the widget flash sale using close_widget_flash_sale.

## Expected tools
`disable_widget_engraving({})`; the subsequent agent must not invent/call a nonexistent engraving tool or claim engraving. It may explain unavailability or offer to enable it, but must not silently enable it. Flash sale uses `close_widget_flash_sale({})` once.

Driver-only in-flight variant: enable again, call genuine engraving with `{productId:"robot-widget",engraving:{text:"In flight"},delayMs:1000}`, wait for start, then call disable from a separate native caller.

## Expected response
Engraving disabled; later engraving cannot be performed without re-enabling. Flash sale closed successfully.

## Assertions
Engraving disappears and stale native descriptor execution yields `NotFoundError`. Repeat disable yields `alreadyDisabled:true`. Flash sale callback fulfills even though its tool disappears. The already-started delayed engraving still finishes "In flight" after registration abort, unless an independent execution abort occurred. No conflation of those signals. Native groups `registration`, `lifetime`, `store` test these boundaries.

## Cleanup
Reset restores flash sale and removes engraving. Keep independent cancellation evidence; do not retry stale calls repeatedly.

## References
[Unregistration algorithm](https://webmachinelearning.github.io/webmcp/#model-context-unregister-a-tool), [registration options](https://webmachinelearning.github.io/webmcp/#model-context-register-tool-options).
