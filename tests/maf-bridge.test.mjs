import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {setImmediate as nextTurn,setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createEvidenceSession} from '../src/evidence-session.mjs';
import {explain,foundryConfiguration} from '../src/agent.mjs';
import {explainWithOrchestrator} from '../src/maf-bridge.mjs';
import {createServer} from '../server.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

// Protocol simulations only. These fixtures do not establish a real Azure or MAF run.
const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,audience:'analyst',language:'en'};
const env={FOUNDRY_ORCHESTRATOR:'agent-framework',AZURE_OPENAI_ENDPOINT:'https://westus3.api.cognitive.microsoft.com/openai/v1/responses',AZURE_OPENAI_DEPLOYMENT:'LOCAL-PROTOCOL-MOCK',AZURE_OPENAI_API_KEY:'NOT-A-REAL-KEY'};
const framework='microsoft-agent-framework',provider='azure-openai-responses';
const analysisArgs={player_id:'A7',start_time:0,end_time:.8};
const currentPlan=facts=>{const claim=facts.claims.find(c=>c.kind==='current');return {claim_ids:[claim.id],evidence_ids:claim.evidence_ids,overlay_type:'receiving_heatmap'};};
const run=(mock,options={})=>explainWithOrchestrator(input,{env,bundle:fixture(),spawnImpl:mock.spawnImpl,...options});

function protocolMock(options={}){
  const workers=[],launches=[];
  function spawnImpl(executable,args,spawnOptions){
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kills=[];child.received=[];child.results=[];child.native=[];child.validations=[];child.repairs=0;let pending='',closed=false;
    child.line=message=>child.stdout.write(JSON.stringify(message)+'\n');
    child.close=(code=0,signal=null)=>{if(closed)return;closed=true;child.stdout.end();child.stderr.end();child.emit('close',code,signal);};
    child.kill=signal=>{child.kills.push(signal);queueMicrotask(()=>child.close(null,signal));return true;};
    child.call=(name,args,extra={})=>{
      const index=child.native.length+1,call_id=`MOCK-call-${index}`,response_id=`MOCK-response-${index}`;
      child.native.push({call_id,response_id,name,status:'pending',dispatched:true});
      const message={type:'tool_call',request_id:child.run.request_id,call_id,name,arguments:args,origin:{framework,provider,response_id,call_id},...extra};
      child.lastCall=message;child.line(message);
    };
    child.proof=()=>{
      const responseIds=[...new Set(child.native.map(c=>c.response_id)),`MOCK-final-${child.repairs}`];
      const trace={framework,provider,frameworkVersion:'1.23.0',providerVersion:'2.32.0',modelDeployment:child.run.model,modelRequests:responseIds.length,rounds:responseIds.length,toolCalls:child.native.length,responseIds,nativeToolCalls:child.native.map(c=>({...c})),repairCount:child.repairs,elapsedMs:4,apiStyle:'responses',outputMode:'strict_json_schema'};
      const agentTrace=[{agent:'receiving-space-analyst',event:'run',status:'started'},...child.native.map(c=>({agent:'receiving-space-analyst',event:'tool',status:c.status,responseId:c.response_id,callId:c.call_id,tool:c.name}))];
      return {trace,agentTrace};
    };
    child.candidate=(plan=child.plan)=>{
      const message={type:'candidate',request_id:child.run.request_id,plan,...child.proof()};
      if(options.changeCandidate)options.changeCandidate(message,child);
      child.line(message);
    };
    child.done=()=>{const message={type:'done',request_id:child.run.request_id,...child.proof()};if(options.changeDone)options.changeDone(message,child);child.line(message);};
    child.stdin=new Writable({write(chunk,_encoding,callback){
      pending+=chunk.toString();let newline;
      while((newline=pending.indexOf('\n'))!==-1){
        const message=JSON.parse(pending.slice(0,newline));pending=pending.slice(newline+1);child.received.push(message);
        queueMicrotask(()=>{
          if(closed)return;
          if(message.type==='run'){
            child.run=message;
            if(options.onRun)return options.onRun(child);
            return child.call('analyze_window',analysisArgs);
          }
          if(message.type==='tool_result'){
            child.results.push(message.result);const record=child.native.find(c=>c.call_id===message.call_id);
            if(record){record.status=message.result.error?'rejected':'completed';if(message.result.error)record.rejectionSource='node';}
            if(options.onResult?.(message,child))return;
            if(child.results.length===1)return child.call('get_evidence',{evidence_ids:[]});
            child.plan=currentPlan(message.result);return child.candidate();
          }
          if(message.type==='validation'){
            child.validations.push(message);
            if(options.onValidation)return options.onValidation(message,child);
            if(!message.accepted){child.repairs++;return child.candidate();}
            child.done();queueMicrotask(()=>child.close());
          }
        });
      }
      callback();
    }});
    workers.push(child);launches.push({executable,args,options:spawnOptions});return child;
  }
  return {spawnImpl,workers,launches};
}

