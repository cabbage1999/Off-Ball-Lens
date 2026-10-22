import { frameAt, stepMotion, MOTION_LIMITS } from './scenarios.mjs';

export const MODEL_VERSION = 'receiving-index-v1.3';
export const DEFAULT_PARAMS = Object.freeze({
  ballSpeed: 15, reactionTime: .35, receiverReactionTime: .1,
  maxSpeed: MOTION_LIMITS.maxSpeed, maxAcceleration: MOTION_LIMITS.maxAcceleration,
  maxPassTime: 2.5, controlRadius: 1.2, interceptionRadius: .8,
  laneScale: .35, readinessScale: .35, centralityWeight: .4,
  laneSamples: 12, laneSpacing: 1, integrationStep: .05
});
export const LIMITATIONS = Object.freeze([
  'A geometric receiving-opportunity index, not a calibrated success, goal, xG or EPV probability.',
  'Current-frame estimates use positions and velocities only. Receiver readiness uses a feasible controller and its final uninterrupted residence in the control radius.',
  'Defender times are optimistic lower bounds: reaction-phase drift, then instantaneous alignment of current speed with the target and acceleration to the speed cap. Ignoring turn costs can conservatively flag impossible interceptions.',
  'A negative sampled optimistic lane margin means an interception cannot be ruled out; it does not prove the defender can execute it. Positive sampled margins do not certify the unsampled continuous line.',
  'The counterfactual is retrospective: the other players follow the same recorded trajectories in both branches.',
  'No claim of real-match causation, defender attraction, indirect space creation or total team contribution.',
  'Finite receiver candidates and the specified controller can miss feasible options; sampled lane minima are approximate, not safety certificates.',
  'Straight ground passes only; no body orientation, ball spin, aerial play or subsequent actions.',
  'Sensitivity ranges are assumption checks, not statistical confidence intervals.'
]);
const EPS = 1e-8;
const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b,x));
const hypot = (a,b) => Math.hypot(a,b);
const sigmoid = x => 1/(1+Math.exp(-clamp(x,-40,40)));
const round = (x,places=3) => Number(x.toFixed(places));
const finite = (v,name) => { if (!Number.isFinite(v)) throw new TypeError(`${name} must be finite`); return v; };

export function resolveParams(params = {}) {
  const p = {...DEFAULT_PARAMS,...params};
  for (const key of Object.keys(DEFAULT_PARAMS)) finite(p[key],key);
  for (const key of ['ballSpeed','maxSpeed','maxAcceleration','maxPassTime','controlRadius','interceptionRadius','laneScale','readinessScale','laneSpacing','integrationStep']) if (p[key]<=0) throw new RangeError(`${key} must be positive`);
  if (p.reactionTime<0 || p.receiverReactionTime<0 || p.centralityWeight<0 || p.centralityWeight>1) throw new RangeError('Invalid reaction time or centrality weight');
  if (p.laneSamples<4 || p.laneSamples>60 || !Number.isInteger(p.laneSamples) || p.laneSpacing<.25 || p.laneSpacing>2 || p.integrationStep<.01 || p.integrationStep>.1 || p.maxPassTime>3) throw new RangeError('Sampling or pass horizon outside supported range');
  return p;
}

function pitchOf(frame) { return {originX:0,originY:0,...frame.pitch}; }
export function validateSnapshot(frame) {
  if(!frame||!Array.isArray(frame.players)||!frame.players.length||![1,-1].includes(frame.attackDirection)||!frame.ball)throw new TypeError('Invalid tracking snapshot');
  const pitch=pitchOf(frame);
  for(const key of ['originX','originY','length','width'])finite(pitch[key],`pitch.${key}`);
  if(pitch.length<=0||pitch.width<=0)throw new RangeError('Invalid pitch dimensions');
  finite(frame.t,'frame.t');
  const ids=new Set();
  for(const player of frame.players){
    if(typeof player.id!=='string'||ids.has(player.id)||typeof player.team!=='string')throw new TypeError('Invalid or duplicate player identity');
    ids.add(player.id);for(const key of ['x','y','vx','vy'])finite(player[key],`${player.id}.${key}`);
    if(!inPitch(player,pitch))throw new RangeError('Tracking player is outside the pitch');
  }
  for(const key of ['x','y','vx','vy'])finite(frame.ball[key],`ball.${key}`);
  if(frame.carrierId&&!ids.has(frame.carrierId))throw new TypeError('Unknown carrier in tracking');
  return frame;
}
export function inPitch(point,pitch) {
  const {originX=0,originY=0,length,width}=pitch;
  return point.x>=originX-EPS && point.x<=originX+length+EPS && point.y>=originY-EPS && point.y<=originY+width+EPS;
}
export function progressX(x, frame) {
  const pitch = pitchOf(frame), local = x-pitch.originX;
  return frame.attackDirection === -1 ? pitch.length-local : local;
}

