# 27 Same-name tools in separate frame documents

## Classification
Native discovery/identity; external-agent origin/window selection remains a product concern.

## Setup
Open native diagnostics; select `frames`. Same-origin frames must be allowed. The runner creates supplier A and B fixtures, each with the name `supplier_widget_quote`.

## Prompt
> Run the frames group in Widget Works native diagnostics. Tell me whether both widget suppliers were called on the correct owning document and whether navigation invalidated old tools.

## Expected tools
Actual parent `getTools()` returns both descriptors. `executeTool()` with A's descriptor returns `{supplier:"A",priceCents:350}`, B returns `{supplier:"B",priceCents:375}`. Default and `fromOrigins:[]` both include same-origin descendants. Name order is code-unit sorted; no order is assumed among equal names.

The runner removes A and checks its tools disappear, then separately navigates a child to `order-status.html` and checks stale supplier invocation is `NotFoundError` while destination status tools appear.

## Expected response
Two suppliers were separately addressable despite equal names and origins; results are $3.50/$3.75 from their actual windows. Report any swapped/merged identities or stale dispatch failures.

## Assertions
Do not deduplicate by name or by origin+name: same-origin windows can legitimately share both. Frame removal/navigation must update discovery. Do not assign an unspecified winner to rapid unregister/re-register races; use the manual race recipe in the coverage index if investigating that branch.

## Cleanup
Download results and verify temporary frames removed. No production store state is shared between these supplier fixtures.

## References
[RegisteredTool/window](https://webmachinelearning.github.io/webmcp/#registered-tool), [discovery](https://webmachinelearning.github.io/webmcp/#model-context-container), [observations](https://webmachinelearning.github.io/webmcp/#observations).
