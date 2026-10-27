# Independently authored tactical scenes

The current trajectory version is **tactical-state-v3.0.0**. These are three separate synthetic attacks, with 22 persistent players, a ball, seven tactical phases and explicit release/control events. Tracking stays at 10 Hz on a 105 × 68 m pitch with centre origin; numeric AS/DAS remains a separate 5 Hz computation. Clip lengths are unchanged: 32, 34 and 30 seconds.

No recorded match tracking, third-party scene code, learned movement distribution or AS/DAS output drives these trajectories. The integer seed is a provenance identifier and introduces no random movement. Scenario IDs are authoring categories, not ground-truth labels or model inputs. A attacks +x; after B gains control, the frame records B and attack direction −1.

## Reproduce and inspect

```sh
node scripts/export-data.mjs
node scripts/validate.mjs
node --test tests/scenarios.test.mjs tests/tactical-motion.test.mjs
```

The exporter accepts optional scene IDs and atomically replaces complete tracking files. `generateScenario` produces the same frames and events for every seed; `frameAt` returns the latest sample at or before the requested time. The current [validation report](../data/validation.json) records exact file hashes and per-player, per-flight and possession-state measurements. The focused suite has 27 passing checks, including deliberately invalid motion, contact, timing, flight pacing and commentary evidence.

## What changed from v2.0.1

Baseline inspection found no ball easing: flights already used constant velocity. The slow appearance came partly from long authored flight intervals. For example, a roughly 6 m used-scene layoff took 1.0 s at 5.98 m/s, and a roughly 6.4 m blocked-scene combination took 1.2 s at 5.32 m/s. Possessed-ball means were only 1.61, 1.30 and 1.92 m/s, because the ball correctly followed its carrier. Those quantities must not be confused.

Arrival times were shortened individually from each realised flight distance and the action’s purpose, then audited against the bounds below. Release times, phase clocks, clip lengths and playback rate were retained. There is no global velocity multiplier. Earlier control changes when a defender responds and slightly changes later realised geometry, so the table reports measured final velocities rather than merely scaling old ones.

| Clip | Mean pass speed before → after (m/s) | Mean pass flight before → after (s) | Possessed-ball mean before → after (m/s) | A7 peak speed before → after (m/s) |
| --- | --- | --- | --- | --- |
| used | 11.40 → 16.53 | 1.20 → 0.84 | 1.61 → 1.45 | 3.39 → 4.13 |
| unused | 12.11 → 16.22 | 1.27 → 0.92 | 1.30 → 1.29 | 3.43 → 3.43 |
| blocked | 11.66 → 14.93 | 1.12 → 0.84 | 1.92 → 1.89 | 6.79 → 6.79 |

The first two clips retain measured supporting movement; the blocked clip retains its faster 6.79 m/s run beyond the line. The used clip adds one local, tactically timed A7 fish-hook rather than applying curves to every route.

## Ball flight and contact

The following are transparent **simulator choices**, not empirical professional-football speed ranges. Short combinations can be slower than longer passes, and a pass direction alone does not determine its pace.

| Action profile | Allowed flight speed (m/s) |
| --- | --- |
| firm_pass | 12–22 |
| short_combination | 9–18 |
| switch | 14–24 |
| shot | 18–28 |

Each flight is a constant horizontal velocity from the releasing player’s recorded foot point to the actual recipient’s recorded foot point. The ball has no carrier while `in_flight`; reception, interception or save changes it to `possessed`. While possessed, its velocity exactly equals the carrier’s velocity. Kicks and controls are explicit impulses. All current flights are at z = 0; the reserved `loose` and `dead` states are not fabricated in these attacks.

This remains offline choreography: the endpoint uses the recipient’s realised arrival position. During a flight, the defensive reference is the declared intended receiver, including A9 before the blocked-scene interception. The future interceptor B6 only becomes the possession reference after contact at 20.0 s. B2 may close A7 during the actual pass, rather than waiting for reception. Rolling resistance, body orientation, limb contact, technical errors, fatigue and aerial dynamics are not simulated.

All release times below are unchanged from v2.0.1. All arrival changes are explicit; event IDs and release-frame links remain stable.