/** Positional offside filter only, at the current hypothetical kick instant. */
export function checkOffside(frame, playerId) {
  validateSnapshot(frame);
  const player = frame.players.find(p=>p.id===playerId);
  if (!player) throw new RangeError(`Unknown player: ${playerId}`);
  const opponents = frame.players.filter(p=>p.team!==player.team);
  const ordered = opponents.map(p=>({id:p.id,progress:progressX(p.x,frame)})).sort((a,b)=>b.progress-a.progress);
  const second = ordered[1]?.progress ?? pitchOf(frame).length;
  const ball = progressX(frame.ball.x,frame), playerProgress = progressX(player.x,frame);
  const halfway = pitchOf(frame).length/2;
  const line = Math.max(ball,second,halfway);
  const offside = playerProgress>halfway+EPS && playerProgress>ball+EPS && playerProgress>second+EPS;
  return {offside,legal:!offside,playerProgress,ballProgress:ball,secondLastDefenderProgress:second,
    secondLastDefenderId:ordered[1]?.id??null,lineProgress:line,
    lineX:frame.attackDirection===-1?pitchOf(frame).originX+pitchOf(frame).length-line:pitchOf(frame).originX+line,
    note:'Point-player positional screen at hypothetical release; level and own-half positions are onside. It is not an officiating or involvement decision.'};
}

/** Identical local grid in every branch; velocity changes reachability, not search extent. */
export function candidatePoints(frame, player) {
  const d = frame.attackDirection;
  const offsets = [[0,0],[3,0],[6,0],[-3,0],[0,-3],[0,3],[3,-3],[3,3]];
  return offsets.map(([dx,dy],index)=>({id:`g${index}`,x:player.x+d*dx,y:player.y+dy}));
}

function pointSegmentDistance(point,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const f=den>0?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/den):0;
  return hypot(point.x-a.x-f*dx,point.y-a.y-f*dy);
}

/** A constructive, acceleration-limited controller estimate, not minimum-time control. */
export function arrivalEstimate(player, target, params = {}, options = {}) {
  const p = {...DEFAULT_PARAMS,...params};
  const reaction = options.reactionTime ?? p.reactionTime;
  const radius = options.radius ?? p.interceptionRadius;
  const limit = options.maxTime ?? p.maxPassTime+1.5;
  const settle = options.settle ?? false;
  let state={...player}, t=0;
  const initiallyInside=hypot(state.x-target.x,state.y-target.y)<=radius+EPS;
  let firstArrival=initiallyInside?0:Infinity, continuousArrival=initiallyInside?0:Infinity;
  while (t<limit-EPS) {
    const dt=Math.min(p.integrationStep,limit-t, t<reaction-EPS ? reaction-t : Infinity);
    let desired={vx:state.vx,vy:state.vy};
    if (t>=reaction-EPS) {
      const dx=target.x-state.x,dy=target.y-state.y,dist=hypot(dx,dy);
      const speed=settle?Math.min(p.maxSpeed,Math.sqrt(2*p.maxAcceleration*Math.max(0,dist-radius*.45))):p.maxSpeed;
      desired=dist<EPS?{vx:0,vy:0}:{vx:speed*dx/dist,vy:speed*dy/dist};
    }
    const next=stepMotion(state,desired,dt,p);
    if (!Number.isFinite(firstArrival) && pointSegmentDistance(target,state,next)<=radius) firstArrival=t+dt;
    const nextInside=hypot(next.x-target.x,next.y-target.y)<=radius+EPS;
    // A receiver can leave and return. Only its final uninterrupted residence
    // supports a readiness surplus; an earlier, abandoned contact does not.
    if(!nextInside)continuousArrival=Infinity;
    else if(!Number.isFinite(continuousArrival))continuousArrival=t+dt;
    state=next;t+=dt;
    if (!settle && Number.isFinite(firstArrival)) break;
  }
  return {time:settle?continuousArrival:firstArrival,firstContactTime:firstArrival,position:{x:state.x,y:state.y},velocity:{vx:state.vx,vy:state.vy},atTarget:hypot(state.x-target.x,state.y-target.y)<=radius+EPS};
}

