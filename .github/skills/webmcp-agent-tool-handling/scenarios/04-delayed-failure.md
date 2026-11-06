# 04 Delayed rejection before the caller deadline

## Classification
Native rejected promise; product failure communication.

## Setup
Reset native storefront. Use delay 2000 ms; ensure the recorded external budget exceeds 4000 ms. Otherwise configure a smaller explicit delay safely below that budget and record it.

## Prompt
> Exercise reject_widget_quote_after_delay once with delayMs 2000. Report the outcome and do not retry.

## Expected tools
`reject_widget_quote_after_delay({delayMs:2000})` exactly once. No shopping mutations.

## Expected response
The delayed widget quote failed; no quote is available. It must not be presented as a successful response or described as a timeout if the actual outcome was rejection.

## Assertions
Scheduled delay is 2000; callback rejection occurs after that delay, before the actual caller deadline. Native outcome is `OperationError`, not fulfillment with the word "error". UI stays responsive and state unchanged. Agent explicitly reports failure. FAIL on hidden failure, wrong outcome category or repeated calls.

## Cleanup
Export transcript/timestamps and reset. If a timeout won, record the run as invalid for this case and rerun once with a documented smaller delay.

## References
[Callback rejection](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback). Failure wording is product policy.
