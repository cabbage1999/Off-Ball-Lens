import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {SCENARIOS,generateScenario,MOTION_LIMITS} from '../src/scenarios.mjs';

const norm=(x,y)=>Math.hypot(x,y);
const close=(a,b,tolerance=1e-7)=>Math.abs(a-b)<=tolerance;
const dist=(a,b)=>norm(a.x-b.x,a.y-b.y);
const round=value=>Number(value.toFixed(6));
const hash=value=>createHash('sha256').update(value).digest('hex');
const median=values=>{const a=[...values].sort((x,y)=>x-y);return(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2;};

/** Closest distance along simultaneous linear chords; acceleration sag is bounded separately. */
function chordClearance(a0,a1,b0,b1){
  const rx=a0.x-b0.x,ry=a0.y-b0.y,dx=a1.x-b1.x-rx,dy=a1.y-b1.y-ry;
  const denominator=dx*dx+dy*dy;
  const u=denominator?Math.max(0,Math.min(1,-(rx*dx+ry*dy)/denominator)):0;
  return {distance:norm(rx+u*dx,ry+u*dy),fraction:u};
}

export function geometricallyOffside(frame,playerId){
  const player=frame.players.find(p=>p.id===playerId),direction=player.team==='A'?1:-1;
  const defenders=frame.players.filter(p=>p.team!==player.team).map(p=>p.x*direction).sort((a,b)=>b-a);
  return player.x*direction>Math.max(0,frame.ball.x*direction,defenders[1])+1e-7;
}

/** Extend a ground-shot velocity to the attacked goal line; this is geometry only. */
export function shotGoalLineProjection(frame){
  const direction=frame.attackingTeam==='A'?1:-1,goalX=direction*52.5;
  const goalward=frame.ball.vx*direction>0;
  const timeToLine=goalward?(goalX-frame.ball.x)/frame.ball.vx:null;
  const y=goalward?frame.ball.y+frame.ball.vy*timeToLine:null;
  return {goalX,y,timeToLine,goalHalfWidth:3.66,groundShot:frame.ball.z===0,goalward,onTarget:goalward&&timeToLine>0&&Math.abs(y)<=3.66&&frame.ball.z===0};
}

export function auditScenario(scene){
  const {metadata,frames,events}=scene,issues=[];
  const check=(condition,message)=>{if(!condition)issues.push(message);};
  const ids=['A','B'].flatMap(team=>Array.from({length:11},(_,i)=>`${team}${i+1}`));
  const motion=Object.fromEntries(ids.map(id=>[id,{id,team:id[0],distance:0,integratedSpeed:0,maxSpeed:0,maxAcceleration:0,stationaryFrames:0}]));
  let minPlayerSeparation=Infinity,closestPair=null,maxPositionResidual=0,maxBallSpeed=0,maxPossessedFootDistance=0;
  check(metadata.synthetic===true,'Data must explicitly be synthetic');
  check(metadata.duration>=25&&metadata.duration<=40,'Duration outside 25–40 seconds');
  check(metadata.sampleRate===10&&frames.length===metadata.duration*10+1,'Incorrect 10 Hz sampling');
  check(metadata.pitch.originX===-52.5&&metadata.pitch.originY===-34,'Incorrect centred coordinate origin');
  check(metadata.stages.length>=5&&metadata.stages.length<=8,'Expected 5–8 tactical phases');
  check(new Set(frames.map(f=>f.frameId)).size===frames.length,'Duplicate frame IDs');
  check(new Set(events.map(e=>e.id)).size===events.length,'Duplicate event IDs');
  for(const stage of metadata.stages){
    check(stage.startTime<stage.endTime,'Invalid stage interval');
    check(ids.every(id=>typeof stage.roles[id]?.reason==='string'&&stage.roles[id].reason.length>10),`Missing role action in ${stage.id}`);
  }
  for(let i=0;i<frames.length;i++){
    const f=frames[i],previous=frames[i-1],dt=previous?f.t-previous.t:0;
    check(f.index===i&&close(f.t,i/10)&&f.frameId===`${metadata.id}:${String(i).padStart(4,'0')}`,`Frame/time mismatch at ${i}`);
    check(f.periodId===1&&f.gameMode==='open_play',`Frame state missing at ${i}`);
    check(f.players.length===22&&f.players.map(p=>p.id).join(',')===ids.join(','),`Roster mismatch at ${i}`);
    check(f.attackDirection===(f.attackingTeam==='A'?1:-1),`Direction mismatch at ${i}`);
    check(['possessed','in_flight','loose','dead'].includes(f.ball.state),`Unknown ball state at ${i}`);
    check(['x','y','vx','vy','z'].every(key=>Number.isFinite(f.ball[key])),`Non-finite ball at ${i}`);
    check(Math.abs(f.ball.x)<=52.5&&Math.abs(f.ball.y)<=34&&f.ball.z>=0,`Ball outside pitch at ${i}`);
    maxBallSpeed=Math.max(maxBallSpeed,norm(f.ball.vx,f.ball.vy));
    if(f.ball.state==='possessed'){
      const p=f.players.find(p=>p.id===f.carrierId);
      check(Boolean(p),`Missing carrier at ${i}`);
      if(p){maxPossessedFootDistance=Math.max(maxPossessedFootDistance,dist(p,f.ball));check(p.team===f.attackingTeam,`Wrong carrier team at ${i}`);check(dist(p,f.ball)<=.5,`Ball detached from carrier at ${i}`);check(close(p.vx,f.ball.vx)&&close(p.vy,f.ball.vy),`Carried-ball velocity mismatch at ${i}`);}
    }else check(f.carrierId===null,`Uncontrolled ball has a carrier at ${i}`);
    for(let j=0;j<f.players.length;j++){
      const p=f.players[j],stats=motion[p.id],speed=norm(p.vx,p.vy);
      check(['x','y','vx','vy'].every(key=>Number.isFinite(p[key])),`Non-finite player ${p.id} at ${i}`);
      check(Math.abs(p.x)<=52.5&&Math.abs(p.y)<=34,`${p.id} outside pitch at ${i}`);
      check(speed<=MOTION_LIMITS.maxSpeed+1e-7,`${p.id} exceeds speed at ${i}`);
      if(p.number===1)check(p.role==='goalkeeper'&&speed<=MOTION_LIMITS.goalkeeperMaxSpeed+1e-7,`Keeper role/speed at ${i}`);
      stats.maxSpeed=Math.max(stats.maxSpeed,speed);if(speed<.2)stats.stationaryFrames++;
      if(previous){
        const q=previous.players[j],acceleration=norm(p.vx-q.vx,p.vy-q.vy)/dt;
        stats.distance+=dist(p,q);stats.integratedSpeed+=(norm(q.vx,q.vy)+speed)*dt/2;stats.maxAcceleration=Math.max(stats.maxAcceleration,acceleration);
        const residual=norm(p.x-q.x-(p.vx+q.vx)*dt/2,p.y-q.y-(p.vy+q.vy)*dt/2);
        maxPositionResidual=Math.max(maxPositionResidual,residual);
        check(acceleration<=MOTION_LIMITS.maxAcceleration+1e-6,`${p.id} exceeds vector acceleration at ${i}`);
        check(residual<1e-7,`${p.id} position/velocity integration mismatch at ${i}`);
      }
      for(let k=j+1;k<f.players.length;k++){
        const other=f.players[k];
        const bound=previous?chordClearance(previous.players[j],p,previous.players[k],other).distance-MOTION_LIMITS.maxAcceleration*dt*dt/4:dist(p,other);
        if(bound<minPlayerSeparation){minPlayerSeparation=bound;closestPair={frameId:f.frameId,t:f.t,players:[p.id,other.id]};}
      }
    }
    if(previous?.ball.state==='in_flight'){
      check(close(f.ball.x,previous.ball.x+previous.ball.vx*dt)&&close(f.ball.y,previous.ball.y+previous.ball.vy*dt),`Ball flight discontinuity before ${f.frameId}`);
    }
    if(previous?.carrierId&&previous.carrierId===f.carrierId){
      check(close(f.ball.x-previous.ball.x,(f.ball.vx+previous.ball.vx)*dt/2)&&close(f.ball.y-previous.ball.y,(f.ball.vy+previous.ball.vy)*dt/2),`Carried ball jumps at ${f.frameId}`);
    }
  }
  check(minPlayerSeparation>=.8,`Player separation below 0.8 m: ${minPlayerSeparation}`);
  check(maxBallSpeed<=30,`Ball speed exceeds 30 m/s: ${maxBallSpeed}`);
  const flights=[];
  for(const event of events){
    const f=frames[event.frameIndex];
    check(Boolean(f)&&close(f.t,event.t)&&f.frameId===event.frameId,`Event/frame mismatch ${event.id}`);
    check(ids.includes(event.playerId),`Unknown event player ${event.id}`);
    check(event.releaseFrameId&&event.passId,`Missing release linkage ${event.id}`);
    if(!['pass','shot'].includes(event.type))continue;
    const arrivals=events.filter(e=>e.passId===event.passId&&!['pass','shot'].includes(e.type));
    check(arrivals.length===1,`Missing/duplicate arrival ${event.passId}`);if(arrivals.length!==1)continue;
    const arrival=arrivals[0],last=frames[arrival.frameIndex],from=f.players.find(p=>p.id===event.playerId),to=last.players.find(p=>p.id===arrival.playerId);
    check(arrival.t>event.t&&arrival.releaseFrameId===f.frameId,`Arrival linkage invalid ${event.passId}`);
    check(frames[event.frameIndex-1]?.carrierId===event.playerId,`Releasing player did not possess ${event.passId}`);
    check(f.carrierId===null&&f.ball.state==='in_flight'&&dist(from,f.ball)<=.5,`Invalid release ${event.passId}`);
    check(last.carrierId===arrival.playerId&&last.ball.state==='possessed'&&dist(to,last.ball)<=.5,`Invalid arrival ${event.passId}`);
    check(last.attackingTeam===arrival.playerId[0],`Team did not follow reception ${event.passId}`);
    if(arrival.type==='reception')check(event.targetId===arrival.playerId,`Reception differs from intended target ${event.passId}`);
    if(event.type==='pass'&&event.targetId?.[0]===event.playerId[0])check(!geometricallyOffside(f,event.targetId),`Authored pass targets an offside player ${event.passId}`);
    let minimumOpponentClearance=Infinity,minimumNonParticipantClearance=Infinity,closest=null;
    for(let i=event.frameIndex;i<arrival.frameIndex;i++){
      const a=frames[i],b=frames[i+1],dt=b.t-a.t;
      check(a.ball.state==='in_flight'&&a.carrierId===null&&a.ball.passId===event.passId&&a.ball.releaseFrameId===event.frameId,`Flight state/link mismatch ${event.passId} at ${i}`);
      for(let j=0;j<22;j++){
        const p=a.players[j];if([event.playerId,arrival.playerId].includes(p.id))continue;
        const result=chordClearance(a.ball,b.ball,p,b.players[j]);
        const bound=result.distance-MOTION_LIMITS.maxAcceleration*dt*dt/8;
        if(bound<minimumNonParticipantClearance){minimumNonParticipantClearance=bound;closest={playerId:p.id,t:round(a.t+result.fraction*dt)};}
        if(p.team!==event.playerId[0])minimumOpponentClearance=Math.min(minimumOpponentClearance,bound);
      }
    }
    // A geometry audit, not a learned control/interception probability. At these
    // speeds a player can still challenge a pass outside the declared exclusion.
    check(minimumNonParticipantClearance>=1.2,`Ball crosses a non-participant 1.2 m exclusion zone on ${event.passId}: ${minimumNonParticipantClearance}`);
    const item={passId:event.passId,releaseType:event.type,from:event.playerId,intendedTarget:event.targetId,actualReceiver:arrival.playerId,outcome:arrival.type,releaseTime:event.t,arrivalTime:arrival.t,speed:round(norm(f.ball.vx,f.ball.vy)),minimumOpponentClearance:round(minimumOpponentClearance),minimumNonParticipantClearance:round(minimumNonParticipantClearance),closest};
    if(event.type==='shot'){
      const projection=shotGoalLineProjection(f);
      item.shotGoalLineProjection={...projection,y:projection.y===null?null:round(projection.y),timeToLine:projection.timeToLine===null?null:round(projection.timeToLine)};
      check(projection.onTarget,`Saved shot misses the goal mouth when extended: ${event.passId} (goal-line y=${projection.y})`);
      check(projection.timeToLine>arrival.t-event.t,`Shot reaches the goal line before its save: ${event.passId}`);
      check(frames.slice(event.frameIndex,arrival.frameIndex+1).every(frame=>frame.ball.z===0),`Ground-shot geometry audit received an aerial shot: ${event.passId}`);
    }
    if(arrival.type==='interception'){
      const intended=last.players.find(p=>p.id===event.targetId);
      const intendedLane=chordClearance(f.ball,{x:intended.x+.35,y:intended.y+.12},last.ball,last.ball);
      const speedSquared=f.ball.vx*f.ball.vx+f.ball.vy*f.ball.vy;
      const rayTime=Math.max(0,((intended.x-f.ball.x)*f.ball.vx+(intended.y-f.ball.y)*f.ball.vy)/speedSquared);
      item.interceptionDistanceFromIntendedLane=round(intendedLane.distance);
      item.interceptionDistanceDefinition='Ball-contact point to the segment from release to the intended target foot at interception time; not target-to-actual-ray error.';
      item.intendedTargetDistanceFromActualBallRay=round(norm(intended.x-f.ball.x-f.ball.vx*rayTime,intended.y-f.ball.y-f.ball.vy*rayTime));
      item.intendedTargetDistanceDefinition=`Intended player centre at ${last.frameId} to the forward extension of the actual released-ball velocity.`;
      item.interceptionModel='Authored misdirected pass and interception; no calibrated execution-error, anticipation, reaction, or technical-skill model.';
      check(arrival.playerId[0]!==event.playerId[0]&&event.targetId[0]===event.playerId[0],`Interception team/intent mismatch ${event.passId}`);
    }
    flights.push(item);
  }
  const players=Object.values(motion).map(({integratedSpeed,stationaryFrames,...p})=>({...p,distance:round(p.distance),meanSpeed:round(integratedSpeed/metadata.duration),maxSpeed:round(p.maxSpeed),maxAcceleration:round(p.maxAcceleration),stationaryFraction:round(stationaryFrames/frames.length)}));
  const offsideFrames=frames.filter(f=>f.attackingTeam==='A'&&geometricallyOffside(f,metadata.targetId));
  const offsideIntervals=[];
  for(const f of offsideFrames){const last=offsideIntervals.at(-1);if(last&&close(f.t-last.endTime,.1)){last.endTime=f.t;last.endFrameId=f.frameId;}else offsideIntervals.push({startTime:f.t,startFrameId:f.frameId,endTime:f.t,endFrameId:f.frameId});}
  return {scenarioId:metadata.id,status:issues.length?'failed':'passed',issues,frames:frames.length,events:events.length,stages:metadata.stages.length,minimumPlayerSeparationLowerBound:round(minPlayerSeparation),closestPlayerPair:closestPair,maxPositionIntegrationResidual:maxPositionResidual,maxPlayerSpeed:round(Math.max(...players.map(p=>p.maxSpeed))),maxVectorAcceleration:round(Math.max(...players.map(p=>p.maxAcceleration))),maxBallSpeed:round(maxBallSpeed),maxPossessedBallDistance:round(maxPossessedFootDistance),players,distribution:{meanOfMeanSpeeds:round(players.reduce((sum,p)=>sum+p.meanSpeed,0)/22),medianMeanSpeed:round(median(players.map(p=>p.meanSpeed))),playersBelowMeanSpeedPointFive:players.filter(p=>p.meanSpeed<.5).map(p=>p.id),outfieldDistanceRange:[Math.min(...players.filter(p=>!['A1','B1'].includes(p.id)).map(p=>p.distance)),Math.max(...players.filter(p=>!['A1','B1'].includes(p.id)).map(p=>p.distance))]},flights,targetGeometricOffsideIntervals:offsideIntervals};
}

async function main(){
  const results=[];
  for(const spec of SCENARIOS){
    const bytes=await readFile(new URL(`../data/${spec.id}.json`,import.meta.url)),scene=JSON.parse(bytes);
    const result=auditScenario(scene);
    if(JSON.stringify(scene)!==JSON.stringify(generateScenario(spec.id,scene.metadata.seed))){result.issues.push('Export differs from current generator');result.status='failed';}
    results.push({...result,inputSha256:hash(bytes)});
  }
  const report={schemaVersion:'2.0',generatedAt:new Date().toISOString(),generatorVersion:'tactical-state-v2.0.1',generatorSha256:hash(await readFile(new URL('../src/scenarios.mjs',import.meta.url))),dataSource:'Independently authored synthetic tactical scripts. No match-data source, borrowed scene code, or AS/DAS score drives motion.',scope:'Reproducible structural, kinematic, continuous-chord separation and event audit. This is not a professional football-realism validation or an interception-success model.',thresholds:{maxPlayerSpeed:7.6,maxVectorAcceleration:3.2,maxGoalkeeperSpeed:4.5,maxBallSpeed:30,minimumPlayerSeparation:.8,minimumPassNonParticipantClearance:1.2,goalHalfWidth:3.66,shotRequirement:'Ground-shot ray crosses the attacked goal mouth after the save point',units:'metres, seconds',continuousBound:'Linear-chord minima minus the maximum constant-acceleration sag: a*dt²/8 for one player, a*dt²/4 for two.'},results};
  await mkdir(new URL('../data/',import.meta.url),{recursive:true});
  await writeFile(new URL('../data/validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  for(const result of results)console.log(`${result.scenarioId}: ${result.status}; ${result.frames} frames; ${result.events} events; max speed ${result.maxPlayerSpeed} m/s; min separation ${result.minimumPlayerSeparationLowerBound} m; ${result.issues.length} issues`);
  if(results.some(result=>result.issues.length)){for(const result of results)for(const issue of result.issues)console.error(`${result.scenarioId}: ${issue}`);process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