test('shared session validates actual retrieval and clears it after every successful analyze',()=>{
  const session=createEvidenceSession(input,fixture());
  assert.throws(()=>session.validate({claim_ids:['fake'],evidence_ids:[],overlay_type:'none'}),/missing_tool_evidence/);
  session.execute('analyze_window',analysisArgs);
  const all=session.execute('get_evidence',{evidence_ids:[]}),plan=currentPlan(all);
  assert.doesNotThrow(()=>session.validate(plan));
  assert.throws(()=>session.execute('analyze_window',{...analysisArgs,end_time:100}),/selected past window/);
  assert.doesNotThrow(()=>session.validate(plan),'rejected analyses preserve the valid session');
  session.execute('analyze_window',analysisArgs);
  assert.throws(()=>session.validate(plan),/invalid_evidence_reference/,'even identical IDs require a fresh retrieval');
  const one=all.evidence.find(e=>!plan.evidence_ids.includes(e.id));
  session.execute('get_evidence',{evidence_ids:[one.id]});
  assert.throws(()=>session.validate(plan),/invalid_evidence_reference/,'available evidence is not retrieved evidence');
  session.execute('get_evidence',{evidence_ids:plan.evidence_ids});
  assert.doesNotThrow(()=>session.validate(plan));
  assert.throws(()=>session.validate({...plan,evidence_ids:[]}),/missing_claim_evidence/);
  assert.throws(()=>session.validate({...plan,text:'unverified prose'}),/invalid_model_output/);
});

test('regional Azure endpoint is an exact allowlist entry with explicit orchestration',()=>{
  const config=foundryConfiguration(env);
  assert.equal(config.configured,true);assert.equal(config.endpointKind,'azure-regional');assert.equal(config.orchestrator,'agent-framework');
  assert.equal(foundryConfiguration({...env,FOUNDRY_ORCHESTRATOR:undefined}).orchestrator,'native');
  for(const endpoint of ['https://eastus.api.cognitive.microsoft.com','https://westus3.api.cognitive.microsoft.com.evil.example','https://westus3.api.cognitive.microsoft.com:444','https://user:secret@westus3.api.cognitive.microsoft.com','https://westus3.api.cognitive.microsoft.com?api-key=x','https://westus3.api.cognitive.microsoft.com/api/projects/test'])assert.equal(foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:endpoint}).configured,false,endpoint);
  assert.equal(foundryConfiguration({...env,FOUNDRY_API_STYLE:'chat-completions'}).reason,'agent_framework_requires_responses');
  assert.equal(foundryConfiguration({...env,FOUNDRY_ORCHESTRATOR:'imaginary-framework'}).reason,'invalid_orchestrator');
});

test('MAF dispatch verifies the same JS evidence and requires native identity plus clean process exit',async()=>{
  const mock=protocolMock(),result=await run(mock,{env:{...env,UNRELATED_SECRET:'DO-NOT-PASS',AZURE_FOUNDRY_AUTH_TOKEN:'TEST-TOKEN',PYTHONPATH:'/unsafe'}});
  assert.equal(result.status,'cloud-verified');assert.equal(result.cloud.verified,true);assert.equal(result.orchestrator,framework);
  assert.equal(result.trace.framework,framework);assert.equal(result.trace.provider,provider);assert.equal(result.trace.modelDeployment,env.AZURE_OPENAI_DEPLOYMENT);
  assert.equal(result.evidence[0].playerId,'A7');assert.equal(result.context.endTime,.8);assert.equal(result.claims.find(c=>c.kind==='current').id,'C:current:0.000:0.800');
  assert.deepEqual(result.toolTrace.map(t=>[t.name,t.status]),[['analyze_window','completed'],['get_evidence','completed']]);
  assert.equal(mock.launches.length,1);assert.deepEqual(mock.launches[0].args,['-m','agent_runtime.worker']);
  const childEnv=mock.launches[0].options.env;
  assert.equal(childEnv.AZURE_FOUNDRY_AUTH_TOKEN,'TEST-TOKEN');assert.equal(childEnv.AZURE_OPENAI_API_KEY,undefined);assert.equal(childEnv.UNRELATED_SECRET,undefined);assert.equal(childEnv.PYTHONPATH,undefined);
  assert.doesNotMatch(JSON.stringify(mock.workers[0].received),/TEST-TOKEN|NOT-A-REAL-KEY/);
  assert.doesNotMatch(JSON.stringify(result),/TEST-TOKEN|NOT-A-REAL-KEY/);
  assert.equal(mock.workers[0].run.review,false);assert(mock.workers[0].run.deadline_ms<=40000);assert.equal(mock.workers[0].run.per_request_timeout_ms,12000);
  const direct=await explain(input,{env,bundle:fixture()});assert.equal(direct.cloud.verified,false);assert.equal(direct.fallbackReason,'agent_framework_requires_server');
});

