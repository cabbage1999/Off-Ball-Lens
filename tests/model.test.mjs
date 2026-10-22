import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScenario, frameAt } from '../src/scenarios.mjs';
import { analyzeFrame, checkOffside, compareRun, candidatePoints, arrivalEstimate, defenderArrivalLowerBound, DEFAULT_PARAMS, sensitivity, teamBest } from '../src/model.mjs';

const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const clone=x=>structuredClone(x);
const scene=generateScenario('diagonal');

test('reflection of the pitch and attack direction preserves the index',()=>{
  const original=frameAt(scene,4.1),mirrored=clone(original);
  mirrored.attackDirection=-1;
  mirrored.ball.x=105-original.ball.x;mirrored.ball.vx=-original.ball.vx;
  mirrored.players=original.players.map(p=>({...p,x:105-p.x,vx:-p.vx}));
  const a=analyzeFrame(original),b=analyzeFrame(mirrored);
  close(a.index,b.index);close(a.best.laneMargin,b.best.laneMargin);
  close(a.offside.lineX,105-b.offside.lineX);
});

test('reflection also preserves the whole retrospective route comparison',()=>{
  const mirrored=clone(scene);mirrored.metadata.attackDirection=-1;
  for(const f of mirrored.frames){f.attackDirection=-1;f.ball.x=105-f.ball.x;f.ball.vx=-f.ball.vx;f.players=f.players.map(p=>({...p,x:105-p.x,vx:-p.vx}));}
  close(compareRun(scene).summary.meanDelta,compareRun(mirrored).summary.meanDelta);
});

test('translation with the coordinate origin preserves every component',()=>{
  const original=frameAt(scene,4),shifted=clone(original),dx=-73.25,dy=203.5;
  shifted.pitch.originX=dx;shifted.pitch.originY=dy;
  shifted.ball.x+=dx;shifted.ball.y+=dy;
  shifted.players=shifted.players.map(p=>({...p,x:p.x+dx,y:p.y+dy}));
  const a=analyzeFrame(original),b=analyzeFrame(shifted);
  close(a.index,b.index);for(const k of ['U','R','B','O'])close(a.components[k],b.components[k]);
});

test('identical routes have exactly zero counterfactual difference',()=>{
  const r=compareRun(scene,2.5,2.5,{alternative:'same-route'});
  assert.equal(r.summary.meanDelta,0);assert.ok(r.samples.every(s=>s.delta===0));
});

test('the ball carrier is excluded and flight has no current receiving opportunity',()=>{
  const f=frameAt(scene,4);
  assert.equal(analyzeFrame(f,f.carrierId).reason,'ball_carrier');
  assert.equal(analyzeFrame(f,f.carrierId).index,0);
  assert.equal(analyzeFrame(frameAt(scene,8)).reason,'no_controlled_possession');
});

test('offside uses receiver position at release, ball, second-last opponent, halfway and level rule',()=>{
  const f=clone(frameAt(scene,4));
  for(const d of f.players.filter(p=>p.team==='B')) d.x=40;
  f.players.find(p=>p.id==='B1').x=103;f.players.find(p=>p.id==='B2').x=80;
  const a=f.players.find(p=>p.id==='A7');
  a.x=80;f.ball.x=60;assert.equal(checkOffside(f,'A7').offside,false,'level with second-last opponent');
  a.x=80.01;assert.equal(checkOffside(f,'A7').offside,true);
  f.ball.x=83;assert.equal(checkOffside(f,'A7').offside,false,'behind the ball');
  f.ball.x=30;f.players.find(p=>p.id==='B2').x=45;a.x=50;
  assert.equal(checkOffside(f,'A7').offside,false,'own half');
  a.x=79;f.ball.x=60;f.players.find(p=>p.id==='B2').x=80;
  assert.equal(checkOffside(f,'A7').offside,false,'a future candidate beyond the line must not change release legality');
  assert.ok(candidatePoints(f,a).some(g=>g.x>80));
  a.x=83;f.ball.x=83;assert.equal(checkOffside(f,'A7').offside,false,'level with ball');
  f.players.find(p=>p.id==='B1').x=10;f.players.find(p=>p.id==='B3').x=100;f.ball.x=60;a.x=81;
  assert.equal(checkOffside(f,'A7').secondLastDefenderId,'B2');assert.equal(checkOffside(f,'A7').offside,true,'goalkeeper has no sorting exemption');
  assert.ok(candidatePoints(f,a).some(g=>g.x<80),'a retreating receiving point does not legalize the current offside position');
});

