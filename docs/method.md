# Implemented method: receiving-index-v1.3

This document describes the code actually used by the demo. [research.md](research.md) reviews alternatives and source models; its recommendations are not claims that every alternative was implemented.

## Scope and estimand

The output is a **direct receiving-opportunity index** for one attacker during controlled possession, at a hypothetical immediate release of a straight ground pass. It is not a success probability, xG, expected possession value, indirect space-creation measure, or causal contribution to actual goals.

The current-frame score reads only that frame's positions and velocities. The two-route comparison is a **retrospective fixed-environment intervention**: the selected player's trajectory is changed while the other recorded trajectories remain fixed. It uses the future frames inside its explicitly selected window and is not an online prediction.

## Coordinates and data

The pitch is 105 × 68 metres. In the supplied scenes, A attacks toward increasing x. Positions are player centres, not the complete body-part geometry used in officiating. The model supports mirrored attacking direction and translated coordinate origins, tested independently. Sampling is 10 Hz; visual interpolation does not create new observations. Each 16-second scene has 161 frames and 22 stable player IDs.

The generator follows authored targets and velocity commands, independent of the score. Vector acceleration is bounded at 3.2 m/s² and speed at 7.8 m/s. Position integration is trapezoidal. These are explicit simulation parameters, not a fitted distribution of real players. Two authored passes are synchronized with ball flight and controlled possession; A7 never receives either pass.

## Candidates and positional legality

For every branch use the same local offsets, in metres:

```text
(0,0), (3,0), (6,0), (-3,0), (0,-3), (0,3), (3,-3), (3,3)
```

The x offsets are mirrored with attack direction. A candidate is rejected if outside the pitch or if ball flight would exceed 2.5 seconds. This finite search is an approximation and can miss feasible opportunities. Faster players do not get a larger candidate search area.

At the hypothetical **release** instant, positional offside requires all three: the receiver is in the opponents' half, ahead of the ball, and ahead of the second-last opponent (including the goalkeeper). Level positions are allowed. Apply this screen to the receiver's current position, **not the future receiving point**. This point-player screen does not model involvement or referee decisions. The carrier and non-attacking players are excluded from the receiving set; the index is unavailable while the ball is in flight.

## Region preference U

Let q be attacking-direction longitudinal progress divided by pitch length, clipped to [0,1]. Let c = 1 − |y − W/2|/(W/2), also clipped, after translating the coordinate origin. Then:

```text
U(g) = q² × [(1 − w) + w × c],    w = 0.4
```

This is a transparent preference for advanced, central receiving areas. It is not a learned shot-value surface. It omits angle-to-goal, body orientation and the value of subsequent actions.

## Receiver readiness R

The receiver coasts for a 0.1-second reaction interval, then follows an acceleration-limited steering/braking controller toward the candidate. The controller uses a 0.05-second integration step, a 1.2 m control radius and a target speed bounded by both the speed cap and a braking-distance rule.

The receiver must be inside the candidate's control radius at ball arrival. Readiness uses the beginning of the **last uninterrupted sampled residence** in that radius before arrival. An earlier contact followed by leaving and returning is not credited as continuous readiness. The returned time has the numerical integration's temporal resolution; it is not an exact optimal-control hitting time.

With hypothetical ball speed v_b = 15 m/s, T_b = distance(ball,g)/v_b and T_ready the final residence start:

```text
R(g) = sigmoid((T_b − T_ready − 0.1 s) / 0.35 s)
```

The hard at-arrival condition is also required. R contains no defender competition. The constructive receiver controller provides a feasible strategy estimate under the simulator, not the fastest possible route; rejecting its candidate does not prove physical impossibility.

## Defensive reachability and lane score B

An initial implementation used a pursuit controller for defenders. Adversarial review constructed a simple feasible constant-acceleration interception that this controller missed, while assigning a near-maximal lane score. **That implementation was replaced.**

The current defender estimate is an **optimistic lower bound on arrival time**. During a 0.35-second reaction interval the defender drifts along its current velocity; first contact with the candidate control disc is solved analytically. If there is no contact during that interval, let:

```text
q = p + τv
d = max(0, distance(q,z) − interceptionRadius)
s0 = |v|,   a = 3.2 m/s²,   V = 7.8 m/s
t_accel = (V − s0) / a
d_accel = (V² − s0²) / (2a)
```