/**
 * Optimistic lower bound on defender time to a target control disc.
 * During reaction the velocity is fixed, so disc contact is solved exactly.
 * Afterwards any path needs at least ||target-q||-radius metres and its speed
 * cannot exceed min(vmax, |v0|+a*t). Integrating this speed envelope and inverting
 * it gives a lower bound even though instantaneous heading alignment is unreal.
 * This deliberately favors defenders; it is not a feasible pursuit trajectory.
 */
export function defenderArrivalLowerBound(player,target,params={}) {
  const p={...DEFAULT_PARAMS,...params},tau=p.reactionTime,radius=p.interceptionRadius;
  const dx=player.x-target.x,dy=player.y-target.y,speed=hypot(player.vx,player.vy);
  if(speed>p.maxSpeed+EPS)throw new RangeError('Defender initial speed exceeds the assumed speed cap');
  const c=dx*dx+dy*dy-radius*radius;
  if(c<=EPS)return {time:0,phase:'reaction',model:'optimistic_lower_bound'};
  if(speed>EPS){
    const a=speed*speed,b=2*(dx*player.vx+dy*player.vy),discriminant=b*b-4*a*c;
    // Tangencies have a zero discriminant. Translation/rotation roundoff can
    // turn that into a tiny negative value; omitting contact would invalidate
    // the optimistic bound. A scale-aware tolerance favors conservative contact.
    const discriminantTolerance=64*Number.EPSILON*Math.max(1,b*b,4*a*Math.abs(c));
    if(discriminant>=-discriminantTolerance){
      const entry=(-b-Math.sqrt(Math.max(0,discriminant)))/(2*a);
      if(entry>=-EPS&&entry<=tau+EPS)return {time:Math.min(tau,Math.max(0,entry)),phase:'reaction',model:'optimistic_lower_bound'};
    }
  }
  const q={x:player.x+tau*player.vx,y:player.y+tau*player.vy};
  const distance=Math.max(0,hypot(target.x-q.x,target.y-q.y)-radius);
  const cap=p.maxSpeed,a=p.maxAcceleration;
  const accelerationTime=(cap-speed)/a,accelerationDistance=(cap*cap-speed*speed)/(2*a);
  const travel=distance<=accelerationDistance+EPS?(Math.sqrt(speed*speed+2*a*distance)-speed)/a:accelerationTime+(distance-accelerationDistance)/cap;
  return {time:tau+travel,phase:'post_reaction',model:'optimistic_lower_bound'};
}

export function regionUtility(point, frame, params = {}) {
  const p={...DEFAULT_PARAMS,...params},pitch=pitchOf(frame);
  const progress=clamp(progressX(point.x,frame)/pitch.length);
  const centrality=clamp(1-Math.abs(point.y-pitch.originY-pitch.width/2)/(pitch.width/2));
  return clamp(progress**2*((1-p.centralityWeight)+p.centralityWeight*centrality));
}

/** Uniform spacing plus geometrically relevant disc projections/boundaries. */
function laneFractions(ball,target,defenders,params) {
  const dx=target.x-ball.x,dy=target.y-ball.y,lengthSquared=dx*dx+dy*dy,length=Math.sqrt(lengthSquared);
  const intervals=Math.max(params.laneSamples,Math.ceil(length/params.laneSpacing));
  const fractions=new Set(Array.from({length:intervals+1},(_,k)=>k/intervals));
  const add=f=>{if(f>=-EPS&&f<=1+EPS)fractions.add(clamp(f));};
  for(const defender of defenders){
    const centres=[defender,{x:defender.x+params.reactionTime*defender.vx,y:defender.y+params.reactionTime*defender.vy}];
    for(const centre of centres){
      const projection=((centre.x-ball.x)*dx+(centre.y-ball.y)*dy)/lengthSquared;
      fractions.add(clamp(projection));
      const px=ball.x+projection*dx,py=ball.y+projection*dy;
      const perpendicularSquared=(centre.x-px)**2+(centre.y-py)**2,radiusSquared=params.interceptionRadius**2;
      const offsetSquared=radiusSquared-perpendicularSquared;
      const tolerance=64*Number.EPSILON*Math.max(1,radiusSquared,perpendicularSquared);
      if(offsetSquared>=-tolerance){
        const offset=Math.sqrt(Math.max(0,offsetSquared))/length;
        add(projection-offset);add(projection+offset);
      }
    }
  }
  return [...fractions].sort((a,b)=>a-b);
}

