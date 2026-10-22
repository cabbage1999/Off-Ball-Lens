# Independent acceptance record

Date: 22 October 2026. Scope: the authorized offline demo and a configurable Microsoft Foundry interface. Live Azure deployment verification is outside this acceptance run because no Azure account or deployment was supplied.

The acceptance role received the requested “GPT-6 Astra / max” configuration. This record does not independently establish which underlying model or reasoning setting the platform actually used.

## Current result

The frozen **receiving-index-v1.3** implementation passes the automated and browser acceptance checks described below. The complete final test suite completed with **58 tests passed, 0 failed, 0 skipped**. Eleven of these tests were added by the independent acceptance role in `tests/acceptance.test.mjs`; the role did not modify the scoring, scenario, server, or explanation implementation.

The first unprivileged run passed the non-network tests but could not bind the local HTTP test server (`listen EPERM`). The HTTP test and then the complete suite were rerun successfully with local loopback access. This was an execution-environment restriction, not an ignored failing assertion.

Commands actually executed:

```text
node --test tests/acceptance.test.mjs
node --test tests/server.test.mjs
node --test tests/*.test.mjs
```

The final complete run took approximately 1.15 seconds on this machine. This is a test-suite duration, not a browser-performance or cloud-latency benchmark.

## Independent numerical and data checks

| Check | Executed result | What it establishes |
|---|---|---|
| Analytic controller arrival-time bound | Passed at 1, 4, 12, and 25 m from rest with a 0.2 s reaction delay | The one-dimensional constructive motion controller never arrives earlier than the bounded-acceleration/bounded-speed physical solution in these cases; its delay is within one integration interval. This controller is distinct from the final defensive optimistic lower-bound model. |
| Smooth stopping distance | Passed | From 1.2 m/s, the alternative travels 0.228 m before stopping, compared with the exact minimum of 0.225 m. The 0.003 m surplus is within the bound for the final discrete braking step. |
| Added lane defender | Passed | With release legality unchanged, adding a defender reduces the best opportunity and never increases an individual candidate's score. Location utility and receiver readiness remain unchanged. |
| Irrelevant teammate removal | Passed | Removing other attackers leaves the selected player's direct receiving analysis unchanged. |
| Data-file reproducibility | Passed for all three scenes | Each checked-in scene JSON exactly equals regeneration from its declared scene ID and seed. |
| Ball and event coherence | Passed for all three scenes | The ball stays in bounds; consecutive positions do not teleport; straight-flight positions agree with the recorded velocity, including reception; actual pass targets are onside under the point-player release screen. |
| Player separation | Passed at every recorded frame | No pair falls within 0.8 m. Observed minimum separations are approximately 3.68, 3.81, and 3.63 m for diagonal, crowded, and early. This is not a full collision or football-realism certification. |
| Frozen-input/read-only analysis | Passed | Scoring, comparison, and local explanation do not mutate deeply frozen inputs; repeated local explanations are identical. |
| Unused-future independence | Passed | Corrupting all frames after the completed comparison horizon and changing later events leaves that window's comparison unchanged. The existing current-snapshot future-change test also passes. |
| Release, flight, and clip-end starts | Passed | These starts cannot fabricate a positive-duration comparison. An unavailable window is described as unavailable rather than as a meaningful zero-effect comparison. |
| Missing/failed cloud configuration | Passed with a fetch spy and simulated failure | Missing configuration makes no network request. A simulated provider failure returns `offline-template`, `fallback`, and `verified: false`, without credentials in the result. |

The existing suite additionally covers identical-route zero difference; attack-direction reflection and coordinate translation; same initial position/velocity and vector acceleration limits; current carrier exclusion; offside boundaries; pre-pass truncation and actual sampled-duration normalization; factor consistency and score bounds; lane evidence geometry; sampling refinement; parameter sensitivity; distinction between personal opportunity and team-best opportunity; explanation evidence validation; and HTTP input, source, and concurrency controls. The final run also includes the defensive lower-bound witness, reaction-phase boundary, and stationary grazing-interception regressions added during adversarial review.

## What the authored examples show

Default comparison: 2.5–5.0 s, A7, smooth braking/hold-width alternative, default model parameters.

| Scene | Observed mean index | Alternative mean index | Difference |
|---|---:|---:|---:|
| Diagonal option | 36.40 | 32.43 | +3.97 |
| Into traffic | 30.52 | 35.03 | −4.51 |
| Too early | 23.94 | 44.83 | −20.89 |

These values were independently recomputed from the frozen v1.3 implementation, after the receiver-residence, defensive lower-bound, and supplemental lane-sampling corrections. They are index points, not success percentages. The three scene labels are authored hypotheses, not independently measured outcome labels.

