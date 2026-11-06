# 15 Overlapping requests and result correlation

## Classification
Native independent execution; agent completion/result association.

## Setup
Reset native storefront, caller budget above 5000 ms. Driver prepares two genuine descriptors. Do not assume the external agent supports parallel dispatch.

## Prompt
> Get a slow widget estimate with delayMs 1200, a shipping quote with delayMs 100, and a current widget stock snapshot. These are read-only; run them concurrently if supported and label each result.

## Expected tools
`get_slow_widget_estimate({delayMs:1200})`, `quote_widget_shipping({delayMs:100})`, `get_widget_stock_snapshot({})`. No purchase/reservation/add calls.

## Expected response
Slow estimate $5.00; standard/express shipping $5.00/$10.00 (empty cart has no charge); stock 10/20/100/0. Correct labels, not swapped by completion order.

## Assertions
If parallel, log must show independent invocation IDs and shipping/snapshot finishing before slow estimate. All three succeed, active list can show more than one, and no indicator/result overwrites another. If agent serializes, record that limitation and use driver `Promise.all` with the genuine descriptors through native `executeTool()` to test concurrency independently. Serial product behavior is not a native concurrency pass.

## Cleanup
Wait for all outcomes, export records and reset. No retries unless a separate failure scenario is intended.

## References
[Pending execution maps](https://webmachinelearning.github.io/webmcp/#pending-tool-executions). Product parallelism is implementation-specific.
