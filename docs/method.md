# Method: from tactical movement to receiving-space evidence

The numerical model is the authors' **individual Dangerous Accessible Space**, package accessible-space 2.1.0. The product measures direct receiving opportunities through a changing scene. It does not attribute the scene's change to a single runner. Detailed API parameters, units, source hashes and numerical checks are in [das-integration.md](das-integration.md).

## 1. Independently authored trajectories and events

Three tactical scripts contain 22 stable player IDs, a ball and 5–8 stages of coordinated play. Roles include pressure, tracking, covering, width, alternative receiving options and goalkeeper positioning. Bounded motion integration produces positions and velocities at 10 Hz. Release, flight, reception, interception and subsequent play use the same timeline. There is no imported real tracking, random idle wobble, language-model coordinate generation or DAS-driven adjustment of trajectories. The [scene audit](scenarios.md) describes the constraints and each player's role.

Coordinates use a 105×68 m pitch, centre origin, x in [-52.5,52.5] and y in [-34,34]. Velocities are m/s. A attacks +x and B attacks −x. Every frame has a globally unique identity, ball state, game mode, possessing team and carrier. Frame identity is never inferred from a player's position. The exporter binds the same source bytes used for computation to an input-file SHA-256. Browser and server both reject a source/analysis hash mismatch before publishing facts.

## 2. Validate the full state before calculation

The adapter requires all 22 identified players and finite coordinates/velocities. Missing opponents invalidate a frame instead of creating false empty space. The supported state is a controlled ground ball in open play: no flight, high ball, loose ball, dead ball or unknown possession. Product checks require ball height at most 0.15 m and ball-carrier separation at most 2 m. These are input checks, not fitted football laws.

For the author call, x and vx are multiplied by the explicit attack direction so attack always points toward +x. Display coordinates are restored afterward. This documented convention makes left-right mirroring consistent despite small orientation differences in the author's finite angular quadrature.

## 3. Call the official accessibility model

For each valid 5 Hz sample the package evaluates potential low passes across its polar sampling grid, combines player/ball motion and interception assumptions, and constructs player possibility fields. Defaults include 30 angles, 15 initial ball speeds and 3 m radial spacing. The application excludes the passer and respects the author's geometric offside filter. Every resolved parameter and adapter/display setting is embedded in a configuration hash.

Conceptually, with the author's accessible field C_i and danger field V:

$$AS_i(t)=\int_{\text{pitch}} C_i(x,t)\,dA,$$
$$DAS_i(t)=\int_{\text{pitch}} C_i(x,t)V(x)\,dA.$$

The code reads player_acc_space and player_das returned by the author's integration. It does not fit a new neural network, invent a composite index, or calculate the scalar from the display image. The danger model and coefficients are supplied by the package. Using the implementation does not transfer the paper's reported validation accuracy to these scenes or to the receiving-only configuration.

AS has units m². DAS has units danger-weighted m². Possibility is not a calibrated pass probability; fields for different players can overlap. Individual values cannot be summed or converted to a percentage contribution to a team total.

## 4. Apply product eligibility and draw a field

Only an onside, off-ball player on the team in possession gets a current AS/DAS and heatmap. Other states are explicit: carrier, defending, offside or unavailable. Null means not applicable. The author returns a configurable zero for excluded players, but the product never uses that as a quality grade.

For visualization, the author's dangerous radial density is multiplied by its radial cell width to approximate C_iV, then interpolated onto 35×23 cell centres. It is a dimensionless intensity. Values are quantized against one fixed global range [0,0.1]. The renderer uses a fixed square-root display transfer for weak-field visibility, documented in the interface; it never rescales a frame to its own maximum. Official integrals remain separate from interpolation and quantization.

Metrics, heatmap and citations refer to one exact analysis frame. Only animation positions interpolate between tracking frames. Curves break at unavailable samples and carrier/team changes. A new flight at an intermediate tracking frame suppresses an outdated valid heatmap.

## 5. Detect opportunities using only the observed prefix

An exploratory notification opens after DAS remains at least 0.5 for 0.6 s, and closes after values remain at most 0.3 for 0.4 s or an eligibility/possession transition occurs. These are transparent UI choices; they are not model parameters learned from expert labels. The initial threshold of 5 was unsuitable for the observed numeric range and was replaced before freezing the demonstration preset. Threshold and sample-rate sensitivity are reported.

Detection may occur after the estimated beginning because confirmation takes time. Every update has a known-at timestamp. Replay selects the latest revision known by its current time; final peaks, endings and outcomes must not leak backwards. A pass aimed at the player is separate from a confirmed reception. An alternative chosen pass does not establish that the carrier made a mistake. Loss of usable tracking produces an indeterminate closure.

Changes and window means are calculated only within a continuous supported segment, never across a ball flight or carrier switch. A time-weighted mean uses trapezoidal integration of the official sampled DAS. It remains descriptive, not a causal estimate.

## 6. Explain with bounded, traceable facts

The shared fact layer reads only frames/events at or before asOfTime. It creates claims with player IDs, metric references, evidence IDs, units and frame/time references. Local fallback renders those facts directly.

When configured, Microsoft Foundry chooses a relevant bounded interval with analyze_window, retrieves get_evidence, then selects allowed factual clauses and an overlay. The server requires both successful tools and validates all references. One correction is allowed; repeated failure uses a labelled local template. The model chooses evidence and presentation; numerical values and bilingual wording remain deterministic. This is deliberately constrained tool use, not unconstrained football commentary or an Agent Framework SDK deployment.

The front end shows the model-selected analysis interval separately from the replay cutoff. A historical overlay offers an explicit action to revisit its frame rather than silently displaying it over the present. It cancels/discards stale responses after a time, player, scene, language or audience change. A successfully configured endpoint is not considered a verified real call. The real smoke test and its sanitized trace are separate from mocked tests.

## 7. What is and is not established

Author sample parity, full-state adaptation, exact frame mapping, mirror convention, excluded states, single/batch equivalence, past-only display prefixes and 10 qualitative examples are reproducible. The [numerical audit](../analytics/reports/validation.json) also measures sensitivity and local performance.

Denser grids change some sampled DAS values substantially; 0.1 m perturbations can change small values and offside status, and lower sampling can miss a short notification. These findings limit precise rankings and subsecond timing claims. The finer grid is not treated as ground truth. Synthetic tactical scripts have not been independently adjudicated by a football practitioner and are not empirical match data.

The decoy example changes a runner and a defender jointly: the runner's direct opportunity can fall while a teammate's rises. This is compatible with a decoy interpretation, but cannot identify causal credit. Defensive value, arbitrary-video tracking, complete off-ball contribution and professional-match prediction remain outside the current model's claims.