test('one model repair reuses the session while the second failed plan becomes visible fallback',async()=>{
  const repaired=protocolMock({changeCandidate(message,child){if(child.repairs===0)message.plan={...message.plan,evidence_ids:[]};}});
  assert.equal((await run(repaired)).status,'cloud-verified');assert.equal(repaired.workers[0].validations[0].reason,'missing_claim_evidence');assert.equal(repaired.workers[0].validations.length,2);
  const invalid=protocolMock({changeCandidate(message){message.plan={...message.plan,claim_ids:['C:invented']};}}),failed=await run(invalid);
  assert.equal(failed.status,'fallback');assert.equal(failed.cloud.verified,false);assert.equal(failed.fallbackReason,'framework_repair_limit');assert.equal(invalid.workers[0].validations.length,1);assert(invalid.workers[0].kills.includes('SIGTERM'));
});

test('wrong player and future tools are rejected without executing a changed context',async()=>{
  const mock=protocolMock({onRun:child=>child.call('analyze_window',{...analysisArgs,player_id:'A9',end_time:8}),onResult(message,child){assert.equal(message.result.error,'invalid_tool_arguments');assert.equal(message.result.selected_context.player_id,'A7');assert.equal(message.result.selected_context.as_of_time,.8);child.line({type:'error',request_id:child.run.request_id,error:{code:'tool_limit',message:'UNTRUSTED EXCEPTION SECRET'}});return true;}});
  const result=await run(mock);assert.equal(result.cloud.verified,false);assert.equal(result.toolTrace[0].status,'rejected');assert.equal(result.fallbackReason,'tool_limit');assert.doesNotMatch(JSON.stringify(result),/UNTRUSTED EXCEPTION SECRET/);
});

test('stale, duplicate and malformed worker messages cannot be accepted',async t=>{
  const cases={
    'stale request ID':{onRun:child=>child.call('analyze_window',analysisArgs,{request_id:'stale-request'})},
    'duplicate native call':{onResult(_message,child){child.line(child.lastCall);return true;}},
    'unknown message field':{onRun:child=>child.call('analyze_window',analysisArgs,{untrusted:'SECRET'})},
    'wrong native framework':{onRun:child=>child.call('analyze_window',analysisArgs,{origin:{framework:'wrapper-only',provider,response_id:'MOCK-response-1',call_id:'MOCK-call-1'}})},
    'missing native provenance':{changeCandidate:message=>{message.trace.nativeToolCalls=[];message.trace.toolCalls=0;}},
    'invented provider model':{changeCandidate:message=>{message.trace.modelDeployment='OTHER';}},
    'done without accepted validation':{onRun:child=>child.done()},
    'error after done':{onValidation(_message,child){child.done();child.line({type:'error',request_id:child.run.request_id,error:{code:'cloud_timeout'}});}},
    'worker dies after accepted plan':{onValidation(_message,child){child.done();queueMicrotask(()=>child.close(2));}},
    'oversized line':{onRun:child=>child.stdout.write('X'.repeat(65538))},
    'non JSON stdout':{onRun:child=>child.stdout.write('SECRET INVALID OUTPUT\n')},
    'unbounded stderr':{onRun:child=>child.stderr.write('SECRET'.repeat(11000))}
  };
  for(const [name,options]of Object.entries(cases))await t.test(name,async()=>{const result=await run(protocolMock(options));assert.equal(result.cloud.verified,false);assert.equal(result.status,'fallback');assert.doesNotMatch(JSON.stringify(result),/SECRET|OTHER|wrapper-only/);});
});

test('accepted candidate cannot return before done and a clean close',async()=>{
  let child,settled=false;
  const mock=protocolMock({onValidation(message,worker){assert(message.accepted);child=worker;}}),pending=run(mock).then(result=>{settled=true;return result;});
  while(!child)await nextTurn();
  assert.equal(settled,false);child.done();await nextTurn();assert.equal(settled,false);child.close();assert.equal((await pending).cloud.verified,true);
});

