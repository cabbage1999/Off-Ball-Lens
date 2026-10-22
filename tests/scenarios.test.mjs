import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,generateScenario,frameAt} from '../src/scenarios.mjs';

for(const spec of SCENARIOS){
  test(`${spec.id}: reproducible 10 Hz data, identities, bounds, and motion limits`,()=>{
    const scenario=generateScenario(spec.id),again=generateScenario(spec.id);
    assert.deepEqual(scenario,again);assert.equal(scenario.metadata.synthetic,true);
    assert.equal(scenario.frames.length,161);assert.equal(scenario.metadata.sampleRate,10);
    const ids=scenario.frames[0].players.map(p=>p.id);
    assert.equal(new Set(ids).size,22);
    scenario.frames.forEach((f,i)=>{
      assert.equal(f.index,i);assert.ok(Math.abs(f.t-i*.1)<1e-8);
      assert.deepEqual(f.players.map(p=>p.id),ids);
      for(const p of f.players){
        assert.ok(p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68,`${p.id} left the pitch`);
        assert.ok(Math.hypot(p.vx,p.vy)<=7.8+1e-8);
        if(i){const prev=scenario.frames[i-1].players.find(q=>q.id===p.id);const dt=f.t-scenario.frames[i-1].t;
          assert.ok(Math.hypot(p.vx-prev.vx,p.vy-prev.vy)/dt<=3.2+1e-7);
          assert.ok(Math.abs(p.x-prev.x-(p.vx+prev.vx)*dt/2)<1e-7);
          assert.ok(Math.abs(p.y-prev.y-(p.vy+prev.vy)*dt/2)<1e-7);
        }
      }
      if(f.carrierId){const carrier=f.players.find(p=>p.id===f.carrierId);assert.ok(Math.hypot(carrier.x-f.ball.x,carrier.y-f.ball.y)<.6);assert.equal(f.ball.state,'possessed');}
      else assert.equal(f.ball.state,'in_flight');
      assert.ok(Math.hypot(f.ball.vx,f.ball.vy)<25,'ball flight speed remains a plausible ground pass');
    });
  });
  test(`${spec.id}: event timing, carrier and ball flights stay synchronized`,()=>{
    const s=generateScenario(spec.id);
    for(const event of s.events){
      const f=s.frames[event.frameIndex];assert.equal(f.t,event.t);
      if(event.type==='pass'){
        assert.equal(f.carrierId,null);assert.equal(f.ball.state,'in_flight');
        const from=f.players.find(p=>p.id===event.playerId);assert.ok(Math.hypot(from.x-f.ball.x,from.y-f.ball.y)<.6);
      }else{assert.equal(f.carrierId,event.playerId);assert.equal(f.ball.state,'possessed');}
    }
    assert.equal(s.events.some(e=>e.type==='reception'&&e.playerId==='A7'),false);
  });
}

test('frame lookup selects a current-or-past sample, never the next one',()=>{
  const s=generateScenario();assert.equal(frameAt(s,4.19).t,4.1);assert.equal(frameAt(s,4.2).t,4.2);
});

test('different seeds affect background positioning without changing the authored key action',()=>{
  const a=generateScenario('diagonal',1),b=generateScenario('diagonal',2);
  assert.notDeepEqual(a.frames[0].players,b.frames[0].players);
  assert.deepEqual(a.frames.map(f=>f.players.find(p=>p.id==='A7')),b.frames.map(f=>f.players.find(p=>p.id==='A7')));
});
