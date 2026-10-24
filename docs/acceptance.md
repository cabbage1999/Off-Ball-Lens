# Independent v2 acceptance record

Date: 24 October 2026. Scope: the rebuilt author-model receiving-space application. This report replaces the earlier heuristic-index acceptance report in full; no earlier release, CI run, screenshot or public demo is evidence that v2 has passed.

Status: **PASS for the executed local v2 acceptance scope.** Both application defects discovered by this role were repaired by the implementers and independently retested. A later Ubuntu CI run exposed an overly strict cross-platform test comparison; its correction is locally verified below, while the corrected Ubuntu rerun is pending. The final data use `tactical-state-v2.0.1`. This is not an acceptance of live Microsoft inference, a public deployment, or real-match scientific accuracy; the outstanding gates are listed below.

The acceptance role received the requested “GPT-6 Astra / max” configuration. It cannot inspect the platform's hidden runtime configuration and does not independently attest the actual model or reasoning setting.

## Independent tests actually executed

The acceptance role authored `tests/acceptance-v2.test.mjs` and `analytics/tests/test_acceptance_independent.py`. It did not implement or repair the application. The direct author-parity check builds its own long table from the exported tracking, reverses the input player order, and calls `accessible-space==2.1.0` without the application's adapter helpers.

| Check | Executed result | Scope |
| --- | --- | --- |
| Current tracking bytes, parsed-input digest and model-config digest | PASS on the final v2.0.1 exports | Exact file hashes, canonical JSON hashes, configuration hashes and all frame IDs/times match. Rechecked after the scene correction. |
| Direct author API parity | PASS on all eligible outputs in all three final exports | Independent 23-row-per-valid-frame long tables over all 381 valid model frames, reversed roster order, explicit attack-direction normalization; AS/DAS use relative tolerance 1e-6 and zero absolute tolerance. Ball-row NaNs and author carrier/offside zeros are checked separately from product nulls. Statuses are also checked directly against raw possession/team/float32 offside geometry. |
| Single-frame versus freshly computed batch | PASS locally | Each complete scene is recomputed at 5 Hz in the test's current process. Ten selected single-frame outputs, including flight, offside, reception, keeper possession and B-team possession, must equal their live batch outputs exactly, including heatmap bytes. |
| Single-frame versus stored export | PASS locally; corrected Ubuntu rerun pending | AS/DAS alone use relative tolerance 1e-6 with zero absolute tolerance. Every frame field, player ID, status/null, key set and quantized heatmap string remains exact. This is a separate check from same-runtime single/batch equality. |
| Every tracking-time moment prefix | PASS | All 963 tracking cutoffs, including the 10 Hz events between 5 Hz model samples, agree with an independently truncated rerun. No future peak, ending or outcome appears. |
| Every time/player UI fact projection | PASS | 963 cutoffs × 22 players: samples and trail points are historical, invalid values remain null, curves break at unavailable states or carrier changes, moments use known revisions. This is a shared-module test, not a claim that every combination was visually inspected. |
| Every time/player explanation prefix | PASS | 21,186 full-versus-truncated-data comparisons are exactly equal. Evidence refers to real elapsed frames and original model values; offline source remains explicit. |
| Bilingual numeric consistency | PASS | English and Chinese analyst responses for 330 selected player/time combinations preserve context, evidence, summary values and claim references. |
| Position/velocity and possession chain | PASS | All player intervals obey trapezoidal position integration and the 3.2 m/s² vector-acceleration bound; releases and arrivals match IDs/times, flight has no carrier, possession returns only at the recorded arrival. |
| Invalid-input window outcome counterexample | FAIL FOUND, FIX RETESTED | Unknown direction, inconsistent team IDs, unsupported pitch, out-of-pitch inputs and unknown ball state initially generated `not_selected`. The root implementer changed invalid-input closures to indeterminate `closed`; the independent regression now passes. |
| Saved-shot geometry | FAIL FOUND, FIX RETESTED | Independently extending the straight release rays to the goal line now gives y = 0.157282 m for `used` and −1.399346 m for `unused`, both inside ±3.66 m. |

Commands executed by this acceptance role:

```sh
node --test tests/acceptance-v2.test.mjs
.venv-das/bin/python -m pytest analytics/tests/test_acceptance_independent.py -q
```

