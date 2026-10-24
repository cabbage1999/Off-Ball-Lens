# Independent adversarial review — v2

Date: 24 October 2026. Reviewed build: independently authored tactical scenes v2.0.1 and `accessible-space==2.1.0`, with the rebuilt AS/DAS application. This report replaces the old heuristic-index review in full. Earlier v1 test results and release claims do not establish anything about this build.

**Initial v2 result:** this review reproduced five P2 defects, all now repaired. Four repairs were independently retested here; the historical-overlay repair passed independent protocol/source checks and the integration agent’s separate browser regression. No unresolved P1/P2 defect was found in the inspected scope. This is a bounded engineering review, not approval of a complete competition submission or validation against professional football ground truth.

The review was requested with GPT-6 Astra / max. That records the requested orchestration configuration; the reviewer could not independently inspect hidden model-serving configuration and does not claim to have verified it.

## Scope and method

The review read the v2 contract, model integration, method and scene documentation, and the project objectives and acceptance requirements. Inspection concentrated on `src/evidence.mjs`, `src/agent.mjs`, `server.mjs`, the browser analysis loader, the opportunity detector, the numerical adapter and the installed author's integration code. It examined actual evidence construction, provider-plan validation, event outcomes, time bounds, source binding, units and heatmap mapping rather than accepting documentation or the existing tests as proof.

Independent counterexamples were added in:

- [tests/adversarial-v2.test.mjs](../tests/adversarial-v2.test.mjs): narrow windows, a real intercepted pass, unrelated events, adversarial provider plans, historical window selection, and stale-data rejection through both loading paths.
- [analytics/tests/test_adversarial_v2.py](../analytics/tests/test_adversarial_v2.py): a source-rewrite race and independent reconstruction of the author's area integral and exported display fields.

The other independent acceptance reviewer covers the broader all-frame prefix, trajectory/physics and ordinary browser acceptance checks; see [acceptance.md](acceptance.md). Their results are not presented here as tests independently performed by this reviewer.

## Reproduced defects and repair status

### V2-A01 — P2: a known interception was described as an unresolved reception

**Original reproduction:** with the actual `blocked` export, request player `A9`, `asOfTime=20.2`, `windowSeconds=6`, English analyst mode. The explanation stated that the carrier passed towards A9 at 19.6 s and that reception was “not yet confirmed.” The same result already included event `blocked:p4:arrival`: B6 intercepted that pass at 20.2 s.

The fact builder gathered interceptions but the wording only distinguished received, selected and another target. It therefore presented a completed failure as pending. This affected an actual selectable player in the default data, not only a fabricated malformed input.

**Repair:** the fact builder recognizes terminal events for the same pass ID before choosing pending wording. The interception claim includes B6 in its entity references.

**Independent verification: PASS.** English and Chinese explanations identify the interception at 20.2 s. At 20.1 s they still correctly leave reception unconfirmed and reveal no later interception evidence. An interception carrying a different pass ID cannot settle the selected pass.

### V2-A02 — P2: an empty selected interval borrowed a sample from outside its bounds

**Original reproduction:** a request at `asOfTime=0.1`, `windowSeconds=0.05` selected 0.05–0.10 s, but returned a current numeric claim and evidence from 0.00 s. The same issue occurred when the model chose 0.41–0.49 s: the code fetched the latest sample before the end without checking the interval start.

There was no future leakage, but the evidence did not belong to the tool's declared interval. This matters because the cloud model is explicitly permitted to shorten the selected past window.

**Repair:** the current sample must also be at or after the interval start. A window containing no model sample returns an explicit availability explanation, no numerical summary and no borrowed metric evidence.

**Independent verification: PASS.** Separate tests cover the original request bounds and a narrower model-selected subwindow.

### V2-A03 — P2: runtime loaders accepted analysis from a different trajectory revision

**Original reproduction:** copy a real scene and its analysis into an isolated temporary root, change one tracking coordinate while preserving the scene ID, frame IDs and timestamps, and invoke the actual server request handler. It returned status 200 and analytical facts even though `analysis.inputFileHash` did not match the scene bytes. Browser loading checked IDs and frame/time alignment but also ignored this hash.

The server's old `sourceDigest` changed the response-cache key; it did not establish that the model had analyzed those trajectories. A normal trajectory re-export without a matching numerical re-export could therefore associate old values with new displayed movement.

**Repair:** both server and browser hash the exact loaded source text and compare it with `inputFileHash` before exposing the bundle. The server returns 409 on a mismatch.

**Independent verification: PASS.** A changed coordinate is rejected by each loader; exact unmodified files are accepted with unchanged numerical payloads. All three final scene files independently match their current analysis hashes.