The crowded scene has a substantive modelled lane threat: at 5.0 s its winning candidate has a lane component of approximately 0.056, while the alternative is approximately 0.963. The defensive estimate is optimistic; this does not prove an interception is executable. In the early scene, the first large separation also includes an interval where the finite candidate/controller search finds no reachable candidate; offside occurs later. The entire negative difference must not be attributed exclusively to offside.

## Browser compatibility and delivery status

The core `agent.mjs → scenarios.mjs/model.mjs` import graph was executed in an isolated ECMAScript-module context without Node globals or `fetch`. The deterministic local explanation completed with an offline source and no cloud-verification claim. This checks the core module graph's independence from Node-only imports; it does not replace a real browser UI test.

Real-browser checks were executed in a separate Codex in-app browser tab. The application was tested through its local Node server and through a temporary Python static server with no API backend. The temporary server was stopped after acceptance.

| Browser check | Observed result |
|---|---|
| Rendering, three scenarios, replay | All three scenes rendered. Play advanced the clock and current-frame score; pause stopped playback; setting the timeline to 8.0 s showed F80 and the in-flight state. |
| Identical-route control | The visible comparison reported +0.0 with equal run and alternative means. |
| Chinese and analyst controls | Labels switched to Chinese; analyst mode exposed arrival times, margin, and candidate coordinates. An initially untranslated sensitivity hint was reported and corrected. |
| Local explanation | Both the Node-server path and static-only worker path produced a grounded answer labelled “Local template”. The answer explicitly said no cloud model generated it. The final server answer displayed v1.3 and the same rounded means as the chart. |
| Evidence navigation | Clicking the 5.0 s peak evidence button moved the replay to F50 while the answer remained explicitly bound to its 2.5–5.0 s comparison window. |
| Answer invalidation | Switching language cleared the prior answer. Changing ball speed from 15 to 16 m/s cleared the old answer and recomputed the comparison. Scenario/window changes also cleared prior evidence. |
| Sensitivity and team-best controls | Both completed and displayed their distinct semantics. Sensitivity was labelled as assumption checks rather than a confidence interval; team-best was explicitly not a sum of personal scores. |
| Invalid comparison window | In the final v1.3 page, starting at 8.0 s returned no valid window; both sensitivity and team-best buttons were disabled. |
| Narrow-screen layout | At 390 × 844 pixels the replay, controls and explanation cards were visible. Both body and document width equalled 390 pixels, with no horizontal overflow. The viewport override was reset. |
| Export | The final v1.3 JSON was actually downloaded through the UI and independently regenerated from its recorded scene ID, seed, parameters, start and horizon. All 26 run/alternative/difference samples matched exactly; maximum absolute replay error was zero. Summary values also matched exactly. The included explanation retained `offline-template` and `cloud.verified: false`. |

The explanation button initially failed with `Unsupported model parameter`; this was reported to the main implementer, corrected by sending only supported parameters, and successfully retested through both serving modes. No unresolved delivery blocker was found in the executed checks.

Source inspection confirms revision checks and a per-question request ID before asynchronous answers are applied. Normal state-change invalidation was exercised above; a deliberately delayed, out-of-order live-cloud response was not simulated in the browser. This distinction is retained rather than treating source inspection as that runtime test.

Visual records: [desktop screenshot](acceptance-desktop.jpg) and [390-pixel screenshot](acceptance-mobile.jpg). The accepted download was `off-ball-lens-diagonal-evidence (1).json`; the first download was from an earlier development version and was not used for final v1.3 acceptance.

## Limits of this acceptance

- No live Microsoft Foundry request, deployed-model compatibility, Azure permissions, cloud latency, or cloud cost was verified. Provider-contract tests use simulated responses.
- No independent football analyst judged unseen scenarios, and no real-match labels were used. Test passing does not establish tactical-value accuracy or generalization.
- The index remains an uncalibrated geometric heuristic. Its finite candidates, constructive receiver controller, optimistic defensive arrival lower bound, sampled interception search, hand-selected parameters, and fixed other-player trajectories limit the interpretation.
- Passing the one-dimensional controller cases does not prove minimum-time optimality or continuous-time correctness for every multidimensional motion. Receiver readiness uses a constructive controller; the defensive lower bound deliberately ignores turn costs and is not a feasible pursuit trajectory. A negative defensive margin only means interception cannot be ruled out; positive sampled margins do not certify the entire continuous line.
- The comparison is retrospective in a fixed environment. It cannot identify real defender attraction, indirect space creation, causal contribution, or total team value.
- Sensitivity ranges are deterministic assumption checks, not confidence intervals. Desktop/browser performance must be reported separately from Node timing and from cloud measurements.
