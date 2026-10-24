# Research choice and evidence

The current implementation calls the original authors' **individual Dangerous Accessible Space (DAS)** package rather than a locally invented receiving index. This is the central methodological change in v2.

## Primary implementation

- Bischofberger and Baca (2026), [Dangerous accessible space: a unified model of space and value in team sports](https://doi.org/10.1186/s40537-026-01387-8), *Journal of Big Data* 13, 76.
- [Author repository](https://github.com/jonas-bischofberger/accessible-space) and [version 2.1.0 distribution](https://pypi.org/project/accessible-space/2.1.0/).
- [Installed source hashes, configuration and measured checks](../analytics/reports/validation.json); [original package MIT notice](../analytics/ACCESSIBLE_SPACE_LICENSE.txt).

The package has the required full-state input and returns per-player receiving-space integrals and spatial fields. It can be run without training a new network. We pin the released numerical implementation and use its supplied parameters and danger function. We do not substitute an approximate JavaScript rewrite.

This choice rests on task alignment, inspectable author implementation, executable numerical tests and license—not repository popularity. A small star count is not validation; a large one would not establish scientific suitability either. We do not call DAS a pretrained deep-learning model. It is a published model with fixed/fitted parameters and a runnable author package.

The integration deliberately excludes the passer, filters unsupported ball states and presents only the possessing team's eligible receivers. The paper's reported evaluation does not automatically validate those product choices or these synthetic scenes. The [integration document](das-integration.md) records the distinction.

## Why not simply use an event-value model?

[Socceraction's VAEP documentation](https://socceraction.readthedocs.io/en/latest/documentation/valuing_actions/vaep.html) describes an action-based value model. It answers a different question from a full-frame player's direct receiving accessibility. Moving an off-ball player can leave the event representation unchanged; an event model therefore need not respond to that movement.

Similarly, placing a location-value grid under a runner does not establish that a pass can reach them through the current defense. Tracking-based models can use more information, but a published paper, public source code and compatible trained weights are three separate assets. No unverified pretrained weights are assumed in this project.

## Space creation is broader than personal receiving space

Fernández and Bornn's [Wide Open Spaces](https://www.lukebornn.com/papers/fernandez_ssac_2018.pdf) distinguishes occupation and space creation. That distinction motivates the preserved decoy boundary: a player's own direct opportunity can fall while another player's improves.

The current implementation does not reproduce that space-generation method, fit its value model, or assign the teammate's gain to the decoy. Our [qualitative decoy case](qualitative-cases.md) changes multiple participants jointly and explicitly reports association rather than identified causal credit.

## What was actually checked

The author package was installed and run; raw array shapes, scalar mappings, integration, excluded states, mirrors, single-frame/batch equality and time-prefix behavior were tested. The three final synthetic inputs were processed by that package. Ten specified qualitative cases and grid/noise/sampling sensitivity were also executed.

Some local changes are substantial under a denser grid or 0.1 m noise. These are retained as results rather than removed by changing the scenes. The UI therefore describes exploratory receiving opportunities and avoids fine rankings or claims of exact timing. We have not replicated the paper's complete empirical benchmark or commissioned independent football-expert labels.

## Engineering references

The [official event repository](https://github.com/microsoft/insidethegamehackathon) is the source for competition requirements. The [hear-the-game project](https://github.com/klckerim/hear-the-game) was consulted as an architecture reference; its code and data are not included. All demo trajectories are independently authored.

The Microsoft integration follows the official [Responses API documentation](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/responses) and [Foundry project Responses guidance](https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api). Actual cloud verification remains pending a team deployment.

The previous heuristic implementation remains recoverable in repository history at commit b875f53c4849cf1189cae55fbe050ea3bf8f48a3. It is not the active model or a scientific baseline claimed by this version.