The original server reproduction invoked the real request handler using a stream request and captured response after the execution environment initially denied an additional local listener. During the later cancellation review, this permanent regression was converted to a real loopback HTTP service and fetch client, with connection cleanup in `finally`; both stale rejection and valid-source acceptance passed through the real Node response lifecycle. The original handler reproduction is not retrospectively described as a network test.

### V2-A04 — P2: historical cloud evidence did not produce its requested visible overlay

**Original reproduction:** a simulated provider performed both tools, selected interval 0–0.4 s for a request whose replay cutoff was 0.8 s, and selected a valid current claim and `receiving_heatmap` overlay at `used:0004`. The valid result was accepted. The UI labeled the interval using 0.8 s and silently ignored the overlay because its frame was not the currently displayed `used:0008`. The fan wording referred to a highlighted area that had not been shown.

This was an allowed model action, not a fabricated reference. It also applies to a valid historical peak selected while replay remains at a later time.

**Repair inspected:** the UI separately labels the analyzed interval and replay cutoff, adds an explicit “View heatmap/evidence at …” action for historical frames, and applies the layer after that action seeks to its evidence frame. Current fan wording invites viewing the frame instead of claiming the area is already highlighted. Event overlays use the last relevant known event and the tracking-frame clock.

**Independent protocol verification: PASS.** The past interval and evidence frame are preserved. **Separate integration-agent browser verification: PASS, reported by the integration agent and not independently operated by this reviewer.** Its Playwright regression, whose script this reviewer inspected, asserted the visible `Analyzed 4.0–9.6 s` and `Replay cutoff 10.0 s` labels, clicked `View heatmap at 9.6 s`, and asserted the pitch label referenced `9.6 seconds` and `used:0096`. The route supplied the prepared response for the actual `used` scene; the deployment and response IDs explicitly identified it as a protocol mock. The route was removed and the page reloaded in `finally`. No real Azure call is implied.

### V2-A05 — P2: the exporter could hash a newer source than the one it analyzed

**Original reproduction:** `compute_das.main` parsed the source, ran analysis, then reread the file to calculate `inputFileHash`. A deterministic temporary-directory fixture changed the file during the computation: the analysis observed `x=1`, the current source contained `x=999`, and the output hash matched the new source. Runtime hash checking would accept that stale analysis.

This is a source-consistency race in the exporter, independent of the runtime-loader fix.

**Repair:** the exporter reads `source_bytes` once. Both JSON parsing and `inputFileHash` use those same bytes. If the on-disk file changes during calculation, the exported hash continues to identify the data actually analyzed, and runtime loading rejects the changed file.

**Independent verification: PASS.** The regression deliberately changes the temporary source during analysis and verifies that the output hash matches only the original analyzed bytes.

## Independent numerical and display audit

The installed author's `integrate_surfaces` was inspected directly. It integrates radial possibility density multiplied by the midpoint radial width and the polar area element. The application uses the author's scalar outputs, and its display conversion multiplies dangerous player density by that radial width before interpolation. Raw density, effective area and dimensionless displayed intensity are not interchangeable.

A fresh audit rebuilt long-table rows independently, put the ball first, reversed player order and resolved every returned frame/player index. It independently reconstructed midpoint radial widths, angular sector areas and display cell centres. Display interpolation was evaluated radially on each ray first and then across rays, using the opposite evaluation order from production. The checks did not call the adapter's row builder, heatmap conversion helpers or `compute_frames`.

Checked tracking indices: `used` 0, 104 and 200; `unused` 104; `blocked` 168 and 214. The final case has B in possession attacking in the negative x direction.

| Check on final frozen exports | Observed result |
| --- | --- |
| Eligible player fields checked | 60 |
| Rectangular display cells checked | 48,300 |
| Largest uint8 code difference from independent conversion | 0 |
| Largest absolute difference in independently reconstructed DAS integral | 0.000000550153 danger-weighted m² |
| Largest absolute difference in independently reconstructed AS integral | 0.000227136 m² |
| Fixed display scale and layout | 35 × 23, scale maximum 0.1, dimensionless intensity |

The small integral differences arise from separately ordered floating-point arithmetic against author float32 integration. These are numerical consistency checks on selected frames, not accuracy bounds for all possible football states. Rectangular heatmap sums are still not official AS/DAS integrals. Angular/radial discretization sensitivity and quantization remain distinct limitations.

## Final checks and explicit non-runs

After the v2.0.1 scene and analysis freeze, this reviewer ran:

```sh
node --test tests/adversarial-v2.test.mjs
.venv-das/bin/python -m pytest analytics/tests/test_adversarial_v2.py -q -s
.venv-das/bin/python -m pip check
```

Results: **11 JavaScript tests passed; 2 Python tests passed; no broken installed requirements found.** The provider tests include free-prose injection despite otherwise valid IDs, stale claim IDs after changing a model window, bounded correction and transparent fallback. They all use in-memory protocol responses, not a Microsoft service.

