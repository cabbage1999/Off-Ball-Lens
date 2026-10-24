# Independently authored tactical scenes

These three clips are complete, separate synthetic attacks. Each contains 22 persistent players, a ball, seven tactical phases, and an explicit possession/flight/reception timeline. Public titles describe the action without announcing its outcome. Scenario IDs are authoring categories; they are not numeric labels, model inputs, or ground truth for a football-value method.

The frozen trajectory version is **tactical-state-v2.0.1**, generated on 24 October 2026. Source: independently written tactical boards and a bounded kinematic controller. No recorded match tracking, third-party scenario source, unlicensed football-demo code, learned movement distribution, or AS/DAS value is used by the generator. The integer seed is recorded for provenance; it introduces no random background movement. Every exported coordinate uses metres on a 105 × 68 m pitch with centre origin, x in [−52.5, 52.5], y in [−34, 34]. A attacks +x; after B gains control, the frame records B and −1.

The phase and role descriptions below are **authored intentions**. They explain why the generator moves a player. They must not be presented as pressures discovered by DAS, automatic causal findings, or observed future events in an as-of explanation. A statement about pressure at a particular time needs that time’s geometry or an explicitly identified authoring note.

## Reproduce and inspect

```sh
node scripts/export-data.mjs
node scripts/validate.mjs
node --test tests/scenarios.test.mjs
```

The exporter can also take scene IDs, for example `node scripts/export-data.mjs used`. It replaces each complete file atomically. The generator remains available through `SCENARIOS`, `listScenarios`, `generateScenario`, and `frameAt`. The lookup returns the latest tracking frame at or before the requested time.

The machine-readable audit is [data/validation.json](../data/validation.json). It records hashes, every player’s distance and speed distribution, every pass/shot’s continuous clearance, all event links, and the target’s geometric offside intervals. The automated scene test suite contains 20 checks, including deliberately broken teleport, event-link, and between-sample ball-crossing examples.

## What the generator actually does

Each phase supplies an authored target for every player. A look-ahead position controller advances toward the phase route, while local defensive tasks respond to the current carrier and marked player. B9 approaches either building centre-back on an angle; B6 presses A6; B8 closes A8 or A10; B2 closes a controlled A7; B5 closes A11. B7 tracks the advancing A2, B11 follows A11 inside, the centre-backs remain goal-side of A9, and goalkeepers adjust their lateral set position. In the turnover clip, A6 counter-presses B6 and A2 delays B7. Following a save, attackers recover and B’s defenders prepare outlets.

The attacking routes also have different purposes: overlapping full-back, deeper pivot, third-player connection, central striker, opposite winger, and rest defence. A slow goalkeeper or central defender is permitted because the role requires depth. There is no sinusoidal anchoring or random movement added to make players appear active.

Desired motion is steered away from predicted close contacts and the pitch edge. The controller limits the **vector** velocity change, so it limits a turn as well as forward acceleration. The position update is

`p_next = p + (v + v_next) × dt / 2`, with `dt = 0.1 s`.

The published velocity is the same velocity used by that integration. There are no post-hoc position projections, teleports, or independent velocity estimates. Speed is capped at 7.6 m/s, goalkeeper speed at 4.5 m/s, and vector acceleration at 3.2 m/s². These are explicit simulator constraints, not estimates fitted to professional tracking.

Passes and low shots travel from the releasing player’s recorded foot point to the actual recipient’s recorded foot point. Each release and arrival share a globally unique pass ID and release frame ID. The ball is `in_flight` with no carrier until reception, interception, or a save changes it to `possessed`; the attacking team changes with actual control. All three clips use ground-level ball motion (z = 0). Other contract states, `loose` and `dead`, are reserved for appropriate sequences rather than fabricated in these attacks.

This is offline choreography: a pass endpoint uses the recipient’s realised arrival position. During a flight the tactical focus is the declared receiving player. The generator does not claim to predict a player’s decisions online. Kicks and controls are explicit velocity impulses; ball rolling resistance, body orientation, limb contact, tackling, fatigue, and aerial dynamics are not simulated.

## Physical and event audit

The audit checks all 22 identities, 10 Hz sampling, finite centred coordinates, speed, vector acceleration, position/velocity consistency, foot distance, ball bounds, possession, release/arrival linkage, direction after turnover, onside geometry of each intended same-team pass target at release, and the continuation of each saved ground shot through the attacked goal mouth after the save point. A goalkeeper save is an actual possession change, and an interception retains the intended teammate on the release event while naming the defender on the arrival event.

For player pairs and ball flights, the audit examines the closest simultaneous point along **every 0.1 s interval**, including crossings between samples. It subtracts a conservative bound for the player’s acceleration curvature: a·dt²/8 for ball versus one player, a·dt²/4 for two players. This makes the reported clearance a lower bound under the stated constant-acceleration step, rather than just a screenshot distance.

All non-participants in a pass/shot must remain at least 1.2 m from the ball’s planar route; the passer and actual receiver are excluded because their contacts are required and separately verified. Player pairs must remain at least 0.8 m apart. Those are transparent geometric exclusions, **not** a validated interception/control model. A defender can still challenge a ball at a larger separation, and these checks do not prove tactical success in a real match.

| Clip | Duration / frames | Events | Peak player speed (m/s) | Peak vector acceleration (m/s²) | Min player clearance (m) | Min ball/non-participant clearance (m) |
| --- | --- | --- | --- | --- | --- | --- |
| used | 32 s / 321 | 12 | 5.06 | 3.2 | 1.8 | 1.63 |
| unused | 34 s / 341 | 14 | 5.32 | 3.2 | 1.59 | 1.34 |
| blocked | 30 s / 301 | 10 | 6.79 | 3.2 | 1.57 | 1.64 |

All checks passed on the frozen data. Motion totals provide an audit of this particular short sequence; they are not a claim that the generator reproduces an empirical professional-football distribution.

| Clip | Median player mean speed (m/s) | Outfield distance range (m) | Players with mean speed below 0.5 m/s |
| --- | --- | --- | --- |
| used | 1.14 | 21.73–54.72 | A1, B1 |
| unused | 1.18 | 20.57–64.74 | A1, B1 |
| blocked | 1.48 | 23.12–79.63 | B1 |

The slow players are goalkeepers, while every outfield player advances, tracks, covers, supports, or recovers with the relevant stage. A7 reaches approximately 6.79 m/s in the turnover clip; the other two attacks contain more measured movement. Faster motion is not used as a success label.

### Physics-only draft corrections