| Flight | From → actual receiver | Release → arrival (s) | Flight before → after (s) | Speed before → after (m/s) | Final distance (m) | Profile |
| --- | --- | --- | --- | --- | --- | --- |
| used:p1 | A3 → A6 | 3.2 → 4.2 | 1.1 → 1.0 | 16.10 → 17.56 | 17.56 | firm_pass |
| used:p2 | A6 → A7 | 11.2 → 12.1 | 1.2 → 0.9 | 13.23 → 19.93 | 17.94 | firm_pass |
| used:p3 | A7 → A9 | 17.5 → 18.4 | 1.2 → 0.9 | 12.25 → 16.11 | 14.50 | firm_pass |
| used:p4 | A9 → A10 | 21.0 → 21.5 | 1.0 → 0.5 | 5.98 → 12.68 | 6.34 | short_combination |
| used:p5 | A10 → A11 | 25.3 → 26.2 | 1.5 → 0.9 | 9.45 → 16.38 | 14.74 | switch |
| used:s1 | A11 → B1 | 29.6 → 30.4 | 1.0 → 0.8 | 16.54 → 20.68 | 16.54 | shot |
| unused:p1 | A4 → A8 | 3.5 → 4.5 | 1.1 → 1.0 | 17.96 → 19.60 | 19.60 | firm_pass |
| unused:p2 | A8 → A10 | 11.8 → 12.6 | 1.2 → 0.8 | 11.22 → 16.42 | 13.14 | firm_pass |
| unused:p3 | A10 → A11 | 16.9 → 18.0 | 1.4 → 1.1 | 12.96 → 16.54 | 18.20 | firm_pass |
| unused:p4 | A11 → A5 | 21.8 → 22.5 | 1.2 → 0.7 | 7.29 → 12.11 | 8.48 | short_combination |
| unused:p5 | A5 → A8 | 26.7 → 27.7 | 1.5 → 1.0 | 11.25 → 16.93 | 16.93 | firm_pass |
| unused:p6 | A8 → A9 | 30.0 → 30.9 | 1.2 → 0.9 | 11.98 → 15.73 | 14.15 | firm_pass |
| unused:s1 | A9 → B1 | 32.6 → 33.0 | 0.6 → 0.4 | 13.00 → 19.45 | 7.78 | shot |
| blocked:p1 | A3 → A6 | 3.1 → 4.1 | 1.1 → 1.0 | 15.35 → 16.73 | 16.73 | firm_pass |
| blocked:p2 | A6 → A8 | 10.4 → 11.5 | 1.4 → 1.1 | 13.38 → 16.92 | 18.62 | switch |
| blocked:p3 | A8 → A10 | 15.1 → 15.7 | 1.2 → 0.6 | 5.32 → 10.20 | 6.12 | short_combination |
| blocked:p4 | A10 → B6 (intended A9) | 19.6 → 20.0 | 0.6 → 0.4 | 7.09 → 10.68 | 4.27 | short_combination |
| blocked:p5 | B6 → B7 | 24.1 → 25.2 | 1.3 → 1.1 | 17.18 → 20.09 | 22.10 | switch |

Both saved shots continue through the goal mouth when their released velocity is extended beyond the save: used crosses x = 52.5 m at y = +0.157 m; unused at y = −1.273 m. The crossing occurs after the save in both cases. The previously corrected v2.0.1 near-side goalkeeper set is retained.

The blocked interception is an authored misdirected pass, not a calibrated model of a defender’s anticipation or technical skill. Its 20.0 s contact is 1.601 m from the segment toward A9’s foot at that time; A9’s centre is 3.578 m from the forward extension of the actual released-ball ray. These are different geometric quantities, both reported in the audit.

## A7 fish-hook and B2 response

A7 starts closer to the near-side full-back in the used clip. He approaches B2, checks back toward A6 while staying wide, rounds the turn at reduced speed and accelerates diagonally inside before A6’s 11.2 s release. B2 remains goal-side during the check, follows its backward displacement, then moves inward during the pass. A7 controls at 12.1 s. This creates a legible change of rhythm; it is not evidence that the movement caused a particular AS/DAS value or created space.

The local route uses cubic Hermite targets with explicit tangents between 0 and 13.5 s. The same bounded controller follows those targets; they never directly set player positions. Other routes retain their role-specific tactical boards. The approach, back-check and inside exit are tied to the current carrier and marker instead of added as decorative oscillation.

| Time (s) | A7 position (m) | A7 velocity (m/s) | Speed (m/s) | Observation |
| --- | --- | --- | --- | --- |
| 5.0 | (19.25, -25.15) | (1.48, -0.35) | 1.52 | Approaches the marker |
| 5.5 | (19.78, -25.39) | (0.52, -0.61) | 0.81 | Slows into the change of direction |
| 7.0 | (18.14, -26.80) | (-1.98, -0.55) | 2.05 | Checks backward |
| 8.8 | (15.70, -25.09) | (0.21, 2.69) | 2.70 | Has turned infield and forward |
| 11.0 | (20.64, -19.23) | (3.42, 2.31) | 4.13 | Accelerates before release |
| 12.1 | (24.15, -17.14) | (2.25, 1.33) | 2.61 | Controls the pass |