export function analyzeFrame(frame, playerId='A7', params={}) {
  validateSnapshot(frame);
  const p=resolveParams(params), player=frame.players.find(x=>x.id===playerId);
  if (!player) throw new RangeError(`Unknown player: ${playerId}`);
  const base={version:MODEL_VERSION,frameIndex:frame.index,t:frame.t,playerId,index:0,score:0,eligible:false,components:{U:0,R:0,B:0,O:0},best:null,candidates:[],params:p};
  if (frame.carrierId===playerId) return {...base,reason:'ball_carrier'};
  if (!frame.carrierId || frame.ball.state!=='possessed') return {...base,reason:'no_controlled_possession'};
  if (player.team!==frame.attackingTeam) return {...base,reason:'not_attacking_team'};
  const offside=checkOffside(frame,playerId), defenders=frame.players.filter(x=>x.team!==player.team);
  const candidates=candidatePoints(frame,player).map(g=>{
    const result={...g,U:regionUtility(g,frame,p),R:0,B:0,O:offside.legal?1:0,index:0,score:0,reachable:false,accepted:false,
      ballArrival:hypot(g.x-frame.ball.x,g.y-frame.ball.y)/p.ballSpeed,receiverArrival:null,receiverMargin:null,laneMargin:null,critical:null};
    if (!inPitch(g,pitchOf(frame))) return {...result,rejection:'out_of_bounds'};
    if (result.ballArrival>p.maxPassTime+EPS || result.ballArrival<.05) return {...result,rejection:'pass_horizon'};
    const receiving=arrivalEstimate(player,g,p,{reactionTime:p.receiverReactionTime,radius:p.controlRadius,maxTime:result.ballArrival,settle:true});
    result.receiverArrival=Number.isFinite(receiving.time)?receiving.time:null;
    result.receiverMargin=Number.isFinite(receiving.time)?result.ballArrival-receiving.time:null;
    result.reachable=receiving.atTarget && Number.isFinite(receiving.time) && receiving.time<=result.ballArrival+EPS;
    result.receiverAtArrival=receiving.position;
    if (!result.reachable) return {...result,rejection:'receiver_unreachable'};
    result.R=sigmoid((result.receiverMargin-.1)/p.readinessScale);
    let minMargin=Infinity,critical=null;
    const fractions=laneFractions(frame.ball,g,defenders,p);
    result.laneSampleCount=fractions.length;
    for (const f of fractions) {
      const z={x:frame.ball.x+(g.x-frame.ball.x)*f,y:frame.ball.y+(g.y-frame.ball.y)*f};
      const ballTime=result.ballArrival*f;
      for (const defender of defenders) {
        const intercept=defenderArrivalLowerBound(defender,z,p);
        const defenderTime=intercept.time;
        const margin=defenderTime-ballTime;
        if (margin<minMargin-EPS) {minMargin=margin;critical={...z,defenderId:defender.id,ballTime,defenderTime,defenderTimeLowerBound:defenderTime,margin,capped:false,arrivalModel:intercept.model};}
      }
    }
    result.laneMargin=Number.isFinite(minMargin)?minMargin:null;
    result.critical=critical;result.B=critical?sigmoid(minMargin/p.laneScale):1;
    result.accepted=offside.legal;result.rejection=offside.offside?'offside':null;
    result.index=100*result.O*result.U*result.R*result.B;result.score=result.index;
    return result;
  });
  const feasible=candidates.filter(g=>g.reachable);
  const best=feasible.reduce((best,g)=>!best||g.index>best.index+EPS?g:best,null);
  return {...base,eligible:offside.legal,reason:offside.offside?'offside':best?'available':'no_reachable_candidate',offside,
    candidates,best,index:best?.index??0,score:best?.index??0,components:best?{U:best.U,R:best.R,B:best.B,O:best.O}:{U:0,R:0,B:0,O:offside.legal?1:0}};
}

