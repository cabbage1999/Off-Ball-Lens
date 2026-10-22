import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineExplain,explain,validateExplainRequest,createAnalysisTools,foundryConfiguration} from '../src/agent.mjs';
import {generateScenario} from '../src/scenarios.mjs';
import {compareRun} from '../src/model.mjs';

const env={AZURE_OPENAI_ENDPOINT:'https://test-resource.openai.azure.com',AZURE_OPENAI_API_KEY:'unit-test-not-a-secret',AZURE_OPENAI_DEPLOYMENT:'test-deployment'};
const input={scenarioId:'diagonal',startTime:2.5,horizon:2.5,playerId:'A7'};
const call=(name,args,id=name)=>({type:'function_call',call_id:id,name,arguments:JSON.stringify(args)});
const calls=[call('analyze_window',{player_id:'A7',start_time:2.5,end_time:5}),call('compare_run',{player_id:'A7',start_time:2.5,horizon:2.5,alternative:'hold-width'}),call('get_evidence',{evidence_ids:[]})];
const final=plan=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan)}]}]});
const goodPlan={focus:'comparison',claim_ids:['C_AVG','C_LANE','C_LIMIT'],evidence_ids:['E_PEAK','E_START','E_END']};
const ok=data=>({ok:true,json:async()=>data});

test('offline mode executes local tools, returns evidence, and does not claim cloud verification',async()=>{
  let fetched=false;const result=await explain(input,{env:{},fetchImpl:async()=>{fetched=true;}});
  assert.equal(fetched,false);assert.equal(result.source,'offline-template');assert.equal(result.cloud.verified,false);
  assert.deepEqual(result.toolTrace.map(t=>t.name),['analyze_window','compare_run','get_evidence']);
  assert.ok(result.claims.some(c=>c.id==='C_LIMIT'));assert.ok(result.evidence.every(e=>Number.isInteger(e.frameIndex)));
});

test('mocked provider contract: actual tool execution round trip and validated evidence selection',async()=>{
  const requests=[];
  const fetchImpl=async(url,options)=>{
    assert.equal(url,'https://test-resource.openai.azure.com/openai/v1/responses');
    assert.equal(options.headers['api-key'],'unit-test-not-a-secret');
    const body=JSON.parse(options.body);requests.push(body);
    return requests.length===1?ok({output:calls}):ok(final(goodPlan));
  };
  const result=await explain(input,{env,fetchImpl});
  assert.equal(result.source,'microsoft-foundry');assert.equal(result.status,'cloud-verified');
  assert.equal(result.cloud.verified,true);assert.equal(requests.length,2);
  assert.equal(requests[1].input.filter(m=>m.type==='function_call_output').length,3);
  const expected=compareRun(generateScenario('diagonal')).summary.meanDelta;
  assert.ok(result.text.includes(`${expected>=0?'+':''}${expected.toFixed(1)}`));assert.ok(!JSON.stringify(result).includes(env.AZURE_OPENAI_API_KEY));
});

test('unknown evidence IDs cannot reach the rendered explanation',async()=>{
  let n=0;const result=await explain(input,{env,fetchImpl:async()=>++n===1?ok({output:calls}):ok(final({...goodPlan,claim_ids:['C_AVG','FABRICATED_CLAIM']}))});
  assert.equal(result.status,'fallback');assert.equal(result.fallbackReason,'invalid_evidence_reference');
  assert.equal(result.text.includes('FABRICATED'),false);assert.equal(result.cloud.verified,false);
});

test('free-form claims and invented numbers are rejected by schema validation',async()=>{
  let n=0;const result=await explain(input,{env,fetchImpl:async()=>++n===1?ok({output:calls}):ok(final({...goodPlan,text:'This run gives a 99 percent success probability.'}))});
  assert.equal(result.status,'fallback');assert.equal(result.fallbackReason,'invalid_model_output');assert.ok(!result.text.includes('99 percent success probability'));
});

test('tool parameters are constrained to the selected player and time window',()=>{
  const tools=createAnalysisTools(input);
  assert.throws(()=>tools.execute('compare_run',{player_id:'A7',start_time:0,horizon:2.5,alternative:'hold-width'}));
  assert.throws(()=>tools.execute('analyze_window',{player_id:'A7',start_time:2.5,end_time:100}));
  assert.throws(()=>tools.execute('get_evidence',{evidence_ids:['DOES_NOT_EXIST']}));
  assert.throws(()=>tools.execute('read_files',{}));
});

test('missing tool use cannot be passed off as a grounded cloud explanation',async()=>{
  const result=await explain(input,{env,fetchImpl:async()=>ok(final(goodPlan))});
  assert.equal(result.status,'fallback');assert.equal(result.fallbackReason,'missing_tool_evidence');
});

test('HTTP errors and bounded tool loops produce transparent local fallbacks',async()=>{
  const bad=await explain(input,{env,fetchImpl:async()=>({ok:false,status:401})});
  assert.equal(bad.fallbackReason,'cloud_http_401');assert.equal(bad.source,'offline-template');
  const loop=await explain(input,{env,maxRounds:2,fetchImpl:async()=>ok({output:[calls[0]]})});
  assert.equal(loop.fallbackReason,'round_limit');assert.equal(loop.toolTrace.length,2);
});

test('request timeouts are bounded and recorded without exposing provider content',async()=>{
  const fetchImpl=(_url,{signal})=>new Promise((_resolve,reject)=>{
    const timer=setTimeout(()=>{},100);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  });
  const result=await explain(input,{env,fetchImpl,timeoutMs:10});assert.equal(result.fallbackReason,'cloud_timeout');
});

test('configuration accepts the documented Azure route and rejects arbitrary destinations',()=>{
  assert.equal(foundryConfiguration(env).configured,true);
  assert.equal(foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:'https://example.com'}).configured,false);
  assert.equal(foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:'https://x.services.ai.azure.com/models'}).configured,false);
  assert.equal(foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:'http://x.openai.azure.com'}).configured,false);
});

test('invalid and oversized inputs fail before any cloud request',()=>{
  assert.throws(()=>validateExplainRequest({question:'a'.repeat(1001)}));
  assert.throws(()=>validateExplainRequest({params:{maxPassTime:1000}}));
  assert.throws(()=>validateExplainRequest({scenarioId:'private'}));
});

test('offline question focus changes selected evidence without inventing claims',()=>{
  const result=offlineExplain({scenarioId:'early',question:'为什么越位？',language:'zh'});
  assert.equal(result.focus,'legality');assert.ok(result.claims.some(c=>c.id==='C_OFFSIDE'));
  assert.ok(result.evidence.some(e=>e.id==='E_OFFSIDE'));
});

test('an invalid single-sample comparison returns unavailable without a cloud request or average claim',async()=>{
  let calls=0;
  const result=await explain({...input,startTime:7.4},{env,fetchImpl:async()=>{calls++;return ok(final(goodPlan));}});
  assert.equal(calls,0);assert.equal(result.status,'unavailable');assert.equal(result.cloud.verified,false);
  assert.equal(result.context.valid,false);assert.equal(result.fallbackReason,'no_comparison_window');
  assert.ok(result.claims.some(c=>c.id==='C_NO_WINDOW'));
  assert.ok(result.claims.every(c=>!['C_AVG','C_PEAK'].includes(c.id)));
  assert.match(result.text,/no usable pre-release possession window/);
});
