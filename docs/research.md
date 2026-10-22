# Off-Ball Lens: method and source review

Verified on 22 October 2026. Scope: synthetic full-team tracking, direct ground-pass receiving opportunities, two feasible runs from the same initial state, evidence-based explanations, and two-dimensional replay. This is a method review and implementation specification, not a claim that every recommendation has been implemented or empirically validated.

## 1. Decision

A deterministic, interpretable opportunity **index** is defensible for this demo. It must not be presented as calibrated pass success probability, xG, EPV, an identified causal effect, or a complete measure of off-ball contribution.

Keep the factorization into location value, receiver readiness, and defensive interception exposure. Make the factors non-overlapping, keep the hypothetical kick time explicit, and compare routes only while possession and the shared environment remain coherent. A full pitch-control surface, neural model, or video reconstruction pipeline is unnecessary for the stated question.

## 2. What the primary sources actually support

| Source | Verified result relevant to this demo | Boundary |
|---|---|---|
| [Spearman, Beyond Expected Goals (2018), §§3.1–3.3](https://www.researchgate.net/publication/327139841_Beyond_Expected_Goals) | Separates control, transition, and scoring components; considers off-ball opportunities without requiring an actual reception. The control model includes ball arrival and player movement. | §3.1.2 does **not** explicitly model blocked passes along their entire route. Therefore its target-location PPCF is not a ground-pass lane-interception model. |
| [Spearman et al., Physics-Based Modeling of Pass Probabilities in Soccer (2017), §§2.2–2.4](https://www.researchgate.net/publication/315166647_Physics-Based_Modeling_of_Pass_Probabilities_in_Soccer) | Evaluates access to the moving ball and the time available to control it, with competing players and a survival term. | Its statistical parameters were fitted to match data. Reusing a similar functional form with hand-picked defaults does not transfer its calibration or reported accuracy. |
| [Fernández and Bornn, Wide Open Spaces (2018), §§2–6](https://www.lukebornn.com/papers/fernandez_ssac_2018.pdf) | Distinguishes space occupied for oneself from space generated for teammates. Uses velocity-aware influence surfaces and a separate learned pitch-value model. §6 describes expert video review. | The whole method is not training-free, and its observational space-generation metric is not experimental causal identification. The demo can use the conceptual distinction without reproducing its learned model. |
| [LaurieOnTracking, Metrica_PitchControl.py](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/blob/7ed3ff857940d3f4611be55f3c08c79525c32171/Metrica_PitchControl.py) | A readable implementation of reaction-time extrapolation, target arrival, logistic arrival uncertainty, and competing control accumulation. | It is a simplified educational implementation. The acceleration parameter is explicitly unused; control is integrated at a target after ball arrival, rather than along the pass. |
| [IFAB Law 11](https://www.theifab.com/laws/latest/offside/) | Determines the receiving player's offside position at the teammate's relevant play/touch, subject to involvement and exceptions. | A player-centre approximation is suitable for a declared synthetic demo, not referee-grade offside adjudication. |

The old Sloan URL for the 2018 paper did not open during this review. The author-uploaded full text above was read instead. For the 2017 paper, the author-uploaded full text was also read. The Fernández/Bornn PDF is hosted by the coauthor.

A useful additional caution from the 2017 paper (§2.1): its initial ball velocity estimate averages the first 0.4 seconds after a real pass. That is a delayed estimate, not information available at the instant of release. A strictly prospective demo should use its explicitly specified hypothetical kick speed.

## 3. Minimal mathematical contract

Use metres and seconds. For a snapshot at hypothetical kick time \(t_0\), let \(b\) be the ball position, \(p_i,v_i\) the receiver state, \(D\) the defending players, and \(c>0\) the stipulated ground-pass speed. Keep attack direction in metadata rather than inferring it from goalkeeper position.

For each candidate \(g\), define

\[
L=\|g-b\|,\quad u=(g-b)/L,\quad
z(t)=b+cut,\quad 0\leq t\leq T=L/c.
\]

Reject zero-length passes, out-of-bounds candidates, the current carrier, invalid tracking, and candidates outside the declared pass horizon. Do not divide by a nearly zero \(L\).

Use

\[
A_i(S)=100\,O_i(S,t_0)
\max_{g\in\mathcal G_i(S)}
\big[U(g)\,R_i(g,S)\,B(g,S)\big].
\]

All three factors must come from **the same winning candidate**. Maximizing each factor separately produces a fictitious option. Return the selected point and its three factors together. An empty valid candidate set gives index zero with a reason.

- \(U\in[0,1]\): a documented geometric preference, for example decreasing with goal distance and lateral displacement. Its constants are design assumptions, not xG calibration.
- \(R_i\in[0,1]\): receiver readiness alone, conditional on an unblocked pass.
- \(B\in[0,1]\): the defensive obstruction/exposure index for the full hypothesized pass.
- \(O_i\in\{0,1\}\): direct-reception eligibility at the stipulated kick time.

Changing a defender while leaving the receiver, target, and ball unchanged must not alter \(R_i\). If \(R_i\) already contains a defender-versus-attacker pitch-control race, multiplying by a lane factor that includes the endpoint penalizes overlapping defensive evidence twice. Choose either the factorization above or a joint competing-control model, not both.

The product is an interpretable aggregation. It is not a probability identity or an assertion of statistical independence.

### Receiver readiness

The smallest baseline is

\[
R_i=\sigma\!\left(\frac{T-\widehat T_i(g)}{\eta_R}\right),
\qquad \sigma(x)=\frac1{1+e^{-x}},\quad \eta_R>0\ {\rm seconds}.
\]

Here \(\widehat T_i\) is a declared arrival-time surrogate. A soft logistic tail must not be described as proof of physical reachability. Reject clearly impossible candidates separately, or report that the estimate is approximate.

For a more coherent immediate implementation, generate the receiver's short response with the same bounded-acceleration controller used for the displayed route, and evaluate its position at ball arrival. This avoids pretending that early arrival automatically permits a fast-moving player to stop and wait. Such a controller gives the performance of a specified feasible policy, not globally optimal time-to-target.

## 4. Arrival time: retain the useful approximation, state its defects

The Laurie implementation at [lines 153–164](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/blob/7ed3ff857940d3f4611be55f3c08c79525c32171/Metrica_PitchControl.py#L153) uses

\[
q_j=p_j+\tau_jv_j,\qquad
\widehat T_j(g)=\tau_j+\frac{\|g-q_j\|}{V_j}.
\]

It extrapolates present velocity during reaction time, then permits immediate motion at full speed toward the target. The code's \(a_{\max}=7\) parameter is not used ([line 188](https://github.com/Friends-of-Tracking-Data-FoTD/LaurieOnTracking/blob/7ed3ff857940d3f4611be55f3c08c79525c32171/Metrica_PitchControl.py#L188)). Its numerical defaults are model choices, not universal human constants.

Consequences to test explicitly:

1. A stationary player already at the target still receives a positive reaction delay in the formula.
2. A player currently on a passing line may block a fast ball before the assumed reaction phase ends.
3. A fast player moving away must brake and turn in reality; the surrogate does not enforce that process after reaction time.
4. Increasing reaction time is not necessarily monotone in this formula: more inertial travel may move the player closer to a particular target. Do not write a blanket monotonicity test for it.
5. Earliest arrival and being present at ball arrival are different when braking and waiting are constrained.

A cheap correction for **pre-reaction contact** is to retain the inertial path \(p_j+v_jt\) for \(0\leq t\leq\tau_j\). For a declared contact radius \(r_c\), minimize

\[
\|b-p_j+(cu-v_j)t\|
\]

over \([0,\min(T,\tau_j)]\). The minimizing time is the projection
\[
t_*=\operatorname{clip}\left(
-\frac{(b-p_j)\cdot(cu-v_j)}{\|cu-v_j\|^2},
0,\min(T,\tau_j)\right),
\]
with the zero-relative-speed case handled separately. This checks instantaneous contact without assigning a fictitious reaction delay. It is a geometric contact screen, not a full tackling model.

An alternative consistent surrogate is a delayed reachable disc: its centre is \(p_j+v_j\min(t,\tau_j)\), and its radius is \(r_c+V_j\max(0,t-\tau_j)\). This has explicit semantics but still permits instantaneous redirection after \(\tau_j\); do not label it an acceleration-limited reachability solver.

## 5. Lane safety: distinguish evidence from score aggregation

For any arrival-time surrogate, retain the raw bottleneck margin

\[
m(g)=\min_{d\in D,\;0\leq t\leq T}
[\widehat T_d(z(t))-t].
\]

Return its defender, path point, ball-arrival time, and defender-arrival estimate. Positive margin means the defender arrives later **within this surrogate**.

### Why the release end can dominate

At \(t=0\), a nearby defender contributes \(\widehat T_d(b)\), even if the ball immediately moves away faster than the defender can pursue. Mapping the minimum through an unsaturated sigmoid can impose almost the same ceiling on several otherwise different passes. This is a limitation of the aggregation and scaling; proximity to the passer is not always a spurious risk.

Do not fix it by deleting the first arbitrary percentage of every line. That would hide genuine immediate blocks. Keep the release point and the pre-reaction contact screen.

Two practical choices:

- **Lowest-change baseline:** map \(m\) through a saturating piecewise-linear function, for example \(B=\operatorname{clip}((m+\delta)/(2\delta),0,1)\), with a declared \(\delta>0\) seconds. Safe margins saturate at one. Display the raw margin and call this a bottleneck safety index.
- **Recommended exposure version:** let
  \[
  F_d(t)=\sigma\left(\frac{t-\widehat T_d(z(t))}{\eta_D}\right),\qquad
  \Lambda(g)=\int_0^T\sum_{d\in D}\lambda_d F_d(t)\,dt,
  \quad B(g)=e^{-\Lambda(g)}.
  \]
  Here \(\eta_D\) is in seconds and \(\lambda_d\) in inverse seconds. A brief near-release exposure then has a brief contribution, rather than determining the entire pass score.

The latter is a deliberately simplified, defender-only survival-shaped index inspired by the 2017 moving-ball control framework. It omits competition from other attackers, pass-execution error, and learned control rates. It must not be advertised as a reproduction of that paper or a calibrated probability.

Use trapezoidal quadrature over time and multiply by the actual interval lengths. Merely multiplying per-sample survival factors without scaling by time changes the result when the sampling rate changes. With nonnegative exposure, the exponential update remains in \((0,1]\).

The interval must include the reception endpoint. Endpoint-only contact has zero duration in a pure time integral; therefore retain the minimum-margin/contact evidence and an explicit endpoint contest flag. If an extra first-touch control interval is introduced, specify its duration and stationary-ball assumption. Do not silently add a second endpoint pitch-control penalty.

## 6. Prevent finite-sampling false reassurance

For the zero-radius Laurie surrogate and constant ball speed, the lane minimum can be found continuously without an optimization dependency. This is a derivation for this demo, not a formula quoted from a paper.

Parameterize the path by distance \(s\in[0,L]\). For defender \(d\), set

\[
a=(b-q_d)\cdot u,\qquad
h^2=\max(0,\|b-q_d\|^2-a^2),
\]
\[
m_d(s)=\tau_d+\frac{\sqrt{(s+a)^2+h^2}}{V_d}-\frac{s}{c}.
\]

This function is convex. If \(c>V_d\), its constrained minimizer is

\[
s_*=\operatorname{clip}\left(
-a+\frac{V_d h}{\sqrt{c^2-V_d^2}},0,L\right).
\]

If \(c\leq V_d\), a minimum occurs at \(s=L\). Evaluate the endpoints as a numerical safeguard, and then minimize over defenders. Handle \(c\approx V_d\), \(h\approx0\), and zero-length paths without division by zero.

This result applies only to the stated surrogate. It must not be reused unchanged for nonzero capture radii, nonlinear ball speed, or acceleration-limited motion.

If retaining spatial samples with maximum spacing \(\Delta s\), including both endpoints, a rigorous lower bound for that same surrogate is

\[
m_{\rm sample}
-\frac{\Delta s}{2}\max_d\left(\frac1{V_d}+\frac1c\right)
\leq m_{\rm true}\leq m_{\rm sample}.
\]

A positive sampled minimum alone does not certify safety. A positive lower bound does, within the simplified model. If the interval crosses zero, refine or report borderline numerical resolution. Nested sampling must never increase the sampled minimum.

For the exposure integral, halve the time step until the score change meets a declared numerical tolerance. This checks numerical stability, not model validity. Use sufficiently small steps or adaptive refinement around contact; a convergence check should include deliberately narrow interception examples.

**Derivation check performed:** 200 seeded random scalar geometries were compared against 10,001-point dense grids. The closed-form minimum never exceeded the grid minimum, and every gap satisfied the Lipschitz bound; the largest grid-minus-continuous gap was \(4.06\times10^{-7}\) seconds. This checks the algebra and numerical implementation of the derivation, not football accuracy.

## 7. Feasible alternative routes

Both alternatives must share the exact \(p(t_0)\), \(v(t_0)\), ball, possession, teammates, defenders, and random seed. They may differ in the selected player's subsequent control policy.

Check
\[
\|v_k\|\leq V,\qquad
\frac{\|v_{k+1}-v_k\|}{\Delta t_k}\leq a_{\max}.
\]

Checking only changes in scalar speed allows instantaneous 180-degree turns. Position must be consistent with velocity integration; do not snap to a target or clamp a boundary after integrating.

A small vector acceleration controller is enough: choose a desired velocity, limit its change to \(a_{\max}\Delta t\), enforce the speed limit, and integrate position consistently. A stopping target should use gradual braking. At speed \(v\), \(v/a_{\max}\) is the minimum stopping time under constant maximum braking and \(v^2/(2a_{\max})\) the corresponding straight-line stopping distance. These are useful failure tests.

A physically feasible displayed route does not automatically make a separate arrival-time scoring surrogate equally physical. Label both assumptions.

## 8. Offside gate at the hypothetical kick

For an attack-normalized longitudinal coordinate \(x'\), with the halfway line at zero, let \(x'_{(2),D}\) be the second-highest coordinate among **all opponents, including the goalkeeper**. Define
\[
\ell_{\rm off}=\max(0,x'_b,x'_{(2),D}),\qquad
O_i=\mathbf1[x'_i(t_0)\leq\ell_{\rm off}+\varepsilon].
\]

Use the receiving player's position at \(t_0\), not the candidate \(g\), not ball arrival, and not a future defender position. If a kick delay is modeled, advance **all** players and the ball to that new kick time before applying the gate.

A zero tolerance is appropriate for exact synthetic coordinates, with a tiny numerical tolerance only. A larger tolerance such as 0.2 m is a declared modeling band, not an IFAB rule. Near the line, report the centre-based simplification.

The [official Law 11](https://www.theifab.com/laws/latest/offside/) considers the head, body, and feet rather than centres, excludes arms and hands, treats level positions as onside, and distinguishes position from an offence. Direct goal kicks, throw-ins, and corners have exceptions; restrict the demo to ordinary open-play ground passes rather than silently applying this gate to every restart. For ordinary kicks, the relevant touch is the first contact; goalkeeper throws use release, outside this demo's scope.

## 9. Route difference, time units, and the causal boundary

Use the common valid interval
\[
t_1=\min(t_0+H,\ t_{\rm first\ pass},\
t_{\rm possession\ change},\ t_{\rm branch\ invalid}),
\quad H_{\rm eff}=t_1-t_0>0,
\]
\[
\Delta_i=\frac1{H_{\rm eff}}
\int_{t_0}^{t_1}
[A_i(S^{\rm run}(t))-A_i(S^{\rm alt}(t))]\,dt.
\]

Integrate the pre-event state up to the boundary, not the inconsistent post-pass branch. For irregular timestamps, use their actual interval lengths. A zero-length valid window should return unavailable, not divide by zero. If a policy deliberately normalizes by requested \(H\) instead, disclose the missing interval; do not mix the two definitions.

The integral without division has units **index-points × seconds**. The normalized difference has units **index points**. Neither is a percentage-point probability difference.

The team statistic \(V(S)=\max_{j\ne\mathrm{carrier}}A_j(S)\) measures the best available option. It is not the sum of independent player contributions. Changing the selected target or best player should be visible in evidence.

With other players fixed, the defensible statement is: **under the same supplied environment and scoring assumptions, this route changes the player's receiving-opportunity index relative to the chosen alternative**. It does not show that the player drew a defender, created a teammate's space, or caused a goal. A responsive-defense extension must run the same response policy in both branches and still qualify conclusions by that policy.

## 10. Prevent future-information leakage

Separate three modes in the data contract:

| Mode | Allowed inputs | Required label |
|---|---|---|
| Snapshot evaluation | State available by the displayed time; explicit hypothetical ball parameters | Current-state estimate |
| Counterfactual forecast | Snapshot plus declared policies and deterministic simulation | Simulated route comparison |
| Observed-window comparison | Recorded/synthetic future trajectories from the complete window | Retrospective comparison |

The online scoring function should accept a snapshot, not unrestricted access to the full scenario. Generate candidate targets from present state or declared policies; do not silently read later positions, event destinations, injected scenario labels, or truth files. Causal finite-difference velocity estimates may use only current and earlier frames. Centred smoothing requires a retrospective/delayed label.

An invariant is especially valuable: changing every frame after \(t_0\) must leave the snapshot score at \(t_0\) unchanged. A forecast comparison should also remain unchanged unless its declared policies change. A retrospective comparison is allowed to change.

Explanation tools must return the mode, as-of time, analyzed window, stop reason, parameter version, and evidence frame IDs. A language model should explain those computed facts, not infer missing defender reactions.

## 11. Focused test invariants

These are specification tests to implement, not a report that application tests have already passed.

| Test | Required result |
|---|---|
| Identical routes | Equal per-frame scores and zero integrated difference, within numerical tolerance. |
| Swap route labels | Difference changes sign. |
| Reflect the whole field and attack direction | Equal factors and scores after transforming goals, ball, players, and velocities consistently. |
| Receiver/defender separation | Changing defenders cannot change readiness \(R\) for a fixed receiver, target, and ball. |
| Factor consistency | Displayed \(U,R,B\) multiply to the winning candidate score; no mixing of candidate maxima. |
| Bounds and invalid input | Finite \(A\in[0,100]\); carrier excluded; empty candidates handled; no NaN propagation. |
| Directional motion | A fast player moving away from a target does not receive the same physical route as an instant stationary player. |
| Already present and immediate block | No artificial waiting merely because a stationary receiver is already at the target; a defender on the immediate ball path is not protected by a reaction floor. |
| Mid-lane and endpoint obstruction | Both cases are detected; a near-release blocker is not dropped by an arbitrary spatial cutoff. |
| Numerical refinement | Nested sampled minimum cannot increase; continuous-minimum bound holds; exposure changes by less than the declared tolerance after refinement. |
| Units | Duplicating frame frequency leaves normalized route value and the time-scaled exposure stable. |
| Offside | Test own half, level with ball, level with second-last opponent, goalkeeper away from goal, through-ball target beyond the line, and receiver moving back after release. |
| Dynamics | Both initial velocities match; vector acceleration and speed limits hold; positions integrate consistently. |
| Shared stop | Both branches use the same valid time span and stop on the earliest incompatible event. |
| No future leakage | Altering future frames/truth labels leaves current snapshot results unchanged. |
| Explanation grounding | Every cited player, number, direction, window, and frame exists in the returned fact package; fixed-defense mode cannot claim induced defensive movement. |

For monotonicity, use the correct conditional statement: if defender arrival estimates increase at **every point** while everything else is fixed, defensive safety cannot decrease. Do not assume total opportunity must increase with ball speed: a faster pass can reduce defensive exposure while making the receiver late.

Parameter sweeps are sensitivity analyses, not confidence intervals. At minimum vary ball speed, reaction delay, movement limits, arrival smoothing, and spatial value weights. Report sign changes in the route comparison.

## 12. Official hackathon and reference-repository verification

### Rules and dates

The [official rules, pinned to the reviewed repository revision](https://github.com/microsoft/insidethegamehackathon/blob/fec6ae2229917574898dc740fd2002381ac758cd/OFFICIAL%20RULES.md) explicitly specify **2026**. There is no evidence for replacing the year with 2025.

| Item | Pacific time in §1 | Beijing time |
|---|---|---|
| Registration closes | 20 October 2026, 12:00 | 21 October 2026, 03:00 |
| Submission closes | 27 October 2026, 23:59 | 28 October 2026, 14:59 |
| Judging ends | 10 November 2026, 23:59 | 11 November 2026, 15:59 |

The October conversions use daylight time; November 10 uses standard time. Registration is already closed on the review date.

Relevant requirements: §4.7 requires football-realistic synthetic data and says organizers will not distribute match material. Video auto-eventing is a suggested feature in §4.1, not a universal prerequisite. §4.4 requires a public GitHub repository and a functioning-project video shorter than two minutes. §4.8 requires access for judging; §4.9 requires English materials or translations. §3 permits teams up to four. §6.2 has five equally weighted criteria.

### What hear-the-game actually contains

The reviewed [generator](https://github.com/klckerim/hear-the-game/blob/54dbb473043519eae460a0207c0be9433813653b/htg/generate.py#L385) writes events, a 10 Hz **ball-only** trajectory, per-player **per-minute aggregate** physical statistics, metadata, and injected scenario labels. It does not generate the 22-player continuous position-and-velocity stream needed here.

Its [data documentation](https://github.com/klckerim/hear-the-game/blob/54dbb473043519eae460a0207c0be9433813653b/docs/data.md) describes real-data aggregate calibration with synthetic runtime matches. That is useful precedent for data organization, not evidence that its outputs can support tracking-based lane analysis.

Its [Foundry narrator](https://github.com/klckerim/hear-the-game/blob/54dbb473043519eae460a0207c0be9433813653b/htg/narration/foundry.py) receives a prepared fact package and makes a structured chat-completion request. This is useful grounding architecture, but that file is not a model-driven football-analysis tool-calling loop. Off-Ball Lens must demonstrate its own tool invocation if claiming that capability. This review read source; it did not independently reproduce the reference application's performance results.

Machine-readable provenance, exact revisions, and source roles are recorded in [research-sources.json](research-sources.json).

