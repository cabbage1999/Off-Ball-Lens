/** Prefix-only facts shared by the browser fallback and the Foundry tools. */
export const MODEL_VERSION = 'accessible-space-2.1.0';
export const LIMITATIONS = Object.freeze([
  'Independently authored synthetic tactical scenes, not observed matches.',
  'AS is effective receiving area; DAS is danger-weighted area, not a goal or pass probability.',
  'Changes describe opportunities during movement, not the causal contribution of a runner.',
  'Individual areas overlap and cannot be added or used as a share of team contribution.',
  'Precomputed author-model results; unsupported ball states are unavailable.'
]);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const rounded = n => finite(n) ? Number(n.toFixed(4)) : null;
const metricOK = p => p && ['eligible','offside'].includes(p.status) && finite(p.as) && finite(p.das);
const frameKey = f => f.frameId ?? f.frame_id;
const valueText = n => Number(n).toFixed(2);
const timeText = n => Number(n).toFixed(1);

export function validateExplainRequest(input, bundle) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Request must be an object');
  const allowed = ['scenarioId','playerId','asOfTime','windowSeconds','question','audience','language'];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new RangeError('Unsupported request field');
  const {scenario, analysis} = bundle ?? {};
  if (!scenario?.metadata || !Array.isArray(scenario.frames) || !Array.isArray(analysis?.frames)) throw new TypeError('A scenario and its author-model analysis are required');
  if (analysis.scenarioId !== scenario.metadata.id) throw new RangeError('Scenario and analysis do not match');
  const scenarioId = input.scenarioId ?? scenario.metadata.id;
  if (scenarioId !== scenario.metadata.id) throw new RangeError('Unknown scenario');
  const playerId = input.playerId ?? scenario.metadata.targetId;
  if (!scenario.frames[0]?.players.some(p => p.id === playerId)) throw new RangeError('Unknown player');
  const asOfTime = input.asOfTime ?? 0, windowSeconds = input.windowSeconds ?? 5;
  if (!finite(asOfTime) || asOfTime < 0 || asOfTime > scenario.metadata.duration + 1e-8) throw new RangeError('Invalid as-of time');
  if (!finite(windowSeconds) || windowSeconds <= 0 || windowSeconds > 15) throw new RangeError('Window must be greater than zero and at most 15 seconds');
  const question = input.question ?? 'What receiving space is available to this player?';
  if (typeof question !== 'string' || question.length > 1000) throw new RangeError('Question must have at most 1,000 characters');
  if (input.language && !['zh','en'].includes(input.language)) throw new RangeError('Unsupported language');
  if (input.audience && !['fan','analyst'].includes(input.audience)) throw new RangeError('Unsupported audience');
  return {scenarioId, playerId, asOfTime, windowSeconds, question, language:input.language ?? 'en', audience:input.audience ?? 'fan'};
}

export function analysisFrameAt(analysis, time) {
  return analysis.frames.findLast(f => f.t <= time + 1e-9) ?? null;
}

function evidenceFor(f, playerId) {
  const p = f.players?.[playerId];
  return {id:`E:${frameKey(f)}:${playerId}`, frameId:frameKey(f), frameIndex:f.frameIndex, t:f.t,
    playerId, status:p?.status ?? 'invalid', reason:f.reason ?? null, carrierId:f.carrierId,
    as:metricOK(p) ? p.as : null, das:metricOK(p) ? p.das : null,
    metric_refs:metricOK(p) ? [`M:${frameKey(f)}:${playerId}:AS`,`M:${frameKey(f)}:${playerId}:DAS`] : []};
}

