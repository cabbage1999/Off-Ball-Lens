## What we built

Off-Ball Lens helps football viewers see receiving opportunities before a player touches the ball. Follow any of 22 players, inspect dangerous receiving space, and replay the exact frames behind an explanation.

**Team:** College of Engineering Football. **Representative:** Jingbang Yang.

**Try the full cloud experience, free with no account or key:** https://offball-lens-hackathon-2026.azurewebsites.net/

**Static replay fallback:** https://cabbage1999.github.io/Off-Ball-Lens/

**113.40-second demonstration:** https://youtu.be/ejo0cYWsC94 — published publicly on 28 October 2026.

**Public source and reproduction instructions:** https://github.com/cabbage1999/Off-Ball-Lens

## The problem and experience

The ball attracts attention; off-ball receiving options are harder to see. Three independently authored synthetic attacks show an option being used, a different teammate being selected, and changing eligibility as defenders recover. Each scene contains 22 players, the ball, coordinated movement, possession, and synchronized events. There is no real match footage or repackaged tracking data.

Fan mode focuses on the pitch, movement trails, and concise explanations. Analyst mode adds opportunity curves, AS/DAS values, units, source frames, and tool activity. English and Chinese share the same evidence. Viewers can follow any player, revisit an opportunity window, click an explanation's evidence, or export the current record.

## How it works

The pipeline ingests synthetic tracking and events, interprets them using the original authors' accessible-space 2.1.0 implementation, explains observed opportunities, renders them alongside the replay, and personalizes the presentation by player, language, and audience.

Accessible Space (AS) measures effective receiving area; Dangerous Accessible Space (DAS) weights it by the model's danger field. These are numerical model outputs, never LLM estimates. Tracking is sampled at 10 Hz and analysis at 5 Hz. Fixed-scale heatmaps and explicit analysis frames connect the visualization to its source. Curves, notifications, and explanations only use information observed up to the selected time.

## Microsoft and Azure integration

One genuine Microsoft Agent Framework Agent uses Azure gpt-5-mini through the Responses API. Its native analyze_window and get_evidence tools retrieve existing analysis from the Node service. The Agent selects supported claims and evidence; Node validates identity, time bounds, and references, then renders canonical facts. Changing the scene, player, time, language, or audience discards an outdated response. Timeouts and invalid outputs produce an explicitly labelled local fallback.

Real local Node → MAF → Azure checks passed on 27 October 2026, including an eight-case suite. The complete application now runs on Azure App Service F1 using the project's Azure allowance. Two real explanations through the public endpoint succeeded on 27 October UTC / 28 October Beijing time, including a check after restart; both reported verified MAF execution and completed native tool calls. Sanitized local receipts and pinned dependencies are in the repository. This implementation contains one Agent; it does not claim a multi-agent runtime.

## Testing and scope

Open the Azure application, select A7 in Right-side combination, pause at 11.0 seconds, switch to Analyst, and choose Explain this moment. A successful real response shows Foundry + Agent Framework · verified. Open Evidence & tool activity to inspect analyze_window and get_evidence, then click an evidence frame to revisit it. A cold start can take time; if a request times out or uses a labelled local fallback, wait and retry. Testing requires no account, key, or payment.

The GitHub Pages fallback includes the same replay, precomputed analysis, and deterministic local explanations, without the Agent backend. The demonstration video records the current local build with a real Azure-backed MAF call, before public deployment; it is publicly available on YouTube.

DAS is receiving-space area, not pass/goal probability or causal credit for a run. Player fields can overlap. Synthetic examples and engineering checks do not establish professional-match accuracy. Numerical sensitivity and decoy-movement limitations are documented openly.

**Testing guide:** https://github.com/cabbage1999/Off-Ball-Lens/blob/main/docs/submission/testing-guide.md