Continuous-path inspection found a draft shot crossing B4, an outside combination crossing B11, and first-line releases too close to the approaching presser. Before freezing the scene, the back-line cover, the winger/full-back handover, and the angled pressure targets were revised. The selected geometry was accepted against event continuity and declared clearance limits. These corrections did not read DAS or optimise an opportunity score. The original interception-distance check described contact-point distance to an intended line; the clarified execution audit below also reports the intended player’s distance to the actual ball ray.

### Saved-shot goal-mouth correction (v2.0.1)

Independent acceptance found a real defect in v2.0: the used shot reached B1 but its continued velocity would miss the goal mouth. B1 had treated himself as the flight’s tactical focus and moved centrally. In v2.0.1 the authored final near-side goalkeeper target changes from (47, 3) to (47, 5.5) m, and the keeper maintains that set through the shot. The same vector-acceleration controller still governs the movement. The shot release remains 29.6 s at (34.558405, 16.910944) m, and the save remains at 30.6 s.

| Quantity | Before correction | After correction |
| --- | --- | --- |
| Ball velocity (vx, vy), m/s | (12.091595, −15.735332) | (12.091595, −11.290998) |
| Save contact (x, y), m | (46.650000, 1.175612) | (46.650000, 5.619947) |
| Continued ball y at goal line x = 52.5 m | −6.437254 m, outside ±3.66 m | +0.157282 m, inside ±3.66 m |
| Continued goal-line arrival | After the recorded save, but wide | 31.083807 s, after the 30.6 s save |

The corrected used shot travels at 16.543679 m/s and has at least 2.725136 m continuous clearance from every non-participant. B1’s peak speed is 3.2 m/s and peak vector acceleration is 3.2 m/s². The unused shot was also checked: its continuation crosses at y = −1.399346 m and remains unchanged. Both are ground shots, so the lateral goal-mouth check applies at z = 0. The validation report now includes each goal-line projection, and a regression test explicitly rejects the former wide used-shot velocity. This change repairs event geometry; it was not based on any AS/DAS output.

## Individual motion distributions

Each cell reports distance in metres / mean speed in m/s / peak speed in m/s. Keeper movement is intentionally smaller, and the central defenders retain more depth than the wide and pressing players.

| Player / role | used | unused | blocked |
| --- | --- | --- | --- |
| A1 — Goalkeeper | 12.15 / 0.38 / 1.99 | 13.34 / 0.39 / 2.35 | 15.75 / 0.53 / 2.54 |
| A2 — Near-side full-back | 54.72 / 1.71 / 3.25 | 43.42 / 1.28 / 1.64 | 58.17 / 1.94 / 2.91 |
| A3 — Near-side centre-back | 37.06 / 1.16 / 1.77 | 41.69 / 1.23 / 1.63 | 43.14 / 1.44 / 2 |
| A4 — Far-side centre-back | 36.16 / 1.13 / 1.77 | 40.59 / 1.19 / 1.64 | 42.98 / 1.43 / 1.86 |
| A5 — Far-side full-back | 40.73 / 1.27 / 2.03 | 64.74 / 1.9 / 3.92 | 45.83 / 1.53 / 2.11 |
| A6 — Holding midfielder | 40.39 / 1.26 / 2.51 | 37.01 / 1.09 / 1.64 | 62.51 / 2.08 / 6.31 |
| A7 — Near-side winger | 42.44 / 1.33 / 3.39 | 48.69 / 1.43 / 3.43 | 79.63 / 2.66 / 6.79 |
| A8 — Far-side midfielder | 35.42 / 1.11 / 1.63 | 39.67 / 1.17 / 3.1 | 46.52 / 1.55 / 2.29 |
| A9 — Centre-forward | 24.65 / 0.77 / 1.01 | 24.68 / 0.73 / 0.99 | 27.92 / 0.93 / 1.83 |
| A10 — Attacking midfielder | 33.84 / 1.06 / 1.5 | 36.78 / 1.08 / 1.62 | 39.52 / 1.32 / 2.38 |
| A11 — Far-side winger | 30.93 / 0.97 / 1.7 | 30.51 / 0.9 / 1.6 | 37.21 / 1.24 / 1.99 |
| B1 — Defending goalkeeper | 15.41 / 0.48 / 3.2 | 15.22 / 0.45 / 3.05 | 14.4 / 0.48 / 3.2 |
| B2 — Near-side full-back | 28.65 / 0.9 / 2.91 | 41.05 / 1.21 / 4.62 | 33.58 / 1.12 / 2.22 |
| B3 — Near-side centre-back | 23.03 / 0.72 / 2 | 20.57 / 0.61 / 1.59 | 23.12 / 0.77 / 1.91 |
| B4 — Far-side centre-back | 21.73 / 0.68 / 1.54 | 20.77 / 0.61 / 1.57 | 23.21 / 0.77 / 1.72 |
| B5 — Far-side full-back | 28.96 / 0.91 / 2.8 | 28.7 / 0.85 / 3.07 | 30.17 / 1.01 / 2.85 |
| B6 — Near-side holding midfielder | 49.16 / 1.54 / 5.02 | 29.37 / 0.86 / 1.87 | 65.7 / 2.19 / 5.18 |
| B7 — Near-side wide midfielder | 49.98 / 1.56 / 4.07 | 41.35 / 1.22 / 4.16 | 56.88 / 1.9 / 3.83 |
| B8 — Far-side central midfielder | 38.51 / 1.2 / 4.89 | 56.97 / 1.68 / 5.32 | 47.7 / 1.59 / 4.09 |
| B9 — First-line presser | 52.97 / 1.66 / 4.46 | 58.58 / 1.72 / 5.26 | 64.03 / 2.13 / 4.64 |
| B10 — Second-line presser | 47.75 / 1.49 / 5.06 | 43.05 / 1.27 / 3.79 | 56.87 / 1.9 / 4.68 |
| B11 — Far-side wide midfielder | 41.5 / 1.3 / 4.57 | 46.63 / 1.37 / 4.57 | 51.37 / 1.71 / 4.72 |

## Scenario outcomes and interpretation boundaries