/** No interpolation of model values and no integration across invalid states or carrier changes. */
export function analyzePrefixWindow(bundle, request, startTime, endTime) {
  const {scenario, analysis} = bundle;
  if (!finite(startTime) || !finite(endTime) || startTime < Math.max(0,request.asOfTime-request.windowSeconds)-1e-8 || endTime > request.asOfTime+1e-8 || startTime > endTime) throw new RangeError('Analysis must stay within the selected past window');
  const frames = analysis.frames.filter(f => f.t >= startTime-1e-8 && f.t <= endTime+1e-8);
  const segments=[]; let segment=null, previous=null;
  const maxGap=1.6/(analysis.sampleRate ?? 5);
  for (const f of frames) {
    const p=f.players?.[request.playerId];
    if (!metricOK(p) || f.status !== 'valid') {segment=null;previous=null;continue;}
    if (!segment || !previous || f.carrierId !== previous.carrierId || f.attackingTeam !== previous.attackingTeam || f.t-previous.t > maxGap) {
      segment={carrierId:f.carrierId,attackingTeam:f.attackingTeam,samples:[]};segments.push(segment);
    }
    segment.samples.push(evidenceFor(f,request.playerId));previous=f;
  }
  const sampled=analysisFrameAt(analysis,endTime);
  const current=sampled&&sampled.t>=startTime-1e-8?sampled:null;
  // Summaries explicitly refer to the final supported segment, never a bridged window.
  const latest=segments.at(-1), samples=latest?.samples ?? [];
  let summary=null;
  if(samples.length){
    const first=samples[0],last=samples.at(-1),peak=samples.reduce((a,b)=>b.das>a.das?b:a);
    let integral=0;
    for(let i=1;i<samples.length;i++)integral+=(samples[i-1].das+samples[i].das)*.5*(samples[i].t-samples[i-1].t);
    summary={startTime:first.t,endTime:last.t,duration:last.t-first.t,startDAS:first.das,endDAS:last.das,
      deltaDAS:last.das-first.das,meanDAS:last.t>first.t?integral/(last.t-first.t):last.das,
      peakDAS:peak.das,peakTime:peak.t,peakFrameId:peak.frameId,carrierId:latest.carrierId,sampleCount:samples.length};
  }
  const events=(scenario.events ?? []).filter(e=>finite(e.t)&&e.t>=startTime-1e-8&&e.t<=endTime+1e-8);
  const selected=new Map();
  const add=e=>{if(e)selected.set(e.id,e);};
  if(current)add(evidenceFor(current,request.playerId));
  if(samples.length){add(samples[0]);add(samples.at(-1));add(samples.find(e=>e.frameId===summary.peakFrameId));}
  const outcomeEvents=[];
  if(summary){
    // A pass to someone else is an observed choice, never proof of a wrong decision.
    const release=events.find(e=>e.type==='pass'&&e.playerId===summary.carrierId&&e.t>=summary.startTime-1e-8);
    if(release){outcomeEvents.push(release);
      const reception=events.find(e=>['reception','interception','save','dead_ball','turnover'].includes(e.type)&&e.passId&&e.passId===release.passId&&e.t>=release.t);
      if(reception)outcomeEvents.push(reception);
    }
  }
  for(const e of outcomeEvents){
    const f=scenario.frames.find(f=>frameKey(f)===e.frameId || f.index===e.frameIndex);
    if(!f||f.t>request.asOfTime+1e-8)continue;
    add({id:`EV:${e.id}`,frameId:frameKey(f),frameIndex:f.index,t:e.t,playerId:e.playerId,status:'event',event:{...e},metric_refs:[]});
  }
  return {playerId:request.playerId,startTime,endTime,current:current?evidenceFor(current,request.playerId):null,
    segments:segments.map(s=>({carrierId:s.carrierId,attackingTeam:s.attackingTeam,samples:s.samples})),
    summary,evidence:[...selected.values()],outcomeEvents,mode:'precomputed-prefix',modelVersion:analysis.model?.version ?? MODEL_VERSION,
    configHash:analysis.model?.configHash ?? null};
}

