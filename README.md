# Off-Ball Lens

**A footballer can create a receiving option without touching the ball. What changes if they run a different route?**

Off-Ball Lens is an interactive feasibility demo for the Microsoft Premier League Hackathon. It replays independently authored synthetic football, compares two physically feasible runs, and links every explanation to calculated evidence.

**[Open the interactive demo](https://cabbage1999.github.io/Off-Ball-Lens/)** · [中文说明](docs/README.zh-CN.md) · [Demo walkthrough](docs/demo-guide.md) · [Method](docs/method.md) · [Independent acceptance](docs/acceptance.md)

The static demo runs locally in your browser. No account, GPU, model training or API key is required. The optional Microsoft Foundry integration requires a separately configured server. **No real Azure deployment has been tested for this delivery.**

## Run locally

Install Node.js 22 or later, clone this repository, and run:

```sh
git clone https://github.com/cabbage1999/Off-Ball-Lens.git
cd Off-Ball-Lens
npm start
```

Open `http://127.0.0.1:4173`. There are **no third-party runtime dependencies** and no installation/build step. Do not open `index.html` as a `file://` URL: ES modules and the analysis worker need HTTP.

## Explore

1. Play one of three 16-second, 22-player, 10 Hz scenes: an angled option, a run into traffic, and an early run beyond the defensive line.
2. Follow A7, who never receives the ball in these clips. Inspect the region, receiver-readiness and passing-lane components at the current frame.
3. Compare the recorded run with a smooth stop, continuation at initial velocity, or the identical route as a zero-difference control. Both branches start with the same position and velocity.
4. Inspect the average index change over the common pre-pass window and jump to the largest difference. The comparison is **retrospective with fixed surroundings**.
5. Ask about the run and jump from the explanation to its evidence frames. Local wording is explicitly identified as a deterministic template.
6. Change assumptions, run nine sensitivity checks, inspect the team's best receiving option, and export the evidence as JSON.

The interface supports English / Chinese, fan / analyst detail, keyboard playback, responsive layouts, and a five-step walkthrough. The walkthrough is deliberately longer than a competition submission clip, so the team can inspect both positive and negative cases.

## What the index means

For receiver `i`, at a hypothetical immediate ground-pass release:

```text
A_i = 100 × O_i × max_g [ U(g) × R_i(g) × B(g) ]
```

`O` screens positional offside at release; `U` is a transparent geometric region preference; `R` describes the receiver's readiness; `B` describes defensive reachability along the ground-pass lane. All components come from the **same** selected candidate. Eight local offsets are shared across branches: speed changes reachability, not the extent of the search grid.

The time-averaged difference between two routes is measured in **index points**, not percentage points, goal probability, xG, EPV, or true causal contribution. Direct receiving opportunity does not measure defender attraction or all off-ball value. Personal improvements must not be summed into a team contribution. The team-level comparison separately evaluates the maximum index among eligible receivers.

The method is an original, transparent baseline informed by published work; it is **not a reproduction or validated substitute** for the cited models. See [the implemented equations and boundaries](docs/method.md), [literature review](docs/research.md), and [machine-readable sources](docs/research-sources.json).

## Microsoft Foundry integration

The optional server uses the Microsoft Foundry `/openai/v1/responses` API with three tools: `analyze_window`, `compare_run`, and `get_evidence`. The model selects tools and verified claim/evidence IDs. The application validates them and renders deterministic numerical claims. It does not blindly display generated numerical prose.

Copy `.env.example` to `.env`, fill in your own endpoint, deployment name and key **locally**, then start:

```sh
node --env-file=.env server.mjs
```

Use a deployment supporting the Responses API, function calling and structured outputs. To make an explicit live smoke call after configuration:

```sh
node --env-file=.env scripts/smoke-foundry.mjs
```

This call uses your Azure deployment and may incur normal usage charges. The smoke check must succeed before claiming the cloud integration is verified. Current tests use simulated provider responses to validate the protocol and error paths; they are not a real Foundry integration test.

| Runtime state | What is actually happening |
| --- | --- |
| Static page / no Azure configuration | Browser or server executes deterministic analysis and local templates |
| Azure configured, not yet verified | Endpoint settings exist; no successful cloud response is implied |
| Foundry verified for an answer | Real response completed the tool loop and passed evidence validation |
| Cloud failure / invalid evidence | Local fallback is explicitly shown; replay and calculations continue |

Keys remain on the server. GitHub Pages cannot host the optional server. For a shared cloud-enabled deployment, add authentication, resource limits and appropriate hosting; the included server defaults to local loopback. This is a demo server, not a production multi-user service.

## Reproduce and inspect

```sh
npm test
npm run export:data
npm run validate
npm run benchmark
```

`data/*.json` contains reproducible tracking fixtures, data validation and local timing reports. The fixed seed is `20261022`. The scene generator does not read or optimize the score. Authored scenarios establish regression examples, **not independently measured football ground truth**.

Tests cover trajectory speed and vector acceleration, identity and ball/event consistency, mirror/translation invariants, initial-state equality, identical-route zero, positional offside edge cases, pre-release truncation, future-data isolation, arrival/readiness counterexamples, lane checks, exported fixtures, cloud-tool validation and local HTTP behavior. [Independent acceptance](docs/acceptance.md) and [adversarial review](docs/adversarial-review.md) distinguish completed checks from scientific validation limits.

## Repository map

```text
index.html / app.mjs / style.css   Interactive replay and analysis interface
src/scenarios.mjs                 Independent synthetic trajectories and events
src/model.mjs                     Receiving index, route comparison, sensitivity
src/analysis-worker.mjs           Background analysis for responsive playback
src/agent.mjs                     Evidence tools, templates and Foundry adapter
server.mjs                       Local static/API server
data/                            Reproducible fixtures and measured reports
tests/                           Regression and independent acceptance tests
scripts/                         Data export, validation, benchmark, cloud smoke
docs/                            Method, sources, audit, team handoff and demo guide
```

## Competition scope

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require synthetic, football-realistic data. This demo uses no real player identities, match footage or third-party tracking dataset. The referenced [hear-the-game project](https://github.com/klckerim/hear-the-game) informed the separation of deterministic facts from generated explanations; its source code and datasets were not copied.

This repository is a **feasibility demo**, not a completed competition submission. Before submission, the team still needs to validate a real Microsoft deployment and prepare the required English submission and video of less than two minutes. The longer walkthrough here is intended for engineering review. See [the handoff checklist](docs/handoff.md).

MIT licensed. Independent project; not affiliated with or endorsed by Microsoft or the Premier League.