The check moves approximately 4.08 m backward in x between 5.5 and 8.8 s. B2 follows backward by more than 1.5 m between 6.2 and 8.8 s. A7’s peak speed is 4.128 m/s; maximum normal acceleration is 2.952 m/s². His maximum sampled heading-change rate above 1 m/s is 93.42°/s. The 4.3–11.2 s curved route accumulates 324.74° of absolute heading change across the approach, check and rounded exit; this is not a single instantaneous turn.

Turning is constrained by vector acceleration. In planar motion, normal acceleration is v² times curvature: a tight turn must therefore occur at a lower speed. The regression checks a sub-1 m/s first turn, backward movement, a later infield heading, an above-4 m/s exit, B2’s response, onside release and the unchanged global limits.

## Motion and clearance contract

Every update limits the change of the full velocity vector, then integrates that same velocity:

`p_next = p + (v + v_next) × dt / 2`, with `dt = 0.1 s`.

Player speed is capped at 7.6 m/s, goalkeeper speed at 4.5 m/s and vector acceleration at 3.2 m/s². Predictive personal-space steering and inward edge steering modify desired velocity; they do not project positions or teleport players. Goalkeepers and rest-defence players may move less because their roles require depth.

The audit checks continuous simultaneous chord clearance across every 0.1 s interval, then subtracts the constant-acceleration sag bound: a·dt²/8 for one player versus a linear ball flight, or a·dt²/4 for two players. Player pairs must remain at least 0.8 m apart; non-participants must remain at least 1.2 m from a flight. Passer and actual receiver are excluded from the flight exclusion because their separately verified foot contacts are required. These are geometric exclusions, not calibrated interception probabilities.

| Clip | Frames / events | Peak player speed (m/s) | Peak vector acceleration (m/s²) | Min player clearance (m) | Min ball/non-participant clearance (m) |
| --- | --- | --- | --- | --- | --- |
| used | 321 / 12 | 5.086 | 3.2 | 1.802 | 1.245 |
| unused | 341 / 14 | 5.713 | 3.2 | 1.586 | 1.338 |
| blocked | 301 / 10 | 6.794 | 3.2 | 1.587 | 1.638 |

All checks pass without weakening the previous thresholds. The narrowest final flight clearance is the used A6→A7 pass at 1.245 m. Every outfield player travels more than 15 m in these progressing attacks. No empirical match-level speed or distance distribution is claimed.

## Current and past observation cues

`metadata.observationCues` is separate from tactical phase intentions. Each item contains:

| Field | Meaning |
| --- | --- |
| `id` | Unique authored cue ID |
| `startTime`, `endTime` | Inclusive display interval in seconds |
| `evidenceTime` | Latest time required to substantiate the entire statement; no later than start |
| `focusPlayerIds` | Known players to highlight; A7 is included in these demonstration cues |
| `text`, `textZh` | Short English and Chinese observations |
| `kind` | `observed_movement` |
| `provenance` | `authored_tracking_cue` |

The UI must show a cue only when the current tracking time is within its interval, its evidence time has occurred and the selected player belongs to its focus list. At most one cue is active. Any trail contains only past positions. The label identifies the copy as scripted observation, not automatic causal inference or a discovered tactical instruction.

The frozen files contain 13, 11 and 11 cues. Brief intervals use short clauses, normally 5–8 English words. A 0.4 s blocked-scene release caption was removed; the 20.0 s interception cue supplies the already-observed context. Shot descriptions continue briefly after contact where necessary for readability, but no save description begins early. Tests reject future evidence, overlapping cue intervals, unknown players and premature reception/interception/save statements.

Phase descriptions and per-player role reasons remain **authored intentions** and can contain future actions. They must never be substituted for observation cues or presented as as-of evidence. The full 22-role record for every phase is retained in each tracking file.

## Individual motion distributions

Each cell is distance in metres / mean speed in m/s / peak speed in m/s. These totals describe the authored clip, not an empirical distribution.