export function makeFactPack(bundle, request, startTime=Math.max(0,request.asOfTime-request.windowSeconds), endTime=request.asOfTime){
  const window=analyzePrefixWindow(bundle,request,startTime,endTime), zh=request.language==='zh';
  const {summary:s,current}=window, id=request.playerId;
  const claims=[];
  function add(kind,text,refs=[],overlay='receiving_heatmap',fanText=text){
    const selected=window.evidence.filter(e=>refs.includes(e.id));
    claims.push({id:`C:${kind}:${startTime.toFixed(3)}:${endTime.toFixed(3)}`,kind,text,fanText,claim:text,
      player_ids:[...new Set([id,...selected.flatMap(e=>[e.event?.playerId,e.event?.targetId]).filter(Boolean)])],frame_ids:[...new Set(selected.map(e=>e.frameId))],metric_refs:[...new Set(selected.flatMap(e=>e.metric_refs ?? []))],
      evidence_ids:refs,overlay_type:overlay,limitations:['Direct receiving opportunity, not causal contribution.']});
  }
  if(current&&finite(current.das)){
    add('current',zh?`${timeText(current.t)} 秒，${id} 的危险接应空间为 ${valueText(current.das)} 危险度加权平方米，可接应空间为 ${valueText(current.as)} 平方米。`:
      `At ${timeText(current.t)} s, ${id} has ${valueText(current.das)} danger-weighted m² of receiving space and ${valueText(current.as)} m² of accessible space.`,[current.id],'receiving_heatmap',
      zh?`模型记录了 ${id} 在 ${timeText(current.t)} 秒的危险接应空间；点击证据可以查看该时刻的热图。`:`The model records ${id}'s dangerous receiving space at ${timeText(current.t)} s; open the evidence to view that frame's heatmap.`);
    if(current.status==='offside')add('offside',zh?'该时刻的点位越位筛选排除了此球员的接应机会；这是模型几何筛选，不是正式判罚。':'The positional offside filter excludes this receiving option at this instant; this is a model geometry check, not an officiating decision.',[current.id],'player_trail');
  }else{
    const reason=current?.status ?? 'no_sample';
    const texts={carrier:zh?'选中球员正在持球，当前不显示其无球接应指标。':'The selected player is on the ball; an off-ball receiving metric is not applicable.',
      defending:zh?'选中球员不属于当前控球队；此模型不提供防守贡献评分。':'The selected player is not on the team in possession; this model does not score defensive contribution.',
      offside:zh?'当前点位越位筛选排除了此球员的接应选项，暂停显示其接应面积；这不是正式判罚。':'The positional offside filter excludes this receiving option, so its area is not displayed; this is not an officiating decision.',
      invalid:zh?'当前状态不适合计算新的低平传球接应机会；热图与指标暂不可用。':'This state does not support a new controlled ground-pass opportunity; the current heatmap and metrics are unavailable.',
      no_sample:zh?'所选时段内没有分析采样帧；请扩大过去的时间窗口。':'There is no analysis sample inside the selected interval; choose a longer past window.'};
    add('availability',texts[reason]??texts.invalid,current?[current.id]:[],'none');
  }
  if(s){
    const first=window.evidence.find(e=>e.t===s.startTime&&e.status!=='event'),last=window.evidence.find(e=>e.t===s.endTime&&e.status!=='event');
    const peak=window.evidence.find(e=>e.frameId===s.peakFrameId&&e.status!=='event');
    if(s.sampleCount>1)add('change',zh?`在 ${timeText(s.startTime)}–${timeText(s.endTime)} 秒这段连续有效状态中，${id} 的 DAS 从 ${valueText(s.startDAS)} 变为 ${valueText(s.endDAS)}，变化 ${s.deltaDAS>=0?'+':''}${valueText(s.deltaDAS)} 危险度加权平方米。这是局面中的机会变化。`:
      `During the supported segment ${timeText(s.startTime)}–${timeText(s.endTime)} s, ${id}'s DAS changes from ${valueText(s.startDAS)} to ${valueText(s.endDAS)} (${s.deltaDAS>=0?'+':''}${valueText(s.deltaDAS)} danger-weighted m²). This describes changing opportunities in the scene.`,[first?.id,last?.id].filter(Boolean),'das_curve',
      zh?`${timeText(s.startTime)}–${timeText(s.endTime)} 秒，${id} 的危险接应空间${s.deltaDAS>0?'增大':s.deltaDAS<0?'缩小':'保持不变'}；点击证据可以回看这段局面变化。`:
      `Between ${timeText(s.startTime)} and ${timeText(s.endTime)} s, ${id}'s dangerous receiving space ${s.deltaDAS>0?'increases':s.deltaDAS<0?'decreases':'stays unchanged'}; open the evidence to revisit the changing scene.`);
    add('peak',zh?`截至所选时刻，在该有效时段内已观察到的最高 DAS 为 ${valueText(s.peakDAS)}，对应 ${timeText(s.peakTime)} 秒。`:
      `Up to the selected time, the largest DAS observed in this supported segment is ${valueText(s.peakDAS)} at ${timeText(s.peakTime)} s.`,peak?[peak.id]:[],'receiving_heatmap',
      zh?`截至当前，在这段有效时段中 ${timeText(s.peakTime)} 秒的危险接应空间最大；点击证据可以回到该时刻。`:
      `So far in this supported segment, the largest dangerous receiving space occurs at ${timeText(s.peakTime)} s; open the evidence to revisit it.`);
    const release=window.outcomeEvents.find(e=>e.type==='pass');
    if(release){const refs=window.outcomeEvents.map(e=>`EV:${e.id}`).filter(ref=>window.evidence.some(e=>e.id===ref));
      const received=window.outcomeEvents.find(e=>e.type==='reception'&&e.playerId===id);
      const stopped=window.outcomeEvents.find(e=>['interception','save','dead_ball','turnover'].includes(e.type));
      const selected=release.targetId===id;
      const stopText=stopped?(stopped.type==='interception'?(zh?`${timeText(stopped.t)} 秒，${stopped.playerId} 拦截了传向 ${id} 的球；这次传球没有由 ${id} 接到。`:`At ${timeText(stopped.t)} s, ${stopped.playerId} intercepts the pass towards ${id}; ${id} does not receive it.`):stopped.type==='save'?
        (zh?`${timeText(stopped.t)} 秒，${stopped.playerId} 收下这次来球；${id} 没有接到这次传球。`:`At ${timeText(stopped.t)} s, ${stopped.playerId} gathers this ball; ${id} does not receive this pass.`):
        (zh?`${timeText(stopped.t)} 秒，比赛停止或球权转换，事件中未记录 ${id} 接到这次传球。`:`At ${timeText(stopped.t)} s, play stops or possession changes, with no recorded reception of this pass by ${id}.`)):null;
      add('outcome',received?(zh?`${timeText(received.t)} 秒，${id} 接到这次传球；接应结果来自已发生的接球事件。`:`At ${timeText(received.t)} s, ${id} receives this pass; the outcome comes from an occurred reception event.`):selected&&stopped?stopText:selected?
        (zh?`${timeText(release.t)} 秒，持球者向 ${id} 传球；截至当前时刻尚未确认接球。`:`At ${timeText(release.t)} s, the carrier passes towards ${id}; reception is not yet confirmed at the selected time.`):
        (zh?`${timeText(release.t)} 秒，持球者选择传给 ${release.targetId}。${id} 未被这次传球选择，但这不能证明持球者决策错误。`:`At ${timeText(release.t)} s, the carrier chooses ${release.targetId}. ${id} is not selected for this pass; that does not establish a poor decision.`),refs,'event');
    }
  }
  add('limits',zh?'DAS 是危险度加权的接应面积，不是进球概率；个人机会下降也不能据此否定牵制跑动的作用。':'DAS is danger-weighted receiving area, not a goal probability; a lower individual value does not rule out useful decoy movement.',[],'none');
  return {context:{scenarioId:request.scenarioId,playerId:id,asOfTime:request.asOfTime,startTime,endTime,analysisTime:current?.t??null,
    analysisFrameId:current?.frameId??null,mode:window.mode,modelVersion:window.modelVersion,configHash:window.configHash},
    summary:s?Object.fromEntries(Object.entries(s).map(([k,v])=>[k,typeof v==='number'?rounded(v):v])):null,
    claims,evidence:window.evidence,limitations:LIMITATIONS};
}