- **used:** A3 finds A6, A6 releases A7 at 11.2 s, and A7 controls at 12.4 s. A7 then connects to A9, A9 links A10, and A10 switches to A11. A11’s low shot is gathered by B1 at 30.6 s. The receiver’s observed outcome comes from events, not from its identifier or a prescribed metric curve.
- **unused:** A8 chooses A10 at 11.8 s and A10 controls at 13.0 s. A7 continues the actual run, checks wider as B2 recovers, and never receives in this clip. The subsequent A11–A5 combination and A8–A9 connection lead to a save at 33.2 s. An unselected option does not establish that the carrier chose badly.
- **blocked:** A7 accelerates, then occupies a geometric offside position from tracking time **8.1 through 16.5 s**. A6 instead finds A8. A7 bends back into an onside position; later A10’s separate attempted pass toward A9 is intercepted by B6 at 20.2 s. B6 carries and finds B7 at 25.4 s; B7 continues the counterattack through the end. A7’s earlier run is not assigned causation for this later turnover.

The last clip can have direct receiving opportunity **before** the offside interval and **after** the return onside. The author-package run indeed reported such windows. “Blocked” therefore cannot mean that the runner had no opportunity for the whole clip. Geometric offside at 10 Hz also need not begin on the same timestamp as the 5 Hz analysis samples, and it is not a referee decision. See the independent [qualitative model cases](qualitative-cases.md) for model agreement and disagreement; no trajectory was changed to force a desired score ordering.

### Authored misdirected pass in blocked

The 19.6 s A10 release records A9 as the intended teammate, but the actual ball is a **misdirected pass** that B6 receives at 20.2 s. The forward extension of its actual velocity passes **3.101862 m from A9’s centre at 20.2 s**. It therefore must not be described as a precise pass to A9’s feet or as a calibrated, realistic technical interception.

The previously reported **1.386899 m** is a different measurement: the ball-contact point at B6 is that far from the segment connecting release to A9’s contemporaneous foot position. Point-to-intended-line distance and intended-player-to-actual-ray distance are not interchangeable. The audit now names both definitions explicitly. This is authored execution error and an authored interception; there is no calibrated model of passing technique, error, anticipation, reaction time, or interception skill. The control change and ball continuity are verified, while that behavioural limitation remains visible.

These scenes support internal tactical review and product demonstration. They have not been independently validated by a professional coach or against an external tracking dataset. They demonstrate direct receiving opportunities and the limits of that view; they do not measure individual causal contribution or automatically attribute a teammate’s gain to a decoy run.

## Complete event chains and phase-by-phase role scripts

For each phase, the target coordinates are **authored steering objectives at the phase boundary**, not asserted exact player locations. Live role responses and collision avoidance may move the realised trajectory away from that board. Exact positions, velocities, and event states are in the corresponding JSON. Every listed action below is authoring rationale.

### used: Right-side combination / 右侧配合

Follow the near-side run through a moving defensive block.

Initial carrier: **A3**. Final carrier: **B1**. Dataset: [used.json](../data/used.json).

| Action ID | Release (s) | From → intended target | Arrival (s) | Actual control / outcome |
| --- | --- | --- | --- | --- |
| used:p1 | 3.2 | A3 → A6 | 4.3 | A6 / reception |
| used:p2 | 11.2 | A6 → A7 | 12.4 | A7 / reception |
| used:p3 | 17.5 | A7 → A9 | 18.7 | A9 / reception |
| used:p4 | 21 | A9 → A10 | 22 | A10 / reception |
| used:p5 | 25.3 | A10 → A11 | 26.8 | A11 / reception |
| used:s1 | 29.6 | A11 → B1 | 30.6 | B1 / save |

#### used, phase 1: Draw the first press (0–4.3 s)

A3 carries into B9’s press. A6 checks into the near-side pocket; the full-backs create width.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Follow A3 from the goal area | (-45, -1) |
| A2 | Open the right-side outlet | (-17, -27) |
| A3 | Carry and release under an angled press | (-23, -9) |
| A4 | Balance A3 from the central safety lane | (-25, 8) |
| A5 | Move forward as the weak-side outlet | (-18, 25) |
| A6 | Check toward A3 for the first pass | (-7, -9) |
| A7 | Hold width beyond the first pressing line | (6, -27) |
| A8 | Present a second midfield angle | (-1, 12) |
| A9 | Occupy the central defensive pair | (20, 0) |
| A10 | Check between the midfield and back line | (7, 5) |
| A11 | Keep far-side width | (13, 26) |
| B1 | Adjust to A3’s ball angle | (48, -1) |
| B2 | Retain depth behind the first press | (23, -24) |
| B3 | Cover inside the near-side full-back | (26, -8) |
| B4 | Maintain the far-side central cover | (27, 8) |
| B5 | Narrow from the far touchline | (23, 23) |
| B6 | Screen the pass beyond A6 | (9, -10) |
| B7 | Recover toward the advancing full-back | (0, -26) |
| B8 | Balance the midfield screen | (13, 10) |
| B9 | Curve toward A3 to pressure circulation | (-18, -8) |
| B10 | Screen A6 while A3 carries | (-5, 5) |
| B11 | Recover toward the far-side winger | (3, 24) |

#### used, phase 2: Advance through the pivot (4.3–9.5 s)

A6 advances as B6 leaves the midfield screen to press. A2 overlaps outside A7; the far-side block narrows.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Advance behind the two centre-backs | (-43, -2) |
| A2 | Accelerate outside A7 | (-5, -29) |
| A3 | Advance after finding the pivot | (-16, -10) |
| A4 | Advance while remaining behind A6 | (-18, 7) |
| A5 | Narrow to support circulation | (-12, 23) |
| A6 | Receive and carry toward B6 | (4, -12) |
| A7 | Begin the diagonal run inside A2 | (13, -25) |
| A8 | Advance on the far side of A6 | (5, 10) |
| A9 | Adjust between the centre-backs | (23, -1) |
| A10 | Advance as A6 attracts the pivot | (12, 3) |
| A11 | Advance while the ball remains opposite | (17, 25) |
| B1 | Move toward the near-side ball line | (47, -2) |
| B2 | Balance A7 and the outside overlap | (24, -25) |
| B3 | Stay goal-side of the striker | (28, -9) |
| B4 | Move with B3 as the ball advances | (29, 7) |
| B5 | Compress the weak side of the block | (25, 20) |
| B6 | Step out to pressure A6’s carry | (9, -11) |
| B7 | Follow A2’s outside movement | (7, -27) |
| B8 | Move toward the ball-side interior | (17, 7) |
| B9 | Recover centrally after the pass bypasses him | (-10, -6) |
| B10 | Recover inside the progressing pivot | (1, 1) |
| B11 | Narrow while tracking A11’s progress | (10, 22) |

#### used, phase 3: Underlap into the channel (9.5–13.5 s)

