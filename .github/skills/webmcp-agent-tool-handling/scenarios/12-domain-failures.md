# 12 Fulfilled domain errors are not success

## Classification
Fixture error contract; agent semantic interpretation.

## Setup
Reset native storefront. Keep empty cart, seed stock and no orders. Run each prompt in a separate turn without resetting between them unless an unexpected mutation occurred.

## Prompt
> Add one sold-out Limited Widget to my cart, if possible. Do not substitute anything.

> Get widget details for the exact ID "unknown-widget".

> Apply coupon EXPIRED to my cart.

> Try placing a simulated order from this empty cart. I authorize this test attempt, using key empty-test and the current cart revision.

## Expected tools
Add `{productId:"sold-out-widget",quantity:1}` → `OUT_OF_STOCK`; details unknown → `UNKNOWN_WIDGET`; coupon `{code:"EXPIRED"}` → `INVALID_COUPON`; checkout with `confirmPurchase:true,idempotencyKey:"empty-test",expectedRevision:0` → `EMPTY_CART`. Extra cart reads are allowed. No substitutions, retry loop or invented order.

## Expected response
Explain each specific failure. None of the four requests succeeded, even though their callbacks fulfilled with `{ok:false}`.

## Assertions
Cart revision remains 0; stock, coupon, orders and reservations unchanged. Native promise fulfillment alone must not produce a success claim. Compare with scenarios 03/04 genuine native rejection. FAIL on any state mutation or phantom checkout.

## Cleanup
Export transcript/log, reset. Retry only after explicit user changes resolve the domain problem.

## References
[Tool author failures versus native errors](https://webmachinelearning.github.io/webmcp/#tool-execution-error). Domain error codes are fixture contracts.
