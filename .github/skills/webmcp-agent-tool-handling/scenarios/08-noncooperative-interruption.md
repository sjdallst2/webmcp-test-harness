# 08 User interruption while the old callback ignores abort

## Classification
Native cancelled-caller isolation and product stale-answer suppression.

## Setup
Native storefront, reset; caller budget over 15000 ms. Use 10000 ms finite noncooperative callback. Driver must record actual interrupt action, not click a fixture reset.

## Prompt
> Start get_uncancellable_widget_estimate with delayMs 10000.

After callback-start, driver sends:

> Stop waiting for that estimate. Instead, tell me the current price of the Gear Widget. Do not change my cart.

## Expected tools
`get_uncancellable_widget_estimate({delayMs:10000})`, then details/browse. No mutation, retry or reissued estimate.

## Expected response
Gear Widget is $3.50 without waiting for the old estimate. The eventual 750-cent estimate must not become an unsolicited answer to the new turn.

## Assertions
Observe through start + 12000 ms. Callback really fulfills at/after 10000 ms; if native abort is delivered, abort-observed is logged but does not stop that callback. The agent ignores its late output after moving on. Native promise already cancelled stays rejected. Read-only fixture cannot change cart/orders. FAIL if old result replaces the Gear price or old work delays the new task.

## Cleanup
Export full observation window; reset only afterward. Document missing abort delivery separately; do not falsify an abort event.

## References
[Late settlement after cancellation](https://webmachinelearning.github.io/webmcp/#pending-tool-executions). Conversation behavior is agent policy.