test('abort and global timeout kill the request worker without accepting a late plan',async()=>{
  const controller=new AbortController(),mock=protocolMock({onRun:()=>{}}),pending=run(mock,{signal:controller.signal});
  while(!mock.workers[0]?.run)await nextTurn();controller.abort(new DOMException('Caller left','AbortError'));
  await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(mock.workers[0].kills,['SIGTERM']);
  const deadlineMock=protocolMock({onRun:()=>{}}),expired=await run(deadlineMock,{deadlineMs:10});
  assert.equal(expired.fallbackReason,'cloud_timeout');assert.equal(expired.cloud.verified,false);assert.deepEqual(deadlineMock.workers[0].kills,['SIGTERM']);
  const before=protocolMock();await assert.rejects(run(before,{signal:controller.signal}),{name:'AbortError'});assert.equal(before.workers.length,0);
});

test('real subprocess cleanup: cancellation reaps the request child and never returns stderr',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'maf-process-')),file=path.join(directory,'worker.mjs'),controller=new AbortController();let child;
  try{
    await writeFile(file,"process.stderr.write('PRIVATE-ERROR-BODY');process.stdin.resume();setInterval(()=>{},1000);");
    const pending=explainWithOrchestrator(input,{env,bundle:fixture(),signal:controller.signal,spawnImpl:(_exe,_args,options)=>(child=spawn(process.execPath,[file],options))});
    while(!child)await nextTurn();const closed=once(child,'close');controller.abort(new DOMException('Disconnected','AbortError'));
    await assert.rejects(pending,{name:'AbortError'});await closed;assert(child.signalCode||child.exitCode!==null);assert.throws(()=>process.kill(child.pid,0));
  }finally{child?.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('server MAF health follows verified configuration, disables its cache, and clears disconnected work',async()=>{
  let hang=false;
  const mock=protocolMock({onRun(child){if(!hang)child.call('analyze_window',analysisArgs);}}),mutableEnv={...env};
  const server=createServer({env:mutableEnv,loadBundle:async()=>fixture(),spawnImpl:mock.spawnImpl});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,post=()=>fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify(input)}).then(r=>r.json());
  try{
    assert.equal((await (await fetch(`${base}/api/health`)).json()).orchestrator,framework);
    assert.equal((await post()).cloud.verified,true);assert.equal((await post()).cached,undefined);assert.equal(mock.workers.length,2);
    assert.equal((await (await fetch(`${base}/api/health`)).json()).cloud.verified,true);
    mutableEnv.AZURE_OPENAI_DEPLOYMENT='CHANGED-MODEL';assert.equal((await (await fetch(`${base}/api/health`)).json()).cloud.verified,false);
    hang=true;const req=http.request(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'}});req.on('error',()=>{});req.end(JSON.stringify(input));
    while(mock.workers.length<3||!mock.workers[2].run)await nextTurn();req.destroy();
    while(!mock.workers[2].kills.length)await nextTurn();assert.equal((await (await fetch(`${base}/api/health`)).json()).cloud.verified,false);
    hang=false;const replacement=await post();assert.equal(replacement.cloud.verified,true);assert.equal(replacement.cached,undefined);
    assert.equal((await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json',origin:base.replace('http:','https:')},body:'{}'})).status,403);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('browser dependencies include the shared session and exclude the server worker bridge',async()=>{
  const pending=[new URL('../src/agent.mjs',import.meta.url)],seen=new Set();
  while(pending.length){const file=pending.pop();if(seen.has(file.href))continue;seen.add(file.href);const source=await readFile(file,'utf8');for(const match of source.matchAll(/(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)){assert(match[1].startsWith('.'));assert(!match[1].includes('maf-bridge'));pending.push(new URL(match[1],file));}}
  assert([...seen].some(file=>file.endsWith('/evidence-session.mjs')));
});

test('TLS-terminating deployments accept only the explicitly configured public origin',async()=>{
  for(const value of ['https://user:secret@demo.azurewebsites.net','https://demo.azurewebsites.net/path','https://demo.azurewebsites.net?','https://demo.azurewebsites.net/#','file:///tmp'])assert.throws(()=>createServer({env:{PUBLIC_ORIGIN:value}}),/PUBLIC_ORIGIN/);
  const server=createServer({env:{PUBLIC_ORIGIN:'https://demo.azurewebsites.net'},loadBundle:async()=>fixture()});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const request=origin=>fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json',origin,'x-forwarded-proto':'https','x-forwarded-host':'attacker.example'},body:JSON.stringify(input)});
    assert.equal((await request('https://demo.azurewebsites.net')).status,200);
    assert.equal((await request('https://attacker.example')).status,403);
    assert.equal((await request(base)).status,403);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
