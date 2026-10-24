/** Browser-safe access to author-computed AS/DAS. This module never computes a football value model. */
const sceneCache = new Map();
const EPS = 1e-7;

export async function loadSceneData(id, { signal } = {}) {
  if (!['used', 'unused', 'blocked'].includes(id)) throw new RangeError(`Unknown scene: ${id}`);
  if (sceneCache.has(id)) return sceneCache.get(id);
  const paths = [`../data/${id}.json`, `../data/analysis/${id}.json`];
  const texts = await Promise.all(paths.map(async path => {
    const response = await fetch(new URL(path, import.meta.url), { signal });
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.text();
  }));
  const [scenario,analysis]=texts.map(text=>JSON.parse(text));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texts[0]));
  const inputHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(analysis.inputFileHash!==inputHash)throw new Error('The tracking has changed. Regenerate the author analysis before replay.');
  if (!scenario?.frames?.length || !analysis?.frames?.length || analysis.scenarioId !== id || scenario.metadata?.id !== id) {
    throw new Error('The tracking and analysis files do not describe the same scene.');
  }
  if (analysis.schemaVersion !== '2.0' || analysis.mode !== 'precomputed' || analysis.sampleRate !== 5 || scenario.metadata.sampleRate !== 10) {
    throw new Error('Unsupported tracking or analysis schema and sample rate.');
  }
  let previousTime = -Infinity;
  const seenFrames = new Set();
  for (const frame of analysis.frames) {
    const tracking = scenario.frames[frame.frameIndex];
    if (!Number.isInteger(frame.frameIndex) || !tracking || frame.frameId !== tracking.frameId || !Number.isFinite(frame.t) || Math.abs(frame.t - tracking.t) > EPS || frame.t <= previousTime || seenFrames.has(frame.frameId) || !['valid', 'invalid'].includes(frame.status)) {
      throw new Error('An analysis frame does not match the recorded tracking sample.');
    }
    previousTime = frame.t; seenFrames.add(frame.frameId);
  }
  const result = { scenario, analysis };
  sceneCache.set(id, result);
  return result;
}

/** Latest sample at or before time. Never chooses a future frame. */
export function frameAtOrBefore(frames, time) {
  if (!frames?.length || !Number.isFinite(time) || time < frames[0].t - EPS) return null;
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle].t <= time + EPS) low = middle;
    else high = middle - 1;
  }
  return frames[low];
}
export const analysisAtTime = (analysis, time) => frameAtOrBefore(analysis?.frames, time);
export const trackingAtTime = (scenario, time) => frameAtOrBefore(scenario?.frames, time);

/** Only positions are interpolated, strictly for animation. Facts stay on recorded samples. */
export function interpolatedFrame(scenario, time) {
  const frame = trackingAtTime(scenario, time);
  if (!frame) return null;
  const next = scenario.frames[Math.min(frame.index + 1, scenario.frames.length - 1)];
  const fraction = next.t > frame.t ? Math.max(0, Math.min(1, (time - frame.t) / (next.t - frame.t))) : 0;
  const mix = (a, b) => ({ ...a, x: a.x + ((b?.x ?? a.x) - a.x) * fraction, y: a.y + ((b?.y ?? a.y) - a.y) * fraction });
  const nextPlayers = new Map(next.players.map(player => [player.id, player]));
  return { ...frame, animationTime: time, players: frame.players.map(player => mix(player, nextPlayers.get(player.id))), ball: mix(frame.ball, next.ball) };
}

