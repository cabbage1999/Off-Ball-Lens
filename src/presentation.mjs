/** Browser-only presentation transforms. These never change the recorded AS/DAS values. */
const PALETTE = [
  [0, 113, 70, 159],
  [.25, 167, 75, 165],
  [.5, 217, 101, 135],
  [.75, 250, 160, 82],
  [1, 255, 245, 170]
];
const EPS = 1e-7;
export const HEATMAP_OPACITY_FLOOR = .30;

/** One fixed sequential palette and affine-sqrt opacity, shared by field and legend. */
export function heatmapRgba(value) {
  const q = Math.max(0, Math.min(255, Number(value) || 0));
  if (q === 0) return [0, 0, 0, 0];
  const fraction = Math.sqrt(q / 255);
  const upper = PALETTE.findIndex(stop => stop[0] >= fraction);
  const right = PALETTE[Math.max(1, upper)], left = PALETTE[Math.max(0, upper - 1)];
  const progress = (fraction - left[0]) / (right[0] - left[0]);
  return [1, 2, 3].map(channel => Math.round(left[channel] + (right[channel] - left[channel]) * progress))
    .concat(Math.round((HEATMAP_OPACITY_FLOOR + (1 - HEATMAP_OPACITY_FLOOR) * fraction) * 255));
}

/** Authored observations are eligible only after every referenced fact has occurred. */
export function observationCueAtTime(scenario, trackingFrame, selectedId) {
  if (!Number.isFinite(trackingFrame?.t) || !Array.isArray(trackingFrame.players) || !trackingFrame.players.some(player => player.id === selectedId)) return null;
  const t = trackingFrame.t;
  const cues = scenario?.metadata?.observationCues;
  if (!Array.isArray(cues)) return null;
  return cues.filter(cue =>
    cue && typeof cue.id === 'string' && cue.id && cue.kind === 'observed_movement' && cue.provenance === 'authored_tracking_cue' &&
    [cue.startTime, cue.endTime, cue.evidenceTime].every(Number.isFinite) &&
    cue.startTime <= cue.endTime && cue.evidenceTime <= cue.startTime + EPS &&
    cue.startTime <= t + EPS && t <= cue.endTime + EPS && cue.evidenceTime <= t + EPS &&
    Array.isArray(cue.focusPlayerIds) && cue.focusPlayerIds.includes(selectedId) &&
    cue.focusPlayerIds.every(id => trackingFrame.players.some(player => player.id === id)) &&
    typeof cue.text === 'string' && cue.text.trim() && typeof cue.textZh === 'string' && cue.textZh.trim()
  ).sort((a, b) => b.startTime - a.startTime || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}