export function teamBest(frame,params={}) {
  const scored=frame.players.filter(p=>p.team===frame.attackingTeam&&p.id!==frame.carrierId).map(p=>analyzeFrame(frame,p.id,params));
  const best=scored.reduce((a,b)=>!a||b.index>a.index?b:a,null);
  return {index:best?.index??0,playerId:best?.playerId??null};
}

function weightedMean(samples,key) {
  if (!samples.length) return 0;
  if (samples.length===1) return samples[0][key];
  let integral=0;
  for (let i=1;i<samples.length;i++) integral+=(samples[i].t-samples[i-1].t)*(samples[i][key]+samples[i-1][key])/2;
  return integral/(samples.at(-1).t-samples[0].t);
}

export function analyzeWindow(scenario,playerId='A7',startTime=0,endTime=startTime+2.5,params={}) {
  finite(startTime,'startTime');finite(endTime,'endTime');
  if (startTime<0||endTime<startTime||endTime>scenario.metadata.duration+EPS) throw new RangeError('Invalid analysis window');
  const frames=scenario.frames.filter(f=>f.t>=startTime-EPS&&f.t<=endTime+EPS);
  const samples=frames.map(f=>analyzeFrame(f,playerId,params));
  return {playerId,startTime:samples[0]?.t??startTime,endTime:samples.at(-1)?.t??endTime,mode:'retrospective_window',
    meanIndex:weightedMean(samples,'index'),peakIndex:Math.max(0,...samples.map(s=>s.index)),offsideFrames:samples.filter(s=>s.reason==='offside').length,samples,limitations:LIMITATIONS};
}

export function compareRun(scenario,startTime=scenario.metadata.compareStart,horizon=2.5,params={}) {
  finite(startTime,'startTime');finite(horizon,'horizon');
  if (startTime<0||startTime>scenario.metadata.duration||horizon<=0||horizon>3) throw new RangeError('Comparison must start inside the clip and last at most 3 seconds');
  const {playerId=scenario.metadata.targetId,alternative='hold-width',includeTeamBest=false,...modelParams}=params;
  if (!['hold-width','same-route','continue-straight'].includes(alternative)) throw new RangeError('Unknown alternative');
  const p=resolveParams(modelParams),start=frameAt(scenario,startTime),subject=start.players.find(p=>p.id===playerId);
  if (!subject) throw new RangeError(`Unknown player: ${playerId}`);
  const requestedEnd=start.t+horizon;
  const firstEvent=scenario.events.filter(e=>['pass','possession_change','shot'].includes(e.type)&&e.t>=start.t-EPS).sort((a,b)=>a.t-b.t)[0];
  let end=Math.min(requestedEnd,scenario.metadata.duration),stopReason=requestedEnd>scenario.metadata.duration?'clip_end':'horizon';
  if (firstEvent&&firstEvent.t<=end+EPS) {end=firstEvent.t;stopReason=firstEvent.type;}
  const relevant=scenario.frames.filter(f=>f.t>=start.t-EPS&&f.t<=end+EPS&&(!firstEvent||f.t<firstEvent.t-EPS));
  const samples=[],states=[];let alt={...subject},lastT=start.t;
  for (const original of relevant) {
    if (original.carrierId!==start.carrierId || original.ball.state!=='possessed') {stopReason='possession_change';break;}
    if (original.t>start.t+EPS && alternative!=='same-route') {
      const desired=alternative==='hold-width'?{vx:0,vy:0}:{vx:subject.vx,vy:subject.vy};
      alt=stepMotion(alt,desired,original.t-lastT,scenario.metadata.motionLimits??p);
    }
    const observed=original.players.find(p=>p.id===playerId);
    if (alternative==='same-route') alt={...observed};
    if (!inPitch(alt,pitchOf(original))) {stopReason='route_out_of_bounds';break;}
    const branch={...original,players:original.players.map(p=>p.id===playerId?{...alt}:p)};
    const run=analyzeFrame(original,playerId,p),baseline=analyzeFrame(branch,playerId,p);
    const sample={t:original.t,frameIndex:original.index,run:run.index,alternative:baseline.index,delta:run.index-baseline.index,runAnalysis:run,alternativeAnalysis:baseline};
    if (includeTeamBest) {sample.teamRun=teamBest(original,p).index;sample.teamAlternative=teamBest(branch,p).index;sample.teamDelta=sample.teamRun-sample.teamAlternative;}
    samples.push(sample);states.push({t:original.t,run:{...observed},alternative:{...alt}});lastT=original.t;
  }
  const actualEnd=samples.at(-1)?.t??start.t,elapsed=actualEnd-start.t;
  const meanRun=weightedMean(samples,'run'),meanAlternative=weightedMean(samples,'alternative'),meanDelta=weightedMean(samples,'delta');
  const peakSample=samples.reduce((a,b)=>!a||Math.abs(b.delta)>Math.abs(a.delta)?b:a,null);
  const output={version:MODEL_VERSION,scenarioId:scenario.metadata.id,playerId,alternative,mode:'retrospective_fixed_environment',startTime:start.t,requestedStartTime:startTime,requestedEndTime:requestedEnd,endTime:actualEnd,duration:elapsed,stopReason,
    truncated:actualEnd<requestedEnd-EPS,valid:elapsed>0,summary:{meanRun,meanAlternative,meanDelta,peakRun:Math.max(0,...samples.map(s=>s.run)),peakAlternative:Math.max(0,...samples.map(s=>s.alternative)),peakDelta:peakSample?.delta??0,peakTime:peakSample?.t??start.t},
    samples,states,params:p,limitations:LIMITATIONS};
  if (includeTeamBest) output.teamSummary={meanRun:weightedMean(samples,'teamRun'),meanAlternative:weightedMean(samples,'teamAlternative'),meanDelta:weightedMean(samples,'teamDelta')};
  return output;
}

