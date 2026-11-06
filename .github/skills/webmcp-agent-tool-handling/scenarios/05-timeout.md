# 05 Never-settling supplier and external-agent timeout

## Classification
Fixture never-settling behavior; timeout/drop notification is an agent requirement, not a browser-specified deadline.

## Setup
Reset native storefront. Record actual agent product/build and configured/measured timeout T. Unknown T is BLOCKED. Driver hard stop is T + 5000 ms; this is a test safety limit, not a site timeout. Keep log visible.

## Prompt
> Check the widget supplier using check_widget_supplier_forever once. If it runs too long, stop waiting and tell me it was dropped. Do not retry.

After control returns:

> Tell me the Gear Widget price without changing the cart.

## Expected tools
`check_widget_supplier_forever({})`, then details/browse for gear. No site-owned timeout, checkout or repeated supplier call.

## Expected response
The supplier call took longer than expected and was dropped/abandoned; no supplier result is available. The next answer is $3.50.

## Assertions
Callback remains pending until actual abort or driver cleanup. If the product drops without abort delivery, the page may still show an active callback: record that, do not claim cancellation. Agent must return control and notify the user near its configured budget. If it never does, record agent FAIL at the driver safety limit and stop via product UI. Store remains unchanged.

## Cleanup
After evidence, use fixture reset to clean cooperative pending work. Label this fixture cleanup separately from an agent abort. Do not count diagnostic runner deadline as this test.

## References
[Pending execution cancellation](https://webmachinelearning.github.io/webmcp/#pending-tool-executions). No normative WebMCP timeout is assumed.
