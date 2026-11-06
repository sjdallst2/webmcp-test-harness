# 01 Immediate and delayed successful answers

## Classification
Fixture/native fulfillment; agent factual accuracy and appropriate waiting are product expectations.

## Setup
Open `http://127.0.0.1:8765/webmcp-test-harness/tests/agent-tool-handling/` in a native-capable browser. Reset and clear logs. Confirm all baseline registrations ready. Success delay is 1500 ms; agent budget must exceed 3500 ms.

## Prompt
> List the widgets I can buy and their prices. Do not change my cart.

After the answer, send:

> Get the standard shipping quote for my widget cart. Do not buy anything.

## Expected tools
`browse_widgets({})`, then `quote_widget_shipping({})`. Extra read-only discovery is allowed. No add, reservation or checkout.

## Expected response
Robot $12.00, Gear $3.50, Screw $0.25, Limited $5.00 but sold out. Standard shipping is $5.00 for a nonempty cart; the currently empty cart total/shipping is $0.00. No order was placed.

## Assertions
Catalog has seed stock 10/20/100/0. Quote callback does not fulfill before the scheduled 1500 ms timer; allow scheduling overhead, not a rigid upper bound below the caller budget. Both native calls fulfill, cart stays empty, orders/reservations stay empty, and UI remains responsive. FAIL on invented stock, premature error, or mutation.

## Cleanup
Export logs; reset. No retry needed unless an infrastructure failure is separately documented.

## References
[Execution](https://webmachinelearning.github.io/webmcp/#model-context-container). Shipping/accuracy expectations are fixture/product contracts.
