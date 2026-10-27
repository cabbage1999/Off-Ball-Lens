# Off-Ball Lens: testing guide

**Team:** College of Engineering Football  
**Representative:** Jingbang Yang  
**Status date:** 28 October 2026 (Beijing time)

## Access status for judges

Open the [full Azure experience](https://offball-lens-hackathon-2026.azurewebsites.net/) for the current replay and real Microsoft Agent Framework explanations. It is free and requires no account, installation, or API key. The service runs on Azure App Service F1 using the project's Azure allowance. Two real MAF calls through this public endpoint succeeded on 27 October 2026 UTC / 28 October Beijing time, including a check after restart. Both returned verified cloud execution and completed `analyze_window` and `get_evidence` calls.

The first visit after inactivity can take time. If loading or an explanation times out, wait briefly and retry. A labelled local fallback is available when the cloud call fails, but is not a verified MAF response. The [static GitHub Pages replay](https://cabbage1999.github.io/Off-Ball-Lens/) remains available for precomputed AS/DAS, evidence navigation, and deterministic local explanations; it does not host the Agent backend.

The submission deadline is **28 October 2026 at 14:59 Beijing time (UTC+8)**. The submitted build and required access must remain available through **11 November 2026 at 15:59 Beijing time (UTC+8)**. See the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

The [113.40-second video](https://youtu.be/ejo0cYWsC94) was published publicly on YouTube on 28 October 2026. It records the current local build with a real Azure-backed MAF call, before public deployment. English captions are embedded; [provenance](../../assets/submission-provenance.json) and a [sanitized response](../../assets/submission-agent-receipt.json) are included.

## Test the free cloud experience

1. Open the [Azure application](https://offball-lens-hackathon-2026.azurewebsites.net/) in a current desktop browser. Begin in English **Fan** mode with **Right-side combination** and player **A7** selected. The player selector also allows inspection of any of the 22 players.
2. Play from the start. Follow A7's check, curved turn, and acceleration. Pause around **11.0 s**, before release at 11.2 s. Inspect the receiving field and the last three seconds of movement. Scripted observations describe already observed movement.
3. Switch to **Analyst**. Inspect the AS/DAS units, analysis time, frame identifier, and opportunity curve. Only the elapsed part of the sequence is shown. Continue through ball flight and reception at **12.1 s**; unsupported flight and the new carrier do not receive a misleading zero contribution score.
4. Return to **11.0 s** and choose **Explain this moment**. Wait for **Foundry + Agent Framework · verified**, then open **Evidence & tool activity** and inspect the completed `analyze_window` and `get_evidence` calls. If the response is labelled local fallback, wait and retry; do not count it as a successful cloud call. Click an evidence button to revisit its frame. On the GitHub Pages fallback, the source label will instead identify a local explanation.
5. Select **Switch across the block**. Follow A7 through **16.8–16.9 s** and inspect the recorded pass to another teammate. An available option that was not selected does not establish that the carrier made a poor decision.
6. Select **Run beyond the line** and inspect A7 at **8.2 s**, when receiving metrics are unavailable because of offside eligibility. Continue the scene to see the later possession change. Selecting a defender or carrier likewise shows the relevant status rather than a receiving contribution score.
7. Switch between **Fan**, **Analyst**, and **中文**. The layout and wording change while the underlying facts remain the same. In Analyst mode, finish a scene to reveal its retrospective review; expand **What this lens measures** and use **Download current evidence** to inspect the exported record.

For interpretation, AS is measured in m² and DAS in danger-weighted m². Neither is a probability or a measure of the total causal value of a player's movement. See the [method](../method.md) and [qualitative cases](../qualitative-cases.md).

## Run the replay locally without Azure

Install Git and **Node.js 22 or later**, then run:

```sh
git clone https://github.com/cabbage1999/Off-Ball-Lens.git
cd Off-Ball-Lens
npm start
```

Open `http://127.0.0.1:4173` and follow the steps above. A clean clone needs no JavaScript dependency installation, Python, or `.env` file for the precomputed replay. Keep the server running while testing; serve the files over HTTP instead of opening `index.html` directly. Stop the server with Ctrl+C.

## Reproduce the complete Agent with authorized Azure access

This section is for a maintainer or developer who already has suitable Azure authorization. Cloud requests can consume credit or incur charges. The project's successful account-specific endpoint check does not establish another account's access.

1. Install **Python 3.12** alongside Node.js 22 or later. In the cloned repository, prepare and test the isolated MAF environment:

   ```sh
   npm run setup:agent
   npm run test:agent
   ```

   The setup uses the pinned `requirements-agent.lock`. These tests use a simulated provider and do not establish real Azure connectivity.

2. Copy `.env.example` to the ignored local `.env`. Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_KEY` for an authorized endpoint and model. Retain `FOUNDRY_ORCHESTRATOR=agent-framework` and `FOUNDRY_API_STYLE=responses`. The included example uses the project's tested West US 3 regional endpoint and `gpt-5-mini`; it is not a shared credential. Keep credentials on the server. See the [configuration guide](../foundry-setup.zh-CN.md) for endpoint alternatives and interpreter selection.

3. Start the application:

   ```sh
   npm run start:agent
   ```

   Open `http://127.0.0.1:4173`, select A7 at **11.0 s** in **Right-side combination**, switch to Analyst, and request an explanation. Inspect the MAF source and native `analyze_window` / `get_evidence` activity. Configuration alone does not verify a call; a successful validated response must report `cloud-verified`. A local fallback is not a successful real Agent test.

4. In a second terminal at the repository root, run the real integration check:

   ```sh
   npm run smoke:agent
   # Optional: eight cases across scenes, languages, limits, and an adversarial request.
   npm run smoke:agent -- --suite
   ```

   These commands make real Azure requests and write the corresponding local receipt in `artifacts/`. Missing configuration reports **NOT RUN**. The checks verify the actual MAF worker, Node HTTP route, native tool calls, canonical facts, and clean worker exit. They do not verify a public hosting service.

## Inspect reproducibility and recorded evidence

The [single-case receipt](../../artifacts/agent-framework-trace.json) and [eight-case receipt](../../artifacts/agent-framework-suite.json) record successful real local runs on 27 October 2026 and declare `mock:false`. The [current verification record](../replay-v3.md) describes the recorded scope and limitations.

Run `npm test` for the JavaScript suite. To reproduce numerical results and Python checks, follow the separate Python 3.12 environment instructions in the [project README](../../README.md). The analysis uses the authors' `accessible-space==2.1.0`, independently of the language model; regeneration commands rewrite generated data and reports. Public deployment instructions are available in the [deployment guide](../deployment.zh-CN.md), while outstanding delivery items remain in the [handoff checklist](../handoff.md).