| Player / role | used | unused | blocked |
| --- | --- | --- | --- |
| A1 — Goalkeeper | 11.91 / 0.37 / 1.98 | 13.34 / 0.39 / 2.35 | 15.92 / 0.53 / 2.54 |
| A2 — Near-side full-back | 54.73 / 1.71 / 3.25 | 43.41 / 1.28 / 1.64 | 58.25 / 1.94 / 2.91 |
| A3 — Near-side centre-back | 37.14 / 1.16 / 1.77 | 41.69 / 1.23 / 1.63 | 43.14 / 1.44 / 2.00 |
| A4 — Far-side centre-back | 36.21 / 1.13 / 1.77 | 40.59 / 1.19 / 1.64 | 42.98 / 1.43 / 1.86 |
| A5 — Far-side full-back | 40.71 / 1.27 / 2.03 | 64.72 / 1.90 / 3.92 | 45.83 / 1.53 / 2.11 |
| A6 — Holding midfielder | 40.41 / 1.26 / 2.51 | 37.04 / 1.09 / 1.64 | 62.99 / 2.10 / 6.35 |
| A7 — Near-side winger | 44.25 / 1.38 / 4.13 | 48.68 / 1.43 / 3.43 | 79.63 / 2.66 / 6.79 |
| A8 — Far-side midfielder | 35.44 / 1.11 / 1.63 | 39.65 / 1.17 / 3.15 | 46.52 / 1.55 / 2.29 |
| A9 — Centre-forward | 24.63 / 0.77 / 1.01 | 24.67 / 0.73 / 0.99 | 27.92 / 0.93 / 1.83 |
| A10 — Attacking midfielder | 33.82 / 1.06 / 1.50 | 36.84 / 1.08 / 1.84 | 39.52 / 1.32 / 2.38 |
| A11 — Far-side winger | 30.89 / 0.97 / 1.70 | 30.48 / 0.90 / 1.60 | 37.21 / 1.24 / 1.99 |
| B1 — Defending goalkeeper | 15.24 / 0.48 / 3.20 | 15.23 / 0.45 / 3.04 | 14.39 / 0.48 / 3.20 |
| B2 — Near-side full-back | 33.79 / 1.06 / 3.42 | 40.92 / 1.20 / 4.62 | 33.58 / 1.12 / 2.22 |
| B3 — Near-side centre-back | 22.94 / 0.72 / 2.00 | 20.49 / 0.60 / 1.59 | 23.12 / 0.77 / 1.91 |
| B4 — Far-side centre-back | 21.65 / 0.68 / 1.54 | 20.69 / 0.61 / 1.57 | 23.21 / 0.77 / 1.72 |
| B5 — Far-side full-back | 29.77 / 0.93 / 2.79 | 28.69 / 0.85 / 3.07 | 30.19 / 1.01 / 2.85 |
| B6 — Near-side holding midfielder | 49.38 / 1.54 / 5.09 | 29.34 / 0.86 / 1.87 | 66.15 / 2.21 / 5.18 |
| B7 — Near-side wide midfielder | 49.92 / 1.56 / 4.07 | 41.48 / 1.22 / 4.16 | 56.88 / 1.90 / 3.83 |
| B8 — Far-side central midfielder | 38.44 / 1.20 / 4.81 | 55.37 / 1.63 / 5.71 | 46.55 / 1.55 / 3.76 |
| B9 — First-line presser | 52.87 / 1.65 / 4.46 | 58.52 / 1.72 / 5.26 | 64.03 / 2.13 / 4.64 |
| B10 — Second-line presser | 47.70 / 1.49 / 5.06 | 43.00 / 1.26 / 3.79 | 56.85 / 1.90 / 4.68 |
| B11 — Far-side wide midfielder | 41.79 / 1.31 / 4.57 | 46.65 / 1.37 / 4.57 | 51.37 / 1.71 / 4.72 |

## Tactical phases

These summaries explain the authored routes. They are not past-only commentary and are not proof of causal effects.

