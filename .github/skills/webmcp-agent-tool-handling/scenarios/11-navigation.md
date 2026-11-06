# 11 Full document navigation and rediscovery

## Classification
Document lifecycle/native discovery; destination verification is a fixture contract.

## Setup
Native storefront at the project-prefix URL. Reset, add one Gear Widget through UI, authorize a simulated checkout through UI. Capture its generated order ID and 850-cent total. Verify storage writes succeed. Export old-document logs before leaving.

## Prompt
> Open the widget order page using the store's navigation tool. Then tell me the status and total of my latest simulated order.

Then:

> Return to the widget store.

## Expected tools
`open_widget_order_page({})`, destination `get_widget_order_status({})`, then `return_to_widget_shop({})`. May inspect state. Do not call cart/engraving tools on the status document.

## Expected response
The destination's order is simulated-confirmed, total $8.50, with the captured ID. No new order is placed.

## Assertions
URL becomes real `order-status.html`, not a hash/history-only change. Destination registers exactly status, inspection and return tools. Session storage preserves order ID/stock. Old document's result may be lost/aborted; do not require success before unload. Returning restores baseline tools with engraving absent. Native `frames` group tests old descriptors after child navigation.

Driver-only lifecycle extension: use browser Back/Forward, record pagehide/pageshow `persisted`, tools and state. If bfcache is not entered, record that prerequisite as BLOCKED rather than claiming its branch passed.

## Cleanup
Return/reset; capture destination evidence before cleanup. Storage failure makes continuity BLOCKED, never a fake successful order lookup.

## References
[Pending/unloading execution](https://webmachinelearning.github.io/webmcp/#pending-tool-executions), [observations](https://webmachinelearning.github.io/webmcp/#observations).
