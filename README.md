# Off-Ball Lens

**See the dangerous receiving space a player offers before touching the ball—and when that opportunity changes.**

Off-Ball Lens replays three independently authored synthetic football attacks, follows any of the 22 players, and connects receiving-space heatmaps and past opportunity windows to exact evidence frames. Its numerical engine is the authors' [accessible-space 2.1.0](https://github.com/jonas-bischofberger/accessible-space), implementing individual Dangerous Accessible Space (DAS).

**[Interactive replay](https://cabbage1999.github.io/Off-Ball-Lens/)** · [108-second actual preview](https://cabbage1999.github.io/Off-Ball-Lens/assets/demo-preview.html) · [中文说明](docs/README.zh-CN.md) · [Method](docs/method.md) · [Walkthrough](docs/demo-guide.md) · [Acceptance](docs/acceptance.md)

The default experience uses precomputed author-model results and works without an account or API key. **Real Microsoft Foundry verification is pending: the team does not yet have an Azure deployment.** The server includes the real Responses API tool loop and transparent local fallback. Mock protocol tests are not evidence of a successful cloud deployment.

## Run the replay

Use Node.js 22 or later:

```sh
git clone https://github.com/cabbage1999/Off-Ball-Lens.git
cd Off-Ball-Lens
npm start
```

Open `http://127.0.0.1:4173`. The replay and local server have no third-party JavaScript runtime dependencies. Python is only needed to regenerate the included analysis. Serve the files over HTTP; do not open `index.html` as a local file.

## What to explore

| Scene | Duration | Actual interaction to inspect |
| --- | ---: | --- |
| Near-side combination (`used`) | 32 s | A7 offers a receiving option, receives, then participates in a longer attack |
| Alternative option (`unused`) | 34 s | A7's opportunity changes while the carrier chooses a different teammate |
| Defensive recovery (`blocked`) | 30 s | A7 has opportunities, an offside interval, then renewed access before an interception and counter |

The scene labels describe authored events, not score targets. The generator never reads DAS. Each scene includes stage-specific roles for all players, bounded continuous motion, pressure/marking/cover, alternative receivers, and ball events from the same clock.

Select a player, play or seek, and inspect their last three seconds of movement. The heatmap, metrics and evidence bind to an explicit 5 Hz analysis frame; the 10 Hz tracking animation may interpolate. Curves and notifications reveal only the observed prefix. Ball flight, uncontrolled play and unsupported states hide current values. A carrier, defender or offside player is never assigned a misleading zero contribution score.

Fan mode shows one main observation with evidence. Analyst mode adds AS/DAS values, units, versions, source frames and uncertainty. English and Chinese share the same facts. End-of-clip review reveals the complete observed sequence.

## What DAS means

For a player i, the author model constructs a receiving-accessibility field C_i(x) and danger weight V(x):

```text
AS_i  = integral C_i(x) dA            [m²]
DAS_i = integral C_i(x) V(x) dA       [danger-weighted m²]
```

The scalar values come directly from the author's integration. The front-end heatmap is a display approximation, not the calculation of DAS. It uses one fixed global scale across players and clips. Neither heatmap colour nor DAS is a pass/goal probability.

A change in DAS describes a player's opportunities while the whole scene changes. It is not individual causal credit. Individual fields overlap: do not add player values or turn them into contribution shares. A decoy runner can lose direct receiving space while helping a teammate; the [ten qualitative cases](docs/qualitative-cases.md) preserve that limitation.

These synthetic scenes are not professional-match validation. Numerical resolution, positional noise and sampling affect the output: some sampled values change materially under denser grids or 0.1 m perturbations, and 2.5 Hz sampling misses one short window. Notifications are exploratory timing cues, not calibrated verdicts. See [the full integration and sensitivity audit](docs/das-integration.md).

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

## Microsoft Foundry

Follow the [Azure setup and local configuration guide](docs/foundry-setup.zh-CN.md). Copy `.env.example` to `.env`, configure the resource endpoint, model deployment and key locally, and run `npm start`. A deployment must support Responses API, function calling and structured outputs.

The model calls `analyze_window` and `get_evidence`, chooses a bounded past interval, factual clauses and an allowed overlay. The application validates every selected reference and renders deterministic bilingual facts. Invalid output receives one correction attempt, then an explicitly labelled fallback. It never lets the language model recompute a football score. Changing scene, player, time, language or audience discards an outdated response.

```sh
npm run smoke:foundry
```

A successful real call writes a sanitized `artifacts/foundry-trace.json`. Missing configuration exits with **NOT RUN** and makes no request. `cloud-configured` means settings are present; `cloud-verified` applies only after a successful real tool loop. GitHub Pages serves the replay/local explanations only; the Node server must be hosted separately for public cloud use. No key belongs in the browser or repository.

Follow the [public deployment guide](docs/deployment.zh-CN.md) to serve the UI and API from the same Node origin. `npm run smoke:deployment -- --url https://YOUR-APP.azurewebsites.net` checks the hosted HTTP paths, deployed file hashes, tool trace and exact evidence against this checkout. Its default mode requires the server's cloud protocol; `--offline` is explicitly limited to an unconfigured local/offline service. An HTTP contract check does not independently authenticate the server's Azure backend, so its report does not replace the real provider trace and Azure-side invocation evidence. Closing a client request cancels its provider work and retry waits; genuine provider failures still produce the labelled fallback.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/scenarios.mjs`, `data/{used,unused,blocked}.json` | Synthetic tactical scripts, trajectories and events |
| `analytics/` | Author package adapter, field conversion, past-only notification detector, audit |
| `data/analysis/` | Precomputed AS/DAS, eligibility, fixed-scale fields and moment revisions |
| `src/analysis.mjs`, `app.mjs`, `index.html`, `style.css` | Prefix-only replay and evidence interface |
| `src/evidence.mjs`, `src/agent.mjs`, `server.mjs` | Shared facts, Foundry tools, validation and server |
| `tests/`, `analytics/tests/` | Meaningful contract, temporal, numerical and HTTP checks |
| `docs/` | Model/data rationale, setup, independent reviews, walkthrough and delivery status |

## Scope and attribution

The [official hackathon rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require synthetic, football-realistic data. The demo uses invented teams and independently authored trajectories; it contains no match footage or repackaged real tracking. The [hear-the-game reference](https://github.com/klckerim/hear-the-game) informed architectural discussion; its implementation and datasets were not copied.

The DAS paper and package are credited in [research.md](docs/research.md). Their original MIT notice is retained in [analytics/ACCESSIBLE_SPACE_LICENSE.txt](analytics/ACCESSIBLE_SPACE_LICENSE.txt). This repository is MIT licensed and is not affiliated with or endorsed by Microsoft or the Premier League.

The [handoff checklist](docs/handoff.md) separates completed engineering from the still-required real Microsoft call, public backend availability and final submission evidence. Passing local tests alone does not complete the submission.
