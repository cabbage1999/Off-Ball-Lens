import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SCENARIOS,generateScenario,frameAt,stepMotion,MOTION_LIMITS,GENERATOR_VERSION} from '../src/scenarios.mjs';
import {auditScenario,geometricallyOffside,shotGoalLineProjection} from '../scripts/validate.mjs';

const scenes=new Map(SCENARIOS.map(spec=>[spec.id,generateScenario(spec.id)]));
for(const spec of SCENARIOS){
  test(`${spec.id}: bounded full-team movement, centre coordinates and synchronized events`,()=>{
    const scene=scenes.get(spec.id),audit=auditScenario(scene);
    assert.deepEqual(audit.issues,[]);
    assert.deepEqual(scene,generateScenario(spec.id));
    assert.equal(scene.metadata.generatorVersion,GENERATOR_VERSION);
    assert.ok(audit.maxPositionIntegrationResidual<1e-7);
    assert.ok(audit.minimumPlayerSeparationLowerBound>1.2);
    assert.ok(audit.flights.every(f=>f.minimumNonParticipantClearance>=1.2));
    assert.ok(audit.players.filter(p=>!['A1','B1'].includes(p.id)).every(p=>p.distance>15),'Every outfield role participates materially in these progressing attacks');
    assert.ok(audit.distribution.playersBelowMeanSpeedPointFive.length<=2);
  });
  test(`${spec.id}: each phase explains all 22 authored roles`,()=>{
    const scene=scenes.get(spec.id),stages=scene.metadata.stages;
    assert.equal(stages.length,7);assert.equal(stages[0].startTime,0);assert.equal(stages.at(-1).endTime,spec.duration);
    for(let i=0;i<stages.length;i++){
      if(i)assert.equal(stages[i-1].endTime,stages[i].startTime);
      assert.equal(Object.keys(stages[i].roles).length,22);
      for(const role of Object.values(stages[i].roles)){
        assert.ok(role.reason.length>10);
        for(const point of [role.start,role.target])assert.ok(Math.abs(point.x)<=52.5&&Math.abs(point.y)<=34);
      }
    }
    for(const id of Object.keys(stages[0].roles))assert.ok(new Set(stages.map(stage=>stage.roles[id].reason)).size>=6,`${id} must have specific stage actions`);
  });
  test(`${spec.id}: published data is exactly reproducible`,async()=>{
    const saved=JSON.parse(await readFile(new URL(`../data/${spec.id}.json`,import.meta.url),'utf8'));
    assert.deepEqual(saved,scenes.get(spec.id));
  });
}

test('frame IDs and event IDs are unique across all independent clips',()=>{
  const frameIds=[...scenes.values()].flatMap(s=>s.frames.map(f=>f.frameId));
  const eventIds=[...scenes.values()].flatMap(s=>s.events.map(e=>e.id));
  assert.equal(new Set(frameIds).size,frameIds.length);assert.equal(new Set(eventIds).size,eventIds.length);
});

test('actual outcomes use events: A7 receives, another option receives, interception starts a counterattack',()=>{
  const used=scenes.get('used'),unused=scenes.get('unused'),blocked=scenes.get('blocked');
  assert.ok(used.events.some(e=>e.type==='reception'&&e.playerId==='A7'&&e.t===12.1));
  assert.equal(unused.events.some(e=>e.type==='reception'&&e.playerId==='A7'),false);
  assert.ok(unused.events.some(e=>e.type==='reception'&&e.playerId==='A10'&&e.t===12.6));
  const interception=blocked.events.find(e=>e.type==='interception');
  assert.equal(interception.playerId,'B6');assert.equal(interception.t,20);
  const release=blocked.events.find(e=>e.passId===interception.passId&&e.type==='pass');
  assert.equal(release.playerId,'A10');assert.equal(release.targetId,'A9');
  assert.equal(frameAt(blocked,20).attackingTeam,'B');assert.equal(frameAt(blocked,20).attackDirection,-1);
  assert.ok(blocked.events.some(e=>e.type==='reception'&&e.playerId==='B7'&&e.t===25.2));
  assert.equal(blocked.frames.at(-1).carrierId,'B7');
  for(const scene of [used,unused])assert.equal(scene.events.at(-1).type,'save');
});

test('fast runner has distinct onside, offside and recovered positions; this is not an all-clip negative label',()=>{
  const s=scenes.get('blocked'),run=s.frames.map(f=>f.players.find(p=>p.id==='A7'));
  assert.ok(Math.max(...run.map(p=>Math.hypot(p.vx,p.vy)))>6.5);
  assert.equal(geometricallyOffside(frameAt(s,7),'A7'),false);
  assert.equal(geometricallyOffside(frameAt(s,10),'A7'),true);
  assert.equal(geometricallyOffside(frameAt(s,18),'A7'),false);
});