export function sensitivity(scenario,startTime=scenario.metadata.compareStart,horizon=2.5,params={}) {
  const variations=[['baseline',{}],['slower ball',{ballSpeed:(params.ballSpeed??DEFAULT_PARAMS.ballSpeed)*.9}],['faster ball',{ballSpeed:(params.ballSpeed??DEFAULT_PARAMS.ballSpeed)*1.1}],['quicker reaction',{reactionTime:Math.max(0,(params.reactionTime??DEFAULT_PARAMS.reactionTime)-.1)}],['slower reaction',{reactionTime:(params.reactionTime??DEFAULT_PARAMS.reactionTime)+.1}],['less central preference',{centralityWeight:Math.max(0,(params.centralityWeight??DEFAULT_PARAMS.centralityWeight)-.1)}],['more central preference',{centralityWeight:Math.min(1,(params.centralityWeight??DEFAULT_PARAMS.centralityWeight)+.1)}]];
  const results=variations.map(([label,change])=>{const r=compareRun(scenario,startTime,horizon,{...params,...change,includeTeamBest:false});return {label,meanDelta:r.summary.meanDelta,params:change};});
  for(const displacement of [-.25,.25]){
    const playerId=params.playerId??scenario.metadata.targetId;
    const perturbed={...scenario,frames:scenario.frames.map(f=>({...f,players:f.players.map(p=>p.id===playerId?{...p,x:p.x+displacement*f.attackDirection}:p)}))};
    const r=compareRun(perturbed,startTime,horizon,{...params,includeTeamBest:false});
    results.push({label:`receiver position ${displacement>0?'+':''}${displacement.toFixed(2)} m`,meanDelta:r.summary.meanDelta,params:{receiverLongitudinalOffset:displacement}});
  }
  const min=Math.min(...results.map(r=>r.meanDelta)),max=Math.max(...results.map(r=>r.meanDelta));
  return {results,min,max,signStable:!(min<-.05&&max>.05),label:'One-at-a-time assumption range; not a confidence interval.'};
}

export function compactAnalysis(result) {
  return {frameIndex:result.frameIndex,t:result.t,playerId:result.playerId,index:round(result.index),reason:result.reason,
    components:Object.fromEntries(Object.entries(result.components).map(([k,v])=>[k,round(v)])),
    offside:result.offside??null,best:result.best?{x:round(result.best.x),y:round(result.best.y),ballArrival:round(result.best.ballArrival),receiverArrival:result.best.receiverArrival===null?null:round(result.best.receiverArrival),laneMargin:result.best.laneMargin===null?null:round(result.best.laneMargin),critical:result.best.critical}:null};
}
