# Documentation

Start with the [project overview](../README.md) and [full online demo](https://offball-lens-hackathon-2026.azurewebsites.net/), which includes real Microsoft Agent Framework explanations without a judge account or API key. The [static replay fallback](https://cabbage1999.github.io/Off-Ball-Lens/) provides precomputed analysis and local explanations. The current replay revision is v3, documented on 27 October 2026; deployment and delivery status were updated on 28 October Beijing time. Historical reports retain their original dates and scope.

## Getting started

| Document | Purpose |
| --- | --- |
| [Project overview and commands](../README.md) | Run the replay, reproduce the analysis, and configure the optional Microsoft Agent Framework runtime. |
| [中文说明](README.zh-CN.md) | Chinese introduction and setup overview. |
| [Walkthrough and recording guide](demo-guide.md) | Explore the scenes and plan a demonstration of the current build. |
| [Microsoft Agent Framework setup](foundry-setup.zh-CN.md) | Python environment, authorized Azure configuration, and real-call checks; written in Chinese. |
| [Deployment guide](deployment.zh-CN.md) | Host the UI and API together and verify the service; written in Chinese. |

## Method and synthetic data

| Document | Purpose |
| --- | --- |
| [Method](method.md) | From authored trajectories to receiving-space evidence and bounded explanations. |
| [DAS integration](das-integration.md) | Author-model adaptation, units, exclusions, numerical checks, and sensitivity. |
| [Synthetic scenes](scenarios.md) | Current trajectory version, motion, ball events, and source hashes. |
| [Qualitative cases](qualitative-cases.md) | Ten cases that examine interpretation boundaries, including decoy movement. |
| [Research rationale](research.md) | Scientific model selection, references, and limits. |
| [Source manifest](research-sources.json) | Machine-readable research sources, recorded on 24 October 2026; integration-status wording reflects that earlier snapshot. |

## Current verification

| Record | Scope |
| --- | --- |
| [V3 motion and replay verification](replay-v3.md) | 27 October 2026 revision, current test results, browser observations, and links to real MAF receipts. |
| [Synthetic-data audit](../data/validation.json) | Exported scene hashes and structural, motion, and event checks. |
| [Numerical audit](../analytics/reports/validation.json) | Author-model checks, source/configuration hashes, sampling, noise, and resolution sensitivity. |
| [Real MAF single-case receipt](../artifacts/agent-framework-trace.json) | Recorded Node → MAF → Azure explanation and native evidence-tool calls. |
| [Real MAF expanded-suite receipt](../artifacts/agent-framework-suite.json) | Recorded cases across scenes, languages, and interpretation limits. |
| [Public deployment evidence](../deploy/verification.json) | Two real public MAF calls, including one after restart, on 27 October UTC / 28 October Beijing time; 14 matching application/data files and separate Azure resource-level request metrics. |

These records describe their stated execution scope. Local MAF receipts and public deployment checks are separate evidence. Public hosting has been verified; the current 113.40-second video was publicly published on [YouTube](https://youtu.be/ejo0cYWsC94) on 28 October 2026 Beijing time, with public visibility confirmed in YouTube Studio and playback verified without signing in. Project-page materials are saved and listed in the event Projects collection; the platform exposed no separate finalization control or receipt. Continued service availability and the scope of human review are tracked in the [handoff checklist](handoff.md).

## Historical acceptance and release records

| Record | Historical context |
| --- | --- |
| [Independent v2 acceptance](acceptance.md) | Dated 24 October 2026, with follow-up observations. Original test scope and status are preserved. |
| [Independent v2 adversarial review](adversarial-review.md) | Dated 24 October 2026, with subsequent cancellation and deployment-check reviews. |
| [Release verification](release-verification.md) | Begins with the 24 October v2 release and includes later integration addenda; the current revision is summarized in the v3 record above. |
| [Browser race-condition observations](acceptance-browser-race.json) | Historical simulated-network UI checks; not real Azure-call evidence. |
| [Local HTTP receipt](local-http-check.json) | 24 October 2026 offline loopback check; not a public deployment or real-cloud receipt. |
| [Historical v2 preview](../assets/demo-preview.html) | 108.04-second local recording from 24 October 2026, before the current v3 interface and MAF demonstration. |
| [Archived v2 planning and screenshots](archive/README.md) | Original files moved without changing their bytes; original paths and checksums are recorded. |

Tests with `v2` in their filenames remain part of the current verification suite. Their names alone do not mean that the tests are obsolete.

## Submission materials

| Document | Purpose |
| --- | --- |
| [Submission package](submission/README.md) | Entry materials and submission status. |
| [Delivery gates and handoff](handoff.md) | Completed evidence and remaining delivery work. |
| [Demonstration guide](demo-guide.md) | Current walkthrough, video plan, and historical-preview disclosure. |
| [Team review form](team-review.zh-CN.md) | Football and first-time-user review form; blank fields are not completed review evidence. |

