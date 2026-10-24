# Public v2 release verification

Checked on 24 October 2026 by the root integration role. This record supplements the independent local acceptance and adversarial reports; it does not extend those roles' claims to checks they did not perform.

Initial application release: [`9b871a934bd125c20cd9df99c7c44c60f93857af`](https://github.com/cabbage1999/Off-Ball-Lens/commit/9b871a934bd125c20cd9df99c7c44c60f93857af). All 77 published files were compared by Git blob SHA against their local bytes before moving `main`; nine obsolete v1 files were removed, and v1 remains in commit history. The subsequent precision correction changed tests and documentation only. The later service and deployment-check changes are recorded separately below; model parameters, scenes, analysis and the original video remain unchanged.

## Public browser verification

The actual [GitHub Pages replay](https://cabbage1999.github.io/Off-Ball-Lens/) was opened in Chromium after the [Pages deployment succeeded](https://github.com/cabbage1999/Off-Ball-Lens/actions/runs/40102859937).

- SHA-256 checks through the public origin matched the accepted local bytes for all three scene JSON files, all three analysis JSON files, `index.html`, `app.mjs`, the analysis worker and the evidence module. This checks the deployed content rather than merely the existence of a URL.
- At `used` 11.0 s, A7 shows AS 242.5 m² and DAS 0.586 danger-weighted m². The explanation identifies local deterministic wording, its 5.0–11.0 s interval and source frame. Its 5.0 s evidence button seeks to `used:0050` and clears the old answer.
- At 12.2 s, pass flight makes DAS unavailable. At 12.4 s, A7 becomes the carrier and receiving metrics remain unavailable.
- At `unused` 16.8 s, the window remains open. At the 16.9 s pass release to another player, it becomes not used. The final review reports two windows, zero receptions and two windows ending without a pass to A7.
- At `blocked` 8.2 s, A7 is geometrically offside with unavailable DAS. At 20.2 s, the interception changes the attacking team; selecting B7 displays B7's eligible field. All 22 roster options are present. Chinese explanations follow B7 and retain the explicit local-template source.
- GitHub Pages has no Node backend. Its one initial `/api/health` probe returns 404 as expected; the app remains in static/local mode. This is not a successful Microsoft health check. No other console error was observed during these application checks.

The public [actual demo preview](https://cabbage1999.github.io/Off-Ball-Lens/assets/demo-preview.html) was played and sought to 45.0 s in Chromium. The browser reported a duration of **108.04 s**, ready state 4, no media error, and five English caption cues in showing mode. It records the local engineering demo and visibly discloses that no Azure call was made. It is not a final cloud-enabled submission recording.

## Cross-platform CI and correction

The first [Ubuntu verification run](https://github.com/cabbage1999/Off-Ball-Lens/actions/runs/40102860487) installed the pinned Python dependencies in a clean runner and passed all 50 JavaScript tests and scene validation. Python reported 31 passed / 1 failed. The failed independent single-frame check incorrectly required stored macOS floating-point scalars to be bit-identical to freshly computed Linux scalars. For example, an AS value changed from 985.5759887695312 to 985.5760498046875; status, identity and heatmap bytes were unchanged.

The independent acceptance role repaired that test, retaining exact single-frame versus newly computed batch equality in the same runtime. Cross-platform stored AS/DAS values use a strict 1e-6 relative tolerance with no absolute floor; identities, statuses, nulls, source hashes and encoded heatmap bytes remain exact. Regression checks accept the observed CI differences and reject materially changed numbers, invalid values, state/identity changes and corrupted heatmaps. The model and stored outputs were not modified to make CI pass. See [the independent report](acceptance.md) for the exact scope and numerical rationale.

The corrected [Ubuntu run 40103863101](https://github.com/cabbage1999/Off-Ball-Lens/actions/runs/40103863101), at commit `f97dbcda8913599644ca9546017873a0f0151c8e`, **passed every step**: clean locked-dependency installation, 50 JavaScript tests, scene validation, all 33 Python tests, author-model adaptation and sensitivity checks, and JavaScript syntax checks. Its [Pages deployment](https://github.com/cabbage1999/Off-Ball-Lens/actions/runs/40103862842) also succeeded. The initial failed run remains available rather than being represented as a pass.

The adversarial role separately reviewed the precision correction without editing it and found no P1/P2 issue or excessive tolerance. It independently ran the nine acceptance tests, accepted 40 deliberate within-tolerance changes, rejected 342 numerical/structural corruptions and four hash corruptions, and confirmed that even a 0.5 ppm single-frame change fails the same-runtime exact batch comparison. Its reviewed test-file SHA-256 is `8a941796ffd1af2cbf992319f8b321af392d967bae8e75a6303d7bbde87fcabf`. These are numerical/software checks, not validation of football accuracy.

## Integration-only addition and remaining gates

The root integration role added HTTP byte-range handling for the local video, then reran the HTTP tests and actual browser seek check. At that initial release, `server.mjs` SHA-256 was `527c23266b4cf3fb804b55a78fad6eaac074da6c27e3518ebec95b8fc52f1b69`. The earlier server fingerprint in the independent adversarial report identifies that role's review snapshot and is not a claim that it separately reviewed this later media-serving addition.

## Completion-audit follow-up: cancellation and public-service verification

A further comparison against plan pages 8–12 found two executable gaps before an Azure account becomes available: the local provider smoke check bypassed the deployed HTTP service, and delayed/out-of-order browser responses had not been exercised. The independent acceptance role also reproduced two disconnected clients retaining the server's two provider slots and causing a new request to receive 503.

The service now propagates premature response closure through the provider fetch/body read and retry wait, stops subsequent tool rounds, and does not create an unused fallback or cache a cancelled result. Normal completed responses and provider timeout fallbacks retain their prior behavior. Three implementation regressions and four independently authored counterexamples cover both actual local HTTP sockets and delayed native-fetch response bodies. The old hash-mismatch HTTP tests now use real loopback sockets instead of incomplete response stubs. The complete JavaScript suite passes **81/81** locally after these changes; the numerical inputs and Python code are unchanged.

During review, a temporary Node-only timer import in the shared browser explanation module was caught before publication and replaced with browser-compatible cancellation. A permanent browser/worker import-graph check and actual Chromium observations cover that failure mode. The acceptance role executed **8/8** delayed/out-of-order UI cases plus **2/2** visible network-fallback cases. Four cases deliberately ignored the browser AbortSignal in test code so the obsolete response body actually arrived; the generation guard still preserved the new frame, player, language, explanation, evidence controls and pitch pixels. These are clearly labelled simulated network tests, not Microsoft calls. See [the independent observations](acceptance-browser-race.json) and [the updated report](acceptance.md).

The new `smoke:deployment` command checks a specified Node HTTP origin, twelve deployed resource hashes, the scenario catalog, health state, same-origin explanation request, tool history and exact facts. Twenty-four focused HTTP cases cover failures, legal historical subwindows and insufficient numerical evidence. In particular, a valid API reply about an all-flight/no-sample window is insufficient for this deliberately numerical probe. The default cloud-protocol mode rejects an unconfigured service or fallback. `--offline` is explicitly separate. The root's [actual local HTTP receipt](local-http-check.json) passed all twelve file comparisons and explanation checks, while the default cloud-required run correctly failed with `cloud_not_configured`.

The checker records `cloudProtocolVerified` and `serverReportedCloudVerified` separately. Its `realCloudVerified` is always false because an HTTP response cannot independently prove the server's Azure backend: an actual provider trace and Azure-side invocation evidence remain necessary. A previously overstrong draft flag was found and corrected before release; neither a local mock nor an HTTPS mock is counted as real Azure evidence.

Follow-up source fingerprints:

| File | SHA-256 |
| --- | --- |
| `server.mjs` | `da51a89e5b8301338bd342d4f2f346a6111351ac205be5a5f9e73dca6d5ae8c7` |
| `src/agent.mjs` | `41b2f8f230b8962540af10ecf4cfedb381c4d0f27a1191cf09b4ee3b997af6ac` |
| `scripts/smoke-deployment.mjs` | `02cbc39053a6a150e1606d1c6d4060ce0e3f753b7bbf1fb26f54963c0e11212d` |

The [public hosting guide](deployment.zh-CN.md) makes the same-origin UI/API requirement explicit. The [team review form](team-review.zh-CN.md) remains blank and separates football plausibility from two first-time users' comprehension; a prepared form is not completed human evaluation.

Real Microsoft Foundry authentication, actual model/tool calls, hosted cloud-backend operation and the final cloud-enabled recording remain **NOT RUN** because no deployment is available. Follow the [Chinese account and local configuration guide](foundry-setup.zh-CN.md), then run the real smoke check. A static demo, simulated provider test or configured environment variable does not satisfy this gate. Tactical realism still needs a football-knowledgeable human review; no professional-football calibration or causal off-ball value is established by software tests.
