import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisTools,explain,foundryConfiguration} from '../src/agent.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

// Local protocol fixtures only: these tests make no real model or Azure calls.
const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,language:'en',audience:'analyst'};
const env={FOUNDRY_API_STYLE:'chat-completions',AZURE_OPENAI_ENDPOINT:'https://chat-fixture.services.ai.azure.com',AZURE_OPENAI_DEPLOYMENT:'LOCAL-PROTOCOL-MOCK',AZURE_OPENAI_API_KEY:'NOT-A-REAL-KEY'};
const call=(name,args,id=name)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const analyze=(start=0,end=.8,player='A7')=>call('analyze_window',{player_id:player,start_time:start,end_time:end});
const evidence=()=>call('get_evidence',{evidence_ids:[]});
function completion(content=null,toolCalls=[],extra={}){
  return {choices:[{index:0,finish_reason:toolCalls.length?'tool_calls':'stop',message:{role:'assistant',content,...(toolCalls.length?{tool_calls:toolCalls}:{}),...extra}}]};
}
const toolResponse=(...calls)=>completion(null,calls);
const textResponse=plan=>completion(typeof plan==='string'?plan:JSON.stringify(plan));
function planFrom(body){
  const facts=JSON.parse(body.messages.findLast(message=>message.role==='tool').content);
  const claim=facts.claims.find(claim=>claim.kind==='current');
  return {claim_ids:[claim.id],evidence_ids:claim.evidence_ids,overlay_type:'receiving_heatmap'};
}
const final=(body,change=plan=>plan)=>textResponse(change(planFrom(body),JSON.parse(body.messages.findLast(message=>message.role==='tool').content)));
function provider(actions){
  const requests=[];
  const fetchImpl=async(url,options)=>{
    const body=JSON.parse(options.body),index=requests.length;
    requests.push({url,body,headers:options.headers,signal:options.signal});
    const action=actions[Math.min(index,actions.length-1)];
    const data=typeof action==='function'?action(body):action;
    return Response.json({id:`MOCK-ONLY-chat-${index+1}`,...data});
  };
  return {fetchImpl,requests};
}
const standard=change=>provider([toolResponse(analyze()),toolResponse(evidence()),body=>final(body,change)]);
const run=(mock,options={})=>explain(input,{bundle:fixture(),env,fetchImpl:mock.fetchImpl,...options});

test('Chat configuration normalizes resource routes while Responses remains the default',()=>{
  for(const host of ['chat-fixture.openai.azure.com','chat-fixture.services.ai.azure.com']){
    for(const path of ['','/','/openai/v1','/openai/v1/','/openai/v1/responses','/openai/v1/chat/completions/']){
      const config=foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:`https://${host}${path}`});
      assert.equal(config.configured,true);
      assert.equal(config.url,`https://${host}/openai/v1/chat/completions`);
      assert.equal(config.apiStyle,'chat-completions');
      assert.equal(config.endpointKind,'azure-resource');
    }
  }
  const defaultConfig=foundryConfiguration({...env,FOUNDRY_API_STYLE:undefined});
  assert.equal(defaultConfig.apiStyle,'responses');
  assert.equal(defaultConfig.url,'https://chat-fixture.services.ai.azure.com/openai/v1/responses');
  const project={...env,FOUNDRY_PROJECT_ENDPOINT:'https://chat-fixture.services.ai.azure.com/api/projects/test',AZURE_FOUNDRY_AUTH_TOKEN:'NOT-A-REAL-TOKEN'};
  assert.equal(foundryConfiguration({...project,FOUNDRY_API_STYLE:'responses'}).configured,true);
  assert.deepEqual(foundryConfiguration(project),{configured:false,reason:'project_chat_completions_unsupported'});
  assert.deepEqual(foundryConfiguration({...env,FOUNDRY_API_STYLE:'unknown'}),{configured:false,reason:'invalid_api_style'});
});

