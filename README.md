# WebMCP Test Harness

Static test sites, agent scenarios and eval suites for testing how a browsing
agent handles WebMCP tool edge cases. The first fixture is **Widget Works**, an
emoji-themed widget store with synthetic inventory, reservations and orders.
There are no real purchases, backend services, production dependencies or
build step for the site.

## What is included

- [Widget Works](tests/agent-tool-handling/index.html): 30 baseline native WebMCP
  tools, a dynamically registered engraving tool and a destination-only return
  tool. Covers successful/delayed results, errors, hanging calls, registration,
  unregistration, navigation, cancellation, checkout and untrusted data.
- [Scenario skill](.github/skills/webmcp-agent-tool-handling/SKILL.md) and
  [28 Markdown scenarios](.github/skills/webmcp-agent-tool-handling/scenarios/index.md):
  complete prompts, expected tools/outcomes, setup, assertions and cleanup.
- [JSON eval suites](tests/agent-tool-handling/evals/README.md): nine tool
  trajectories and fifteen conversation simulations compatible with
  GoogleChromeLabs `webmcp-evals`, covering selected branches of 14 scenarios.
- [Native diagnostics](tests/agent-tool-handling/diagnostics.html): opt-in browser
  probes for schemas, execution, cancellation, document lifetime, frames and
  permissions. Native probes are not proof of actual-agent behavior.
- [Dependency-free tests](tests/agent-tool-handling/contracts.test.mjs), a local
  static server, a coverage manifest and an allowlisted Pages staging script.

## Run locally

From this repository root, using Python 3:

```powershell
python tests\agent-tool-handling\scripts\serve.py --port 8765
```

Open <http://127.0.0.1:8765/webmcp-test-harness/>. The root entry opens Widget
Works at `/webmcp-test-harness/tests/agent-tool-handling/`, matching the GitHub
Pages project prefix. The helper also serves root-relative local URLs and maps
`.mjs` to a JavaScript MIME type.

Use a current WebMCP-capable browser, enable its WebMCP testing feature and
restart. In Edge Canary/Dev, check `about://flags/#enable-webmcp-testing`.
Verify registration readiness in the fixture's test lab; API presence alone is
not conformance. The UI remains usable without WebMCP, but native tests report
**UNSUPPORTED**, never a fabricated pass. No shim is installed.

Read the [fixture guide](tests/agent-tool-handling/README.md) for tool contracts,
native diagnostics, second-origin probes and the optional isolated Edge driver.
For agent scenarios, the test driver reads expectations privately and sends only
the scenario's user prompts to a separate agent-under-test conversation.

## GitHub Pages

After deployment, the site will be available at:

<https://sjdallst2.github.io/webmcp-test-harness/>

The root entry opens the store. Direct links:

- [Widget Works](https://sjdallst2.github.io/webmcp-test-harness/tests/agent-tool-handling/)
- [Native diagnostics](https://sjdallst2.github.io/webmcp-test-harness/tests/agent-tool-handling/diagnostics.html)
- [JSON eval guide](https://sjdallst2.github.io/webmcp-test-harness/tests/agent-tool-handling/evals/README.md)

### One-time repository setup

1. A repository administrator opens **Settings > Pages > Build and deployment**.
2. Set **Source** to **GitHub Actions**, not branch-based publishing.
3. Commit and push this repository's files to `main`.
4. Open **Actions > Validate and deploy WebMCP Test Harness** and check the run.
   Main-branch pushes deploy automatically; it can also be run manually on
   `main`. Pull requests run validation only and cannot deploy.

The [workflow](.github/workflows/deploy-pages.yml) runs the fixture/eval/link/
staging checks before deployment. It uses Node 22, pinned actions, a
`github-pages` environment and a deployment job with `pages: write` and
`id-token: write` permissions. No model API key or third-party hosting secret is
needed. Workflow changes must be pushed before GitHub can execute them.

The deployment artifact contains only the root entry, license and explicit
fixture assets, including JSON eval files and usage docs. It does not publish
the repository wholesale, Python server, Node tests, scripts, `.git` or `.github`.
Skill/scenario links in published guides point to their GitHub source.

To inspect an artifact locally, supply a **new** directory:

```powershell
node tests\agent-tool-handling\scripts\stage-pages.mjs "$env:TEMP\webmcp-harness-pages-inspect"
```

Staging refuses an existing output directory and never overwrites or deletes it.
The output can be served by any static host. All browser assets use relative
URLs; no server routing or response-header customization is needed for the
ordinary single-origin store.

## Validate

Using Node 22 or later:

```powershell
node --test tests\agent-tool-handling\contracts.test.mjs tests\agent-tool-handling\evals.test.mjs
node --check tests\agent-tool-handling\app.mjs
```

If tool metadata or JSON case mappings change, regenerate the manifest before
running tests:

```powershell
node tests\agent-tool-handling\scripts\coverage.mjs --write
```

Tests cover deterministic cart totals, stock, input validation, domain failures,
authorization/idempotency, reset/abort isolation, JSON contracts, scenario links
and standalone Pages staging. Registry-dependent callback replays are explicitly
skipped without a real native API.

## Coverage limits and evidence

Keep fixture correctness, native API behavior and actual-agent UX verdicts
separate. Local tests and a static deployment do not prove an agent passed.
Timed interruption, late-result suppression, exact native serialization,
same-name frame identity and policy cases still require the appropriate
driver/native scenarios.

Upstream `webmcp-evals smoke` executes required concrete calls but does **not**
check result matchers or agent responses. Use the
[JSON eval guide](tests/agent-tool-handling/evals/README.md) for live browser and
simulation commands, extension integration and provider usage details. Model
evals are optional and require separately configured providers; the site and CI
do not call them.

MIT licensed; see [LICENSE](LICENSE).