**NOT RUN by this reviewer:** real Microsoft Foundry/Azure authentication or inference; production deployment, cost or latency; a clean-machine installation from the dependency lock; cross-platform binary reproducibility; professional football-practitioner adjudication; final recorded-video acceptance. The team has no supplied Azure deployment. These must not be closed by a mock returning `cloud-verified` in a protocol test.

The dependency versions are pinned and the current environment is internally consistent. This is narrower evidence than a fresh reproducible installation. Local files and author-model parity do not establish that every future provider deployment supports the selected Responses API schema.

## Remaining interpretation boundaries

- AS and DAS describe direct receiving opportunity under the author's model. They are not pass or goal probabilities and do not establish individual causal contribution. Individual areas may overlap.
- The detector thresholds are a disclosed product preset. They are not externally calibrated football quality labels. Already-disclosed grid/noise sensitivity and missed short windows at lower sampling rates remain limitations, not defects concealed by this review.
- Synthetic tactical choreography supports a reproducible demonstration; it is not observed-match ground truth or an empirical accuracy study. A useful decoy can have a lower individual DAS.
- Current source/analysis hashes prevent accidental version mixing. They are not a cryptographic signature proving trusted authorship of an arbitrarily supplied analysis file.
- A finite adversarial review cannot prove absence of every malformed-input, service or semantic failure. The submission still requires the delivery gates recorded in [handoff.md](handoff.md).

## Reviewed source fingerprints

SHA-256 at the final local test snapshot:

| File | SHA-256 |
| --- | --- |
| `src/scenarios.mjs` | `b059d47c14f9f073d80f74da098a0907b910c511151a085700be20afcb0dacb6` |
| `src/evidence.mjs` | `b67984e0d1dd55e1a416975f02ff02fc4ba77cbaf16a218a83b1d14394bd62a5` |
| `src/agent.mjs` | `5985ee00976ea4cfa8d60c33d1be43129036e4c1dfbe2b1d9e66351cb44fa0a0` |
| `src/analysis.mjs` | `cef3e82a8320ee45400a37fc2da44fbefcbee85893ace28c3f9aa492f7d5f5b6` |
| `server.mjs` | `535fd738c8f7f6cf79c31110b147642fbba674cd216911b94fbd98efccb6d63e` |
| `analytics/compute_das.py` | `7a6ad819c14a70f1384ebe3b30425271c7feecc4b6f7f4409df759fc306fcfa9` |
| `analytics/heatmap.py` | `45c80ff3269d4ba45e7aee743750e80e8b2c5bc46e36aec563130cb2f81df333` |


## Follow-up audit: cancellation and deployment evidence

This addendum records a later local review following public revision `a7f0a9b9ba666181f39dc8d88bedb35ab9709405`. It concerns cancellation and deployment verification only. It does not claim that the reviewed follow-up files were published, or that a Microsoft deployment was available. The earlier fingerprints identify the original audit snapshot; updated files relevant to this addendum are listed below.

### V2-A06 — P1: the cancellation patch imported a Node-only module into browser entry points

The first cancellation implementation added a top-level `node:timers/promises` import to `src/agent.mjs`. Both `app.mjs` and `src/analysis-worker.mjs` import that module directly in the browser. A Node-only module specifier in this dependency graph prevents the native browser module graph from loading, even when the application only wants the offline explanation export. Node unit tests alone did not detect this regression.

The reviewer identified the actual production import chain and reported it before publication. The implementer replaced the Node timer dependency with a browser-compatible cancellable retry wait. Its completion and abort paths remove the abort listener.

**Independent verification: PASS.** A new permanent test walks both browser/worker entry-point import graphs and rejects Node-only static dependencies. The current graph passes. The reviewer did not personally run a pre-fix browser-launch experiment; this finding came from source inspection and the import-graph regression, not a claimed browser screenshot.

### Cancellation behavior after repair

The reviewer added [cancellation-adversarial.test.mjs](../tests/cancellation-adversarial.test.mjs) and executed it against the actual Node server. The most demanding transport case uses two real loopback HTTP connections to the application and a second real loopback HTTP server as the simulated provider. The provider sends response headers and part of a JSON body, then stops. The downstream clients disconnect while native `fetch` is waiting inside `response.json()`.

Observed results:

- Both native upstream response-body reads are aborted. Both application slots become available to a replacement request.
- Cancelled work does not verify the fresh server session or populate the explanation cache. The replacement request executes all three simulated provider rounds; a later ordinary repeat correctly uses its successful cache entry.
- Two provider deadlines still return visible HTTP 200 template fallbacks with `cloud_timeout`, rather than being treated as caller cancellations. They do not verify the session or populate the successful-response cache. A subsequent ordinary request succeeds.
- Cancellation during final provider JSON parsing propagates as an abort and cannot return a verified explanation.
- The implementer's separate tests for client disconnect, retry-wait cancellation and already-aborted/late-response cases also passed when independently rerun.