test('Chat configuration preserves endpoint restrictions and never sends rejected configurations',async()=>{
  const unsafe=['http://chat-fixture.openai.azure.com','https://unrelated.example','https://key:secret@chat-fixture.openai.azure.com','https://chat-fixture.openai.azure.com?api-key=secret','https://chat-fixture.openai.azure.com/#secret','https://chat-fixture.openai.azure.com/arbitrary','https://chat-fixture.openai.azure.com.evil.example/openai/v1'];
  for(const endpoint of unsafe){
    let calls=0;
    const result=await explain(input,{bundle:fixture(),env:{...env,AZURE_OPENAI_ENDPOINT:endpoint},fetchImpl:async()=>{calls++;}});
    assert.equal(calls,0);
    assert.equal(result.cloud.verified,false);
    assert.match(result.fallbackReason,/^invalid_endpoint/);
  }
});

test('Chat executes both native tools and returns locally verified evidence with truthful format traces',async()=>{
  const mock=provider([toolResponse(analyze(0,.4)),toolResponse(evidence()),final]);
  const result=await run(mock);
  assert.equal(result.status,'cloud-verified');
  assert.equal(result.source,'microsoft-foundry');
  assert.equal(result.cloud.apiStyle,'chat-completions');
  assert.equal(result.trace.apiStyle,'chat-completions');
  assert.equal(result.trace.outputMode,'json_object');
  assert.equal(result.trace.rounds,3);
  assert.deepEqual(result.trace.responseIds,['MOCK-ONLY-chat-1','MOCK-ONLY-chat-2','MOCK-ONLY-chat-3']);
  assert.deepEqual(result.toolTrace.map(item=>[item.name,item.status]),[['analyze_window','completed'],['get_evidence','completed']]);
  assert.equal(result.context.endTime,.4);
  assert.equal(result.overlay.frameId,'used:0004');
  assert(result.evidence.every(item=>item.t<=.4));
  assert.doesNotMatch(JSON.stringify(result),/NOT-A-REAL-KEY|strict_json_schema/);
  assert.equal(mock.requests.length,3);
  for(const {url,body,headers,signal} of mock.requests){
    assert.equal(url,'https://chat-fixture.services.ai.azure.com/openai/v1/chat/completions');
    assert.equal(headers['api-key'],env.AZURE_OPENAI_API_KEY);
    assert(signal instanceof AbortSignal);
    assert.equal(body.model,env.AZURE_OPENAI_DEPLOYMENT);
    assert.equal(body.max_tokens,1800);
    assert.equal(body.tool_choice,'auto');
    assert.deepEqual(body.response_format,{type:'json_object'});
    assert.deepEqual(body.tools.map(item=>item.function.name),['analyze_window','get_evidence']);
    for(const tool of body.tools){
      assert.equal(tool.type,'function');
      assert.equal(tool.function.parameters.type,'object');
      assert.equal(tool.function.parameters.additionalProperties,false);
      assert.equal(tool.function.strict,undefined);
      assert.equal(tool.name,undefined);
    }
    for(const absent of ['input','text','max_output_tokens','thinking','reasoning_effort','temperature','store','parallel_tool_calls'])assert.equal(body[absent],undefined,absent);
    assert.match(body.messages[0].content,/final JSON object.*claim_ids.*evidence_ids.*overlay_type/);
    assert(!body.messages.some(message=>Object.hasOwn(message,'reasoning_content')));
  }
  assert.deepEqual(mock.requests.map(({body})=>body.messages.map(message=>message.role)),[
    ['system','user'],['system','user','assistant','tool'],['system','user','assistant','tool','assistant','tool']
  ]);
  const history=mock.requests[2].body.messages;
  for(const index of [2,4])assert.equal(history[index+1].tool_call_id,history[index].tool_calls[0].id);
  assert(JSON.parse(history[3].content).summary);
  assert(JSON.parse(history[5].content).claims.length>0);
});

