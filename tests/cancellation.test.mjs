import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {setImmediate as nextTurn,setTimeout as delay} from 'node:timers/promises';
import {createServer} from '../server.mjs';
import {explain} from '../src/agent.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,language:'en',audience:'analyst'};
const env={AZURE_OPENAI_ENDPOINT:'https://fixture.openai.azure.com',AZURE_OPENAI_DEPLOYMENT:'simulated-only',AZURE_OPENAI_API_KEY:'NOT-A-REAL-KEY'};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const call=(name,args,id)=>Response.json({id:`simulation-${id}`,output:[{type:'function_call',call_id:id,name,arguments:JSON.stringify(args)}]});

test('closed HTTP clients abort provider work, free both slots and never cache their result',async()=>{
  const started=[deferred(),deferred()],aborted=[deferred(),deferred()];let fetchCount=0;
  const fetchImpl=async(_url,options)=>{
    const index=fetchCount++;
    if(index<2){
      started[index].resolve();
      return new Promise((_resolve,reject)=>{
        const stop=()=>{aborted[index].resolve();reject(options.signal.reason);};
        if(options.signal.aborted)stop();else options.signal.addEventListener('abort',stop,{once:true});
      });
    }
    const body=JSON.parse(options.body),last=body.input.findLast(x=>x.type==='function_call_output');
    if(!last)return call('analyze_window',{player_id:'A7',start_time:0,end_time:.8},'analyze');
    const evidence=JSON.parse(last.output);
    if(!evidence.claims)return call('get_evidence',{evidence_ids:[]},'evidence');
    const claim=evidence.claims.find(c=>c.kind==='current');
    return Response.json({id:'simulation-final',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({claim_ids:[claim.id],evidence_ids:claim.evidence_ids,overlay_type:'receiving_heatmap'})}]}]});
  };
  const server=createServer({env,fetchImpl,loadBundle:async()=>fixture()});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,requests=[];
  try{
    for(let i=0;i<2;i++){
      const req=http.request(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'}});
      req.on('error',()=>{});req.end(JSON.stringify(input));requests.push(req);
    }
    await Promise.all(started.map(x=>x.promise));
    for(const req of requests)req.destroy();
    await Promise.race([Promise.all(aborted.map(x=>x.promise)),delay(2000,undefined,{ref:false}).then(()=>{throw Error('Disconnected clients did not cancel their provider requests');})]);
    await nextTurn();
    const health=await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.cloud.verified,false,'Cancelled requests must not verify the session');
    const response=await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    assert.equal(response.status,200,'The new request must not be rejected by occupied slots');
    const result=await response.json();assert.equal(result.status,'cloud-verified');assert.equal(result.cached,undefined);
    assert.equal(fetchCount,5,'The replacement request must execute its own complete simulated tool loop');
    const repeated=await (await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})).json();
    assert.equal(repeated.cached,true);assert.equal(fetchCount,5);
  }finally{for(const req of requests)req.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('caller cancellation interrupts a provider retry without producing a fallback',async()=>{
  const controller=new AbortController(),firstCall=deferred();let calls=0,settled=false;
  const result=explain(input,{bundle:fixture(),env,signal:controller.signal,fetchImpl:async()=>{calls++;firstCall.resolve();return {ok:false,status:503};}})
    .then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
  await firstCall.promise;await nextTurn();
  controller.abort(new DOMException('Test client left','AbortError'));await nextTurn();
  assert.equal(settled,true,'Cancellation must interrupt the 400 ms retry wait');
  const outcome=await result;assert.equal(outcome.error?.name,'AbortError');assert.equal(outcome.value,undefined);assert.equal(calls,1);
});

test('aborted callers cannot start a request or process a late provider response',async()=>{
  const before=new AbortController();before.abort();let calls=0;
  await assert.rejects(explain(input,{bundle:fixture(),env,signal:before.signal,fetchImpl:async()=>{calls++;}}),{name:'AbortError'});
  assert.equal(calls,0);
  const during=new AbortController();
  await assert.rejects(explain(input,{bundle:fixture(),env,signal:during.signal,fetchImpl:async()=>{
    calls++;during.abort();return call('analyze_window',{player_id:'A7',start_time:0,end_time:.8},'late');
  }}),{name:'AbortError'});
  assert.equal(calls,1,'A late response must not start another tool/provider round');
});
