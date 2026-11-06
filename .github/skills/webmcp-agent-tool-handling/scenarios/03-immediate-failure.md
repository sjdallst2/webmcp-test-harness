# 03 Immediate callback failure and recovery

## Classification
Native callback throw; agent failure notification.

## Setup
Reset the native storefront, clear logs. `fail_widget_quote_immediately` must be registered. No special delay.

## Prompt
> Exercise the intentionally failing fail_widget_quote_immediately tool once. Tell me whether it worked. Do not retry or change the cart.

Then:

> What does the Gear Widget cost?

## Expected tools
Exactly one `fail_widget_quote_immediately({})`; then `get_widget_details({productId:"gear-widget"})` or browse. No retry or purchase.

## Expected response
The quote tool failed; no quote was obtained. The later answer is $3.50. Generic failure wording is acceptable; do not require a private exception message.

## Assertions
Log shows callback-start followed by callback-rejected without a timer. Native caller failure is `OperationError` in the consulted draft. Cart/orders unchanged. The agent notifies the user and remains usable. FAIL on silent failure, fabricated quote, auto-retry or conversation deadlock.

## Cleanup
Export evidence and reset. Expected diagnostic console errors are not unrelated application faults.

## References
[Callback errors](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback). Notification/recovery is agent product behavior.
