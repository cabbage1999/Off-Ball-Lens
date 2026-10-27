# Delivery gates and team handoff

This document distinguishes an executable research demo from a finished hackathon submission. Local test success is not sufficient to close every gate. Current status: 28 October 2026, Beijing time. Earlier dated tests remain evidence of their original execution scope.

| Requirement | Current evidence / next action |
| --- | --- |
| Three complete synthetic attacks | 32/34/30 seconds; 22-player stage roles, possession and ball-event audit; see scenarios.md |
| Published numerical model | Actual accessible-space 2.1.0 execution, pinned dependencies, source/config/input hashes |
| Direct receiving-space semantics | Official AS/DAS integrals; excluded states are null; no causal credit, probability or summed contributions |
| Temporal visualization | Prefix-only curves and revised moments; explicit analysis frames; fixed colour scale |
| Qualitative and sensitivity checks | Ten examples plus resolution/noise/sampling report; no claimed independent football-expert truth |
| Independent acceptance and adversarial review | Current v3 independent acceptance and adversarial review are recorded in replay-v3.md, including the repaired failed-load state; earlier reviews remain historical |
| Clean Linux environment and CI | Corrected Ubuntu run 40103863101 passed locked dependency installation, 50 JavaScript and 33 Python tests, scene checks and model/sensitivity verification; see release-verification.md |
| Real Microsoft Foundry connectivity | The team's original `azure_check.py` returned `OK` from the West US 3 regional Responses endpoint using `gpt-5-mini` on 27 October: 29 tokens. This is a basic real-call check, not the Agent Framework tool-loop acceptance |
| Substantive Microsoft Agent Framework integration | Implemented: one MAF Agent, two native evidence tools, request-scoped Python worker, Node evidence ledger and final validator. Independent offline acceptance: 176 JavaScript and 52 Python tests; simulated provider is explicitly distinguished from Azure |
| Real Agent Framework tool-loop check | **PASSED, 27 October.** Actual Azure + MAF + Node HTTP/evidence tools: basic smoke and eight-case suite; three native model turns and two tools per case. See [basic receipt](../artifacts/agent-framework-trace.json) and [scenario receipt](../artifacts/agent-framework-suite.json), both `mock:false` |
| Historical public static v2 build | Published and browser-checked at application commit `9b871a934bd125c20cd9df99c7c44c60f93857af`; all six scene/analysis file hashes match the accepted local version. See release-verification.md for checks and CI history |
| Public cloud-enabled service | **Verified, 28 October Beijing time / 27 October UTC.** [Azure App Service](https://offball-lens-hackathon-2026.azurewebsites.net/) serves the UI and real MAF backend without a judge account or API key. Two real public calls passed, including one after restart; each used three model requests and both native tools. See [deployment evidence](../deploy/verification.json) |
| Public deployment verification | App Service F1 hosts the same-origin service; 14 deployed application/data files matched the checked source. HTTP receipts and Azure resource-level request metrics are recorded separately in [deployment evidence](../deploy/verification.json). F1 may sleep; continued access through judging still requires operation and monitoring |
| Actual functional English video, less than 120 s | Current v3/MAF recording: **113.40 seconds**, English captions, publicly published on [YouTube](https://youtu.be/ejo0cYWsC94) on 28 October 2026 Beijing time; public visibility is confirmed in YouTube Studio and playback was verified in a signed-out Chrome window. Recorded against the local build before public deployment. The historical v2 108.04-second preview is retained |
| Team football and comprehension review | Football plausibility and two first-time users' comprehension are recorded separately in team-review.zh-CN.md; the blank form is not completed human-review evidence |
| Project-page delivery | The required materials have been saved on Innovation Studio project 126816, and Off-Ball Lens is listed in the event Projects collection. The page has no observed independent Submit/Finalize control or formal receipt. See the [delivery record](submission/submission-record.json) for the verification boundary |

## Configure Microsoft without exposing credentials

Use [the setup guide](foundry-setup.zh-CN.md). Select an authorized, working Azure inference endpoint. The verified regional route accepts the model identifier used by the team's script; it does not require this application to create a deployment. Other endpoint types can require an existing deployment or project configuration. Store endpoint, model and key only in the ignored local .env or the hosting platform's server environment. Keep the trial spending limit enabled; do not upgrade the subscription or purchase Marketplace services for this demo.

Run `npm run setup:agent`, configure .env, then run `npm run smoke:agent` and `npm run smoke:agent -- --suite`. Missing configuration is a non-run; timeout, invalid output, rejected references and local fallback are failures for the real-call gate. A pass requires the actual MAF runtime, network call, both native tools, their matching provider call IDs, and valid canonical evidence. The suite covers all three scenes, both languages, a limitations question and an instruction to access future data or credentials. These smoke checks do not replace human judgement of answer relevance or football validity. Do not fabricate or edit a passing trace.

For public testing, use the [deployed same-origin service](https://offball-lens-hackathon-2026.azurewebsites.net/). Its health, replay and real explanation paths passed the checks recorded in [deployment evidence](../deploy/verification.json), including a check after restart. [GitHub Pages](https://cabbage1999.github.io/Off-Ball-Lens/) remains a static fallback with local explanations. The included server defaults to loopback; the host supplies HOST=0.0.0.0 and its assigned PORT. Credentials remain in server settings. The F1 hosting tier is free, while Azure inference consumes the project's allowance; the trial spending limit remains enabled. These checks establish observed availability, not guaranteed retention through judging.

Follow [the deployment guide](deployment.zh-CN.md). `smoke:deployment` checks actual HTTP paths, local-versus-deployed bytes, exact facts, tool records and the server's claimed cloud status. Its `passed` result is limited to that HTTP contract, and `realCloudVerified` remains false because this checker cannot independently attest Azure. Pair it with the real provider smoke trace and Azure-side invocation evidence; never close the real-call gate from an offline or simulated-protocol result.

## Before submission

The current [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require public source, a testable build, English materials or translation and a video under two minutes. The recorded demonstration is 113.40 seconds, publicly published, and playable without signing in. The project page contains its public link, the full Azure experience, English description, and public repository. The platform did not expose a separate submission receipt during verification. Keep the complete service available through the judging period, ending 11 November 2026 at 15:59 Beijing time (10 November at 23:59 Pacific Standard Time). Confirm current deadlines and availability in the official portal before submitting.

Re-run meaningful checks after fixes. Verify that documentation, scene/analysis hashes, UI, recorded video and deployed commit describe the same version. The final recording must show the real state of Microsoft integration at recording time. Keep the longer interactive demo available for inspection.

## Work boundaries

Author-model calculations and synthetic scenarios are implemented; this is not evidence of professional football accuracy. In particular, no one has established individual causal contribution, full decoy credit, defensive value or arbitrary-video tracking. The known sensitivity results remain visible rather than being hidden behind a single quality score.
