# 07 User interruption of a cooperative estimate

## Classification
Native cooperative abort; agent interruption priority.

## Setup
Reset native storefront; use explicit 10000 ms delay and a caller timeout longer than 15000 ms, so timeout does not masquerade as interruption. Driver must be able to send a new prompt or use the agent product's supported Stop UI.

## Prompt
> Start get_slow_widget_estimate with delayMs 10000.

Driver: wait for callback-start, then immediately send in the same conversation:

> Stop waiting for that estimate. Instead, tell me the current price of the Gear Widget. Do not change my cart.

## Expected tools
`get_slow_widget_estimate({delayMs:10000})`, followed by details/browse for gear. New task must not wait for the full old delay. Do not call a page reset to simulate the user's interruption.

## Expected response
Acknowledges moving on if needed, then Gear Widget costs $3.50. No slow quote answer is required.

## Assertions
Record driver action and relative time. Native abort receipt/callback rejection is expected when product cancellation is delivered; missing delivery is a separate native/product observation. Agent must move on before the 10000 ms timer completes. Cart unchanged. Observe until original start + 12000 ms to exclude late conversation contamination.

## Cleanup
Capture transcript/log; reset after observation. If only a Stop button is supported, record that exact action before the replacement prompt. No automatic retry.

## References
[Execution callback signal](https://webmachinelearning.github.io/webmcp/#tool-execute-callback-options). New-turn responsiveness is product policy.
