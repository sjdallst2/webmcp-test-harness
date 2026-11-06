# 02 At least five successful shopping tools

## Classification
Fixture totals and native fulfillment; agent multi-step task completion.

## Setup
Use the storefront URL in scenario 01, reset, clear logs, standard shipping, 1500 ms success delay. Native API and all baseline tools must be ready. Agent budget must permit the delayed quote.

## Prompt
> In this test store, browse the widgets, add two Robot Widgets and four Gear Widgets, show the cart, apply WIDGET10, get standard shipping, and show me the final total. Do not place an order.

## Expected tools
`browse_widgets({})`; `add_widgets_to_cart({productId:"robot-widget",quantity:2})` and `{productId:"gear-widget",quantity:4}`; `view_widget_cart({})`; `apply_widget_coupon({code:"WIDGET10"})`; `quote_widget_shipping({})`. At least five **distinct** tools must succeed. Product IDs come from browse. Both additions precede the final totals; extra cart reads are allowed.

## Expected response
Two robots and four gears, subtotal $38.00, discount $3.80, standard shipping $5.00, tax $0.00, total **$39.20**. Not purchased.

## Assertions
No callback/native errors or domain failures. Cart has exactly two lines, totalCents 3920; inventory remains 10/20/100/0 because the cart does not reserve. Zero orders. FAIL on tool errors, fewer than five distinct tools, duplicate additions, wrong rounding or checkout. Native diagnostics group `store` independently tests the tool path, not this conversation.

## Cleanup
Capture transcript/log and reset. Do not retry add calls blindly.

## References
[Native execution](https://webmachinelearning.github.io/webmcp/#model-context-container). Five-tool requirement and pricing are fixture acceptance criteria.
