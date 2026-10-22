# Team handoff

This repository delivers a working, inspectable feasibility demo. It does not submit an entry, register a team, verify prize eligibility, or provision Azure resources.

## Completed scope

- Independent synthetic tracking and event generation, three short 22-player scenes.
- Direct receiving-opportunity index and feasible alternative-route comparison.
- Interactive replay, evidence overlays, bilingual fan/analyst views, parameter experiments and JSON export.
- Deterministic evidence tools and local explanations.
- Optional Microsoft Foundry Responses tool loop with server-side credentials and checked evidence selection.
- Automated invariants, independent acceptance, adversarial review and source documentation.

## Before competition submission

- Configure an eligible Microsoft model deployment. Run the live smoke check and demonstrate a real validated tool loop. Local simulated-provider tests do not satisfy this step.
- Have the football-analysis teammate record judgments on **new, un-tuned scenes** before seeing model outputs; keep disagreements. The three authored scenes are regression examples, not ground-truth accuracy evaluation.
- Review the limitations and revise any promotional wording suggesting real causal value or goal probabilities.
- Record the official English demonstration video under two minutes and prepare the required submission fields. The longer in-app walkthrough is for feasibility review.
- Confirm public repository and demo access from another account/network; retain access for the judging period. For cloud hosting, add authentication and budget controls before sharing the optional API.
- Confirm registration and submission in the official portal. Neither action is performed by this project.

## Dates from the official rules

The official rules reviewed on 2026-10-22 specify submission by **2026-10-27 23:59 Pacific**, equivalent to **2026-10-28 14:59 Asia/Shanghai**. The judging window ends **2026-11-10 23:59 Pacific**, equivalent to **2026-11-11 15:59 Asia/Shanghai**; Pacific daylight-saving time changes between these dates. Confirm any later organizer amendments directly in the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

## Agent workflow

The user requested four subagent roles with **GPT-6 Astra / max**. The main agent supplied those exact settings at creation for literature research, code/data implementation, adversarial review and independent acceptance. Tool creation accepted each requested configuration. Agents cannot independently attest the hidden runtime's actual model settings.

The process separated source research, implementation, independent checks and adversarial counterexamples. Findings triggered implementation repairs and fresh verification. This development process is separate from the product's optional **single** Foundry evidence-selecting agent; the app does not pretend each deterministic function is an independent cloud agent.
