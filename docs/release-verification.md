# Public v2 release verification

Checked on 24 October 2026 by the root integration role. This record supplements the independent local acceptance and adversarial reports; it does not extend those roles' claims to checks they did not perform.

Application release: [`9b871a934bd125c20cd9df99c7c44c60f93857af`](https://github.com/cabbage1999/Off-Ball-Lens/commit/9b871a934bd125c20cd9df99c7c44c60f93857af). All 77 published files were compared by Git blob SHA against their local bytes before moving `main`; nine obsolete v1 files were removed, and v1 remains in commit history. Later numerical-test/documentation corrections do not change the released application, model, scenes, analysis, or video.

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

The follow-up GitHub Actions result is tracked in the repository's [verification workflow](https://github.com/cabbage1999/Off-Ball-Lens/actions/workflows/verify.yml); the initial failed run remains available rather than being represented as a pass.

## Integration-only addition and remaining gates

The root integration role added HTTP byte-range handling for the local video, then reran the HTTP tests and actual browser seek check. The final `server.mjs` SHA-256 is `527c23266b4cf3fb804b55a78fad6eaac074da6c27e3518ebec95b8fc52f1b69`. The earlier server fingerprint in the independent adversarial report identifies that role's review snapshot and is not a claim that it separately reviewed this later media-serving addition.

Real Microsoft Foundry authentication, actual model/tool calls, hosted cloud-backend operation and the final cloud-enabled recording remain **NOT RUN** because no deployment is available. Follow the [Chinese account and local configuration guide](foundry-setup.zh-CN.md), then run the real smoke check. A static demo, simulated provider test or configured environment variable does not satisfy this gate. Tactical realism still needs a football-knowledgeable human review; no professional-football calibration or causal off-ball value is established by software tests.