A7 leaves the touchline while B2 balances the overlap. A9 holds the centre-backs and A10 offers an inside alternative.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Keep central reset depth | (-42, -2) |
| A2 | Continue the outside overlap | (8, -29) |
| A3 | Maintain the near-side rest-defence line | (-9, -11) |
| A4 | Narrow beneath the developing attack | (-11, 6) |
| A5 | Keep a deeper far-side receiving angle | (-5, 21) |
| A6 | Release into A7’s inside run | (11, -11) |
| A7 | Receive in the near-side channel | (24, -17) |
| A8 | Move centrally below A10 | (11, 8) |
| A9 | Keep a central receiving angle for A7 | (26, -1) |
| A10 | Offer the second route inside A7 | (18, 3) |
| A11 | Maintain the far-side outlet | (20, 24) |
| B1 | Set for the channel pass | (47, -3) |
| B2 | Hold the outside lane as A7 cuts inside | (27, -23) |
| B3 | Protect the channel behind B2 | (30, -9) |
| B4 | Narrow around the centre-forward | (31, 6) |
| B5 | Move inside while retaining recovery width | (28, 17) |
| B6 | Recover toward the inside route after release | (17, -12) |
| B7 | Track the overlap behind B2 | (15, -27) |
| B8 | Protect the alternative route through A10 | (21, 5) |
| B9 | Close the return lane to A6 | (-2, -5) |
| B10 | Track the central support below A7 | (9, 0) |
| B11 | Hold the weak-side recovery lane | (17, 20) |

#### used, phase 4: Receive and connect (13.5–18.7 s)

A7 carries after reception. B2 closes the ball, B3 covers inside, and A9 checks toward the next pass.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Shift behind the right-side attack | (-41, -1) |
| A2 | Support beneath A7 after his reception | (20, -26) |
| A3 | Follow the attack without joining the box | (-2, -10) |
| A4 | Keep cover behind the near-side centre-back | (-5, 7) |
| A5 | Advance without duplicating A11 width | (1, 21) |
| A6 | Follow the ball as the return option | (17, -8) |
| A7 | Carry inside and pass to A9 | (31, -14) |
| A8 | Provide an unselected central support option | (17, 9) |
| A9 | Check toward the passing lane and receive | (30, 0) |
| A10 | Move underneath A9 for the layoff | (24, 5) |
| A11 | Move forward as the near-side attack develops | (23, 25) |
| B1 | Adjust behind the full-back and centre-back | (47, -2) |
| B2 | Close A7 after he controls the ball | (32, -17) |
| B3 | Track A9 while B2 closes the ball | (34, -5) |
| B4 | Hold the central lane opposite B3 | (34, 6) |
| B5 | Stay connected to the centre-backs | (31, 17) |
| B6 | Move behind B2 to cover the channel | (25, -11) |
| B7 | Remain with the full-back beneath A7 | (23, -25) |
| B8 | Follow the central receiving movement | (27, 7) |
| B9 | Follow the attack from behind the ball | (6, -3) |
| B10 | Close the route back through A6 | (16, 2) |
| B11 | Move back with the far-side option | (23, 21) |

#### used, phase 5: Third-player support (18.7–22 s)

A9 receives with pressure behind and connects to A10. A6 and A8 stay available beneath the attack.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Hold the central safety position | (-40, 0) |
| A2 | Remain outside the central combination | (24, -24) |
| A3 | Stay beneath A6 as a reset | (3, -8) |
| A4 | Move up with the safety line | (0, 7) |
| A5 | Move outside as the ball approaches A10 | (7, 24) |
| A6 | Offer a deeper reset behind A9 | (21, -5) |
| A7 | Continue across the defensive line as support | (34, -10) |
| A8 | Remain under the third-player combination | (22, 11) |
| A9 | Lay the ball off to A10 | (33, 1) |
| A10 | Receive the short connection from A9 | (28, 5) |
| A11 | Prepare to receive the cross-field switch | (27, 24) |
| B1 | Return toward the central passing angle | (47, 0) |
| B2 | Recover inside after the central pass | (35, -13) |
| B3 | Cover behind the striker’s layoff | (36, -3) |
| B4 | Follow the third-player combination | (37, 6) |
| B5 | Prepare to engage the far-side switch | (34, 18) |
| B6 | Recover underneath the central combination | (29, -7) |
| B7 | Recover into the wide passing lane | (28, -23) |
| B8 | Keep cover beyond A9’s layoff | (31, 8) |
| B9 | Move toward the central reset route | (12, -1) |
| B10 | Follow the supporting midfielders | (21, 4) |
| B11 | Keep contact as the ball approaches A10 | (28, 22) |

#### used, phase 6: Move the block across (22–27 s)

A10 carries and switches toward A11; B5 and B11 release from narrow cover to defend the far side.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Adjust toward the switched ball | (-40, 1) |
| A2 | Advance as the ball moves away | (27, -22) |
| A3 | Move centrally beneath the switch | (6, -6) |
| A4 | Hold central protection as A5 advances | (4, 8) |
| A5 | Support A11 from below the ball | (13, 25) |
| A6 | Move centrally underneath the switch | (24, -2) |
| A7 | Retain an inside option as the ball switches | (36, -7) |
| A8 | Advance beneath A11 for a cutback | (26, 13) |
| A9 | Move into the central finishing channel | (37, 2) |
| A10 | Carry and switch the ball toward A11 | (32, 6) |
| A11 | Receive outside the narrowing back line | (31, 20) |
| B1 | Shift across as the ball switches | (47, 5.5) |
| B2 | Narrow while the ball travels away | (38, -10) |
| B3 | Retain central depth beneath the switch | (39, -2) |
| B4 | Protect the central shot lane | (40, 4) |
| B5 | Move outward to the receiving winger | (36, 20) |
| B6 | Protect the lane below A10 | (32, -4) |
| B7 | Narrow as the ball leaves the near side | (31, -20) |
| B8 | Press A10 from the inside before the switch | (33, 13) |
| B9 | Recover through the centre | (18, 0) |
| B10 | Recover beneath the far-side combination | (25, 7) |
| B11 | Recover outside B8 toward A11 | (31, 23) |

#### used, phase 7: Finish and reset (27–32 s)