The independent Node suite passed **6/6**, with no failures or skips. The Python suite first passed 7/8 and exposed the invalid-input outcome defect; after the implementer's repair and final scene export it passed 8/8 locally. Following the cross-platform comparison correction, the independent Python suite passes **9/9**, and the complete `analytics/tests` suite passes **33/33** locally, with no failures or skips. The latter run used Python 3.12.14 / NumPy 2.3.5 on macOS arm64 and took 4.28 s. It is a test duration, not a model latency or cloud benchmark.

Final exact tracking-file SHA-256 values independently checked:

| Scene | Tracking / model frames | SHA-256 |
| --- | ---: | --- |
| `used` | 321 / 161 | `f1fb9c9a473184242096d554d94b69a7222d115d78a336332ab807961bebb62f` |
| `unused` | 341 / 171 | `8c8dbeee60d313fd2e0bb4bbeeb53cb1671a321459e7e4e71420f1651924f1c1` |
| `blocked` | 301 / 151 | `0925b9872d7f353b3767e41d406a4574d920989469ac35dba27bf937b92a9133` |

## Cross-platform precision correction

The acceptance role directly read the logs of [Ubuntu CI run 40102860487, job 120898399450](https://github.com/cabbage1999/Off-Ball-Lens/actions/runs/40102860487/job/120898399450), at commit `9b871a934bd125c20cd9df99c7c44c60f93857af`. Ubuntu 24.04.5 / x64 with Python 3.12.15 installed the locked dependencies successfully. The run passed the 50 JavaScript tests and scene validation, then passed 31 Python tests and failed the stored-export equality assertion for `used:0000`. The failure was in an acceptance assertion, not a changed model, scene or exported artifact.

The logged full diff changes 13 AS/DAS scalars. Its other frame fields, player statuses/nulls and heatmap strings are identical. Examples:

| Scalar | Stored macOS value | Linux recomputation | Absolute difference |
| --- | ---: | ---: | ---: |
| A1 DAS | 0.0012128488939318022 | 0.001212848905467322 | 1.154e-11 |
| A5 AS | 985.5759887695312 | 985.5760498046875 | 6.104e-5 |
| A9 AS | 28.222002029418945 | 28.22200584411621 | 3.815e-6 |
| A10 AS | 101.11639404296875 | 101.11641693115234 | 2.289e-5 |

The pinned author's default simulation uses float32, and the unweighted area integration also accumulates float32 values. The three AS differences above are respectively one, two and three float32 representable steps at those magnitudes. The largest relative difference among the 13 logged scalar pairs is approximately 2.264e-7. DAS includes later weighting/integration and is exported as a Python float; printing more digits does not undo the float32 precision of its upstream simulation.

The corrected cross-platform comparator therefore permits only `abs(actual − expected) <= 1e-6 × max(abs(actual), abs(expected))`, for finite, nonnegative eligible-player AS/DAS. This one-part-per-million tolerance is approximately 8.39 times float32 machine epsilon. It is an explicit reproducibility allowance, not a proven forward-error bound for the full model or a scientific-accuracy statement. There is **no absolute-error floor**: zero cannot match a positive result, even one below display precision. The earlier direct-author parity test's 1e-5 AS / 1e-7 DAS absolute floors were removed so that it uses the same stricter policy.

The regression reconstructs all 13 actual Linux differences against the immutable stored frame and confirms their acceptance. It rejects 1e-4 relative metric changes, values immediately beyond the declared tolerance, NaN/Infinity/negative/non-numeric metrics, changed IDs or timestamps (including a 1e-12 s time change), changed status/null, missing players and a single changed heatmap byte. Existing input-file, canonical-input and configuration hash checks remain exact. No model parameters, trajectory files, analysis values or heatmap bytes were changed to make the test pass.

At this report update, corrected tests have passed locally; a successful corrected Ubuntu CI run has **not yet been observed by this role**. Exact same-runtime single/batch equality and cross-platform scalar compatibility are deliberately reported separately.

## Browser observations

The local Node service was opened in the Codex in-app browser. Actual UI observations include:

- At `used` 12.2 s, A7 is in the pass-flight state, both metrics and the heatmap are unavailable, the moment says pass released, and the explanation does not claim reception.
- At 12.4 s, A7 is carrying the ball with null receiving metrics; the occurred reception changes the moment to received.
- Selecting A9 at 12.4 s shows its own AS/DAS, source frame and evidence. Selecting B3 shows defending and unavailable metrics.
- Seeking, switching language, selecting another player and changing scene clear the earlier explanation and evidence.
- The `blocked` 8.2 s view shows A7's geometric offside status and null metrics; the bilingual explanation preserves the model boundary.
- Every one of the 22 selectable roster entries was actually selected at `blocked` 8.2 s. A6 is the carrier, A7 is offside, the other A players are eligible and all B players are defending.
- At `blocked` 20.2 s the occurred interception changes the attacking team and direction to B / left; selecting B7 displays its own eligible receiving metrics.
- At `unused` 16.8 s A7's window remains open. At the 16.9 s release to A11 it changes to not used, and the current flight immediately hides the preceding 16.8 s heatmap. Clicking that window returns to its 13.6 s detection frame and restores the historical open status.
- Playback advances at the selected 2× control setting and clears an earlier answer. Pause and seeking work. The `unused` end review correctly reports two observed windows and zero receptions for A7, without calling the carrier's decisions wrong.
- A final reload successfully reads the matching frozen files. The final server answer at `used` 11.0 s is labelled local template, shows the actual analyzed interval and replay cutoff, and agrees with the displayed 242.5 m² AS and 0.586 danger-weighted m² DAS. Clicking its 5.0 s evidence button moves the replay to `used:0050` and clears the old answer.
- During a temporary scene/analysis mismatch while implementers regenerated files, the API returned 409 and the cached browser used an explicit local fallback. The server's health endpoint subsequently reported offline, unconfigured and unverified. A restricted command's failed loopback connection was not treated as proof of service failure.
- The final evidence download was actually triggered through the UI at `used` 6.2 s, then read and compared with the final stored analysis. The full model frame matches exactly; all 26 curve samples and both events are historical. The exported file also matches `inputFileHash`, canonical `inputHash`, generator version and seed. A copy is retained in [acceptance-v2-export.json](acceptance-v2-export.json); the test-created file in Downloads was removed after verification.

Visual records from the final local app: [overview](acceptance-v2-overview.png) and [metrics, curve and explanation](acceptance-v2-desktop.png).

**NOT RUN by this role:** a narrow-screen viewport test and a deliberately delayed/out-of-order cloud response in the browser. A source-code check of generation/abort guards is not equivalent to that runtime race test. The root implementer separately reports a simulated historical-window overlay test; that is not counted here as an independently executed browser test or as live Azure evidence.

## Reported issues and disposition

1. Invalid numerical-input closures incorrectly asserted `not_selected`. **Fixed and independently retested.** The initial failing regression is retained as a permanent test.
2. The original `used` shot at 29.6 s would cross x = 52.5 m at y = −6.437 m if extended beyond the keeper, outside the ±3.66 m goal mouth, although the event was labelled shot/save. **Fixed and independently retested.** The scene author changed the relevant goalkeeper/shot geometry, versioned the generator and regenerated the trajectories; the official analysis was recomputed. The new independent shot-ray test passes.
3. The authored `blocked` interception's straight ball ray does not point exactly through the eventual A9 position. This is an authored interception approximation, not a solved pass-target/interception interaction. Its existence does not invalidate DAS snapshots, but it cannot support a claim of learned tactical realism.

Other adversarial-review issues and their fixes belong to `docs/adversarial-review.md`. They must not be silently counted as independently retested here.

## Release gates and scientific limits

**NOT RUN by this role:** a real Microsoft Foundry/Azure model request, authentication/deployment compatibility, actual cloud tool trace, production latency/cost, v2 public deployment, a clean-machine dependency installation, independent football-practitioner adjudication, and independent viewing of the final under-120-second recorded demonstration. The root implementer separately reports a 108.04 s local recording; this acceptance role has not verified that recording. No Azure deployment was supplied. Mock provider success is not evidence for any live Microsoft check.

For the planned live AI submission, the real Microsoft request/trace and accessible final public demo remain delivery gates. No unresolved blocking software defect was found in the local checks executed by this role. A static offline demonstration is usable within this checked scope and must be labelled as precomputed author-model analysis plus local deterministic wording. Public release, CI, presentation-file QA and any later cloud activation need their own recorded verification.

Scientific limits are separate from software defects: these are authored synthetic scenes; individual possibility fields overlap; AS/DAS are not probabilities, causal contribution or team-value shares; point-coordinate offside is not an officiating decision; the display interpolation is not the author's scalar integration. The notification threshold is an exploratory product rule. The existing sensitivity report shows that reduced temporal sampling can remove a short window, and small positional changes can alter peak timing. None of these checks establishes real-match calibration, total off-ball value or independent tactical accuracy.