test('received reasoning_content survives tool continuation and repair without entering public output',async()=>{
  const reasoning=['PRIVATE-MODEL-CONTEXT-1','PRIVATE-MODEL-CONTEXT-2','PRIVATE-MODEL-CONTEXT-3'];
  const mock=provider([
    completion(null,[analyze()],{reasoning_content:reasoning[0],untrusted_extra:'discard-me'}),
    completion('',[evidence()],{reasoning_content:reasoning[1]}),
    body=>completion(JSON.stringify({...planFrom(body),claim_ids:['C:invented']}),[],{reasoning_content:reasoning[2]}),
    final
  ]);
  const result=await run(mock);
  assert.equal(result.status,'cloud-verified');
  assert.equal(result.trace.repairCount,1);
  assert.equal(result.toolTrace.filter(item=>item.name==='fact_validation').length,1);
  const assistants=mock.requests[3].body.messages.filter(message=>message.role==='assistant');
  assert.deepEqual(assistants.map(message=>message.reasoning_content),reasoning);
  assert(assistants.every(message=>message.untrusted_extra===undefined));
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-MODEL-CONTEXT|discard-me|NOT-A-REAL-KEY/);
});

test('multiple native calls in one response receive ordered matching tool results',async()=>{
  const mock=provider([toolResponse(analyze(),evidence()),final]);
  const result=await run(mock);
  assert.equal(result.status,'cloud-verified');
  const messages=mock.requests[1].body.messages;
  assert.deepEqual(messages.map(message=>message.role),['system','user','assistant','tool','tool']);
  assert.deepEqual(messages.slice(3).map(message=>message.tool_call_id),['analyze_window','get_evidence']);
  assert(JSON.parse(messages[4].content).claims.length>0);
});

test('JSON mode plans still reject fabricated, oversized, incomplete or unsupported results after one repair',async t=>{
  const cases=[
    ['invented claim',plan=>({...plan,claim_ids:['C:invented']}),'invalid_evidence_reference'],
    ['invented evidence',plan=>({...plan,evidence_ids:['E:invented']}),'invalid_evidence_reference'],
    ['empty claims',plan=>({...plan,claim_ids:[]}),'invalid_model_output'],
    ['nine claims',plan=>({...plan,claim_ids:Array(9).fill(plan.claim_ids[0])}),'invalid_model_output'],
    ['nine evidence IDs',plan=>({...plan,evidence_ids:Array(9).fill(plan.evidence_ids[0])}),'invalid_model_output'],
    ['missing claim evidence',plan=>({...plan,evidence_ids:[]}),'missing_claim_evidence'],
    ['unsupported overlay',plan=>({...plan,overlay_type:'event'}),'unsupported_overlay'],
    ['unknown overlay',plan=>({...plan,overlay_type:'invented'}),'invalid_model_output'],
    ['unverified prose',plan=>({...plan,text:'Guaranteed goal, 100 percent.'}),'invalid_model_output'],
    ['only limitations',(plan,facts)=>({...plan,claim_ids:[facts.claims.find(claim=>claim.kind==='limits').id],evidence_ids:[],overlay_type:'none'}),'missing_substantive_claim']
  ];
  for(const [name,change,reason] of cases)await t.test(name,async()=>{
    const mock=standard(change),result=await run(mock);
    assert.equal(result.status,'fallback');
    assert.equal(result.cloud.verified,false);
    assert.equal(result.fallbackReason,reason);
    assert.equal(result.trace.apiStyle,'chat-completions');
    assert.equal(result.trace.outputMode,'json_object');
    assert.equal(result.toolTrace.filter(item=>item.name==='fact_validation').length,1);
    assert.equal(mock.requests.length,4);
    assert.doesNotMatch(result.text,/Guaranteed goal|100 percent/);
  });
});

test('a limitations question may select verified claims with no associated frame evidence',async()=>{
  const mock=standard((_plan,facts)=>({claim_ids:[facts.claims.find(claim=>claim.kind==='limits').id],evidence_ids:[],overlay_type:'none'}));
  const result=await explain({...input,question:'What are the model limits?'},{bundle:fixture(),env,fetchImpl:mock.fetchImpl});
  assert.equal(result.status,'cloud-verified');
  assert.equal(result.claims[0].kind,'limits');
  assert.deepEqual(result.evidence,[]);
});

