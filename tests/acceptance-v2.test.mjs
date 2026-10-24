/** Independent acceptance of the frozen v2 files and shared UI/fact projections. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {offlineExplain} from '../src/agent.mjs';
import {analysisAtTime, trackingAtTime, playerAnalysis, curveSegments, visibleMoments, visibleEvents, playerTrail, decodeHeatmap} from '../src/analysis.mjs';

const names=['used','unused','blocked'];
const bundles=names.map(name=>({scenario:JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url))),analysis:JSON.parse(readFileSync(new URL(`../data/analysis/${name}.json`,import.meta.url)))}));
const eps=1e-8;

test('frozen exports bind to the exact current tracking bytes and complete roster',()=>{
  for(const {scenario:s,analysis:a} of bundles){
    assert.equal(a.inputFileHash,createHash('sha256').update(readFileSync(new URL(`../data/${s.metadata.id}.json`,import.meta.url))).digest('hex'));
    assert.equal(a.schemaVersion,'2.0');assert.equal(a.mode,'precomputed');assert.equal(a.model.version,'2.1.0');
    assert.equal(a.sampleRate,5);assert.equal(s.metadata.sampleRate,10);assert.equal(a.heatmapMeta.scaleMax,.1);
    assert.equal(a.frames.length,Math.floor(s.frames.length/2)+1);
    for(const f of a.frames){
      const raw=s.frames[f.frameIndex];
      assert.equal(f.frameId,raw.frameId);assert.equal(f.t,raw.t);
      assert.deepEqual(Object.keys(f.players).sort(),raw.players.map(p=>p.id).sort());
      for(const v of Object.values(f.players)){
        if(v.status==='eligible')assert.equal(decodeHeatmap(v.heatmap,a.heatmapMeta).length,805);
        else assert.deepEqual([v.as,v.das,v.heatmap],[null,null,null]);
      }
    }
  }
});

test('all 963 tracking-time cutoffs and all 22 players retain only past UI facts',()=>{
  for(const {scenario:s,analysis:a} of bundles){
    for(const raw of s.frames){
      const t=raw.t, model=analysisAtTime(a,t);
      assert(model.t<=t+eps);assert.equal(trackingAtTime(s,t).frameId,raw.frameId);
      assert(visibleEvents(s,t).every(e=>e.t<=t+eps));
      for(const p of raw.players){
        const value=playerAnalysis(model,raw,p.id,a.model.config.filters);
        if(raw.ball.state!=='possessed'||raw.carrierId===p.id||p.team!==raw.attackingTeam||model.status!=='valid')assert.equal(value.das,null);
        const trail=playerTrail(s,p.id,t);
        assert(trail.every(point=>point.t<=t+eps&&point.t>=Math.max(0,t-3)-eps));
        for(const segment of curveSegments(a,p.id,t)){
          assert(segment.every(point=>point.t<=t+eps));
          assert.equal(new Set(segment.map(point=>point.carrierId)).size,1);
          for(let i=1;i<segment.length;i++)assert(Math.abs(segment[i].t-segment[i-1].t-.2)<eps);
        }
        for(const m of visibleMoments(a,p.id,t)){
          assert(m.detectedAtTime<=t+eps);assert(m.knownAtTime<=t+eps);
          assert(m.peakTime===undefined||m.peakTime<=t+eps);
          assert(m.endTime===undefined||m.endTime<=t+eps);
          assert(!m.outcome||m.outcomeKnownAtTime<=t+eps);
          if(m.outcome?.status==='not_selected')assert(Number.isFinite(m.endTime));
        }
      }
    }
  }
});

test('every tracking-time/player explanation equals its physically truncated future',()=>{
  for(const bundle of bundles){
    const {scenario:s,analysis:a}=bundle, frameMap=new Map(s.frames.map(f=>[f.frameId,f]));
    for(const raw of s.frames){
      const t=raw.t;
      const prefix={scenario:{...s,frames:s.frames.filter(f=>f.t<=t+eps),events:s.events.filter(e=>e.t<=t+eps)},analysis:{...a,frames:a.frames.filter(f=>f.t<=t+eps)}};
      for(const p of raw.players){
        const request={scenarioId:s.metadata.id,playerId:p.id,asOfTime:t,windowSeconds:6,language:'en',audience:'analyst'};
        const full=offlineExplain(request,bundle),cut=offlineExplain(request,prefix);
        assert.deepEqual(full,cut,`${s.metadata.id} ${t} ${p.id}`);
        assert.equal(full.source,'offline-template');assert.equal(full.cloud.verified,false);
        assert(full.context.analysisTime<=t+eps);
        for(const evidence of full.evidence){
          assert(evidence.t<=t+eps);assert(frameMap.has(evidence.frameId));
          assert.equal(evidence.t,frameMap.get(evidence.frameId).t);
          if(evidence.status==='event')assert(s.events.some(e=>e.id===evidence.event.id&&e.t<=t+eps));
          else{
            const source=a.frames.find(f=>f.frameId===evidence.frameId).players[evidence.playerId];
            assert.equal(evidence.as,source.as);assert.equal(evidence.das,source.das);
          }
        }
        for(const claim of full.claims){
          assert(claim.frame_ids.every(id=>frameMap.get(id).t<=t+eps));
          assert(claim.evidence_ids.every(id=>full.evidence.some(e=>e.id===id)));
        }
      }
    }
  }
});

test('all players preserve numeric evidence between English and Chinese audiences',()=>{
  for(const bundle of bundles)for(const time of [0,6.7,12.4,20.2,29.8])for(const p of bundle.scenario.frames[0].players){
    const request={scenarioId:bundle.scenario.metadata.id,playerId:p.id,asOfTime:time,windowSeconds:6,audience:'analyst'};
    const en=offlineExplain({...request,language:'en'},bundle),zh=offlineExplain({...request,language:'zh'},bundle);
    assert.deepEqual(en.context,zh.context);assert.deepEqual(en.summary,zh.summary);assert.deepEqual(en.evidence,zh.evidence);
    assert.deepEqual(en.claims.map(c=>[c.id,c.evidence_ids,c.frame_ids,c.metric_refs]),zh.claims.map(c=>[c.id,c.evidence_ids,c.frame_ids,c.metric_refs]));
  }
});

test('the recorded possession chain and trapezoidal player integration are coherent',()=>{
  for(const {scenario:s} of bundles){
    const eventsByPass=new Map();
    for(const e of s.events){
      const frame=s.frames[e.frameIndex];assert.equal(e.frameId,frame.frameId);assert.equal(e.t,frame.t);
      const pair=eventsByPass.get(e.passId)||[];pair.push(e);eventsByPass.set(e.passId,pair);
    }
    for(const events of eventsByPass.values()){
      assert.equal(events.length,2);
      const [release,arrival]=events;assert(release.t<arrival.t);
      const r=s.frames[release.frameIndex],a=s.frames[arrival.frameIndex],before=s.frames[release.frameIndex-1];
      assert.equal(before.carrierId,release.playerId);assert.equal(r.carrierId,null);assert.equal(r.ball.state,'in_flight');
      assert.equal(a.carrierId,arrival.playerId);assert.equal(a.ball.state,'possessed');
      for(const f of s.frames.filter(f=>f.t>=release.t&&f.t<arrival.t)){assert.equal(f.carrierId,null);assert.equal(f.ball.state,'in_flight');}
    }
    for(let i=1;i<s.frames.length;i++){
      const before=s.frames[i-1],after=s.frames[i],dt=after.t-before.t;
      assert(Math.abs(dt-.1)<eps);
      for(const p of before.players){
        const q=after.players.find(q=>q.id===p.id);
        assert(Math.hypot(q.vx-p.vx,q.vy-p.vy)/dt<=s.metadata.motionLimits.maxAcceleration+eps);
        assert(Math.hypot(q.x-p.x-(q.vx+p.vx)*dt/2,q.y-p.y-(q.vy+p.vy)*dt/2)<1e-9);
      }
      if(after.carrierId){const p=after.players.find(p=>p.id===after.carrierId);assert(Math.hypot(p.x-after.ball.x,p.y-after.ball.y)<.5);}
    }
  }
});

test('the two authored saved shots are directed through the goal mouth',()=>{
  // This is the declared intent of these two scenes, not a universal event rule.
  // Extrapolate the pre-contact straight ray; do not infer intent from the label.
  for(const {scenario:s} of bundles){
    for(const event of s.events.filter(e=>e.type==='shot')){
      const f=s.frames[event.frameIndex], b=f.ball;
      const direction=f.attackDirection, goalX=direction*52.5;
      assert(b.vx*direction>0,`${event.id} must travel toward the opposition goal`);
      const goalTime=(goalX-b.x)/b.vx;
      const goalY=b.y+b.vy*goalTime;
      assert(goalTime>0&&Math.abs(goalY)<=3.66,`${event.id} goal-line crossing y=${goalY}`);
      assert(s.events.some(e=>e.type==='save'&&e.passId===event.passId));
    }
  }
});
