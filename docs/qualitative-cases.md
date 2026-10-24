# Qualitative scrutiny of direct receiving space

Internal, model-assisted qualitative scrutiny; no independent football expert labels or accuracy ground truth.

These ten independently specified toy snapshots exercise interpretation boundaries. They are not training examples, calibrated accuracy labels, complete match simulations, or counterfactual contribution estimates. All 22 players are included except the explicitly invalid missing-defender case. Input snapshots and unrounded outputs are in `analytics/reports/qualitative-cases.json`.

AS is m²; DAS is danger-weighted m². A null product metric means not applicable, not zero value. These observations must not be promoted to expert validation.

## 1. Stationary open

A stationary A7 in an open channel can retain direct receiving space; running speed is not itself the score.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 492.548 | 4.5042 |

## 2. Lane screen

Moving one defender into the direct lane can alter the receiver's accessible field; inspect the full field, not only the straight line.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 492.548 | 4.5042 |
| 2 | A7 | eligible | 164.580 | 1.5721 |

Observed: A7's DAS decreased (-2.9321).

## 3. Tight marker

A nearby marker may suppress direct space even with the receiver in an attacking location.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 492.548 | 4.5042 |
| 2 | A7 | eligible | 237.355 | 1.6108 |

Observed: A7's DAS decreased (-2.8934).

## 4. Momentum

Opposite and inward velocities test sensitivity to current momentum. No universal monotonic speed rule is imposed.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 500.068 | 4.1030 |
| 2 | A7 | eligible | 497.831 | 4.8622 |

Observed: A7's DAS increased (+0.7592).

## 5. Offside fast run

A fast, advanced A7 is removed by the author's geometric offside filter; this is not an official offside decision.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | offside | unavailable | unavailable |

## 6. Carrier exclusion

The carrier is excluded by configuration. The raw zero is displayed as unavailable for receiving rather than as poor play.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A6 | carrier | unavailable | unavailable |

## 7. Missing defender

Missing B3 invalidates the complete snapshot instead of silently creating more space.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | invalid (incomplete_or_duplicate_roster) | unavailable | unavailable |

## 8. Unsupported ball

A controlled high ball and a ball in flight are both outside this snapshot receiving analysis.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | invalid (non_ground_ball) | unavailable | unavailable |
| 2 | A7 | invalid (ball_in_flight) | unavailable | unavailable |

## 9. Decoy boundary

A7 and B3 move wide while A9 stays central. Opposing changes in their direct opportunities would be compatible with a decoy interpretation, but cannot establish A7's causal contribution.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 535.963 | 6.7340 |
| 1 | A9 | eligible | 149.310 | 2.2618 |
| 2 | A7 | eligible | 166.751 | 1.3244 |
| 2 | A9 | eligible | 237.019 | 6.5548 |

Observed: A7's DAS decreased (-5.4096). A9's DAS increased (+4.2931).

Interpretation boundary: the two snapshots change both a receiver and a defender. Any increase for A9 is an association with the joint configuration. The system cannot assign it to A7, and a lower A7 DAS cannot establish that the wide movement was poor. No causal credit or quality label is emitted.

## 10. Left right mirror

Reflecting x and vx and reversing the explicit attack direction preserves the same tactical geometry.

| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |
| --- | --- | --- | ---: | ---: |
| 1 | A7 | eligible | 492.548 | 4.5042 |
| 1 | A9 | eligible | 198.247 | 3.9981 |
| 2 | A7 | eligible | 492.548 | 4.5042 |
| 2 | A9 | eligible | 198.247 | 3.9981 |

Observed: A7's DAS was unchanged (+0.0000). A9's DAS was unchanged (+0.0000).

## What remains unvalidated

An independent football practitioner has not adjudicated these cases. The synthetic clips do not reproduce the paper's pass-outcome or expert-state benchmark. Sensitivity to finite angular/radial resolution, measurement noise and notification thresholds is reported separately in `analytics/reports/validation.json`. The display is a model-based account of direct receiving opportunities and is not a quality grade for every off-ball action.
