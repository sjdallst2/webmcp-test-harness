# 18 Reset isolates the new session from old work

## Classification
Fixture generation isolation; honest distinction from external-agent cancellation.

## Setup
Native storefront; reset and capture old session ID. Enable engraving. Driver starts genuine noncooperative estimate and reservation calls with delayMs 1500 from a separate native caller, attaching rejection handlers immediately.

## Prompt
> Reset the widget test store, then add one Gear Widget to the fresh cart. Do not order it.

## Expected tools
`reset_widget_test_store({})` then `add_widgets_to_cart({productId:"gear-widget",quantity:1})`. Extra inspection allowed. Old pending reserve must not be replayed.

## Expected response
Fresh store, one Gear Widget in the new cart, no order. Reset invalidates old work; it does not prove the external agent cancelled anything.

## Assertions
New session/generation differs. Success/failure/slow presets return to 1500/2000/30000; engraving absent; flash sale restored. At old start + 3500 ms, no reservation/order, one gear remains, stock untouched. Noncooperative old estimate can fulfill but log is tagged old session and staleSession true. History is retained/bounded, not silently rewritten under new ID.

## Cleanup
Export full history, reset and clear only after evaluation. Do not retry old mutations in the new generation.

## References
[Cancellation versus callback lifetime](https://webmachinelearning.github.io/webmcp/#pending-tool-executions). Session isolation/reset semantics are fixture-defined.
