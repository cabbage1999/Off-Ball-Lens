import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {setImmediate as nextTurn,setTimeout as delay} from 'node:timers/promises';
import {createServer} from '../server.mjs';
import {explain} from '../src/agent.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

// Every provider here is a local protocol fixture. No Microsoft service is called.
const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,audience:'analyst',language:'en'};
const env={AZURE_OPENAI_ENDPOINT:'https://cancellation-audit.openai.azure.com',AZURE_OPENAI_DEPLOYMENT:'LOCAL-PROTOCOL-MOCK',AZURE_OPENAI_API_KEY:'NOT-A-REAL-KEY'};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
async function post(base){const response=await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});return {status:response.status,value:await response.json()};}
function nextProviderResponse(body){
  const last=body.input.findLast(item=>item.type==='function_call_output');
  if(!last)return {id:'MOCK-ONLY-analyze',output:[{type:'function_call',call_id:'window',name:'analyze_window',arguments:JSON.stringify({player_id:'A7',start_time:0,end_time:.8})}]};
  const facts=JSON.parse(last.output);
  if(!facts.claims)return {id:'MOCK-ONLY-evidence',output:[{type:'function_call',call_id:'evidence',name:'get_evidence',arguments:'{"evidence_ids":[]}'}]};
  const claim=facts.claims.find(item=>item.kind==='current');
  return {id:'MOCK-ONLY-final',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({claim_ids:[claim.id],evidence_ids:claim.evidence_ids,overlay_type:'receiving_heatmap'})}]}]};
}

test('browser and worker import graphs contain no Node-only static dependency',async()=>{
  const pending=[new URL('../app.mjs',import.meta.url),new URL('../src/analysis-worker.mjs',import.meta.url)],seen=new Set();
  while(pending.length){
    const file=pending.pop();if(seen.has(file.href))continue;seen.add(file.href);
    const source=await readFile(file,'utf8');
    const imports=[...source.matchAll(/^\s*import\s+(?:(?:[\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/gm)].map(match=>match[1]);
    for(const specifier of imports){
      assert(specifier.startsWith('.'),`${file.pathname} imports browser-incompatible specifier ${specifier}`);
      pending.push(new URL(specifier,file));
    }
  }
  assert([...seen].some(file=>file.endsWith('/src/agent.mjs')));
  assert([...seen].some(file=>file.endsWith('/src/evidence.mjs')));
});

test('disconnect after provider headers aborts native body reads and leaves slots/cache clean',{timeout:5000},async()=>{
  const started=[deferred(),deferred()],providerClosed=[deferred(),deferred()];let providerCalls=0;
  const provider=http.createServer(async(req,res)=>{
    const parts=[];for await(const part of req)parts.push(part);
    const body=JSON.parse(Buffer.concat(parts));const index=providerCalls++;
    res.writeHead(200,{'content-type':'application/json'});
    if(index<2){
      // fetch has a Response, but response.json() must wait for the unfinished body.
      res.once('close',()=>providerClosed[index].resolve());
      res.write('{"id":"MOCK-ONLY-incomplete","output":[');started[index].resolve();
    }else res.end(JSON.stringify(nextProviderResponse(body)));
  });
  const providerBase=await listen(provider);
  const server=createServer({env,loadBundle:async()=>fixture(),fetchImpl:(_url,options)=>fetch(providerBase,options)});
  const base=await listen(server),clients=[];
  try{
    for(let i=0;i<2;i++){
      const req=http.request(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'}});
      req.on('error',()=>{});req.end(JSON.stringify(input));clients.push(req);
    }
    await Promise.all(started.map(item=>item.promise));
    for(const req of clients)req.destroy();
    await Promise.race([Promise.all(providerClosed.map(item=>item.promise)),delay(1500).then(()=>{throw Error('Native upstream body reads were not cancelled');})]);
    await nextTurn();
    assert.equal((await (await fetch(`${base}/api/health`)).json()).cloud.verified,false);
    const replacement=await post(base);
    assert.equal(replacement.status,200);assert.equal(replacement.value.status,'cloud-verified');assert.equal(replacement.value.cached,undefined);
    assert.equal(providerCalls,5);
    const cached=await post(base);assert.equal(cached.value.cached,true);assert.equal(providerCalls,5);
  }finally{for(const req of clients)req.destroy();await close(server);await close(provider);}
});

test('provider timeouts still return fallback and do not poison slots or response cache',{timeout:5000},async()=>{
  let timingOut=true,calls=0;
  const server=createServer({env,timeoutMs:25,loadBundle:async()=>fixture(),fetchImpl:async(_url,options)=>{
    calls++;
    if(!timingOut)return Response.json(nextProviderResponse(JSON.parse(options.body)));
    return new Promise((_resolve,reject)=>{
      const abort=()=>reject(options.signal.reason);
      if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
    });
  }});
  const base=await listen(server);
  try{
    const timeouts=await Promise.all([post(base),post(base)]);
    for(const result of timeouts){assert.equal(result.status,200);assert.equal(result.value.status,'fallback');assert.equal(result.value.fallbackReason,'cloud_timeout');assert.equal(result.value.cloud.verified,false);}
    assert.equal(calls,2);assert.equal((await (await fetch(`${base}/api/health`)).json()).cloud.verified,false);
    timingOut=false;
    const result=await post(base);assert.equal(result.status,200);assert.equal(result.value.cached,undefined);assert.equal(result.value.status,'cloud-verified');assert.equal(calls,5);
  }finally{await close(server);}
});

test('an abort during final provider JSON parsing cannot return a verified answer',async()=>{
  const controller=new AbortController();let rounds=0;
  await assert.rejects(explain(input,{env,bundle:fixture(),signal:controller.signal,fetchImpl:async(_url,options)=>{
    rounds++;const data=nextProviderResponse(JSON.parse(options.body));
    if(rounds<3)return Response.json(data);
    return {ok:true,json:async()=>{controller.abort(new DOMException('Caller left during JSON','AbortError'));return data;}};
  }}),{name:'AbortError'});
  assert.equal(rounds,3);
});
