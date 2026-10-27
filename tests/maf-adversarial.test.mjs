/** Independent failure cases. Mock children below do not establish a real Azure run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {explainWithOrchestrator} from '../src/maf-bridge.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

const FRAMEWORK='microsoft-agent-framework',PROVIDER='azure-openai-responses';
const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,audience:'analyst',language:'en'};
const env={FOUNDRY_ORCHESTRATOR:'agent-framework',AZURE_OPENAI_ENDPOINT:'https://westus3.api.cognitive.microsoft.com/openai/v1/responses',AZURE_OPENAI_DEPLOYMENT:'INDEPENDENT-PROTOCOL-FIXTURE',AZURE_OPENAI_API_KEY:'LOCAL-FAKE-CREDENTIAL'};
const interval={player_id:'A7',start_time:0,end_time:.8};
const planFrom=facts=>{const claim=facts.claims.find(c=>c.kind==='current');return {claim_ids:[claim.id],evidence_ids:[...claim.evidence_ids],overlay_type:'receiving_heatmap'};};

function childScenario(scenario){
  const children=[];
  const spawnImpl=()=>{
    const child=new EventEmitter(),inbox=[],waiters=[],responses=[],native=[];
    child.stdout=new PassThrough();child.stderr=new PassThrough();child.kills=[];child.repairs=0;let pending='',closed=false,serial=0;
    child.receive=()=>inbox.length?Promise.resolve(inbox.shift()):new Promise(resolve=>waiters.push(resolve));
    child.send=message=>{if(!closed)child.stdout.write(JSON.stringify({request_id:child.run.request_id,...message})+'\n');};
    child.close=(code=0,signal=null)=>{if(closed)return;closed=true;child.stdout.end();child.stderr.end();child.emit('close',code,signal);};
    child.kill=signal=>{child.kills.push(signal);queueMicrotask(()=>child.close(null,signal));return true;};
    child.stdin=new Writable({write(chunk,_encoding,callback){
      pending+=chunk.toString();let end;
      while((end=pending.indexOf('\n'))!==-1){const message=JSON.parse(pending.slice(0,end));pending=pending.slice(end+1);const waiter=waiters.shift();waiter?waiter(message):inbox.push(message);}
      callback();
    }});
    child.tool=async(name,args)=>{
      const call_id=`independent-call-${++serial}`,response_id=`independent-response-${serial}`;
      responses.push(response_id);const record={call_id,response_id,name,status:'rejected',dispatched:true,rejectionSource:'node'};native.push(record);
      child.send({type:'tool_call',call_id,name,arguments:args,origin:{framework:FRAMEWORK,provider:PROVIDER,response_id,call_id}});
      const reply=await child.receive();assert.equal(reply.type,'tool_result');assert.equal(reply.call_id,call_id);
      if(!reply.result.error){record.status='completed';delete record.rejectionSource;}
      return reply.result;
    };
    child.proof=()=>({trace:{framework:FRAMEWORK,provider:PROVIDER,frameworkVersion:'1.23.0',providerVersion:'1.17.0',modelDeployment:child.run.model,modelRequests:responses.length,rounds:responses.length,toolCalls:native.length,responseIds:[...responses],nativeToolCalls:native.map(x=>({...x})),repairCount:child.repairs,elapsedMs:1,apiStyle:'responses',outputMode:'strict_json_schema'},agentTrace:[{agent:'receiving-space-analyst',event:'agent_run',status:'completed'},...native.map(c=>({agent:'receiving-space-analyst',event:'tool_call',status:c.status,callId:c.call_id,responseId:c.response_id,tool:c.name}))]});
    child.candidate=async(plan,mutate=()=>{})=>{
      responses.push(`independent-final-${++serial}`);
      const message={type:'candidate',plan,...child.proof()};mutate(message);child.send(message);
      const reply=await child.receive();if(reply.accepted===false)child.repairs++;return reply;
    };
    child.done=(mutate=()=>{})=>{const message={type:'done',...child.proof()};mutate(message);child.send(message);};
    child.validPlan=async()=>{await child.tool('analyze_window',interval);return planFrom(await child.tool('get_evidence',{evidence_ids:[]}));};
    children.push(child);
    void (async()=>{child.run=await child.receive();await scenario(child);})().catch(error=>{child.scenarioError=error;child.close(2);});
    return child;
  };
  return {spawnImpl,children};
}
const run=(mock,options={})=>explainWithOrchestrator(input,{env,bundle:fixture(),spawnImpl:mock.spawnImpl,deadlineMs:2000,...options});

test('a same-window reanalysis invalidates prior retrieval even when every ID is identical',async()=>{
  const mock=childScenario(async child=>{
    const stale=await child.validPlan();await child.tool('analyze_window',interval);
    const verdict=await child.candidate(stale);assert.equal(verdict.accepted,false);assert.equal(verdict.reason,'invalid_evidence_reference');
    await child.candidate(stale);
  });
  const answer=await run(mock);
  assert.equal(answer.cloud.verified,false);assert.equal(answer.fallbackReason,'framework_repair_limit');
  assert.deepEqual(answer.toolTrace.filter(t=>t.status==='completed').map(t=>t.name),['analyze_window','get_evidence','analyze_window']);
  assert.equal(mock.children[0].scenarioError,undefined);
});

test('middleware proof must account for the exact dispatched calls and stay inside every cap',async t=>{
  const cases={
    'seventh model request':message=>{message.trace.modelRequests=7;message.trace.rounds=7;},
    'eleven reported native calls':message=>{message.trace.toolCalls=11;},
    'wrong provider response binding':message=>{message.trace.nativeToolCalls[0].response_id=message.trace.responseIds.at(-1);},
    'completed dispatch rewritten as Python rejection':message=>{Object.assign(message.trace.nativeToolCalls[0],{dispatched:false,status:'rejected',rejectionSource:'python'});},
    'unexecuted completed native call':message=>{message.trace.nativeToolCalls.push({call_id:'invented',response_id:message.trace.responseIds[0],name:'get_evidence',status:'completed',dispatched:true});message.trace.toolCalls++;},
    'tool evidence assigned to a different agent':message=>{message.agentTrace[0].agent='invented-reviewer';},
  };
  for(const [name,mutate]of Object.entries(cases))await t.test(name,async()=>{
    const mock=childScenario(async child=>{const plan=await child.validPlan();await child.candidate(plan,mutate);});
    const answer=await run(mock);assert.equal(answer.cloud.verified,false);assert.equal(answer.fallbackReason,'framework_identity_mismatch');
  });
});

test('native call proof cannot change between accepted candidate and done',async()=>{
  const mock=childScenario(async child=>{
    const plan=await child.validPlan();assert.equal((await child.candidate(plan)).accepted,true);
    child.done(message=>{message.trace.nativeToolCalls[0].response_id=message.trace.responseIds.at(-1);});child.close();
  });
  const answer=await run(mock);assert.equal(answer.cloud.verified,false);assert.equal(answer.fallbackReason,'framework_identity_mismatch');
});

test('cancellation between done and close cannot return a verified answer',async()=>{
  const controller=new AbortController();
  const mock=childScenario(async child=>{
    const plan=await child.validPlan();assert.equal((await child.candidate(plan)).accepted,true);
    child.done();controller.abort(new DOMException('Client disconnected before process close','AbortError'));child.close();
  });
  await assert.rejects(run(mock,{signal:controller.signal}),{name:'AbortError'});
  assert.deepEqual(mock.children[0].kills,['SIGTERM']);
});

test('a partial extra output after done prevents a success on clean close',async()=>{
  const mock=childScenario(async child=>{
    const plan=await child.validPlan();assert.equal((await child.candidate(plan)).accepted,true);
    child.done();child.stdout.write('{"unfinished":');child.close();
  });
  const answer=await run(mock);assert.equal(answer.cloud.verified,false);assert.equal(answer.fallbackReason,'framework_worker_failed');
});

test('a child that ignores SIGTERM is killed and reaped before cancellation resolves',{timeout:5000},async()=>{
  const controller=new AbortController();let child,readyResolve;
  const ready=new Promise(resolve=>{readyResolve=resolve;});
  const pending=explainWithOrchestrator(input,{env,bundle:fixture(),signal:controller.signal,deadlineMs:4000,spawnImpl:(_python,_args,options)=>{
    child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdin.resume();process.stderr.write('ready');setInterval(()=>{},1000);"],options);
    child.stderr.once('data',readyResolve);return child;
  }});
  try{
    await ready;const closed=once(child,'close');controller.abort(new DOMException('Force cleanup audit','AbortError'));
    await assert.rejects(pending,{name:'AbortError'});await closed;
    assert.equal(child.signalCode,'SIGKILL');assert.throws(()=>process.kill(child.pid,0));
  }finally{child?.kill('SIGKILL');}
});

test('real MAF subprocess and JSONL bridge render only Node-retrieved canonical facts',{timeout:15000},async t=>{
  const python=fileURLToPath(new URL('../.venv-maf/bin/python',import.meta.url));
  try{await access(python);}catch{t.skip('Dedicated MAF environment is not installed; run npm run setup:agent first.');return;}
  let child;
  const answer=await explainWithOrchestrator(input,{env,bundle:fixture(),deadlineMs:12000,spawnImpl:(_python,_args,options)=>
    (child=spawn(python,['-m','agent_runtime.tests.fake_provider_worker'],options))});
  assert.equal(answer.status,'cloud-verified',answer.fallbackReason);assert.equal(answer.orchestrator,FRAMEWORK);
  assert.equal(answer.trace.frameworkVersion,'1.23.0');assert.equal(answer.trace.providerVersion,'1.17.0');
  assert.equal(answer.trace.modelRequests,3);assert.equal(answer.trace.toolCalls,2);assert.equal(answer.trace.repairCount,0);
  assert.deepEqual(answer.trace.responseIds,['resp_process_fixture_1','resp_process_fixture_2','resp_process_fixture_3']);
  assert.deepEqual(answer.trace.nativeToolCalls.map(call=>[call.name,call.status,call.dispatched]),[['analyze_window','completed',true],['get_evidence','completed',true]]);
  assert.deepEqual(answer.toolTrace.map(call=>call.callId),['call_fixture_analysis','call_fixture_evidence']);
  assert.deepEqual(answer.evidence.map(e=>[e.id,e.playerId,e.t,e.as,e.das]),[['E:used:0008:A7','A7',.8,28,4]]);
  assert.match(answer.text,/4\.00 danger-weighted m²/);assert.equal(answer.context.endTime,.8);
  assert.equal(child.exitCode,0);assert.throws(()=>process.kill(child.pid,0));
  assert.doesNotMatch(JSON.stringify(answer),/LOCAL-FAKE-CREDENTIAL/);
});
