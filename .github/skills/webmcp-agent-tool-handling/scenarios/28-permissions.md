# 28 Secure contexts, policy and optional cross-origin tools

## Classification
Native/spec permissions and origins. Browser-agent observation is a separate implementation-defined surface.

## Setup
Use diagnostics on trustworthy localhost or HTTPS. Run `permissions` first. For `cross-origin`, serve identical static files on `http://127.0.0.1:8766` as explained in the fixture README, and enter that exact second origin. Missing second server is BLOCKED. One Pages origin cannot prove cross-origin behavior.

## Prompt
> Run Widget Works permissions diagnostics. If the second local origin is configured, also run the cross-origin group. Report unavailable prerequisites and actual outcomes separately.

## Expected tools
Runner, not a fabricated agent tool:

- Same-origin/default allow succeeds; a frame with `allow="tools 'none'"` rejects registration/discovery with `NotAllowedError`.
- Malformed origin `"not a URL"` and untrustworthy `"http://widget.example.invalid"` in `exposedTo`/`fromOrigins` yield `SecurityError`.
- Optional child at second local origin with `allow="tools *"` exposes public `supplier_widget_quote` only to the parent's explicit origin.
- Parent `getTools({fromOrigins:[secondOrigin]})` sees public, not `private_supplier_widget_quote`; default filter excludes the foreign frame.
- Public execution returns supplier B / 375 cents. Forged private name yields `NotFoundError`.
- After target navigates to first-origin status document, retained descriptor with old origin yields `NotFoundError`.

## Expected response
Actual per-probe results, with second-origin/header-only cases BLOCKED if prerequisites are missing. No claim that native `getTools()` results prove all browser-agent exposure policies.

## Assertions
No opaque sandbox substituted for a proper origin. No arbitrary response-header policy simulated by a meta tag. The local second-origin runner accepts only loopback URLs. In an ordinary insecure HTTP environment, unavailable secure API is UNSUPPORTED, not a permissions pass.

## Cleanup
Download JSON; remove temporary frames through runner cleanup. Stop only the specific local server processes started by the driver when finished.

## References
[Secure context](https://webmachinelearning.github.io/webmcp/#document-extension), [permissions policy](https://webmachinelearning.github.io/webmcp/#permissions-policy), [origin filtering](https://webmachinelearning.github.io/webmcp/#model-context-container), [observations](https://webmachinelearning.github.io/webmcp/#observations).
