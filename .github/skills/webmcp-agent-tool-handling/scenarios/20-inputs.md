# 20 Input boundaries, nested arrays, enums and Unicode

## Classification
Fixture runtime validation and atomicity; agent accurate handling.

## Setup
Reset native storefront, add one Robot Widget, enable engraving. Native API ready. Driver can call a real descriptor independently to bypass an agent that refuses deliberately invalid inputs.

## Prompt
> Engrave my Robot Widget with "🤖 Café", bold style, and tags ["robot","gift"]. Do not purchase.

Then:

> Set the Gear Widget quantity to 20, then remove that line by setting its quantity to zero. Use express shipping.

## Expected tools
Engrave `{productId:"robot-widget",engraving:{text:"🤖 Café",style:"bold",tags:["robot","gift"]}}`; update gear quantity 20 then 0; `select_widget_shipping({method:"express"})`. Extra reads allowed.

Driver-only probes, each with a before/after snapshot:

| Input | Expected |
|---|---|
| add Screw quantity 100 | success; maximum allowed |
| add quantity 0, -1, 1.5 or 101 | `INVALID_INPUT`, unchanged |
| update Robot quantity 11 | `OUT_OF_STOCK`, unchanged |
| omitted productId or extra `surprise:true` | `INVALID_INPUT`, unchanged |
| engraving text `""`, `"   "`, or 41 ASCII characters | `INVALID_INPUT`, unchanged |
| engraving style `"italic"` or four tags | `INVALID_INPUT`, unchanged |
| engraving tags `["robot","gift"]` with omitted style | valid |
| shipping `"overnight"` | `INVALID_INPUT`, unchanged |

## Expected response
Exact Unicode engraving preserved; gear removed, express selected. Invalid inputs are explained, not silently coerced.

## Assertions
Runtime validation applies independently of browser JSON Schema enforcement. Valid emoji counts as one code point. Unknown fields fail. No partial cart/engraving changes on failure. Native callback can fulfill a domain error; agent must inspect its content.

## Cleanup
Export each probe's arguments/outcome and reset. Do not retry malformed inputs unchanged.

## References
[Input schema contract](https://webmachinelearning.github.io/webmcp/#model-context-tool). Bounds and strict unknown-property behavior are fixture-defined.