test('tool-shaped JSON in assistant content cannot execute tools or verify a plan',async()=>{
  const mock=provider([textResponse({tool_calls:[analyze(),evidence()],claim_ids:['C:invented'],evidence_ids:[],overlay_type:'none'})]);
  const result=await run(mock);
  assert.equal(result.status,'fallback');
  assert.equal(result.fallbackReason,'missing_tool_evidence');
  assert.equal(mock.requests.length,2);
  assert.deepEqual(result.toolTrace.map(item=>item.name),['fact_validation']);
  assert(!mock.requests[1].body.messages.some(message=>message.role==='tool'));
});

test('Chat rejects future windows and changes of the selected player',async t=>{
  for(const [name,invalid] of [['future',analyze(0,1)],['other player',analyze(0,.8,'A9')]])await t.test(name,async()=>{
    const mock=provider([toolResponse(invalid),toolResponse(evidence()),textResponse({claim_ids:['C:invented'],evidence_ids:[],overlay_type:'none'})]);
    const result=await run(mock);
    assert.equal(result.status,'fallback');
    assert.equal(result.fallbackReason,'missing_tool_evidence');
    assert.deepEqual(result.toolTrace.slice(0,2).map(item=>item.status),['rejected','rejected']);
    assert.equal(JSON.parse(mock.requests[1].body.messages.at(-1).content).error,'invalid_tool_arguments');
  });
});

test('Chat cannot cite claims that were available but were not retrieved',async()=>{
  const toolkit=createAnalysisTools(input,fixture());
  toolkit.execute('analyze_window',{player_id:'A7',start_time:0,end_time:.8});
  const all=toolkit.execute('get_evidence',{evidence_ids:[]}),current=all.claims.find(claim=>claim.kind==='current');
  const different=all.evidence.find(item=>!current.evidence_ids.includes(item.id));
  assert(different);
  const mock=provider([toolResponse(analyze()),toolResponse(call('get_evidence',{evidence_ids:[different.id]})),textResponse({claim_ids:[current.id],evidence_ids:current.evidence_ids,overlay_type:'receiving_heatmap'})]);
  const result=await run(mock);
  assert.equal(result.fallbackReason,'invalid_evidence_reference');
  assert.equal(result.cloud.verified,false);
});

test('Chat requires fresh evidence after a successful change of analysis window',async()=>{
  let oldPlan;
  const mock=provider([toolResponse(analyze()),toolResponse(evidence()),body=>{oldPlan=planFrom(body);return toolResponse(analyze(.4,.8));},()=>textResponse(oldPlan)]);
  const result=await run(mock);
  assert.equal(result.status,'fallback');
  assert.equal(result.fallbackReason,'invalid_evidence_reference');
  assert.equal(result.toolTrace.filter(item=>item.name==='get_evidence'&&item.status==='completed').length,1);
});

test('malformed Chat protocol messages are rejected before tools or evidence can be verified',async t=>{
  const invalidCall=change=>completion(null,[change(analyze())]);
  const cases=[
    ['Responses-shaped response',{output:[]},'invalid_provider_response'],
    ['multiple choices',{choices:[...completion().choices,...completion().choices]},'invalid_provider_response'],
    ['wrong role',completion('{}',[],{role:'user'}),'invalid_provider_response'],
    ['truncated output',{choices:[{finish_reason:'length',message:{role:'assistant',content:'{}'}}]},'invalid_provider_response'],
    ['missing tool calls',{choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null}}]},'invalid_tool_call'],
    ['bad call ID',invalidCall(call=>({...call,id:null})),'invalid_tool_call'],
    ['empty call ID',invalidCall(call=>({...call,id:''})),'invalid_tool_call'],
    ['bad call type',invalidCall(call=>({...call,type:'custom'})),'invalid_tool_call'],
    ['object arguments',invalidCall(call=>({...call,function:{...call.function,arguments:{}}})),'invalid_tool_call'],
    ['oversized arguments',invalidCall(call=>({...call,function:{...call.function,arguments:'x'.repeat(3001)}})),'invalid_tool_call'],
    ['duplicate call ID',toolResponse(analyze(),analyze()),'invalid_tool_call']
  ];
  for(const [name,data,reason] of cases)await t.test(name,async()=>{
    const mock=provider([data]),result=await run(mock);
    assert.equal(result.fallbackReason,reason);
    assert.equal(result.cloud.verified,false);
    assert.equal(mock.requests.length,1);
    assert.deepEqual(result.toolTrace,[]);
  });
});

