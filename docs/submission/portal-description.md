## What we built

Off-Ball Lens helps football viewers see receiving opportunities before a player touches the ball. Follow any of 22 players, inspect dangerous receiving space, and replay the exact frames behind an explanation.

**Team:** College of Engineering Football. **Representative:** Jingbang Yang.

**Try the free interactive replay:** https://cabbage1999.github.io/Off-Ball-Lens/

**Public source and reproduction instructions:** https://github.com/cabbage1999/Off-Ball-Lens

## The problem and experience

The ball attracts attention; off-ball receiving options are harder to see. Three independently authored synthetic attacks show an option being used, a different teammate being selected, and changing eligibility as defenders recover. Each scene contains 22 players, the ball, coordinated movement, possession, and synchronized events. There is no real match footage or repackaged tracking data.

Fan mode focuses on the pitch, movement trails, and concise explanations. Analyst mode adds opportunity curves, AS/DAS values, units, source frames, and tool activity. English and Chinese share the same evidence. Viewers can follow any player, revisit an opportunity window, click an explanation's evidence, or export the current record.

## How it works

The pipeline ingests synthetic tracking and events, interprets them using the original authors' accessible-space 2.1.0 implementation, explains observed opportunities, renders them alongside the replay, and personalizes the presentation by player, language, and audience.

Accessible Space (AS) measures effective receiving area; Dangerous Accessible Space (DAS) weights it by the model's danger field. These are numerical model outputs, never LLM estimates. Tracking is sampled at 10 Hz and analysis at 5 Hz. Fixed-scale heatmaps and explicit analysis frames connect the visualization to its source. Curves, notifications, and explanations only use information observed up to the selected time.

## Microsoft and Azure integration

One genuine Microsoft Agent Framework Agent uses Azure gpt-5-mini through the Responses API. Its native analyze_window and get_evidence tools retrieve existing analysis from the Node service. The Agent selects supported claims and evidence; Node validates identity, time bounds, and references, then renders canonical facts. Changing the scene, player, time, language, or audience discards an outdated response. Timeouts and invalid outputs produce an explicitly labelled local fallback.

Real local Node → MAF → Azure checks passed on 27 October 2026, including an eight-case suite. Sanitized receipts and pinned dependencies are in the repository. This implementation contains one Agent; it does not claim a multi-agent runtime.

## Testing and scope

The public GitHub Pages replay is free, requires no account or API key, and includes precomputed analysis and deterministic local explanations. The complete live MAF integration currently runs on the local Node/Python service; GitHub Pages does not host that backend. The repository provides installation and testing instructions and records the available evidence separately from deployment status.

DAS is receiving-space area, not pass/goal probability or causal credit for a run. Player fields can overlap. Synthetic examples and engineering checks do not establish professional-match accuracy. Numerical sensitivity and decoy-movement limitations are documented openly.

**Testing guide:** https://github.com/cabbage1999/Off-Ball-Lens/blob/main/docs/submission/testing-guide.md