export function defaultClaimPlan(pack,request){
  if(/limit|assumption|局限|限制|假设/i.test(request.question))return {claim_ids:pack.claims.filter(c=>c.kind==='limits').map(c=>c.id),evidence_ids:[],overlay_type:'none'};
  const priorities=/receive|pass|利用|接球|传球|错过/.test(request.question.toLowerCase())?['outcome','availability','change','current']:['availability','change','current'];
  const primary=priorities.find(k=>pack.claims.some(c=>c.kind===k));
  const kinds=request.audience==='analyst'?['current','availability','change','peak','outcome','offside','limits']:[primary,'limits'];
  const ids=kinds.map(k=>pack.claims.find(c=>c.kind===k)?.id).filter(Boolean);
  const chosen=pack.claims.filter(c=>ids.includes(c.id));
  return {claim_ids:ids,evidence_ids:[...new Set(chosen.flatMap(c=>c.evidence_ids))],overlay_type:chosen.find(c=>c.overlay_type!=='none')?.overlay_type??'none'};
}

export function renderFactPlan(pack,plan,request,extra={}){
  const limit=pack.claims.find(c=>c.kind==='limits');
  let selectedIds=request.audience==='fan'?plan.claim_ids.filter(id=>pack.claims.some(c=>c.id===id&&c.kind!=='limits')).slice(0,1):plan.claim_ids;
  if(!selectedIds.length&&limit&&plan.claim_ids.includes(limit.id))selectedIds=[limit.id];
  const ids=[...new Set([...selectedIds,...(limit?[limit.id]:[])])];
  const claims=ids.map(id=>pack.claims.find(c=>c.id===id)).filter(Boolean);
  const evidenceIds=new Set([...plan.evidence_ids,...claims.flatMap(c=>c.evidence_ids)]);
  const evidence=pack.evidence.filter(e=>evidenceIds.has(e.id));
  const overlayEvidence=(plan.overlay_type==='event'?evidence.filter(e=>e.status==='event').at(-1):evidence.find(e=>e.status!=='event'&&finite(e.das)))??evidence[0];
  const text=request.audience==='fan'?claims.filter(c=>selectedIds.includes(c.id)).map(c=>c.fanText).join('\n\n'):claims.map(c=>c.text).join('\n\n');
  return {source:'offline-template',status:'offline',text,claims,evidence,
    context:pack.context,summary:pack.summary,limitations:pack.limitations,language:request.language,audience:request.audience,
    overlay:{type:plan.overlay_type,frameId:overlayEvidence?.frameId??pack.context.analysisFrameId,playerIds:[request.playerId]},
    cloud:{configured:false,verified:false},wording:'Verified factual clauses selected and ordered by the cloud model when available; deterministic wording and numbers.',...extra};
}