A11 moves inside for a low shot. B1 adjusts and gathers; nearby attackers slow and the back line holds recovery depth.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Hold depth, then settle after the save | (-41, 1) |
| A2 | Recover several steps after the save | (28, -19) |
| A3 | Retreat after the goalkeeper gathers | (7, -5) |
| A4 | Retreat after possession changes | (6, 9) |
| A5 | Recover when the shot is saved | (17, 24) |
| A6 | Hold recovery depth and step back | (26, 0) |
| A7 | Slow and recover after the save | (38, -8) |
| A8 | Recover centrally after the save | (28, 11) |
| A9 | Arrive centrally, then retreat after the save | (41, 3) |
| A10 | Follow the shot at recovery speed | (36, 7) |
| A11 | Carry inside, shoot low, then recover | (37, 14) |
| B1 | Set on the near-side shot line, gather, then settle centrally | (47, 5.5) |
| B2 | Open slightly as a goalkeeper outlet | (42, -7) |
| B3 | Hold the middle, then offer a short outlet | (44, 0) |
| B4 | Remain inside the shot route, then reset | (44, 2) |
| B5 | Close A11, then widen after the save | (40, 16) |
| B6 | Return centrally after the save | (35, 0) |
| B7 | Hold an outlet position after the save | (33, -17) |
| B8 | Recover toward the far-side second ball | (36, 13) |
| B9 | Turn into a counterattack outlet after the save | (23, 1) |
| B10 | Offer a central outlet after the save | (28, 8) |
| B11 | Follow A11 inside, then reset | (34, 21) |

### unused: Switch across the block / 横向转移

Watch two receiving options develop around the ball.

Initial carrier: **A4**. Final carrier: **B1**. Dataset: [unused.json](../data/unused.json).

| Action ID | Release (s) | From → intended target | Arrival (s) | Actual control / outcome |
| --- | --- | --- | --- | --- |
| unused:p1 | 3.5 | A4 → A8 | 4.6 | A8 / reception |
| unused:p2 | 11.8 | A8 → A10 | 13 | A10 / reception |
| unused:p3 | 16.9 | A10 → A11 | 18.3 | A11 / reception |
| unused:p4 | 21.8 | A11 → A5 | 23 | A5 / reception |
| unused:p5 | 26.7 | A5 → A8 | 28.2 | A8 / reception |
| unused:p6 | 30 | A8 → A9 | 31.2 | A9 / reception |
| unused:s1 | 32.6 | A9 → B1 | 33.2 | B1 / save |

#### unused, phase 1: Circulate on the far side (0–4.6 s)

A4 draws B9 and releases A8, with A5 preparing the outside route.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Follow the left centre-back’s advance | (-45, 1) |
| A2 | Offer the opposite-side outlet | (-20, -26) |
| A3 | Balance A4’s initial carry | (-26, -7) |
| A4 | Carry and release toward A8 | (-24, 12) |
| A5 | Start outside the initial carrier | (-16, 28) |
| A6 | Show a central alternative to A8 | (-6, -4) |
| A7 | Hold width on the opposite flank | (3, -27) |
| A8 | Check toward A4 and receive | (-6, 15) |
| A9 | Occupy the two central defenders | (20, 0) |
| A10 | Show between the two midfield lines | (8, 3) |
| A11 | Keep the far-side width | (15, 26) |
| B1 | Adjust toward the left-side build-up | (48, 1) |
| B2 | Keep goal-side depth against A7 | (23, -23) |
| B3 | Hold the near-side central cover | (27, -7) |
| B4 | Balance the back line above A4 | (27, 9) |
| B5 | Retain width behind the midfield press | (24, 23) |
| B6 | Screen the central route beyond A6 | (12, -5) |
| B7 | Recover toward the opposite full-back | (1, -25) |
| B8 | Step toward A8’s first reception | (8, 13) |
| B9 | Curve toward A4’s inside shoulder | (-20, 10) |
| B10 | Screen A6 while A4 carries | (-3, -3) |
| B11 | Recover on the ball-side flank | (2, 26) |

#### unused, phase 2: Develop two angles (4.6–9 s)

A8 advances under B8 pressure. A7 starts an inside run across the pitch while A10 checks between the lines.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Stay behind the advancing safety line | (-43, 2) |
| A2 | Advance while preserving defensive depth | (-15, -24) |
| A3 | Advance behind the central pivot | (-20, -6) |
| A4 | Follow the pass into the safety line | (-18, 10) |
| A5 | Advance along the far touchline | (-6, 30) |
| A6 | Follow the ball as a safe return | (0, -2) |
| A7 | Start an inside run behind midfield | (11, -24) |
| A8 | Carry toward the pressing B8 | (6, 13) |
| A9 | Move along the central line | (23, -1) |
| A10 | Check inside A8’s carry | (13, 2) |
| A11 | Move forward above A8 | (20, 25) |
| B1 | Set toward A8’s carrying angle | (47, 2) |
| B2 | Follow the start of A7’s inside run | (25, -22) |
| B3 | Remain goal-side of A9 | (29, -7) |
| B4 | Move centrally as A8 advances | (29, 8) |
| B5 | Narrow toward A8’s route | (27, 21) |
| B6 | Move across behind B8’s press | (14, -3) |
| B7 | Keep the far-side edge of the block | (6, -23) |
| B8 | Press A8’s advance from goal-side | (10, 12) |
| B9 | Recover after A4 bypasses the press | (-10, 8) |
| B10 | Recover toward the selected midfield route | (2, 1) |
| B11 | Move back as A5 advances outside | (10, 27) |

#### unused, phase 3: Select the inside link (9–13.3 s)

A10 receives the pass. A7 continues the actual run without receiving, and B2 follows goal-side.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Hold a central reset position | (-42, 2) |
| A2 | Remain below A7’s inside run | (-8, -23) |
| A3 | Keep the near-side recovery lane | (-13, -6) |
| A4 | Advance beneath the selected inside route | (-11, 9) |
| A5 | Accelerate beyond A8’s outside shoulder | (8, 30) |
| A6 | Stay below A10 and A7’s receiving routes | (7, -1) |
| A7 | Continue as A10 receives the selected pass | (24, -17) |
| A8 | Release to A10 instead of A7 | (12, 12) |
| A9 | Keep the centre-backs occupied during A7’s run | (27, 0) |
| A10 | Receive the selected central pass | (19, 2) |
| A11 | Retain the wide passing route | (24, 24) |
| B1 | Return toward A10’s central position | (47, 1) |
| B2 | Track the runner without following beyond the line | (28, -17) |
| B3 | Cover the space inside A7’s run | (31, -6) |
| B4 | Cover behind the selected inside link | (31, 7) |
| B5 | Prepare for a pass to A11 | (30, 22) |
| B6 | Protect A9’s lane as A10 receives | (22, -4) |
| B7 | Follow A2 while A7 runs inside | (12, -22) |
| B8 | Recover as the pass finds A10 | (21, 7) |
| B9 | Follow into the central return lane | (-2, 7) |
| B10 | Follow the support below A10 | (9, 3) |
| B11 | Stay connected to B5 above the winger | (17, 28) |

