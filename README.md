# Off-Ball Lens

**See the dangerous receiving space a player offers before touching the ball—and when that opportunity changes.**

Off-Ball Lens replays three independently authored synthetic football attacks, follows any of the 22 players, and connects receiving-space heatmaps and past opportunity windows to exact evidence frames. Its numerical engine is the authors' [accessible-space 2.1.0](https://github.com/jonas-bischofberger/accessible-space), implementing individual Dangerous Accessible Space (DAS).

**[Interactive replay](https://cabbage1999.github.io/Off-Ball-Lens/)** · [Submission materials](docs/submission/README.md) · [Documentation index](docs/README.md) · [中文说明](docs/README.zh-CN.md) · [Method](docs/method.md) · [Walkthrough](docs/demo-guide.md) · [Replay refinement](docs/replay-v3.md) · [Acceptance](docs/acceptance.md)

The default replay uses precomputed author-model results and works without an account or API key. The server includes **one genuine Microsoft Agent Framework (MAF) Agent** with native evidence tools. **On 27 October 2026, the complete local Node → MAF → Azure path passed a real smoke and all eight expanded cases**, using `gpt-5-mini` at `https://westus3.api.cognitive.microsoft.com/openai/v1/responses`. See the sanitized [single-run record](artifacts/agent-framework-trace.json) and [eight-case record](artifacts/agent-framework-suite.json), both marked `mock:false`. Public backend deployment, the final MAF video and human review remain pending. GitHub Pages continues to provide deterministic local explanations.

## Run the replay

Use Node.js 22 or later:

```sh
git clone https://github.com/cabbage1999/Off-Ball-Lens.git
cd Off-Ball-Lens
npm start
```

Open `http://127.0.0.1:4173`. The replay and local server have no third-party JavaScript runtime dependencies. Python is needed for the optional MAF runtime or to regenerate the included analysis, each in its own environment. Serve the files over HTTP; do not open `index.html` as a local file.

## What to explore

| Scene | Duration | Actual interaction to inspect |
| --- | ---: | --- |
| Near-side combination (`used`) | 32 s | A7 offers a receiving option, receives, then participates in a longer attack |
| Alternative option (`unused`) | 34 s | A7's opportunity changes while the carrier chooses a different teammate |
| Defensive recovery (`blocked`) | 30 s | A7 has opportunities, an offside interval, then renewed access before an interception and counter |

The scene labels describe authored events, not score targets. The generator never reads DAS. Each scene includes stage-specific roles for all players, bounded continuous motion, pressure/marking/cover, alternative receivers, and ball events from the same clock. The v3 choreography adds A7's check, curved turn and acceleration; passes travel at 10.20–20.09 m/s while a carried ball follows its carrier. These are audited synthetic choices, not empirically calibrated football norms.

Select a player, play or seek, and inspect their last three seconds of movement. The heatmap, metrics and evidence bind to an explicit 5 Hz analysis frame; the 10 Hz tracking animation may interpolate. Curves and notifications reveal only the observed prefix. Ball flight, uncontrolled play and unsupported states hide current values. A carrier, defender or offside player is never assigned a misleading zero contribution score.

Fan mode centres the pitch, Player Lens and What Are We Seeing. Short bilingual **scripted observations** below the touchline describe already observed movement; they do not invoke a model. Team A uses blue/white shirts with navy numbers, and the fixed heatmap uses violet through orange to pale yellow. Analyst mode retains the opportunity curve, events, receiving windows, AS/DAS values, source frames and tool activity. English and Chinese share the same facts. End-of-clip review in Analyst reveals the complete observed sequence.

## What DAS means

For a player i, the author model constructs a receiving-accessibility field C_i(x) and danger weight V(x):

```text
AS_i  = integral C_i(x) dA            [m²]
DAS_i = integral C_i(x) V(x) dA       [danger-weighted m²]
```

The scalar values come directly from the author's integration. The front-end heatmap is a display approximation, not the calculation of DAS. It uses one fixed global scale across players and clips. Neither heatmap colour nor DAS is a pass/goal probability.

A change in DAS describes a player's opportunities while the whole scene changes. It is not individual causal credit. Individual fields overlap: do not add player values or turn them into contribution shares. A decoy runner can lose direct receiving space while helping a teammate; the [ten qualitative cases](docs/qualitative-cases.md) preserve that limitation.

These synthetic scenes are not professional-match validation. Numerical resolution, positional noise and sampling affect the output: some sampled values change materially under denser grids or 0.1 m perturbations, and 2.5 Hz sampling shifts window timings. Notifications are exploratory timing cues, not calibrated verdicts. See [the full integration and sensitivity audit](docs/das-integration.md).

## Reproduce the numerical results

Use Python 3.12. On macOS/Linux:

```sh
python3.12 -m venv .venv-das
.venv-das/bin/python -m pip install -r requirements-das.lock
.venv-das/bin/python -m pip check
npm run export:data
npm run validate
npm run export:analysis
npm run test:analytics
npm run benchmark
npm test
```

On Windows, create the same environment with `py -3.12 -m venv .venv-das` and install with `.venv-das\Scripts\python.exe -m pip install -r requirements-das.lock`. The npm Python commands detect that environment. `DAS_PYTHON` can select a different installed interpreter.

`benchmark` runs the reproducible numerical, prefix, qualitative and sensitivity audit; it is not a cloud-latency benchmark. `analytics/reports/validation.json` records source/config/input hashes and measured timings. `analyze_frame` uses the same author calculation as batch export:

```sh
node scripts/run-python.mjs -m analytics.compute_das used --frame 104
```

## Microsoft Agent Framework and Azure

Install Python 3.12 alongside Node.js 22 or later, then prepare the separate `.venv-maf` environment:

```sh
npm run setup:agent
npm run test:agent
```

The installer uses [requirements-agent.lock](requirements-agent.lock): MAF core `1.23.0`, its OpenAI provider `1.17.0`, OpenAI SDK `3.39.0`, and the remaining pinned dependencies. `MAF_BOOTSTRAP_PYTHON` can select a Python 3.12 executable during setup; `MAF_PYTHON` can select an absolute interpreter path at runtime. This environment is separate from `.venv-das`.

Copy `.env.example` to the ignored local `.env` and supply your own authorized Azure credential. Its example selects the account-tested West US 3 endpoint, `gpt-5-mini`, Responses, `minimal` reasoning, and `FOUNDRY_ORCHESTRATOR=agent-framework`. That account-specific result does not establish access for another account. See the [setup guide](docs/foundry-setup.zh-CN.md) for resource/project endpoints and authentication.

```sh
npm run start:agent
```

Open the local Node URL and request an explanation. For each request, Node launches one Python child. A single MAF `Agent`, using the Responses provider `OpenAIChatClient`, owns the native model/tool loop. Its only tools are `analyze_window` and `get_evidence`; both ask Node for existing analysis. Node remains authoritative for the selected player, past-time bounds, retrieved claims, final validation, and deterministic bilingual rendering. The model selects claim IDs, evidence IDs and an allowed overlay; it does not recompute DAS. There is no second reviewer Agent or MAF Workflow in this implementation.

The request has a shared 40-second limit, at most six model requests and ten native tool calls, and a maximum 12-second wait per provider/tool call. A rejected candidate gets at most one repair within those same limits. SDK automatic retries are disabled. Native provider response IDs and function-call IDs are matched to the evidence tools actually dispatched. Cancellation stops the child process; changing scene, player, time, language or audience discards an outdated response. The model has no filesystem or shell tool; the Python child is not an operating-system filesystem sandbox.

After local tests pass, these commands make **real, potentially billable Azure requests**:

```sh
npm run smoke:agent
# Optional: three scenes, both languages, limitations and an adversarial question.
npm run smoke:agent -- --suite
```

The checks write sanitized `artifacts/agent-framework-trace.json` or `artifacts/agent-framework-suite.json`. They exercise the Node HTTP route, actual Python MAF worker, native calls, canonical facts and clean child exit. Missing configuration reports **NOT RUN** without a model request. Local tests use an in-memory provider and are not cloud verification. `cloud-configured` means configuration is present; `cloud-verified` follows a successful, validated explanation for the current server configuration.

The 27 October expanded run covered all three scenes in English Analyst and Chinese Fan modes, a limitations question and an adversarial question. The records include per-request timing, model requests, native tool calls and repair counts. These measured runs do not establish a latency guarantee or replace human assessment of relevance and football interpretation.

The Free Trial subscription was rechecked on 27 October and retains `spendingLimit=On`; no new resource, subscription upgrade or Marketplace purchase was needed for these checks. Cloud inference is not inherently free: eligible usage consumes trial credit, and availability depends on the account and remaining credit. Keep credentials in local `.env` or server-side hosting settings. No key belongs in the browser or repository. See [Microsoft's spending-limit guidance](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit).

The existing `FOUNDRY_ORCHESTRATOR=native` path remains available with `npm start` and `npm run smoke:foundry`; it supports Responses or resource-level Chat Completions. MAF currently requires Responses. Chat Completions JSON mode is not a provider-enforced schema, so the same local evidence checks remain necessary.

For public cloud use, follow the [deployment guide](docs/deployment.zh-CN.md) and host the UI and API together with both required runtimes. A TLS reverse proxy can set an explicit `PUBLIC_ORIGIN`. GitHub Pages has no public MAF backend. `smoke:deployment` checks a chosen service's HTTP contract and evidence; it does not independently authenticate that service's Azure backend.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/scenarios.mjs`, `data/{used,unused,blocked}.json` | Synthetic tactical scripts, trajectories and events |
| `analytics/` | Author package adapter, field conversion, past-only notification detector, audit |
| `data/analysis/` | Precomputed AS/DAS, eligibility, fixed-scale fields and moment revisions |
| `src/analysis.mjs`, `src/presentation.mjs`, `app.mjs`, `index.html`, `style.css` | Prefix-only replay, fixed palette, authored cues and evidence interface |
| `src/evidence.mjs`, `src/evidence-session.mjs`, `src/agent.mjs` | Canonical facts, evidence ledger/validation and legacy native provider path |
| `agent_runtime/`, `src/maf-bridge.mjs`, `server.mjs` | MAF Agent, bounded Python/Node bridge and same-origin HTTP server |
| `tests/`, `agent_runtime/tests/`, `analytics/tests/` | Contract, temporal, MAF/protocol, numerical and HTTP checks |
| `docs/` | Model/data rationale, setup, independent reviews, walkthrough and delivery status |

## Scope and attribution

The [official hackathon rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require synthetic, football-realistic data. The demo uses invented teams and independently authored trajectories; it contains no match footage or repackaged real tracking. The [hear-the-game reference](https://github.com/klckerim/hear-the-game) informed architectural discussion; its implementation and datasets were not copied.

The DAS paper and package are credited in [research.md](docs/research.md). Their original MIT notice is retained in [analytics/ACCESSIBLE_SPACE_LICENSE.txt](analytics/ACCESSIBLE_SPACE_LICENSE.txt). This repository is MIT licensed and is not affiliated with or endorsed by Microsoft or the Premier League.

The [handoff checklist](docs/handoff.md) records the completed MAF cloud check separately from pending public backend availability, final video, human review and submission evidence. The local real-cloud pass does not complete those remaining items.
