import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/das-bundle.mjs';
import {offlineExplain,createAnalysisTools,explain,foundryConfiguration} from '../src/agent.mjs';

const input={scenarioId:'used',playerId:'A7',asOfTime:.8,windowSeconds:1,language:'en',audience:'analyst'};
const env={AZURE_OPENAI_ENDPOINT:'https://example.openai.azure.com',AZURE_OPENAI_DEPLOYMENT:'test',AZURE_OPENAI_API_KEY:'TEST-NOT-A-KEY'};
test('future frames and events cannot change an earlier explanation',()=>{
  const a=fixture(),b=fixture();for(const f of b.analysis.frames)if(f.t>.8){f.players.A7.das=999999;f.status='valid';}
  b.scenario.events.push({id:'future-made-up',type:'reception',t:1.9,frameId:'used:0019',frameIndex:19,playerId:'A7'});
  assert.deepEqual(offlineExplain(input,a),offlineExplain(input,b));
});
test('received/not-selected outcomes require occurred events',()=>{
  assert(!offlineExplain(input,fixture()).claims.some(c=>c.kind==='outcome'));
  const r=offlineExplain({...input,asOfTime:1.2,windowSeconds:1.2},fixture());
  assert(r.claims.some(c=>c.kind==='outcome'&&c.text.includes('receives')));
  assert(r.evidence.every(e=>e.t<=1.2));
});
test('carrier, defender and flight states do not show fictitious numeric current scores',()=>{
  for(const [asOfTime,playerId] of [[1,'A7'],[1.2,'A7'],[.8,'B3']]){
    const r=offlineExplain({...input,asOfTime,playerId},fixture());
    assert(r.claims.some(c=>c.kind==='availability'));
    assert(!r.claims.some(c=>c.kind==='current'));
  }
});
test('windows split at ball flight and new carrier instead of joining the curve',()=>{
  const tools=createAnalysisTools({...input,playerId:'A9',asOfTime:2,windowSeconds:2},fixture());
  const result=tools.execute('analyze_window',{player_id:'A9',start_time:0,end_time:2});
  assert.equal(result.summary.startTime,1.2);assert.equal(result.summary.endTime,2);
});
test('tools reject future, unknown player, missing time and unknown evidence',()=>{
  const t=createAnalysisTools(input,fixture());
  assert.throws(()=>t.execute('get_evidence',{evidence_ids:[]}));
  for(const args of [{player_id:'A7',start_time:0,end_time:1},{player_id:'A9',start_time:0,end_time:.8},{player_id:'A7'}])assert.throws(()=>t.execute('analyze_window',args));
  t.execute('analyze_window',{player_id:'A7',start_time:0,end_time:.8});
  assert.throws(()=>t.execute('get_evidence',{evidence_ids:['invented']}));
});
test('language and audience alter presentation while preserving underlying numeric facts',()=>{
  const en=offlineExplain(input,fixture()),zh=offlineExplain({...input,language:'zh',audience:'fan'},fixture());
  assert.deepEqual(en.context,zh.context);assert.deepEqual(en.summary,zh.summary);
  assert.notEqual(en.text,zh.text);assert(en.claims.length>zh.claims.length);
});
test('the visible model-limits question answers the limitation rather than an unrelated change',()=>{
  for(const [language,question] of [['en','Model limits'],['zh','模型局限']]){
    const r=offlineExplain({...input,audience:'fan',language,question},fixture());
    assert.equal(r.claims.length,1);assert.equal(r.claims[0].kind,'limits');
    assert(r.text.length>0);assert.equal(r.overlay.type,'none');
  }
});
test('cloud configuration accepts resource paths and rejects secret-bearing or unrelated URLs',()=>{
  assert(foundryConfiguration(env).configured);
  assert(foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:'https://example.openai.azure.com/openai/v1/responses'}).configured);
  for(const url of ['http://example.openai.azure.com','https://example.com','https://a:b@example.openai.azure.com','https://example.openai.azure.com?key=x','https://example.openai.azure.com/arbitrary'])assert(!foundryConfiguration({...env,AZURE_OPENAI_ENDPOINT:url}).configured);
});

function fakeProvider({invalidFinal=false}={}){
  let calls=0;return async (_url,opts)=>{
    calls++;const body=JSON.parse(opts.body);
    if(calls===1)return Response.json({id:'fixture-response-1',output:[{type:'function_call',call_id:'a',name:'analyze_window',arguments:JSON.stringify({player_id:'A7',start_time:0,end_time:.8})}]});
    if(calls===2)return Response.json({id:'fixture-response-2',output:[{type:'function_call',call_id:'b',name:'get_evidence',arguments:'{"evidence_ids":[]}'}]});
    const output=body.input.findLast(x=>x.type==='function_call_output');
    const pack=JSON.parse(output.output),claim=pack.claims.find(c=>c.kind==='current');
    const plan={claim_ids:[invalidFinal?'C:invented':claim.id],evidence_ids:claim.evidence_ids,overlay_type:'receiving_heatmap'};
    return Response.json({id:`fixture-response-${calls}`,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan)}]}]});
  };
}
test('simulated provider must actually traverse both tools before verified rendering',async()=>{
  const r=await explain(input,{bundle:fixture(),env,fetchImpl:fakeProvider()});
  assert.equal(r.source,'microsoft-foundry');assert(r.cloud.verified);
  assert.deepEqual(r.toolTrace.map(t=>t.name),['analyze_window','get_evidence']);
  assert(r.evidence.every(e=>e.t<=input.asOfTime));assert(!JSON.stringify(r).includes(env.AZURE_OPENAI_API_KEY));
});
test('fabricated final reference gets exactly one correction then transparent fallback',async()=>{
  const r=await explain(input,{bundle:fixture(),env,fetchImpl:fakeProvider({invalidFinal:true})});
  assert.equal(r.status,'fallback');assert.equal(r.cloud.verified,false);
  assert.equal(r.toolTrace.filter(t=>t.name==='fact_validation').length,1);
  assert.equal(r.fallbackReason,'invalid_evidence_reference');
});
test('an unconfigured run makes no network request and never claims real AI',async()=>{
  const r=await explain(input,{bundle:fixture(),env:{},fetchImpl:()=>{throw new Error('Unexpected network call');}});
  assert.equal(r.source,'offline-template');assert.equal(r.cloud.verified,false);
});
