# Delivery gates and team handoff

This document distinguishes an executable research demo from a finished hackathon submission. Local test success is not sufficient to close every gate. Status date: 27 October 2026.

| Requirement | Current evidence / next action |
| --- | --- |
| Three complete synthetic attacks | 32/34/30 seconds; 22-player stage roles, possession and ball-event audit; see scenarios.md |
| Published numerical model | Actual accessible-space 2.1.0 execution, pinned dependencies, source/config/input hashes |
| Direct receiving-space semantics | Official AS/DAS integrals; excluded states are null; no causal credit, probability or summed contributions |
| Temporal visualization | Prefix-only curves and revised moments; explicit analysis frames; fixed colour scale |
| Qualitative and sensitivity checks | Ten examples plus resolution/noise/sampling report; no claimed independent football-expert truth |
| Independent acceptance and adversarial review | Independent v2 reviews, reproduced defects and repairs are recorded in acceptance.md and adversarial-review.md; no v1 results are carried forward |
| Clean Linux environment and CI | Corrected Ubuntu run 40103863101 passed locked dependency installation, 50 JavaScript and 33 Python tests, scene checks and model/sensitivity verification; see release-verification.md |
| Real Microsoft Foundry connectivity | The team's original `azure_check.py` returned `OK` from the West US 3 regional Responses endpoint using `gpt-5-mini` on 27 October: 29 tokens. This is a basic real-call check, not the Agent Framework tool-loop acceptance |
| Substantive Microsoft Agent Framework integration | Implemented: one MAF Agent, two native evidence tools, request-scoped Python worker, Node evidence ledger and final validator. Independent offline acceptance: 164 JavaScript and 52 Python tests; simulated provider is explicitly distinguished from Azure |
| Real Agent Framework tool-loop check | **PASSED, 27 October.** Actual Azure + MAF + Node HTTP/evidence tools: basic smoke and eight-case suite; three native model turns and two tools per case. See [basic receipt](../artifacts/agent-framework-trace.json) and [scenario receipt](../artifacts/agent-framework-suite.json), both `mock:false` |
| Public static v2 build | Published and browser-checked at application commit `9b871a934bd125c20cd9df99c7c44c60f93857af`; all six scene/analysis file hashes match the accepted local version. See release-verification.md for checks and CI history |
| Public cloud-enabled service | Requires a configured and hosted Node backend; GitHub Pages cannot supply it |
| Public deployment preparation | Same-origin App Service instructions and a strict HTTP/version/evidence checker are included in deployment.zh-CN.md; an actual hosted cloud deployment is still required |
| Actual functional English video, less than 120 s | 108.04-second actual local preview with English captions is included and visually checked; a final cloud-enabled recording remains pending |
| Team football and comprehension review | Football plausibility and two first-time users' comprehension are recorded separately in team-review.zh-CN.md; the blank form is not completed human-review evidence |
| Final submission | Team submits its entry and category choice with repository, working build and final video |

## Configure Microsoft without exposing credentials

Use [the setup guide](foundry-setup.zh-CN.md). Select an authorized, working Azure inference endpoint. The verified regional route accepts the model identifier used by the team's script; it does not require this application to create a deployment. Other endpoint types can require an existing deployment or project configuration. Store endpoint, model and key only in the ignored local .env or the hosting platform's server environment. Keep the trial spending limit enabled; do not upgrade the subscription or purchase Marketplace services for this demo.

Run `npm run setup:agent`, configure .env, then run `npm run smoke:agent` and `npm run smoke:agent -- --suite`. Missing configuration is a non-run; timeout, invalid output, rejected references and local fallback are failures for the real-call gate. A pass requires the actual MAF runtime, network call, both native tools, their matching provider call IDs, and valid canonical evidence. The suite covers all three scenes, both languages, a limitations question and an instruction to access future data or credentials. These smoke checks do not replace human judgement of answer relevance or football validity. Do not fabricate or edit a passing trace.

For public testing, deploy the same Node service and verify the public health/replay/real explanation paths. The included server defaults to loopback. A hosting environment may set HOST=0.0.0.0 and its assigned PORT. Add platform access and usage controls appropriate to the team's audience; do not publish API keys in client files. Public hosting and retention have not yet been verified.

Follow [the deployment guide](deployment.zh-CN.md). `smoke:deployment` checks actual HTTP paths, local-versus-deployed bytes, exact facts, tool records and the server's claimed cloud status. Its `passed` result is limited to that HTTP contract, and `realCloudVerified` remains false because this checker cannot independently attest Azure. Pair it with the real provider smoke trace and Azure-side invocation evidence; never close the real-call gate from an offline or simulated-protocol result.

## Before submission

The current [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require public source, a testable build, English materials or translation and a video under two minutes. The plan targets an approximately 110-second demonstration and continued access through the judging period. Confirm current deadlines and availability in the official portal before submitting.

Re-run meaningful checks after fixes. Verify that documentation, scene/analysis hashes, UI, recorded video and deployed commit describe the same version. The final recording must show the real state of Microsoft integration at recording time. Keep the longer interactive demo available for inspection.

## Work boundaries

Author-model calculations and synthetic scenarios are implemented; this is not evidence of professional football accuracy. In particular, no one has established individual causal contribution, full decoy credit, defensive value or arbitrary-video tracking. The known sensitivity results remain visible rather than being hidden behind a single quality score.