test('candidate offsets do not expand with velocity or branch',()=>{
  const f=frameAt(scene,4),p=f.players.find(p=>p.id==='A7');
  assert.deepEqual(candidatePoints(f,p),candidatePoints(f,{...p,vx:7.8,vy:0}));
});

test('unreachable endpoint is excluded without clamping it back onto the pitch',()=>{
  const f=clone(frameAt(scene,4)),p=f.players.find(p=>p.id==='A7');
  p.x=104;p.y=3;p.vx=0;p.vy=0;f.ball.x=103;f.ball.y=3;
  const r=analyzeFrame(f,'A7');
  assert.equal(r.candidates.find(g=>g.id==='g2').rejection,'out_of_bounds');
  const arrival=arrivalEstimate({x:0,y:0,vx:0,vy:0},{x:20,y:0},DEFAULT_PARAMS,{maxTime:.5});
  assert.equal(arrival.time,Infinity);assert.equal(arrival.atTarget,false);
});

test('receiver readiness restarts after leaving and re-entering the control radius',()=>{
  const player={x:70,y:34,vx:3.2,vy:0},target={x:70,y:34};
  const options={reactionTime:.1,radius:1.2,settle:true};
  const outside=arrivalEstimate(player,target,DEFAULT_PARAMS,{...options,maxTime:1.7});
  assert.equal(outside.atTarget,false);assert.equal(outside.time,Infinity);
  const returned=arrivalEstimate(player,target,DEFAULT_PARAMS,{...options,maxTime:1.9});
  assert.equal(returned.atTarget,true);assert.equal(returned.firstContactTime,0);
  assert.ok(returned.time>1.7&&returned.time<=1.9,'effective readiness must use the final entry, not first contact at zero');
  assert.ok(1.9-returned.time<.2);
  const defender=arrivalEstimate(player,target,DEFAULT_PARAMS,{...options,maxTime:1.9,settle:false});
  assert.equal(defender.time,0,'defensive earliest-contact semantics remain distinct');
});

test('an actual crowded-scene return to the original point cannot earn an abandoned readiness surplus',()=>{
  const f=frameAt(generateScenario('crowded'),3.3),a=analyzeFrame(f),g0=a.candidates.find(g=>g.id==='g0');
  assert.equal(g0.reachable,true);assert.ok(g0.receiverArrival>1.5);
  assert.ok(g0.receiverMargin<.15);assert.ok(g0.R<.55);
});

test('defensive lower bound detects a certified interception missed by pure pursuit',()=>{
  const defender={x:50,y:30,vx:5,vy:0},target={x:57.75,y:34},reaction=.35,travel=2,total=reaction+travel;
  const acceleration={x:-2,y:2},endVelocity={x:defender.vx+acceleration.x*travel,y:defender.vy+acceleration.y*travel};
  close(defender.x+defender.vx*total+.5*acceleration.x*travel**2,target.x);
  close(defender.y+defender.vy*total+.5*acceleration.y*travel**2,target.y);
  assert.ok(Math.hypot(acceleration.x,acceleration.y)<DEFAULT_PARAMS.maxAcceleration);
  assert.ok(Math.hypot(endVelocity.x,endVelocity.y)<DEFAULT_PARAMS.maxSpeed);
  assert.ok(arrivalEstimate(defender,target,DEFAULT_PARAMS,{maxTime:6}).time>total);
  assert.ok(defenderArrivalLowerBound(defender,target).time<=total);
  const f=clone(frameAt(scene,0));f.ball.x=22.5;f.ball.y=34;
  Object.assign(f.players.find(p=>p.id==='A6'),{x:22,y:34,vx:0,vy:0});
  Object.assign(f.players.find(p=>p.id==='A7'),{...target,vx:0,vy:0});
  for(const p of f.players.filter(p=>p.team==='B'))Object.assign(p,{x:100,y:64,vx:0,vy:0});
  Object.assign(f.players.find(p=>p.id==='B6'),defender);
  const candidate=analyzeFrame(f).candidates.find(g=>g.id==='g0');
  close(candidate.ballArrival,total);assert.ok(candidate.B<=.5);
  assert.ok(candidate.laneMargin<=0);assert.equal(candidate.critical.defenderId,'B6');
  assert.equal(candidate.critical.arrivalModel,'optimistic_lower_bound');
});

