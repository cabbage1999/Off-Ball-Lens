# DAS rebuild: implementation contract

Target: the 24 October project plan. This working contract coordinates implementation; it is not evidence of completion.

## Required experience

Three independently authored 25–40 second attacks: `used` (the selected runner receives), `unused` (another option is chosen), and `blocked` (fast movement with blocked access or offside). All 22 players have stage-specific tactical roles, continuous motion, and synchronized possession/pass/reception events. No score drives scene generation. Default product follows actual movement; no counterfactual route comparison or hand-built 0–100 index.

Use author package `accessible-space==2.1.0` for individual AS/DAS. AS is m²; DAS is danger-weighted m². Call the author's integration; display grids do not determine the scalar metric. Official possibility fields are not calibrated pass probabilities. Do not sum individual DAS or interpret changes as causal contribution.

## Shared trajectory schema

Retain `{metadata, frames, events}`. Scene exports are `data/used.json`, `data/unused.json`, `data/blocked.json`; generator exports `SCENARIOS`, `listScenarios`, `generateScenario`, `frameAt`.

- Metadata: `id`, bilingual title/subtitle, `duration`, `sampleRate:10`, `targetId`, `synthetic:true`, source/generator version, seed, pitch dimensions, coordinate units, motion limits, stage/role descriptions.
- Coordinates in metres, **centre origin**: x ∈ [-52.5,52.5], y ∈ [-34,34]. Pitch `{length:105,width:68,originX:-52.5,originY:-34}`. A attacks +x, B -x.
- Frames: local `index`, globally unique `frameId` such as `used:0000`, `t`, `periodId:1`, `pitch`, `attackDirection`, `attackingTeam`, `carrierId`, `gameMode:'open_play'`, `players`, `ball`.
- Players retain `id`, `team`, `number`, `role`, `x,y,vx,vy`. A1/B1 are keepers, rosters A1…A11 and B1…B11.
- Ball: `x,y,vx,vy,z,state`. States `possessed`, `in_flight`, `loose`, `dead`. Carrier is null unless controlled. Possession remains explicit; unknown ownership is null.
- Events: unique `id`, `type`, `t`, `frameIndex`, `frameId`, `playerId`, optional `targetId`, `passId`, `releaseFrameId`. Releases/receptions share a pass ID and derive from the same timeline. No scenario hypotheses or labels are analytical inputs.

## Shared analysis schema

Write `data/analysis/{scene}.json`. Top level: `schemaVersion:'2.0'`, `scenarioId`, `model` (name/version/config/configHash/source/units), `mode:'precomputed'`, `sampleRate`, `frames`, `moments`, `heatmapMeta`.

Compute at 5 Hz (every second tracking frame) including explicit invalid states. Each result frame binds exact `frameId`, `frameIndex`, `t`, `status`, `reason`, `carrierId`, `attackingTeam`. `players` is an ID-keyed map with `{status, as, das, heatmap}`. Status is `eligible`, `carrier`, `defending`, `offside`, or `invalid`. Non-applicable metrics are null in product outputs (raw author output can be retained separately for audits). No missing opponent silently omitted. Ball flight, non-ground, unknown ownership, dead ball and invalid tracking are unavailable.

Heatmap display payload: quantized rectangular grid, `heatmap` base64 uint8 string. Shared `heatmapMeta`: `width`, `height`, `xMin`, `xMax`, `yMin`, `yMax`, `encoding:'base64-uint8'`, `quantity:'danger_weighted_accessibility'`, `unit:'dimensionless'`, `scaleMax`, and explicit source/interpolation explanation. The field is official dangerous player possibility density multiplied by radial cell width, C_i V; it is an accessibility intensity, not a probability. Use 35×23 cell centres, row-major with x and y increasing; a fixed global color scale. Scalars always use author integration, never heatmap sums. All eligible players must be selectable. Metrics/heatmap use the same analysis frame and visibly state its time; animation may interpolate only for display.

Moments have unique `id`, `playerId`, `kind`, `startTime/startFrameId`, `detectedAtTime/detectedAtFrameId`, optional `endTime/endFrameId`, `peakTime/peakFrameId`, and `outcome` with `outcomeKnownAtTime`. Each update is stored in `revisions` with `knownAtTime/knownAtFrameId`; as-of projection chooses only the latest known revision, never the final peak/end/outcome. Detection uses only numerical prefixes and occurred events, not scene labels or future extrema. Curves split across invalid states/possession changes. `not_selected` is only available after the relevant window ends. Explain tools and UI filter facts by as-of time.

## Ownership

- analytics agent: `analytics/*`, Python dependencies/lock, Python tests, analysis exports, `docs/das-integration.md`, `docs/qualitative-cases.md`.
- tactical scene agent: `src/scenarios.mjs`, `scripts/export-data.mjs`, `scripts/validate.mjs`, scenario data, scene tests, `docs/scenarios.md`.
- frontend agent: `index.html`, `app.mjs`, `style.css`, browser-safe analysis access module `src/analysis.mjs`, `src/analysis-worker.mjs`, UI-only assets. Do not edit agent/server files.
- root: `src/agent.mjs`, `server.mjs`, request/agent tests, package commands, README/method/research/handoff, publishing/integration.
- later independent acceptance/review own reports and independent tests after initial integration.

Discuss necessary contract changes with root before changing shared shapes. Do not commit/publish, read secrets, or modify other owners' files. Preserve current files until replacements are ready. Store private prior conversations/planning PDF outside the public repository.

## Explanation boundary

Frontend POST `/api/explain` with `{scenarioId,playerId,asOfTime,windowSeconds,question,audience,language}`. Root returns `{source,status,text,claims,evidence,context,toolTrace,cloud,overlay}`. Evidence binds IDs/frame/time; claims include player_ids/frame_ids/metric_refs/overlay_type/limitations. Tools `analyze_window`, `get_evidence` select only data ≤ asOfTime; model may choose a shorter past window. One bounded correction, visible template fallback. On seek/scene/player/audience/language change discard stale responses. Local fallback may use the same browser-safe fact layer; coordinate its interface with root.

## Completion evidence

Author package sample and adapter checks; mirror/direction, offside/carrier, missing players and invalid ball states; 8–12 qualitative cases including decoy limitation; physics/event consistency and per-role tactical rationale; prefix-only moments and explanations; fixed heatmap color scale; browser selection/seek/language/audience/evidence behavior; actual Microsoft request trace if credentials supplied; reproducible install, public repo and accessible demo; English documentation and a <120-second working demonstration. Unknown or absent evidence remains incomplete.