| Clip / phase | Interval (s) | Intention |
| --- | --- | --- |
| used:stage-1: Draw the first press | 0.0–4.3 | A3 carries into B9’s press. A6 checks into the near-side pocket; the full-backs create width. |
| used:stage-2: Check and curve inside | 4.3–9.5 | A6 carries as B6 steps toward him. A7 checks back in front of B2 and rounds the hook at reduced speed; A2 advances outside. |
| used:stage-3: Accelerate into the channel | 9.5–13.5 | A7 accelerates inside as A6 releases. B2 turns toward the runner; A9 stays between the centre-backs and A10 remains inside. |
| used:stage-4: Receive and connect | 13.5–18.7 | A7 carries after reception. B2 closes the ball, B3 covers inside, and A9 checks toward the next pass. |
| used:stage-5: Third-player support | 18.7–22.0 | A9 receives with pressure behind and connects to A10. A6 and A8 stay available beneath the attack. |
| used:stage-6: Move the block across | 22.0–27.0 | A10 carries and switches toward A11; B5 and B11 release from narrow cover to defend the far side. |
| used:stage-7: Finish and reset | 27.0–32.0 | A11 moves inside for a low shot. B1 adjusts and gathers; nearby attackers slow and the back line holds recovery depth. |
| unused:stage-1: Circulate on the far side | 0.0–4.6 | A4 draws B9 and releases A8, with A5 preparing the outside route. |
| unused:stage-2: Develop two angles | 4.6–9.0 | A8 advances under B8 pressure. A7 starts an inside run across the pitch while A10 checks between the lines. |
| unused:stage-3: Select the inside link | 9.0–13.3 | A10 receives the pass. A7 continues the actual run without receiving, and B2 follows goal-side. |
| unused:stage-4: Find the wide receiver | 13.3–18.4 | A10 carries before releasing A11. A5 overlaps; B5 closes the winger and B11 recovers outside. |
| unused:stage-5: Overlap and protect | 18.4–23.5 | A11 uses A5 outside. A7 checks back toward width as the far-side defence recovers. |
| unused:stage-6: Recycle the second ball | 23.5–28.5 | A5 finds A8 underneath. A6 remains a central safety option and the centre-backs step up together. |
| unused:stage-7: Connect to the striker | 28.5–34.0 | A8 releases A9, who carries into a low shot. B1 gathers while the other attackers retain recovery positions. |
| blocked:stage-1: Build under pressure | 0.0–4.2 | A3 advances against B9 and finds A6. The wide players prepare different receiving depths. |
| blocked:stage-2: Accelerate at the line | 4.2–8.0 | A7 sprints inside while B2 and the centre-backs maintain their line. B6 presses A6 and screens the forward lane. |
| blocked:stage-3: Run beyond the release line | 8.0–11.8 | A7 continues beyond the second-last defender. A6 uses A8 across the pitch instead of forcing the forward route. |
| blocked:stage-4: Recover an onside option | 11.8–16.3 | A7 bends back as A8 finds A10. B6 recovers into the central pass corridor and B3 protects the striker. |
| blocked:stage-5: Contest the central pass | 16.3–21.0 | A10 attempts the pass toward A9. B6 steps into the route, intercepts, and turns into space. |
| blocked:stage-6: Break out after recovery | 21.0–25.5 | B6 carries toward the near side and releases B7. A6 counter-presses and both A centre-backs retreat. |
| blocked:stage-7: Support the counterattack | 25.5–30.0 | B7 advances with B9 and B10 supporting inside. A2 delays the carrier and A7 recovers behind the ball. |

## Related coaching guidance and limits

The check, curved acceleration and pass timing are consistent with FIFA’s coaching emphasis on [coordinating run rhythm with pass weight and timing](https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/hediger-balls-behind-the-defence.php), the accelerating curved run in [technical activation circuit 4, drill 6](https://www.fifatrainingcentre.com/en/practice/technical-activation/technical-activation-circuit-4.php), and [pressing during ball travel](https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/press-and-regain/passing-circuit-defensive-anticipation.php). These sources motivate qualitative authoring choices; they do not validate the numerical speed bounds or these synthetic scenes.

The scenes remain a bounded tactical demonstration. They do not model player perception, body facing, fatigue, calibrated decision-making, tackle success or ball-control probability. Neither the hook nor the faster pass receives a success label from its shape. AS/DAS must be recomputed independently from the frozen tracking and interpreted with the method’s own assumptions.

## Frozen source and data hashes

Hashes cover the exact bytes, including each exported trailing newline. Metadata copy is part of the input hash; changing a cue requires an export and analysis-provenance refresh even when player coordinates are unchanged.

| File | SHA-256 |
| --- | --- |
| src/scenarios.mjs | 1d26df39175100ebf3908387321eb46f4c932d48577b1156a12f730ca61a2b71 |
| data/used.json | a8ac74f2d5d48807559e0286be639fa4e71dc41b1b711618b2e43a4cb7c4a6f0 |
| data/unused.json | 9afaea12c5c2e45a339eb953dc54b85ebb6fdae6cd3fa158d6e1ce084358d3df |
| data/blocked.json | a26082126925cf6448f4e1e9da34d3e86a0d596008df1b6fda977555f9ab0a08 |