test('defender pre-reaction drift contact is detected before the reaction time',()=>{
  const d={x:0,y:0,vx:5,vy:0},target={x:1.5,y:0};
  const bound=defenderArrivalLowerBound(d,target,DEFAULT_PARAMS);
  close(bound.time,(1.5-DEFAULT_PARAMS.interceptionRadius)/5);
  assert.ok(bound.time<DEFAULT_PARAMS.reactionTime);assert.equal(bound.phase,'reaction');
  close(defenderArrivalLowerBound(d,{x:1,y:.8},DEFAULT_PARAMS).time,.2); // Tangent contact.
  close(defenderArrivalLowerBound(d,{x:2.55,y:0},DEFAULT_PARAMS).time,.35); // Reaction endpoint.
  assert.equal(defenderArrivalLowerBound({x:0,y:0,vx:0,vy:0},{x:0,y:0}).time,0);
  const stationary=defenderArrivalLowerBound({x:0,y:0,vx:0,vy:0},{x:2.4,y:0});
  close(stationary.time,.35+Math.sqrt(2*(2.4-.8)/3.2));
  assert.throws(()=>defenderArrivalLowerBound({x:0,y:0,vx:8,vy:0},{x:20,y:0}),RangeError);
});

test('pre-reaction tangent contact survives translated and rotated coordinates',()=>{
  for(let i=0;i<1000;i++){
    const theta=i*2*Math.PI/1000,cos=Math.cos(theta),sin=Math.sin(theta);
    const d={x:50,y:30,vx:5*cos,vy:5*sin};
    const target={x:50+cos-.8*sin,y:30+sin+.8*cos};
    const result=defenderArrivalLowerBound(d,target);
    assert.equal(result.phase,'reaction',`tangent contact missed at angle ${theta}`);
    close(result.time,.2,1e-6);
  }
});

test('comparison ends before an actual pass and does not integrate missing time',()=>{
  const r=compareRun(scene,6,2.5);
  assert.equal(r.stopReason,'pass');assert.equal(r.truncated,true);
  assert.equal(r.endTime,7.4);close(r.duration,1.4);
  assert.ok(r.samples.every(s=>s.t<7.5));
  let area=0;
  for(let i=1;i<r.samples.length;i++)area+=(r.samples[i].delta+r.samples[i-1].delta)/2*(r.samples[i].t-r.samples[i-1].t);
  close(r.summary.meanDelta,area/r.duration);
});

test('branches share position and velocity initially and use the same acceleration constraints',()=>{
  const r=compareRun(scene,2.5,2.5);
  assert.deepEqual(r.states[0].run,r.states[0].alternative);
  for(let i=1;i<r.states.length;i++){
    const dt=r.states[i].t-r.states[i-1].t;
    for(const branch of ['run','alternative']){
      const p=r.states[i][branch],prev=r.states[i-1][branch];
      assert.ok(Math.hypot(p.vx,p.vy)<=7.8+1e-8);
      assert.ok(Math.hypot(p.vx-prev.vx,p.vy-prev.vy)/dt<=3.2+1e-8);
    }
  }
  assert.ok(r.states[1].alternative.vx>0,'smooth braking, not instantaneous stop');
});

test('changing unseen future frames cannot change a current-frame score',()=>{
  const altered=clone(scene),t=4;
  for(const f of altered.frames.filter(f=>f.t>t)){
    f.ball.x=0;for(const p of f.players){p.x=1;p.y=1;p.vx=0;p.vy=0;}
  }
  assert.deepEqual(analyzeFrame(frameAt(scene,t)),analyzeFrame(frameAt(altered,t)));
});

test('synthetic negative examples do not automatically reward forward running',()=>{
  assert.ok(compareRun(generateScenario('crowded')).summary.meanDelta<0);
  const early=compareRun(generateScenario('early'));
  assert.ok(early.summary.meanDelta<0);
  assert.ok(early.samples.some(s=>s.runAnalysis.reason==='offside'));
});

test('a defender approaching an otherwise fixed lane cannot be hidden inside receiver readiness',()=>{
  const f=clone(frameAt(scene,3.5)),a=analyzeFrame(f);
  const defender=f.players.find(p=>p.id==='B6');
  defender.x=(f.ball.x+a.best.x)/2;defender.y=(f.ball.y+a.best.y)/2;defender.vx=0;defender.vy=0;
  const b=analyzeFrame(f),sameCandidate=b.candidates.find(g=>g.id===a.best.id);
  close(sameCandidate.R,a.best.R);assert.ok(sameCandidate.B<a.best.B);
});