#### unused, phase 4: Find the wide receiver (13.3–18.4 s)

A10 carries before releasing A11. A5 overlaps; B5 closes the winger and B11 recovers outside.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Shift with the ball’s far-side angle | (-41, 2) |
| A2 | Narrow as the ball stays on the far side | (0, -22) |
| A3 | Follow the ball without joining the forward line | (-5, -7) |
| A4 | Support the far-side attack from depth | (-4, 10) |
| A5 | Continue outside A11 toward an overlap | (28, 30) |
| A6 | Advance beneath the chosen wide attack | (13, 0) |
| A7 | Run beyond the ball without receiving | (30, -19) |
| A8 | Follow the selected wide attack | (18, 13) |
| A9 | Offer a central target while play goes wide | (30, 2) |
| A10 | Carry toward the wide option and release A11 | (24, 7) |
| A11 | Receive from A10 near the touchline | (28, 23) |
| B1 | Shift to the incoming wide pass | (47, 3) |
| B2 | Retain contact while the pass goes elsewhere | (33, -17) |
| B3 | Protect the middle as the ball goes wide | (35, -4) |
| B4 | Narrow inside the defending full-back | (34, 8) |
| B5 | Close A11 after the wide reception | (32, 23) |
| B6 | Stay inside the far-side defending pair | (26, -5) |
| B7 | Narrow away from the ball | (17, -21) |
| B8 | Close A10 from the inside before release | (25, 12) |
| B9 | Recover behind the developing attack | (6, 8) |
| B10 | Protect the return lane through A6 | (16, 6) |
| B11 | Recover toward A11 instead of matching the full-back | (25, 25) |

#### unused, phase 5: Overlap and protect (18.4–23.5 s)

A11 uses A5 outside. A7 checks back toward width as the far-side defence recovers.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Keep depth beneath the overlapping full-back | (-40, 2) |
| A2 | Maintain balance opposite A5’s overlap | (8, -20) |
| A3 | Stay beneath the opposite full-back | (1, -7) |
| A4 | Keep cover behind the overlapping full-back | (3, 11) |
| A5 | Receive outside the winger and advance | (35, 30) |
| A6 | Remain central while A5 goes beyond the ball | (18, 1) |
| A7 | Check back toward width as the block recovers | (27, -24) |
| A8 | Move beneath A5’s outside route | (23, 16) |
| A9 | Adjust toward the positive-y side of the box | (32, 4) |
| A10 | Support underneath the full-back combination | (29, 10) |
| A11 | Pass outside to the advancing A5 | (31, 21) |
| B1 | Protect the near post during the overlap | (47, 4) |
| B2 | Recover wider as A7 checks back | (32, -21) |
| B3 | Stay connected to the other centre-back | (37, -3) |
| B4 | Protect the central lane during the overlap | (37, 9) |
| B5 | Manage A11 while A5 overlaps outside | (35, 25) |
| B6 | Hold the central cutback route | (29, -3) |
| B7 | Hold recovery width opposite the overlap | (21, -19) |
| B8 | Cover underneath B5’s wide challenge | (27, 16) |
| B9 | Move centrally below the wide combination | (13, 9) |
| B10 | Recover toward the second central option | (21, 9) |
| B11 | Follow A11 inside while A5 receives outside | (32, 20) |

#### unused, phase 6: Recycle the second ball (23.5–28.5 s)

A5 finds A8 underneath. A6 remains a central safety option and the centre-backs step up together.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Move centrally as possession recycles | (-40, 1) |
| A2 | Move up with the centre-backs | (13, -18) |
| A3 | Advance beneath the recycled possession | (7, -6) |
| A4 | Advance as A8 receives the return pass | (7, 11) |
| A5 | Return the ball underneath to A8 | (37, 27) |
| A6 | Support the recycle from A5 to A8 | (23, 1) |
| A7 | Offer the opposite-side switch again | (31, -25) |
| A8 | Receive the return pass below the winger | (27, 14) |
| A9 | Check toward the recycled ball | (35, 3) |
| A10 | Remain available beside A8 | (33, 9) |
| A11 | Move inside as A5 recycles underneath | (32, 18) |
| B1 | Reset centrally as the ball returns inside | (47, 2) |
| B2 | Maintain the far-side defensive outlet | (35, -21) |
| B3 | Follow the striker’s checking movement | (39, -2) |
| B4 | Follow the recycled central possession | (40, 8) |
| B5 | Recover toward the full-back’s outside lane | (38, 22) |
| B6 | Move under the returning ball | (32, 0) |
| B7 | Follow A2 up the pitch | (23, -17) |
| B8 | Step toward A8 as the ball recycles | (30, 15) |
| B9 | Close the route toward the centre-backs | (19, 8) |
| B10 | Follow the recycled midfield possession | (25, 10) |
| B11 | Track the winger’s inward movement | (35, 17) |

#### unused, phase 7: Connect to the striker (28.5–34 s)

A8 releases A9, who carries into a low shot. B1 gathers while the other attackers retain recovery positions.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Settle after the goalkeeper gathers | (-41, 0) |
| A2 | Recover after the shot is saved | (18, -16) |
| A3 | Retreat after the save | (11, -5) |
| A4 | Retreat after the save | (11, 10) |
| A5 | Maintain width, then recover after the save | (38, 23) |
| A6 | Hold the safety position below the striker | (26, 1) |
| A7 | Move inside, then recover after the save | (35, -22) |
| A8 | Find A9 for the next forward action | (30, 11) |
| A9 | Receive, carry and shoot low before the save | (40, 2) |
| A10 | Offer a second option behind the striker | (37, 7) |
| A11 | Hold an inside support position then recover | (35, 14) |
| B1 | Gather the striker’s low shot | (47, 1) |
| B2 | Open toward the touchline after the save | (39, -17) |
| B3 | Hold beside the shot lane then reset | (43, 0) |
| B4 | Hold the middle as the keeper gathers | (44, 7) |
| B5 | Return inside and widen after the save | (41, 17) |
| B6 | Close central space as A9 receives | (35, 1) |
| B7 | Retain a counterattack outlet after the save | (25, -15) |
| B8 | Pressure the return passer before the shot | (34, 10) |
| B9 | Turn into an outlet after the goalkeeper save | (24, 8) |
| B10 | Move into a central outlet position | (29, 9) |
| B11 | Retain central contact before the save | (38, 14) |