test('latest tracking lookup never invents a future frame',()=>{
  const s=scenes.get('used');
  assert.equal(frameAt(s,4.19).t,4.1);assert.equal(frameAt(s,4.2).t,4.2);
  assert.equal(frameAt(s,-1).t,0);assert.equal(frameAt(s,100).t,32);
  assert.throws(()=>frameAt(s,NaN),TypeError);
});

test('authored seeds record provenance without random background motion',()=>{
  const a=generateScenario('used',1),b=generateScenario('used',2);
  assert.deepEqual(a.frames,b.frames);assert.deepEqual(a.events,b.events);
  assert.notEqual(a.metadata.seed,b.metadata.seed);
  assert.throws(()=>generateScenario('missing'),RangeError);
  assert.throws(()=>generateScenario('used',1.5),TypeError);
});

test('vector acceleration limits a sharp turn as well as forward acceleration',()=>{
  const p={id:'A7',role:'right_winger',x:0,y:0,vx:7,vy:0};
  const next=stepMotion(p,{vx:-7,vy:7},.1);
  assert.ok(Math.hypot(next.vx-p.vx,next.vy-p.vy)<=MOTION_LIMITS.maxAcceleration*.1+1e-9);
  assert.ok(Math.abs(next.x-(p.vx+next.vx)*.05)<1e-10);
  assert.ok(Math.abs(next.y-(p.vy+next.vy)*.05)<1e-10);
});

test('audit catches a player teleport and an event detached from its frame',()=>{
  const bad=structuredClone(scenes.get('used'));
  bad.frames[40].players[6].x+=5;bad.events[0].frameId='used:9999';
  const result=auditScenario(bad);
  assert.ok(result.issues.some(x=>x.includes('position/velocity integration mismatch')));
  assert.ok(result.issues.some(x=>x.includes('Event/frame mismatch')));
});

test('audit detects a ball crossing between samples even when sampled endpoints are clear',()=>{
  const bad=structuredClone(scenes.get('used')),a=bad.frames[114],b=bad.frames[115];
  const p=a.players.find(p=>p.id==='B6'),q=b.players.find(p=>p.id==='B6');
  Object.assign(a.ball,{x:p.x-2,y:p.y});Object.assign(b.ball,{x:q.x+2,y:q.y});
  assert.equal(Math.hypot(a.ball.x-p.x,a.ball.y-p.y),2);
  assert.equal(Math.hypot(b.ball.x-q.x,b.ball.y-q.y),2);
  assert.ok(auditScenario(bad).issues.some(x=>x.includes('1.2 m exclusion zone on used:p2')));
});


test('both saved ground shots would cross the goal mouth after the save point',()=>{
  for(const id of ['used','unused']){
    const scene=scenes.get(id),shot=scene.events.find(event=>event.type==='shot');
    const save=scene.events.find(event=>event.passId===shot.passId&&event.type==='save');
    const projection=shotGoalLineProjection(scene.frames[shot.frameIndex]);
    assert.equal(projection.onTarget,true,`${id}: goal-line y=${projection.y}`);
    assert.ok(Math.abs(projection.y)<3.66);
    assert.ok(projection.timeToLine>save.t-shot.t);
  }
});

test('audit rejects a wide shot ray even though the keeper receives the ball',()=>{
  const bad=structuredClone(scenes.get('used'));
  const ball=bad.frames[296].ball;
  ball.vy=(-6.437253617124128-ball.y)/((52.5-ball.x)/ball.vx);
  const projection=shotGoalLineProjection(bad.frames[296]);
  assert.equal(projection.onTarget,false);
  assert.ok(Math.abs(projection.y+6.437253617124128)<1e-8);
  assert.ok(auditScenario(bad).issues.some(issue=>issue.includes('Saved shot misses the goal mouth')));
});

test('the authored misdirected interception reports target-to-ball-ray error separately',()=>{
  const interception=auditScenario(scenes.get('blocked')).flights.find(flight=>flight.outcome==='interception');
  assert.ok(Math.abs(interception.intendedTargetDistanceFromActualBallRay-3.577986)<1e-5);
  assert.ok(Math.abs(interception.interceptionDistanceFromIntendedLane-1.601487)<1e-5);
  assert.ok(interception.intendedTargetDistanceFromActualBallRay>interception.interceptionDistanceFromIntendedLane);
  assert.match(interception.interceptionModel,/Authored misdirected pass/);
});
