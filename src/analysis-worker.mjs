/** Optional data worker: reads the precomputed author outputs; does not reimplement DAS. */
import { loadSceneData, analysisAtTime, trackingAtTime, playerAnalysis, curveSegments, visibleMoments, visibleEvents } from './analysis.mjs';
import { offlineExplain } from './agent.mjs';
self.onmessage = async ({ data: { id, task, request } }) => {
  try {
    const { scenario, analysis } = await loadSceneData(request.scenarioId);
    let result;
    if (task === 'explain') result = offlineExplain(request, { scenario, analysis });
    else if (task === 'snapshot') {
      const frame = analysisAtTime(analysis, request.asOfTime);
      result = { frame, player: playerAnalysis(frame, trackingAtTime(scenario, request.asOfTime), request.playerId),
        curves: curveSegments(analysis, request.playerId, request.asOfTime), moments: visibleMoments(analysis, request.playerId, request.asOfTime), events: visibleEvents(scenario, request.asOfTime) };
    } else throw new Error('Unknown data job');
    self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