/** Hide outdated values during a transition between the 10 Hz tracking and 5 Hz model samples. */
export function playerAnalysis(analysisFrame, trackingFrame, playerId, { maxGroundBallZ = 0.15 } = {}) {
  const player = trackingFrame?.players?.find(item => item.id === playerId);
  if (!player || !analysisFrame || !trackingFrame) return { status: 'invalid', reason: 'missing_tracking', as: null, das: null, heatmap: null };
  if (trackingFrame.carrierId === playerId && trackingFrame.ball?.state === 'possessed') return { status: 'carrier', reason: 'carrier', as: null, das: null, heatmap: null };
  if (trackingFrame.attackingTeam && player.team !== trackingFrame.attackingTeam) return { status: 'defending', reason: 'defending', as: null, das: null, heatmap: null };
  const ball = trackingFrame.ball;
  const mode = trackingFrame.gameMode;
  let reason = null;
  if (ball?.state !== 'possessed') reason = ball?.state || 'unknown_possession';
  else if ((ball?.z ?? 0) > maxGroundBallZ) reason = 'non_ground_ball';
  else if (!trackingFrame.carrierId) reason = 'unknown_possession';
  else if (mode && mode !== 'open_play') reason = 'dead_ball';
  else if (analysisFrame.carrierId !== trackingFrame.carrierId || analysisFrame.attackingTeam !== trackingFrame.attackingTeam) reason = 'awaiting_sample';
  if (reason) return { status: 'invalid', reason, as: null, das: null, heatmap: null };
  if (analysisFrame.status !== 'valid') return { status: 'invalid', reason: analysisFrame.reason || 'invalid_analysis', as: null, das: null, heatmap: null };
  const value = analysisFrame.players?.[playerId];
  if (!value) return { status: 'invalid', reason: 'missing_player', as: null, das: null, heatmap: null };
  if (value.status !== 'eligible') return { ...value, reason: value.reason || analysisFrame.reason || value.status, as: null, das: null, heatmap: null };
  if (!Number.isFinite(value.as) || !Number.isFinite(value.das)) return { status: 'invalid', reason: 'invalid_metric', as: null, das: null, heatmap: null };
  return { ...value, reason: null };
}

export function curveSegments(analysis, playerId, asOfTime) {
  const segments = [];
  let segment = [], carrier = null, team = null, previousTime = null;
  const interval = 1 / (analysis.sampleRate || 5);
  for (const frame of analysis.frames) {
    if (frame.t > asOfTime + EPS) break;
    const value = frame.players?.[playerId];
    const valid = frame.status === 'valid' && value?.status === 'eligible' && Number.isFinite(value.das);
    const changed = frame.carrierId !== carrier || frame.attackingTeam !== team || (previousTime !== null && frame.t - previousTime > interval * 1.6);
    if (!valid || changed) { if (segment.length) segments.push(segment); segment = []; }
    if (valid) segment.push({ t: frame.t, das: value.das, as: value.as, frameId: frame.frameId, frameIndex: frame.frameIndex, carrierId: frame.carrierId });
    carrier = frame.carrierId; team = frame.attackingTeam; previousTime = frame.t;
  }
  if (segment.length) segments.push(segment);
  return segments;
}

/** Strip future extrema, endings and outcomes even when present in a precomputed file. */
export function visibleMoments(analysis, playerId, asOfTime) {
  return (analysis.moments || []).filter(moment => moment.playerId === playerId && Number.isFinite(moment.detectedAtTime) && moment.detectedAtTime <= asOfTime + EPS).map(moment => {
    const revision = (moment.revisions || []).filter(item => item.knownAtTime <= asOfTime + EPS).at(-1);
    // Revisions are full snapshots: never merge the final summary into an earlier revision.
    const visible = revision ? { id: moment.id, playerId: moment.playerId, kind: moment.kind, ...revision } : { ...moment };
    delete visible.revisions;
    if (!Number.isFinite(visible.endTime) || visible.endTime > asOfTime + EPS) { delete visible.endTime; delete visible.endFrameId; }
    if (!Number.isFinite(visible.peakTime) || visible.peakTime > asOfTime + EPS) { delete visible.peakTime; delete visible.peakFrameId; delete visible.peakDas; delete visible.peakDAS; }
    const outcomeKnownAt = visible.outcomeKnownAtTime ?? visible.outcome?.outcomeKnownAtTime ?? visible.outcome?.knownAtTime;
    if (!Number.isFinite(outcomeKnownAt) || outcomeKnownAt > asOfTime + EPS) { delete visible.outcome; delete visible.outcomeKnownAtTime; }
    return visible;
  });
}
export const visibleEvents = (scenario, asOfTime) => (scenario.events || []).filter(event => event.t <= asOfTime + EPS);

export function decodeHeatmap(encoded, meta) {
  if (!encoded || meta?.encoding !== 'base64-uint8') return null;
  const raw = typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('binary');
  if (raw.length !== meta.width * meta.height) throw new Error('The heatmap dimensions do not match the recorded data.');
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export function playerTrail(scenario, playerId, time, seconds = 3) {
  return scenario.frames.filter(frame => frame.t >= Math.max(0, time - seconds) - EPS && frame.t <= time + EPS).map(frame => {
    const player = frame.players.find(item => item.id === playerId);
    return player ? { x: player.x, y: player.y, t: frame.t } : null;
  }).filter(Boolean);
}