### blocked: Run beyond the line / 冲击防线

Follow the runner, the passing lane, and the recovering defenders.

Initial carrier: **A3**. Final carrier: **B7**. Dataset: [blocked.json](../data/blocked.json).

| Action ID | Release (s) | From → intended target | Arrival (s) | Actual control / outcome |
| --- | --- | --- | --- | --- |
| blocked:p1 | 3.1 | A3 → A6 | 4.2 | A6 / reception |
| blocked:p2 | 10.4 | A6 → A8 | 11.8 | A8 / reception |
| blocked:p3 | 15.1 | A8 → A10 | 16.3 | A10 / reception |
| blocked:p4 | 19.6 | A10 → A9 | 20.2 | B6 / interception |
| blocked:p5 | 24.1 | B6 → B7 | 25.4 | B7 / reception |

#### blocked, phase 1: Build under pressure (0–4.2 s)

A3 advances against B9 and finds A6. The wide players prepare different receiving depths.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Follow the initial centre-back carry | (-45, -1) |
| A2 | Open the right-side outlet | (-17, -28) |
| A3 | Carry and find A6 against pressure | (-23, -9) |
| A4 | Balance A3’s initial progression | (-26, 9) |
| A5 | Move up as the far-side outlet | (-18, 25) |
| A6 | Check toward A3 and receive | (-8, -7) |
| A7 | Hold a starting lane outside the block | (7, -25) |
| A8 | Present a second midfield angle | (0, 13) |
| A9 | Occupy the centre-backs | (21, 0) |
| A10 | Show between midfield and defence | (7, 4) |
| A11 | Keep the far-side width | (14, 26) |
| B1 | Set behind the initial defensive block | (48, -1) |
| B2 | Hold depth above the wide midfielder | (24, -23) |
| B3 | Cover the near-side channel | (27, -7) |
| B4 | Balance the centre-back line | (27, 8) |
| B5 | Narrow from the far touchline | (24, 23) |
| B6 | Screen A6 from midfield | (9, -8) |
| B7 | Recover with A2’s early advance | (2, -27) |
| B8 | Balance the central screen | (12, 11) |
| B9 | Curve into A3’s build-up press | (-18, -7) |
| B10 | Screen the pivot during build-up | (-4, 6) |
| B11 | Recover with the far-side winger | (4, 25) |

#### blocked, phase 2: Accelerate at the line (4.2–8 s)

A7 sprints inside while B2 and the centre-backs maintain their line. B6 presses A6 and screens the forward lane.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Advance behind the safety line | (-43, -1) |
| A2 | Advance outside the sprinting winger | (-7, -29) |
| A3 | Advance after the first pass | (-16, -10) |
| A4 | Advance in parallel behind the pivot | (-19, 8) |
| A5 | Keep useful width opposite A7 | (-12, 24) |
| A6 | Carry into B6’s pressure | (3, -9) |
| A7 | Accelerate diagonally toward the back line | (32, -16) |
| A8 | Advance on the far side of the pivot | (6, 12) |
| A9 | Adjust along the defensive line | (24, -1) |
| A10 | Advance beneath the sprinting winger | (12, 3) |
| A11 | Move forward opposite the sprint | (18, 25) |
| B1 | Move with A6’s ball angle | (47, -2) |
| B2 | Protect the line as A7 accelerates | (27, -21) |
| B3 | Hold the central line behind B6 | (28, -6) |
| B4 | Remain connected as the wide runner sprints | (29, 7) |
| B5 | Compress the weak side of the block | (26, 21) |
| B6 | Press the carrier while blocking the forward lane | (8, -9) |
| B7 | Track the outside support behind A7 | (10, -27) |
| B8 | Move across behind B6’s pressure | (16, 9) |
| B9 | Recover after A3 finds the pivot | (-10, -5) |
| B10 | Recover through the central support lane | (2, 2) |
| B11 | Narrow while the ball stays opposite | (11, 23) |

#### blocked, phase 3: Run beyond the release line (8–11.8 s)

A7 continues beyond the second-last defender. A6 uses A8 across the pitch instead of forcing the forward route.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Shift toward the cross-field option | (-42, 1) |
| A2 | Keep width below A7’s advanced position | (4, -28) |
| A3 | Keep central cover beneath the early run | (-10, -10) |
| A4 | Hold opposite-side central cover | (-12, 7) |
| A5 | Advance while A6 looks across the pitch | (-5, 23) |
| A6 | Pass across to A8 as A7 runs beyond the line | (8, -5) |
| A7 | Continue beyond the second-last defender | (39, -10) |
| A8 | Receive the cross-field choice from A6 | (13, 11) |
| A9 | Hold a central option below A7 | (27, 0) |
| A10 | Move into A8’s forward passing angle | (18, 4) |
| A11 | Stay outside for a cross-field alternative | (23, 23) |
| B1 | Hold depth while A7 runs beyond the line | (47, 1) |
| B2 | Stay with the line instead of chasing the offside run | (29, -17) |
| B3 | Stay goal-side of A9 while A7 runs beyond | (30, -5) |
| B4 | Maintain depth beside B3 | (31, 7) |
| B5 | Shift toward the pass to A8 | (28, 19) |
| B6 | Recover across as A6 releases to A8 | (16, -2) |
| B7 | Hold the touchline route below the back line | (16, -26) |
| B8 | Close A8 when the cross-field pass arrives | (18, 10) |
| B9 | Hold the return lane beneath A6 | (-3, -2) |
| B10 | Close the return angle from A8 | (9, 3) |
| B11 | Move toward the cross-field passing side | (17, 21) |

#### blocked, phase 4: Recover an onside option (11.8–16.3 s)