test('Chat shares the provider deadline, round ceiling and ten-tool ceiling',async()=>{
  const deadline=standard(),expired=await run(deadline,{deadlineMs:0});
  assert.equal(expired.fallbackReason,'cloud_timeout');
  assert.equal(deadline.requests.length,0);
  const rounds=standard(),limited=await run(rounds,{maxRounds:2});
  assert.equal(limited.fallbackReason,'round_limit');
  assert.equal(rounds.requests.length,2);
  const tools=provider([toolResponse(analyze(),...Array.from({length:10},(_,index)=>call('get_evidence',{evidence_ids:[]},`evidence-${index}`)))]);
  const overLimit=await run(tools);
  assert.equal(overLimit.fallbackReason,'tool_limit');
  assert.equal(overLimit.toolTrace.length,10);
});

test('Chat retries a transient provider failure once with the same native request',async()=>{
  const mock=standard(),attempts=[];
  const result=await run(mock,{fetchImpl:async(url,options)=>{
    attempts.push(JSON.parse(options.body));
    if(attempts.length===1)return {ok:false,status:503};
    return mock.fetchImpl(url,options);
  }});
  assert.equal(result.status,'cloud-verified');
  assert.equal(attempts.length,4);
  assert.deepEqual(attempts[0],attempts[1]);
  assert.equal(result.toolTrace.filter(item=>item.name==='provider_retry').length,1);
  let calls=0;
  const unavailable=await run(mock,{fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
  assert.equal(unavailable.fallbackReason,'cloud_http_429');
  assert.equal(calls,2);
});

test('caller cancellation interrupts a Chat retry without a fallback or another request',async()=>{
  const controller=new AbortController();let calls=0,started;
  const firstCall=new Promise(resolve=>{started=resolve;});
  const result=explain(input,{bundle:fixture(),env,signal:controller.signal,fetchImpl:async()=>{calls++;started();return {ok:false,status:503};}});
  const rejected=assert.rejects(result,{name:'AbortError'});
  await firstCall;await nextTurn();
  controller.abort();
  await rejected;
  assert.equal(calls,1);
});

test('Chat caller cancellation prevents requests, late responses and final JSON verification',async()=>{
  const before=new AbortController();before.abort();let calls=0;
  await assert.rejects(explain(input,{bundle:fixture(),env,signal:before.signal,fetchImpl:async()=>{calls++;}}),{name:'AbortError'});
  assert.equal(calls,0);
  const late=new AbortController();
  await assert.rejects(explain(input,{bundle:fixture(),env,signal:late.signal,fetchImpl:async()=>{calls++;late.abort();return Response.json(toolResponse(analyze()));}}),{name:'AbortError'});
  assert.equal(calls,1);
  const parsing=new AbortController(),mock=standard();let rounds=0;
  await assert.rejects(run(mock,{signal:parsing.signal,fetchImpl:async(url,options)=>{
    rounds++;
    const response=await mock.fetchImpl(url,options);
    if(rounds<3)return response;
    return {ok:true,json:async()=>{const data=await response.json();parsing.abort();return data;}};
  }}),{name:'AbortError'});
  assert.equal(rounds,3);
});

test('Chat per-request timeout retains a visible unverified fallback',async()=>{
  const keepAlive=setTimeout(()=>{},1000);
  try{
    let signal;
    const result=await explain(input,{bundle:fixture(),env,timeoutMs:10,fetchImpl:async(_url,options)=>{
      signal=options.signal;
      return new Promise((_resolve,reject)=>{
        const abort=()=>reject(signal.reason);
        if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
      });
    }});
    assert.equal(signal.aborted,true);
    assert.equal(result.fallbackReason,'cloud_timeout');
    assert.equal(result.cloud.verified,false);
    assert.equal(result.trace.apiStyle,'chat-completions');
  }finally{clearTimeout(keepAlive);}
});