If d ≤ d_accel, the optimistic remaining travel time is `(sqrt(s0² + 2ad) − s0)/a`; otherwise it is `t_accel + (d − d_accel)/V`. Add τ. The interception radius is 0.8 m. Inputs exceeding the assumed defender speed cap are rejected.

Why this is a lower bound: after reaction, any feasible path has displacement at most its arc length, and its arc length is bounded above by the integral of `min(V, s0 + at)`. Inverting that optimistic distance envelope yields a necessary time. It treats initial speed as instantly aligned toward the target and ignores turning cost, so it can report a possible threat that no actual trajectory can achieve. It does not miss the review's witness merely because one chosen pursuit controller is poor.

Along the hypothetical pass, take at least 12 equal intervals, with spacing at most 1 m; include both endpoints. Add the line projections and control-circle intersections for each defender’s initial and reaction-end positions. These extra samples address narrow near-tangent threats that a uniform grid can miss; they still do not give a continuous-lane guarantee. At each point z_k:

```text
m = min over defenders d and samples k [ T_lower,d(z_k) − T_ball(z_k) ]
B(g) = sigmoid(m / 0.35 s)
```

The recorded evidence contains the minimizing sampled point, defender, ball time, defender lower-bound time and margin. A negative margin means **interception cannot be ruled out by this bound**, not that an interception is proven feasible. A positive sampled minimum is not a continuous-lane safety certificate: gaps remain between samples. A 0.5 m refinement regression checks the supplied scenes; it is not a universal error guarantee. There is no longer a 1.5-second defender-search cap.

This asymmetric treatment is deliberate: require a constructive receiving strategy while allowing defenders an optimistic reachability bound. Both are explicit modelling choices, not calibrated probabilities. See the [adversarial review](adversarial-review.md) for the witness and residual limits.

## Index and route comparison

```text
A_i(S) = 100 × O_i(S) × max_g [ U(g) × R_i(g) × B(g) ]
```

The displayed U/R/B values belong to the **same maximizing candidate**. Offside or no accepted candidate yields a zero index with a separate reason. The multiplication is a transparent heuristic, not an independence claim about random events.

Alternatives start from the same sampled position and velocity as the recorded run. The default brakes smoothly to a stop; the straight alternative retains initial velocity; the identical-route control uses the original trajectory. All use the scene's vector speed/acceleration limits. Counterfactual surrounding players are unchanged, so indirect defender response is not measured.

The common window stops before the next pass, possession change, shot, clip end or invalid alternative position. At 10 Hz, a pass at 7.5 seconds means the last allowed sample is 7.4 seconds. A single sample has no positive-duration comparison and is reported as unavailable.

For the actual included interval `[t_first,t_last]`, integrate the difference by the trapezoidal rule and divide by `t_last − t_first`. The mean difference has units of **index points**. Do not divide by the originally requested horizon after truncation.

The optional team quantity is the maximum eligible receiving index in each frame. Its difference is distinct from the selected player's difference and is not a sum of individual contributions.

## Sensitivity and evidence

Nine one-at-a-time checks include baseline, ball speed ±10%, defender reaction delay ±0.1 seconds, centrality weight ±0.1, and receiver longitudinal position ±0.25 m. They test assumptions around the current setting; they are not sampling-based uncertainty estimates or confidence intervals.

The interface labels current-frame estimates separately from the retrospective comparison window. Explanations bind to scenario, window, model version, parameter values and alternative. A changed scenario, parameter, language, detail mode or comparison invalidates an old answer. Merely moving the playhead inspects a different frame without silently moving the labelled comparison window.

## Cloud boundary

Without credentials the application runs deterministic analysis and local wording, with no model call. The optional Foundry Responses loop allows `analyze_window`, `compare_run` and `get_evidence`. Selected context and arguments are checked. The model can select only returned claim/evidence IDs; application code renders the numerical claims. Invalid output, missing tools, timeouts and provider errors fall back visibly. Invalid comparison windows do not invoke the cloud.

The delivered live-cloud status is **unverified by user choice**, because no deployment is currently available. Simulated-provider contract tests verify protocol handling, not an actual cloud deployment.

## What the verification establishes

Automated and independent tests establish stated invariants, reproducible fixtures, known counterexample repairs, numerical consistency and software behavior. Three manually authored scenes do not establish real football accuracy. External expert assessment, broader held-out scenes and tracking-data validation are future work.
