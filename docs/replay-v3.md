# Motion and replay refinement — 27 October 2026

This revision addresses ball pace, curved movement and the spectator view. It changes the synthetic inputs and presentation. The scientific engine remains the authors' `accessible-space==2.1.0`; its parameters, eligibility rules and notification thresholds are unchanged. All three analysis exports and numerical audits were regenerated from the final tracking bytes.

## Motion

The 15 passes now travel at **10.20–20.09 m/s**, compared with **5.32–17.96 m/s** before this revision. Two shots travel at 19.45 and 20.68 m/s; the remaining flight is a goalkeeper distribution. Each flight has its own arrival time and action profile. Clip lengths, release times and playback rate are unchanged. A carried ball stays 0.37 m from its carrier and has the same velocity, so carrying is not artificially accelerated.

In the first scene A7 approaches B2, checks back approximately 4.1 m, decelerates through a curved turn and accelerates inside to about 4.13 m/s. B2 follows the check and closes during the pass. The motion is bounded by vector acceleration as well as speed. All 22 players still have coordinated stage roles. These are plausible authored movements, not empirical player or defender-behaviour models. Full timing tables and motion checks are in [scenarios.md](scenarios.md).

FIFA coaching examples support coordinating the pass with an accelerating curved run and varying pass weight with the situation; they do not provide a universal speed standard for these synthetic scenes. See [Technical Activation, Circuit 4](https://www.fifatrainingcentre.com/en/practice/technical-activation/technical-activation-circuit-4.php), [balls behind the defence](https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/hediger-balls-behind-the-defence.php), and [defensive anticipation](https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/press-and-regain/passing-circuit-defensive-anticipation.php).

## Spectator and analyst views

Fan contains the replay, Player Lens and What Are We Seeing. Numerical curves, match-event lists, receiving-window lists, full retrospective review and tool details remain in Analyst. Evidence navigation can explicitly open the relevant Analyst view when needed. Moving the detailed panels does not remove their numerical or temporal checks.

Short bilingual captions sit inside the replay card below the touchline. This keeps the explanation attached to the action without covering the ball or players. Captions are labelled **Scripted observation / 预设场景解说** and select only observations whose evidence time has passed. They show for the selected involved player; unrelated selections receive a generic movement hint. Highlights and trails show recorded past movement. Captions are authored scene annotations, not MAF output, and playback makes no automatic model requests.

Team A has blue/white shirts and navy numbers; Team B has coral shirts and navy numbers. Larger, darker interface copy and a larger heatmap legend improve readability. The field and legend use the same fixed sequential violet–orange–pale-yellow lookup over the unchanged global range 0–0.1. Display contrast does not change AS, DAS or the quantized field. Zero remains transparent. The palette is not claimed to be perceptually uniform or a formal colour-vision accessibility certification; ordered lightness and text contrast were informed by [Crameri et al.](https://www.nature.com/articles/s41467-020-19160-7) and [W3C contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).

Scene loading now clears the old pitch and evidence attributes immediately. A failed load leaves an explicit unavailable overlay and disabled transport; selecting a scene again can recover. This fixes an independently identified case where old scene pixels could remain under the new selection.

## Verification

Development used separate motion, interface, research/adversarial and independent acceptance agents, each configured as GPT-6 Astra / max. The requested configuration is recorded; hidden runtime settings were not independently introspected.

- Local JavaScript: **176 passing tests**, including chronological cues, fixed palette, motion, evidence, HTTP and MAF bridge checks.
- Numerical Python: **33 passing tests**; author parity, exclusions and current export comparison remain intact. A historical Linux/macOS comparator fixture was isolated from the newly authored scene without widening its tolerance.
- MAF Python: **52 passing tests** with an explicitly simulated provider; these are not cloud-call evidence.
- All three physical audits pass. Minimum player separation is 1.59 m overall; minimum nonparticipant flight clearance is 1.245 m. Maximum vector acceleration remains 3.2 m/s².
- Fresh author-model benchmark passes: 483 analysis cutoffs retain prefix equivalence, mirrors agree, and resolution/noise/sampling sensitivity remains disclosed. The first A7 window is confirmed at 10.6 s at 5 Hz and 10.8 s at 2.5 Hz.
- Independent acceptance checked 21,186 frame/player states, 2,306 eligible cue/player/frame combinations and 954 cue-frame wording checks. It accepted the revised motion, metadata, evidence and interface after the stale-load repair.
- Desktop and 390 px mobile layouts were inspected in a real browser, including Chinese, seeking, view changes, failure/recovery and playback. Nearby players can overlap at the full-pitch mobile scale; the selected player and roster control remain usable.

The final fixed display mapping uses sqrt(q/255) for colour and 0.30+0.70×sqrt(q/255) for nonzero opacity, with transparent zero. This increases weak-field visibility without changing the field or rescaling each frame. Positive values below quantization resolution can still disappear. A7's direct receiving space is not a causal measure of the value of his hook or of a teammate's decoy movement.

The final data also passed a fresh **real MAF single-case check and all eight expanded cases**, recorded at 11:51 UTC on 27 October in the [single receipt](../artifacts/agent-framework-trace.json) and [suite receipt](../artifacts/agent-framework-suite.json). Each used three model requests, two native tools and no repair. The single case took 11.670 s; the expanded cases ranged from 6.585 to 9.284 s. These are measured examples, not a latency guarantee. The existing Free Trial subscription was rechecked as Enabled with spendingLimit On; no resource, upgrade or Marketplace purchase was created.

The earlier [108-second preview](../assets/demo-preview.html) is a historical v2 recording; it predates these trajectories and this interface. The interactive replay is the current demonstrator. Public MAF hosting, a final submission video and human football/comprehension review remain separate delivery items in [handoff.md](handoff.md).
