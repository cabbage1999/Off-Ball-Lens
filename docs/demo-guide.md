# Functional walkthrough and recording plan

The interactive replay has no two-minute limit. The planned English submission video is approximately 110 seconds. The published preview shows **local explanations** and must not be presented as a completed cloud-enabled entry. On 27 October 2026, the complete local Node → MAF → Azure path passed a [real smoke](../artifacts/agent-framework-trace.json) and all [eight expanded cases](../artifacts/agent-framework-suite.json) with `gpt-5-mini`; both records state `mock:false`. Public hosting, the final MAF recording and human review remain pending. GitHub Pages has no public MAF backend.

For a new MAF recording, use Python 3.12 and Node.js 22 or later, run `npm run setup:agent` and `npm run test:agent`, configure the ignored local `.env`, then use `npm run start:agent`. `npm run smoke:agent` verifies the actual Node/MAF/Azure path; optional `--suite` adds more cases and cloud usage. Record the status that actually passed. A local test with an in-memory provider or an earlier direct inference probe is not evidence that the complete MAF cloud path passed.

## Explore at your own pace

1. Open the replay in English Fan mode. In the right-side combination, follow A7 from the beginning. Notice teammates and defenders moving together, and the ball remaining with its carrier before release.
2. Around 10.4–11.2 s, inspect A7's first detected receiving window. Its notification appears after the confirmation interval; this does not imply the model knew its eventual peak in advance.
3. Continue through release and reception at 12.4 s. The flight suppresses the heatmap; the new carrier is labelled on the ball. Replay the earlier evidence to inspect the actual option.
4. Switch to Analyst mode. Read AS in m², DAS in danger-weighted m², the exact model frame and the fixed global display scale. Select a different attacker, a defender and the current carrier.
5. In the second scene, examine A7's later window and the different teammate selected by the carrier. An unused option is not proof of a poor decision.
6. In the third scene, inspect A7 before, during and after the offside interval. Fast movement does not guarantee an eligible receiving option. The clip later includes an interception and counter.
7. Ask for an explanation, click its evidence, and seek to a new time. An old response must not survive the change. Compare Fan/Analyst and Chinese/English. In a verified MAF run, inspect the framework label and native evidence-tool trace. One Agent calls `analyze_window` and `get_evidence`; Node validates and renders the canonical facts. Do not describe this as a multi-agent review or Workflow.
8. At the end of each scene, inspect the retrospective summary; then open the method and sensitivity notes. The decoy boundary is documented among the qualitative cases.

Exact windows may change only when the configuration or source data changes; use the current exported moment revisions as the record. The first short window is sensitive to downsampling, which is itself a result to disclose.

## Approximately 110-second English storyboard

| Wall time | Real UI action | Narration/caption |
| --- | --- | --- |
| 0–8 s | Open title and replay | See receiving opportunities before the touch. Synthetic data, 22 players and the ball. |
| 8–30 s | Play the first attack through A7 receiving | Follow the actual run. The field and curve show direct receiving space; unsupported flight is hidden. |
| 30–48 s | Analyst mode, evidence replay | Author-model AS/DAS, exact frames and units; this is area, not a probability or causal credit. |
| 48–68 s | Second scene, past window and alternative pass | An option can exist without being selected. The event establishes what happened, not whether the carrier was wrong. |
| 68–86 s | Third scene, offside then later phase | Running quickly is not sufficient. Eligibility and changing defense matter. |
| 86–103 s | Ask, inspect evidence, switch audience | Show a fresh MAF run and its native trace: one Agent requests evidence; Node validates the selected facts. If the recorded run falls back, retain that status rather than substituting an earlier successful result. |
| 103–110 s | Method / source / limitations | Published author implementation, reproducible checks, sensitivity and decoy limits. |

A real 108.04-second local preview has now been recorded and visually inspected at five segment checkpoints: [watch the preview](../assets/demo-preview.html). It includes an English caption track and source/data hashes in [demo-provenance.json](../assets/demo-provenance.json). The original 25 fps browser recording is preserved; no synthetic UI or result replacement was used. It shows local explanations and makes no cloud-call claim. The real MAF check is now complete; a final MAF-enabled recording, human review and public deployment remain pending. Evidence/protocol checks do not replace review of answer relevance and football interpretation.

Keep local `.env`, keys, tokens and login screens out of the recording. Show sanitized framework versions, response/call IDs, selected evidence and the resulting explanation. The model has no filesystem or shell tools; do not present the Python child as an operating-system sandbox. Cloud requests consume eligible credit, so a Free Trial with `spendingLimit=On` should not be advertised as inherently free inference.
