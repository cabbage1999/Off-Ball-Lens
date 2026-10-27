import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,generateScenario,frameAt,MOTION_LIMITS} from '../src/scenarios.mjs';
import {auditScenario,geometricallyOffside} from '../scripts/validate.mjs';

const scenes=new Map(SCENARIOS.map(spec=>[spec.id,generateScenario(spec.id)]));
const playerAt=(scene,t,id='A7')=>frameAt(scene,t).players.find(p=>p.id===id);
const speed=p=>Math.hypot(p.vx,p.vy);

test('the fish-hook checks back, turns slowly, and accelerates before the carrier releases',()=>{
  const scene=scenes.get('used'),approach=playerAt(scene,5.5),check=playerAt(scene,7),turn=playerAt(scene,8),exit=playerAt(scene,11);
  assert.ok(approach.x-playerAt(scene,8.8).x>3.8,'The check must be visible at pitch scale');
  assert.ok(speed(approach)<1,'The first direction change must include deceleration');
  assert.ok(check.vx< -1.5&&turn.vx<0&&turn.vy>0,'The run must bend from backwards to infield');
  assert.ok(exit.vx>3&&exit.vy>2&&speed(exit)>4,'The runner accelerates out of the hook');
  for(const frame of scene.frames.filter(f=>f.t>=4.3&&f.t<11.2))assert.equal(frame.carrierId,'A6');
  const release=scene.events.find(e=>e.type==='pass'&&e.targetId==='A7');
  assert.equal(release.t,11.2);
  assert.equal(geometricallyOffside(scene.frames[release.frameIndex],'A7'),false);
});

test('B2 follows the check from goal-side and closes while the ball is travelling',()=>{
  const scene=scenes.get('used');
  assert.ok(playerAt(scene,6.2,'B2').x-playerAt(scene,8.8,'B2').x>1.5);
  for(const frame of scene.frames.filter(f=>f.t>=4.3&&f.t<=11.2)){
    const runner=frame.players.find(p=>p.id==='A7'),marker=frame.players.find(p=>p.id==='B2');
    assert.ok(marker.x>runner.x,'B2 retains goal-side depth during the check');
  }
  const inFlight=frameAt(scene,11.9);
  assert.equal(inFlight.ball.state,'in_flight');
  assert.ok(playerAt(scene,11.9,'B2').vy>2,'B2 engages during travel, before control');
});

test('a tight hook respects normal acceleration as well as total vector acceleration',()=>{
  const scene=scenes.get('used'),run=scene.frames.filter(f=>f.t>=4.3&&f.t<=11.2).map(f=>({t:f.t,...f.players.find(p=>p.id==='A7')}));
  let headingChange=0;
  for(let i=1;i<run.length;i++){
    const a=run[i-1],b=run[i],dt=b.t-a.t,vx=(a.vx+b.vx)/2,vy=(a.vy+b.vy)/2;
    const ax=(b.vx-a.vx)/dt,ay=(b.vy-a.vy)/dt;
    assert.ok(Math.hypot(ax,ay)<=MOTION_LIMITS.maxAcceleration+1e-8);
    const normalAcceleration=Math.abs(vx*ay-vy*ax)/Math.hypot(vx,vy);
    assert.ok(normalAcceleration<=MOTION_LIMITS.maxAcceleration+1e-8);
    headingChange+=Math.abs(Math.atan2(a.vx*b.vy-a.vy*b.vx,a.vx*b.vx+a.vy*b.vy));
  }
  assert.ok(headingChange>Math.PI,'The hook has substantial curvature, not one diagonal segment');
  assert.deepEqual(auditScenario(scene).issues,[]);
});

test('short combinations, longer passes and shots have distinct flight timing without a carry-speed multiplier',()=>{
  const used=auditScenario(scenes.get('used')),blocked=auditScenario(scenes.get('blocked'));
  const layoff=used.flights.find(f=>f.passId==='used:p4'),shortPass=blocked.flights.find(f=>f.passId==='blocked:p3');
  assert.ok(layoff.distance>5&&layoff.duration<=.6&&layoff.speed>=10&&layoff.speed<=15);
  assert.ok(shortPass.distance>5&&shortPass.duration<=.7&&shortPass.speed>=9&&shortPass.speed<=13);
  for(const scene of scenes.values()){
    const audit=auditScenario(scene);
    assert.deepEqual(audit.issues,[]);
    assert.ok(audit.ballMotion.possessed.maximum<4.1);
    assert.ok(audit.ballMotion.inFlight.minimum>=9);
    for(const flight of audit.flights){
      assert.ok(Math.abs(flight.distance/flight.duration-flight.speed)<2e-6);
      if(flight.releaseType==='shot')assert.ok(flight.speed>=18);
    }
  }
});

test('the audit rejects eased pass motion and a mismatched action-specific pace',()=>{
  const eased=structuredClone(scenes.get('used'));
  eased.frames[113].ball.vx*=.5;
  assert.ok(auditScenario(eased).issues.some(issue=>issue.includes('Unmodelled easing')));
  const mismatched=structuredClone(scenes.get('used'));
  mismatched.events.find(e=>e.id==='used:p4:release').flightProfile='shot';
  assert.ok(auditScenario(mismatched).issues.some(issue=>issue.includes('outside shot profile')));
});

test('observations have bounded bilingual intervals, known focus players and no future evidence',()=>{
  for(const scene of scenes.values()){
    const ids=new Set(scene.frames[0].players.map(p=>p.id));
    for(const cue of scene.metadata.observationCues){
      assert.equal(cue.kind,'observed_movement');
      assert.equal(cue.provenance,'authored_tracking_cue');
      assert.ok(cue.startTime>=0&&cue.endTime<=scene.metadata.duration&&cue.evidenceTime<=cue.startTime);
      assert.ok(cue.focusPlayerIds.includes('A7')&&cue.focusPlayerIds.every(id=>ids.has(id)));
      assert.ok(cue.text.length>10&&cue.textZh.length>5);
      assert.doesNotMatch(cue.text,/will |creates? space|successful|dangerous opportunity/i);
    }
    for(const frame of scene.frames){
      const active=scene.metadata.observationCues.filter(cue=>cue.startTime<=frame.t&&frame.t<=cue.endTime&&cue.evidenceTime<=frame.t);
      assert.ok(active.length<=1);
    }
  }
  const bad=structuredClone(scenes.get('used'));
  bad.metadata.observationCues[0].evidenceTime=1;
  assert.ok(auditScenario(bad).issues.some(issue=>issue.includes('Future observation evidence')));
});

test('reception, interception and save commentary begins only after the linked event occurred',()=>{
  const used=scenes.get('used'),unused=scenes.get('unused'),blocked=scenes.get('blocked');
  const cases=[
    [used,/A7 controls/,'reception','A7'],
    [unused,/A10 has control/,'reception','A10'],
    [blocked,/B6 has intercepted/,'interception','B6'],
    [blocked,/B7 has control/,'reception','B7'],
    [used,/B1 has saved/,'save','B1'],
    [unused,/B1 has saved/,'save','B1']
  ];
  for(const [scene,phrase,type,playerId] of cases){
    const event=scene.events.find(e=>e.type===type&&e.playerId===playerId),cue=scene.metadata.observationCues.find(c=>phrase.test(c.text));
    assert.ok(event&&cue);
    assert.ok(cue.startTime>=event.t&&cue.evidenceTime>=event.t);
  }
});
