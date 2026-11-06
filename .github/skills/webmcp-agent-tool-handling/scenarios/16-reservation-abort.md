# 16 Cancellation prevents a late reservation commit

## Classification
Fixture atomic delayed mutation; native execution abort; agent interruption UX.

## Setup
Reset native storefront, timeout over 15000 ms. Driver records robot stock/availability 10 and no reservations. Use 10000 ms reservation delay.

## Prompt
> Reserve two Robot Widgets with reserve_widget_stock using delayMs 10000. Do not order them.

After callback-start, driver interrupts:

> Cancel that pending reservation. Tell me the current Robot Widget availability without reserving or buying anything.

## Expected tools
Reserve `{productId:"robot-widget",quantity:2,delayMs:10000}` then stock/inspection. Native execution cancellation must be delivered for the no-commit assertion; a page reset is not the agent interrupt.

## Expected response
Reservation cancelled/not completed, 10 Robot Widgets available. If cancellation was not actually confirmed, agent must not falsely guarantee it.

## Assertions
After start + 12000 ms: no held reservation, stock/availability still 10. Normal callback must reject on execution abort and not mutate later. If agent did not deliver abort and a reservation completes, record that product failure separately; do not hide it. Driver-only positive control reserves with delayMs 0, captures returned ID, releases it twice, verifies alreadyReleased false then true.

## Cleanup
Export before cleanup. Release any unexpectedly committed reservation by its returned ID, then reset. No blind reservation retries.

## References
[Callback abort signal](https://webmachinelearning.github.io/webmcp/#tool-execute-callback-options). No-late-commit is the fixture contract.