These experiments establish local transport cancellation and application-resource cleanup. They do not establish how an actual Azure service terminates computation or accounts for a request after the client disconnects.

The original two data-binding tests used a plain response stub without Node's `once`/`off` lifecycle methods. Adding real response-close cancellation exposed that outdated test double. The reviewer replaced the helper with a real temporary loopback server, `fetch`, and guaranteed connection/server cleanup. The product was not changed to accommodate the stub. All eleven original adversarial tests pass, including the unchanged 409 stale-data rejection and 200 matched-data acceptance checks.

### V2-A07 — P2: an HTTPS-shaped target was being treated as proof of real Azure inference

The deployment-check draft set `realCloudVerified` solely when the mode required cloud and the URL was not a recognized loopback name. Its validated HTTP response could still have come from an explicitly simulated provider. A public-looking DNS name and a well-formed provider trace are not independent backend authentication.

**Repair:** the report separates `cloudProtocolVerified` from `serverReportedCloudVerified`. `realCloudVerified` remains false for this HTTP checker, including public HTTPS targets. Closing the real Microsoft gate requires separate actual service evidence. The implementation does not attempt to prove authenticity by guessing a response-ID prefix or by assuming the absence of a word such as “mock.”

**Independent verification: PASS.** With an explicitly simulated provider response and a public HTTPS URL shape, the transport-mocked review case passes the HTTP contract while retaining `realCloudVerified:false`; only the protocol and server-reported flags become true. This experiment did not contact that public hostname. Additional independent cases reject invented claims, altered metric evidence, a cached response, an offline response under cloud-configured health, duplicate provider response IDs, and a tool window inconsistent with the returned facts.

### V2-A08 — P2: an invalid-only historical window could pass a numerical deployment probe

The checker intentionally chooses an eligible probe frame and requests AS/DAS with exact frame evidence. An initial lower bound of one evidence item was insufficient: the model could select the actual `used` interval 3.4–4.0 s, which lies entirely in pass flight. Its valid availability explanation returned `E:used:0040:A7` with `status:invalid`, `as:null`, `das:null` and `summary:null`. The checker nevertheless returned `passed:true` without verifying a receiving-space number.

This is a distinction between a legitimate application response and completion of this particular numerical smoke test. It is not a reason for the application to fabricate a metric in flight.

**Repair and independent verification: PASS.** The probe now requires at least one eligible evidence item with finite AS and DAS, then checks that evidence against the local trusted facts. Empty-sample and invalid-only answers produce `insufficient_probe_evidence`. The exact actual-scene 3.4–4.0 s case is retained in the deployment suite and passed when rerun over real loopback HTTP; the provider remains simulated.

### Executed follow-up checks and limits

| Suite independently executed in this follow-up | Result |
| --- | --- |
| `tests/cancellation.test.mjs` | 3 passed |
| `tests/cancellation-adversarial.test.mjs` | 4 passed |
| `tests/adversarial-v2.test.mjs`, with real HTTP helper | 11 passed |
| Final `tests/deployment.test.mjs` | 24 passed |

The deployment suite includes actual local HTTP checks for stale files, metadata and exact facts, legal shorter windows, missing tools and response IDs, altered numbers/text, future evidence, offline/fallback responses, cached results, final health, redirects, bounded timeouts and artifact redaction. Separate in-memory transport mutations inspected the public-URL classification and evidence-validation branches. Neither kind is an actual public Azure deployment run.

Within these two follow-up topics, no unresolved P1/P2 defect remained after the repairs and listed tests. Real Microsoft authentication/inference, Azure-side cancellation behavior, a live cloud deployment trace and a final cloud-enabled submission remain **NOT RUN** by this reviewer. Public release verification and delayed/out-of-order browser exercises belong to their separately recorded integration/acceptance scopes.

Updated SHA-256 values at this follow-up snapshot:

| File | SHA-256 |
| --- | --- |
| `src/agent.mjs` | `41b2f8f230b8962540af10ecf4cfedb381c4d0f27a1191cf09b4ee3b997af6ac` |
| `server.mjs` | `da51a89e5b8301338bd342d4f2f346a6111351ac205be5a5f9e73dca6d5ae8c7` |
| `scripts/smoke-deployment.mjs` | `02cbc39053a6a150e1606d1c6d4060ce0e3f753b7bbf1fb26f54963c0e11212d` |
| `tests/cancellation-adversarial.test.mjs` | `d9f7c7b697a74dd8b80509cadf1ba0d2c284611dd8d7844a8e1e21926b9663cc` |
| `tests/adversarial-v2.test.mjs` | `55151cb013b610c97890856b41141bde707a320b45b641d44ff4777a9ad04a8b` |
