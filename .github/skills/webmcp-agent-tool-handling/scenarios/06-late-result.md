# 06 Finite results after external timeout

## Classification
Native cancellation and late callback observation; stale-turn suppression is product behavior.

## Setup
Native storefront, reset. Record known T (at most 299000 ms), then use lab button to set slow preset D = 2*T + 2000. Unknown/out-of-range T is BLOCKED. Run each variant from a clean state.

## Prompt
Variant A:

> Run get_slow_widget_estimate once using the lab's slow delay preset. Do not retry.

Variant B, separate run:

> Run get_uncancellable_widget_estimate once using the lab's slow delay preset. Do not retry.

After the timeout notice in either variant:

> Instead, tell me the price of one Gear Widget. Do not modify the cart.

## Expected tools
One named estimate with omitted `delayMs`, then details/browse. No restarted estimate. Driver records start time and waits until start + D + 2000 ms after sending the next prompt.

## Expected response
First: call ran longer than expected and was dropped. Next: Gear Widget is $3.50. No unsolicited old estimate appended to the new answer.

## Assertions
Variant A may reject on native abort; without abort it can fulfill late. Variant B must fulfill its callback late even if abort was observed, returning estimateCents 750. Native caller rejection must not resurrect on late settlement. The transcript must not consume old 500/750-cent data as the new answer. No cart/orders change. Distinguish callback result from caller/agent result. FAIL on stale-turn overwrite or missing timeout notice.

## Cleanup
Observe the entire window, export logs/transcript, then reset. Do not retry or stop early after the first plausible answer.

## References
[Cancellation and settlement races](https://webmachinelearning.github.io/webmcp/#pending-tool-executions). Turn ownership and notification are agent policy.
