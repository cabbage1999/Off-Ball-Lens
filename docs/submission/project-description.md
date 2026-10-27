# Off-Ball Lens

**Team:** College of Engineering Football  
**Team representative:** Jingbang Yang  
**Project draft:** [Inside the Game entry](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/project/126816)  
**Source:** [GitHub repository](https://github.com/cabbage1999/Off-Ball-Lens)  
**Public replay:** [Off-Ball Lens](https://cabbage1999.github.io/Off-Ball-Lens/)

## Elevator pitch

Off-Ball Lens helps football viewers see receiving opportunities before a player touches the ball. It connects synthetic match replays, published receiving-space calculations, and a Microsoft Agent Framework Agent to explanations with evidence viewers can replay.

## Project description

Football viewers can follow the ball while missing the receiving options around it. Off-Ball Lens lets them follow a player, inspect the space available to receive a pass, and revisit the exact frames behind an explanation. It is a working research demonstrator for understanding off-ball receiving opportunities.

The application replays three independently authored synthetic attacks lasting 30–34 seconds. Each contains 22 players, a ball, coordinated movement, possession, and synchronized pass and reception events. The examples show an option being used, another option being selected, and changing eligibility as defenders recover. The generator does not read the receiving-space score, and the project contains no real match footage or repackaged tracking data.

Accessible Space (AS) and Dangerous Accessible Space (DAS) come from the original authors' published `accessible-space==2.1.0` implementation. AS measures effective receiving area; DAS weights that area by the model's danger field. These values are calculated numerically, never by the language model. A fixed-scale heatmap, movement trails, and opportunity windows connect the calculations to the replay. Tracking runs at 10 Hz and analysis at 5 Hz, with explicit analysis frames. Curves, events, notifications, and explanations use only the observed prefix: later peaks and outcomes remain hidden until their evidence becomes available.

One genuine Microsoft Agent Framework Agent uses Azure `gpt-5-mini` through the Responses API. Its native tools, `analyze_window` and `get_evidence`, retrieve existing analysis from the Node service. The Agent selects supported claim and evidence identifiers; Node validates the player, time bounds, references, and output, then renders the canonical facts. Changing the scene, player, time, language, or audience discards an outdated response. A real local Node → MAF → Azure smoke check and an eight-case suite passed on 27 October 2026; sanitized receipts are included.

English and Chinese share the same facts. Fan mode focuses on the pitch and a concise explanation; Analyst mode exposes AS/DAS, units, source frames, opportunity curves, and tool activity. Viewers can click evidence to revisit a frame or export the current evidence record. Scripted movement observations are explicitly labelled and do not make model calls.

The public GitHub Pages replay is freely accessible with precomputed analysis and deterministic local explanations. The complete MAF runtime currently runs locally; free judge access to the complete Agent remains unresolved. DAS is neither a pass/goal probability nor causal credit for a run. Synthetic examples, published sensitivity checks, and engineering tests do not establish professional-match accuracy or independent human validation.

## Supporting evidence

- [Current motion, interface, and verification record](../replay-v3.md)
- [Real MAF single-case receipt](../../artifacts/agent-framework-trace.json) and [eight-case receipt](../../artifacts/agent-framework-suite.json), both marked `mock:false`
- [Method and interpretation limits](../method.md), [numerical integration](../das-integration.md), and [research attribution](../research.md)
- [Testing guide and access status](testing-guide.md)

