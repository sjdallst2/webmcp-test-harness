# 17 Revalidate delayed work against cart and stock changes

## Classification
Fixture consistency/domain failure; agent accurate explanation.

## Setup
Reset native storefront, caller budget over 8000 ms. Driver can mutate through UI or a separate native caller while the agent is waiting. Do not send evaluator actions as agent instructions.

## Prompt
> Check widget cart freshness with delayMs 2000 and report whether it stayed unchanged.

After callback-start, driver adds one Gear Widget through UI.

Separate reset run:

> Reserve ten Robot Widgets with delayMs 2000. Do not purchase.

After start, driver performs a separate genuine `reserve_widget_stock({productId:"robot-widget",quantity:1,delayMs:0})` and captures its ID.

## Expected tools
`check_widget_cart_freshness({delayMs:2000})` → `STALE_CART`; second run delayed reserve of ten → `OUT_OF_STOCK`. Optional reads allowed. No automatic mutation retry.

## Expected response
The cart changed while waiting; read it again before relying on the old quote. Second run: ten robots cannot be reserved because only nine are available.

## Assertions
First call does not undo the added gear. Second leaves exactly the driver's one-unit reservation, stock 10/availability 9, no ten-unit hold. Revalidation occurs immediately before commit, not only before delay. Errors are fulfilled domain failures, not native rejection.

## Cleanup
Release captured reservation, capture evidence and reset. Re-run only after reset; don't "fix" the conflict during evaluation.

## References
[Tool callbacks](https://webmachinelearning.github.io/webmcp/#model-context-tool). Consistency rules are fixture-defined.
