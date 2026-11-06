# 14 Bounded recovery from a transient failure

## Classification
Fixture resettable attempt counter; agent retry policy.

## Setup
Reset native storefront; counter starts at zero. Clear logs. No delays or cart setup required.

## Prompt
> Check retry_widget_supplier. You may retry this read-only diagnostic once if its first call fails. Tell me what happened. Do not retry more than once.

## Expected tools
`retry_widget_supplier({})` twice: first throws, second succeeds with `attempt:2,estimateCents:500`. No mutation tools and no third retry.

## Expected response
First supplier attempt failed; permitted second attempt succeeded with a $5.00 estimate.

## Assertions
Exactly one callback rejection and one successful result. Agent does not pretend the first attempt succeeded, loop indefinitely, or generalize permission to retry checkout. State unchanged. Driver resets and optionally runs a second independent case with "Do not retry"; only one failure is then allowed.

## Cleanup
Capture attempts/transcript; reset restores first-attempt failure. No manual extra calls before starting a run.

## References
[Callback errors](https://webmachinelearning.github.io/webmcp/#invoke-the-execute-callback). Retry permission is product policy, not WebMCP.
