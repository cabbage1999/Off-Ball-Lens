# Author-backed DAS integration

Off-Ball Lens calls the published `accessible-space==2.1.0` package. It does not reimplement its passing model or combine hand-chosen weights into a new receiving score. The application shows a player's direct receiving opportunities during actual synthetic movement. It does not estimate that player's causal contribution.

The primary sources are the [author repository](https://github.com/jonas-bischofberger/accessible-space), the [2.1.0 distribution](https://pypi.org/project/accessible-space/2.1.0/), and Bischofberger and Baca, [Dangerous accessible space: a unified model of space and value in team sports](https://doi.org/10.1186/s40537-026-01387-8), *Journal of Big Data* 13, 76 (2026). The installed distribution's original MIT notice is retained in [ACCESSIBLE_SPACE_LICENSE.txt](../analytics/ACCESSIBLE_SPACE_LICENSE.txt). Source-file and wheel SHA-256 hashes are recorded in [validation.json](../analytics/reports/validation.json). No private planning document is part of the implementation.

## Reproduce the environment and analysis

Use Python 3.12 in an isolated environment. The complete resolved package versions are pinned in [requirements-das.lock](../requirements-das.lock); the small direct-dependency file is [requirements-das.txt](../requirements-das.txt).

```sh
python3.12 -m venv .venv-das
.venv-das/bin/python -m pip install -r requirements-das.lock
.venv-das/bin/python -m pip check
.venv-das/bin/python -m pytest analytics/tests -q
.venv-das/bin/python -m analytics.compute_das used unused blocked
.venv-das/bin/python -m analytics.validate
```

The scene exporter must run before the analysis commands when trajectories change. `inputHash` is SHA-256 of the parsed full scene serialized with sorted keys and compact separators. `inputFileHash` is the separate SHA-256 of the source JSON file's exact bytes, so it matches the trajectory export's file hash. These hashes intentionally differ. Analysis is written atomically. The validation report records both hashes used for each experiment. A scene change requires a fresh export and audit; stale scores must not be relabeled with a newer scene identifier.

During initial setup the default terminal could not resolve PyPI. The authorized network installation succeeded. To avoid duplicate slow downloads, compatible numerical dependencies already present in the bundled runtime were copied into the isolated environment; remaining dependencies and the actual author wheel were installed by pip. The resulting environment passes `pip check`. Normal reproduction uses the lock file above and has no dependency on those local copies or absolute paths.

## Numerical entry point and parameters

`analytics.compute_das.author_call` is the sole author API boundary:

```python
result = accessible_space.get_individual_dangerous_accessible_space(
    tracking.copy(deep=True),
    period_col="period_id",
    player_in_possession_col="player_in_possession",
    attacking_direction_col="attack_direction",
    infer_attacking_direction=False,
    exclude_passer=True,
    respect_offside=True,
    return_cropped_result=True,
    use_progress_bar=False,
    chunk_size=10,
    x_pitch_min=-52.5, x_pitch_max=52.5,
    y_pitch_min=-34, y_pitch_max=34,
)
```

The remaining model parameters are the pinned author's defaults: 30 angles, 15 initial ball speeds from 3 to 30 m/s, 3 m radial spacing, danger weight 1, and the author's DAS motion/interception settings. Every resolved numerical parameter is embedded in `model.config.authorApi`; a SHA-256 `configHash` covers these and the adapter, display and detector settings. The danger function and fitted coefficients are used through the author's implementation. Carrier exclusion intentionally restricts the product to receiving space; paper results for broader passing/carrying settings are not claimed as validation of this configuration.

`analyze_frame(frame)` and offline `analyze_scene(scene)` use the same `compute_frames` function. The batch path shares work across frames; it does not change the model. The frame CLI is:

```sh
.venv-das/bin/python -m analytics.compute_das used --frame 104
```

The product uses offline, precomputed results at 5 Hz from 10 Hz tracking. Player/ball animation may interpolate. Metrics, fields and evidence refer to the exact sampled frame and must show that frame's time.

## Coordinates, identities and validity

The pitch is 105 by 68 metres with a centre origin. Positions are metres; velocities are metres per second. Every supported frame contains the same 22 identified players and a separate ball row. A1/B1 are the goalkeepers, with rosters A1–A11 and B1–B11. A missing opponent invalidates the entire frame. No imputation or omission makes the pitch appear less defended.

Attack direction is explicit. For the author call, multiply x and vx by the possessing team's attack direction and pass direction +1, leaving y and vy unchanged. This gives one attacking coordinate convention. Heatmap x is reflected back to the original pitch before export. `attackDirection` in the exported frame retains the input direction. This choice is documented because the author's finite angular quadrature is not exactly orientation invariant. It is a coordinate convention, not a claim to repair or improve the author model. Tests compare the mirrored configuration and also report the difference from calling the author directly in world coordinates.

The adapter returns `status: "invalid"` with a reason for missing/duplicate players, non-finite tracking, inconsistent identity or possession, unknown direction, unsupported pitch, non-open play, uncontrolled or dead balls, any ball flight, and ball height above 0.15 m. The ball must be within 2 m of its declared carrier. The height and control-distance limits are conservative product input checks, not author-fitted parameters. They are explicit in the config.

For valid frames, player statuses are `eligible`, `carrier`, `defending`, or `offside`. Only eligible attackers receive product AS, DAS and a heatmap. Others have null metrics, including the carrier and offside players whose raw author values are zero. The author also computes defender values; the product does not present them as defensive contributions.

The offside status matches the author's point-coordinate test at its float32 precision: in attack-oriented x, an attacking player must be ahead of both the ball and the second-last defender and in the opponent's half. The carrier is excluded from this check. This is a geometric input filter, not an official decision about body parts, interference, timing or rules exceptions.

## Scalar results and raw mapping

The author returns `player_acc_space` and `player_das` aligned with long-table rows. We read these directly. The scalar results come from the author's `integrate_surfaces`; they are never sums of front-end heatmap cells.

| Output | Meaning | Unit |
| --- | --- | --- |
| AS | Integral of the player's model accessibility field | m² |
| DAS | Integral of accessibility weighted by the author's danger field | danger-weighted m² |
| Raw `player_poss_density` | Radial possibility density, not a probability or an area field | inverse metres |
| Display heatmap | Approximation of C_i(x) V(x) | dimensionless intensity |

For these scenes, the raw player density shape is `[valid_frames, 22, 30, 46]`. `x_grid` and `y_grid` are `[valid_frames, 30, 46]`; `phi_grid` is `[valid_frames, 30]`; `r_grid` has 46 entries. Frame and player positions in these arrays are resolved with the author's `frame_index` and `player_index`, never by assuming input roster order. The ball's individual metric is NaN in author output and is not converted into a player zero. Audit reports preserve all frame/player mappings, raw scalar results and product statuses.

Individual possibility fields can overlap. Summing individual DAS, computing an individual's share of team DAS, or interpreting a change as that player's contribution would be incorrect for this application. Neither DAS nor a heatmap intensity is a goal or pass-completion probability.

## Heatmap conversion and fixed scale

The author integrates `density × dr × dA`. We multiply `dangerous_result.player_poss_density` by exactly the same midpoint radial widths `dr` before display interpolation. Interior widths are 3 m; first/last widths are 1.5 m under this configuration. This converts the radial density to a dimensionless valued accessibility field for visualization. It does not change the official scalar integral.

The exported field is a 35 by 23 rectangular grid. Samples are at cell centres. Row-major order runs from y = -34 toward +34; within each row x runs from -52.5 toward +52.5. Periodic bilinear interpolation in polar coordinates avoids an artificial angular seam in the display. Out-of-pitch author nodes are zero. This interpolation and 3 m-scale display lose detail; the grid is not an independent scientific measurement.

The globally fixed scale is `[0, 0.1]`, across players, frames and all three clips. The uint8 value is `round(255 × clip(field/0.1, 0, 1))`, encoded in base64. Larger values saturate; saturation counts are audited. The largest display value in the current clips is approximately 0.077, with no saturated cells. Quantization alone introduces at most 0.1/510 absolute intensity error before considering interpolation. No frame or player is individually normalized to red. `quantity`, `unit`, `source`, `interpolation`, `layout` and `scaleMax` are included in `heatmapMeta`.

## Causal opportunity windows

These are notification rules, not a new football value model or calibrated quality threshold. A window is detected when eligible DAS stays at least 0.5 for 0.6 s. It closes after DAS stays at most 0.3 for 0.4 s, or immediately on a relevant possession/carrier change, release, offside or unavailable state. Each decision uses only numerical samples and events that have already occurred. Input titles, target-player labels and scenario hypotheses are never detector inputs.

The initial engineering threshold of 5 produced no A7 notifications because these clips often have DAS below 1. This revealed an unsuitable UI setting, not an absence of receiving value. The fixed 0.5/0.3 preset was chosen for this demonstration's numeric scale and then frozen; it was not fitted to expert truth or optimized to force the story labels. The audit reports sweeps at 0.25, 0.5 and 1.0.

Every moment has `kind: "receiving_window"`, a stable ID, player ID, start/detected/peak frame references, an optional end and an outcome. Opening time may precede detection by the confirmation interval. `peak` always means the greatest observed value so far, not a confirmed future local maximum.

`outcome.status` is one of `pending`, `passed_to`, `received`, `not_selected`, or `closed`. A release aimed at the player first yields `passed_to`; only an occurred reception gives `received`. A different chosen pass or a completed observed window may yield `not_selected`. Loss of trustworthy tracking yields the indeterminate `closed`. An open window is not closed merely because a file prefix ends. Lack of a pass is not a judgment that the carrier chose incorrectly.

**Replay must project revisions.** Each moment's `revisions` array contains complete snapshots with `knownAtTime` and `knownAtFrameId`. Select the last revision whose known-at time is at most the replay time. Do not merge it with the final moment summary, and do not merely filter final summaries by detection time. `project_moments` is the Python reference implementation. This prevents future peak, end and reception information from appearing early. All 483 analysis-frame cutoffs in the current exports satisfy prefix equivalence.

## Checks, performance and remaining uncertainty

The Python tests include the author's published toy-sample values, direct API parity, direct integral/mapping parity, carrier/offside exclusions, missing opponents, flight/height/unknown possession, explicit direction, mirrored fields, batch/single-frame equality, and time-prefix invariance. The [ten qualitative cases](qualitative-cases.md) include a stationary open receiver, screening, marking, momentum, offside and a decoy boundary. They are internal model-assisted scrutiny, not independent expert validation.

The complete reproducible audit is [validation.json](../analytics/reports/validation.json). On this local Apple Silicon Python 3.12 environment, after imports/caches warmed, complete 30–34 s clips take about 0.43–0.49 s; a single frame including display conversion takes about 10 ms at the median. The first cold run included font-cache/import work and took about 15.5 s. These numbers exclude browser, network and LLM costs and are not a production latency guarantee.

Left-right mirroring with direction reversal is exact under the adapter convention. A direct world-coordinate call differs because of finite angular quadrature; the largest sampled absolute difference was approximately 0.52 danger-weighted m². Doubling angular resolution and halving radial spacing changed some sampled values by about 41% relative to default values above 0.1, while median changes were about 4–5%. The finer grid is a sensitivity check, not ground truth. Seeded 0.1 m positional noise produced median relative changes around 2–3%, with larger local changes and an occasional offside-state change.

Window timing also depends on sampling and notification settings. At 2.5 Hz the first short used-A7 window is not confirmed before the release; other starts shift. Under 0.1 m perturbation some window starts and peaks shift. Consequently the UI should present windows as qualitative timing cues, preserve explicit analysis times and avoid fine rankings, exact percentiles or claims of reliable subsecond precision. The `blocked` clip has valid receiving opportunities before and after its offside interval; its label is not a metric verdict for the whole clip.

We have not reproduced the paper's pass-outcome or expert-state benchmark, obtained independent practitioner judgments, established causal attribution, modeled ball height, or validated professional-match deployment. The official model's known assumptions and the product's conservative exclusions remain part of the interpretation.