test('the sensitivity range is a deterministic assumption sweep',()=>{
  const s=sensitivity(scene);
  assert.equal(s.results.length,9);
  assert.ok(s.min<=s.max);assert.match(s.label,/not a confidence interval/);
});

test('invalid horizons and NaN parameters fail rather than create misleading numbers',()=>{
  assert.throws(()=>compareRun(scene,0,4),RangeError);
  assert.throws(()=>analyzeFrame(scene.frames[0],'A7',{ballSpeed:NaN}),TypeError);
  assert.throws(()=>analyzeFrame(scene.frames[0],'A7',{ballSpeed:0}),RangeError);
  const broken=clone(scene.frames[0]);broken.players[5].x=NaN;
  assert.throws(()=>analyzeFrame(broken),TypeError);
});

test('components belong to one winning candidate and all scores remain bounded',()=>{
  for(const id of ['diagonal','crowded','early']){
    const s=generateScenario(id);
    for(const t of [0,2.5,3.5,4.5,5,7,8,10,15]){
      const a=analyzeFrame(frameAt(s,t));assert.ok(Number.isFinite(a.index)&&a.index>=0&&a.index<=100);
      if(a.best){close(a.index,100*a.components.U*a.components.R*a.components.B*a.components.O);assert.equal(a.best.index,a.index);}
    }
  }
});

test('the lane includes the release point and the critical evidence is on the chosen line',()=>{
  const f=clone(frameAt(scene,3.5));
  const defender=f.players.find(p=>p.id==='B6');Object.assign(defender,{x:f.ball.x,y:f.ball.y,vx:0,vy:0});
  const a=analyzeFrame(f);
  assert.ok(a.best.critical.margin<=0);assert.ok(a.best.B<=.5+1e-8);
  const {x,y}=a.best.critical,dx=a.best.x-f.ball.x,dy=a.best.y-f.ball.y;
  close((x-f.ball.x)*dy-(y-f.ball.y)*dx,0,1e-6);
  assert.equal(a.best.laneMargin,a.best.critical.defenderTime-a.best.critical.ballTime);
});

test('defender projections and disc boundaries catch a stationary grazing block between uniform samples',()=>{
  const f=clone(frameAt(scene,0));f.ball.x=50;f.ball.y=34;
  Object.assign(f.players.find(p=>p.id==='A6'),{x:49.5,y:34,vx:0,vy:0});
  Object.assign(f.players.find(p=>p.id==='A7'),{x:65,y:34,vx:0,vy:0});
  for(const p of f.players.filter(p=>p.team==='B'))Object.assign(p,{x:100,y:64,vx:0,vy:0});
  Object.assign(f.players.find(p=>p.id==='B6'),{x:57.5,y:34.75,vx:0,vy:0});
  const candidate=analyzeFrame(f).candidates.find(g=>g.id==='g0');
  assert.ok(candidate.laneMargin<=-.5);
  assert.ok(candidate.B<.21);assert.equal(candidate.critical.defenderId,'B6');
  close(candidate.critical.y,34);
  close(candidate.laneMargin,-(7.5+Math.sqrt(.8**2-.75**2))/15,1e-6);
  assert.ok(candidate.laneSampleCount>16,'the 1 m uniform grid must be augmented');
});

test('refining lane sampling retains the authored scenario comparison signs',()=>{
  for(const id of ['diagonal','crowded','early']){
    const s=generateScenario(id),base=compareRun(s),fine=compareRun(s,2.5,2.5,{laneSpacing:.5});
    assert.equal(Math.sign(base.summary.meanDelta),Math.sign(fine.summary.meanDelta));
    assert.ok(Math.abs(base.summary.meanDelta-fine.summary.meanDelta)<1,'refinement shifts the window mean by less than one index point in these scenes');
  }
});

test('personal improvement need not improve the team best receiving choice',()=>{
  const comparison=compareRun(scene),end=clone(frameAt(scene,comparison.endTime));
  const alternative=clone(end),last=comparison.states.at(-1).alternative;
  alternative.players=alternative.players.map(p=>p.id==='A7'?{...last}:p);
  assert.ok(comparison.samples.at(-1).delta>0);
  const runTeam=teamBest(end),altTeam=teamBest(alternative);
  assert.equal(runTeam.playerId,'A9');close(runTeam.index,altTeam.index);
});