A7 bends back as A8 finds A10. B6 recovers into the central pass corridor and B3 protects the striker.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Keep a central reset position | (-41, 1) |
| A2 | Offer a safe pass as A7 bends back | (13, -27) |
| A3 | Follow the attack at safety depth | (-3, -9) |
| A4 | Remain beneath the midfield support | (-5, 8) |
| A5 | Support A8 from outside | (3, 22) |
| A6 | Follow the selected route into midfield | (14, -2) |
| A7 | Bend backward to recover an onside position | (33, -18) |
| A8 | Carry and release toward A10 | (20, 10) |
| A9 | Remain available in front of the centre-backs | (30, 0) |
| A10 | Receive the selected central pass | (23, 6) |
| A11 | Advance while A8 uses the inside route | (27, 22) |
| B1 | Adjust toward the selected inside passes | (47, 1) |
| B2 | Follow A7 only after he bends back | (33, -17) |
| B3 | Protect the lane to the striker | (33, -5) |
| B4 | Protect the central space behind B8 | (33, 7) |
| B5 | Retain cover outside B8 | (31, 19) |
| B6 | Drop into the route between A10 and A9 | (23, 1) |
| B7 | Remain available wide of the central contest | (23, -25) |
| B8 | Follow the carry and cover the A10 route | (25, 11) |
| B9 | Follow the attack from behind the midfield | (5, 1) |
| B10 | Follow the selected inside combination | (16, 5) |
| B11 | Track A11 beneath the far-side attack | (23, 20) |

#### blocked, phase 5: Contest the central pass (16.3–21 s)

A10 attempts the pass toward A9. B6 steps into the route, intercepts, and turns into space.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Hold depth as the central pass is contested | (-42, 0) |
| A2 | Begin recovering when the pass is intercepted | (8, -26) |
| A3 | Turn backward after the interception | (-5, -10) |
| A4 | Turn toward the own goal after the loss | (-8, 8) |
| A5 | Narrow after the central turnover | (2, 20) |
| A6 | Move toward the intercepted ball | (20, -1) |
| A7 | Check wide as the central route is contested | (27, -23) |
| A8 | Support behind the contested central pass | (24, 8) |
| A9 | Check toward A10 but the pass is intercepted | (32, -2) |
| A10 | Attempt the forward pass that B6 intercepts | (26, 7) |
| A11 | Narrow as A10 attempts the central pass | (30, 20) |
| B1 | Remain ready behind the interception | (47, 0) |
| B2 | Recover inside as the central pass is contested | (32, -20) |
| B3 | Hold behind B6’s interception | (34, -4) |
| B4 | Hold the centre during the interception | (35, 6) |
| B5 | Prepare to advance after possession changes | (33, 17) |
| B6 | Intercept the attempted central pass and turn | (28, 3) |
| B7 | Turn toward the attacking half after the interception | (22, -23) |
| B8 | Stay near the interception without claiming the ball | (28, 11) |
| B9 | Turn forward once B6 intercepts | (10, 0) |
| B10 | Turn toward the attacking half after the loss | (20, 4) |
| B11 | Turn inward after the interception | (27, 17) |

#### blocked, phase 6: Break out after recovery (21–25.5 s)

B6 carries toward the near side and releases B7. A6 counter-presses and both A centre-backs retreat.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Retreat behind the counter-press | (-45, -2) |
| A2 | Retreat toward the counterattack channel | (-1, -24) |
| A3 | Retreat inside the near-side full-back | (-12, -12) |
| A4 | Retreat with the other centre-back | (-15, 6) |
| A5 | Recover toward the middle of the pitch | (-6, 16) |
| A6 | Counter-press B6 before the wide release | (13, -6) |
| A7 | Recover rapidly toward the counterattack side | (17, -20) |
| A8 | Turn and recover after the interception | (17, 4) |
| A9 | Turn back as the counterattack develops | (28, -1) |
| A10 | Turn and recover after losing the passing route | (20, 5) |
| A11 | Recover toward the middle after the loss | (25, 16) |
| B1 | Advance slightly behind the counterattack | (46, -1) |
| B2 | Move forward behind B7’s breakout | (25, -20) |
| B3 | Advance behind the secured ball | (29, -5) |
| B4 | Step forward with the far-side cover | (30, 5) |
| B5 | Move up beneath the counterattack | (28, 13) |
| B6 | Carry away from A6 and release B7 | (17, -6) |
| B7 | Receive B6’s pass in the wide channel | (10, -21) |
| B8 | Advance inside the recovering A midfield | (21, 6) |
| B9 | Accelerate inside the wide breakout | (1, -4) |
| B10 | Advance between B6 and the first forward | (12, 0) |
| B11 | Advance through the far-side interior | (20, 11) |

#### blocked, phase 7: Support the counterattack (25.5–30 s)

B7 advances with B9 and B10 supporting inside. A2 delays the carrier and A7 recovers behind the ball.

| Player | Authored stage action | Boundary target (x, y), m |
| --- | --- | --- |
| A1 | Set deeper behind the recovering centre-backs | (-48, -2) |
| A2 | Delay B7 from the goal-side lane | (-11, -22) |
| A3 | Keep the central recovery line | (-21, -12) |
| A4 | Narrow behind the delaying full-back | (-23, 5) |
| A5 | Continue retreating behind the midfield | (-15, 13) |
| A6 | Recover centrally after B7 receives | (2, -10) |
| A7 | Track back behind the delaying full-back | (5, -21) |
| A8 | Continue retreating through central midfield | (8, -1) |
| A9 | Recover below the advancing B midfielders | (20, -3) |
| A10 | Retreat toward the ball-side interior | (11, 2) |
| A11 | Retreat while keeping an outside counter-press angle | (17, 12) |
| B1 | Follow the team out of the defending third | (44, -2) |
| B2 | Support the counterattack from the outside lane | (15, -20) |
| B3 | Follow the counterattack at safety depth | (21, -7) |
| B4 | Keep a central safety position for the counterattack | (23, 2) |
| B5 | Support centrally behind the advancing winger | (21, 9) |
| B6 | Follow the wide counterattack as inside support | (6, -12) |
| B7 | Carry forward with A2 delaying from goal-side | (-3, -22) |
| B8 | Support the counterattack through the central lane | (12, 1) |
| B9 | Offer an advanced central counterattack option | (-12, -7) |
| B10 | Provide the second central option for B7 | (1, -5) |
| B11 | Offer width beyond the counterattack support | (11, 5) |

## Frozen source and data hashes

Frozen audit time: 2026-10-24T13:59:04.603Z. SHA-256 values are computed over the exact exported bytes, including their trailing newline.

| File | SHA-256 |
| --- | --- |
| src/scenarios.mjs | b059d47c14f9f073d80f74da098a0907b910c511151a085700be20afcb0dacb6 |
| data/used.json | f1fb9c9a473184242096d554d94b69a7222d115d78a336332ab807961bebb62f |
| data/unused.json | 8c8dbeee60d313fd2e0bb4bbeeb53cb1671a321459e7e4e71420f1651924f1c1 |
| data/blocked.json | 0925b9872d7f353b3767e41d406a4574d920989469ac35dba27bf937b92a9133 |
