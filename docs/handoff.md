# Delivery gates and team handoff

This document distinguishes an executable research demo from a finished hackathon submission. Local test success is not sufficient to close every gate. Status date: 24 October 2026.

| Requirement | Current evidence / next action |
| --- | --- |
| Three complete synthetic attacks | 32/34/30 seconds; 22-player stage roles, possession and ball-event audit; see scenarios.md |
| Published numerical model | Actual accessible-space 2.1.0 execution, pinned dependencies, source/config/input hashes |
| Direct receiving-space semantics | Official AS/DAS integrals; excluded states are null; no causal credit, probability or summed contributions |
| Temporal visualization | Prefix-only curves and revised moments; explicit analysis frames; fixed colour scale |
| Qualitative and sensitivity checks | Ten examples plus resolution/noise/sampling report; no claimed independent football-expert truth |
| Independent acceptance and adversarial review | Independent v2 reviews, reproduced defects and repairs are recorded in acceptance.md and adversarial-review.md; no v1 results are carried forward |
| Real Microsoft Foundry call | **NOT RUN.** Team has no usable deployment; follow foundry-setup.zh-CN.md, then run smoke:foundry |
| Public static v2 build | Must be checked after the rebuilt files are published; the public URL alone is not proof of the current version |
| Public cloud-enabled service | Requires a configured and hosted Node backend; GitHub Pages cannot supply it |
| Actual functional English video, less than 120 s | 108.04-second actual local preview with English captions is included and visually checked; a final cloud-enabled recording remains pending |
| Team football review | A football-knowledgeable team member should adjudicate tactical plausibility; internal agents are not independent domain experts |
| Final submission | Team submits its entry and category choice with repository, working build and final video |

## Configure Microsoft without exposing credentials

Use [the setup guide](foundry-setup.zh-CN.md). The team must create/choose its Azure subscription, authorize the resource and deploy a compatible model. Store the endpoint, deployment and key only in the ignored local .env or the hosting platform's server environment.

Run `npm run smoke:foundry`. A missing deployment is a non-run; timeout, invalid output, rejected references and local fallback are failures for the real-call gate. A pass requires the actual network call, both tools and valid evidence, with a sanitized trace. Do not fabricate or edit a passing trace.

For public testing, deploy the same Node service and verify the public health/replay/real explanation paths. The included server defaults to loopback. A hosting environment may set HOST=0.0.0.0 and its assigned PORT. Add platform access and usage controls appropriate to the team's audience; do not publish API keys in client files. Public hosting and retention have not yet been verified.

## Before submission

The current [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) require public source, a testable build, English materials or translation and a video under two minutes. The plan targets an approximately 110-second demonstration and continued access through the judging period. Confirm current deadlines and availability in the official portal before submitting.

Re-run meaningful checks after fixes. Verify that documentation, scene/analysis hashes, UI, recorded video and deployed commit describe the same version. The final recording must show the real state of Microsoft integration at recording time. Keep the longer interactive demo available for inspection.

## Work boundaries

Author-model calculations and synthetic scenarios are implemented; this is not evidence of professional football accuracy. In particular, no one has established individual causal contribution, full decoy credit, defensive value or arbitrary-video tracking. The known sensitivity results remain visible rather than being hidden behind a single quality score.
