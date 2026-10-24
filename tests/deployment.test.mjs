import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,cp,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from '../server.mjs';
import {checkDeployment,parseDeploymentUrl} from '../scripts/smoke-deployment.mjs';
import {fixture} from './fixtures/das-bundle.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FAKE_ENV={AZURE_OPENAI_ENDPOINT:'https://fixture.openai.azure.com',AZURE_OPENAI_DEPLOYMENT:'SIMULATION-NOT-A-REAL-DEPLOYMENT',AZURE_OPENAI_API_KEY:'FIXTURE-NOT-A-CREDENTIAL'};
const SECRET_SENTINEL='UNKNOWN-SERVER-CONTENT-MUST-NEVER-BE-SAVED';
let directory,fixtureRoot,artifactNumber=0;
const sha=value=>createHash('sha256').update(value).digest('hex');

before(async()=>{
  directory=await realpath(await mkdtemp(path.join(tmpdir(),'off-ball-deployment-')));fixtureRoot=path.join(directory,'site');
  await mkdir(path.join(fixtureRoot,'data','analysis'),{recursive:true});await mkdir(path.join(fixtureRoot,'src'),{recursive:true});
  for(const name of ['index.html','app.mjs','style.css','src/analysis.mjs','src/agent.mjs','src/evidence.mjs'])await copyFile(path.join(ROOT,name),path.join(fixtureRoot,name));
  for(const id of ['used','unused','blocked']){
    const bundle=JSON.parse(JSON.stringify(fixture()).replaceAll('used:',`${id}:`));
    bundle.scenario.metadata.id=id;bundle.analysis.scenarioId=id;
    const scenario=JSON.stringify(bundle.scenario);bundle.analysis.inputFileHash=sha(scenario);
    await writeFile(path.join(fixtureRoot,'data',`${id}.json`),scenario);
    await writeFile(path.join(fixtureRoot,'data','analysis',`${id}.json`),JSON.stringify(bundle.analysis));
  }
});
after(async()=>{await rm(directory,{recursive:true,force:true});});

async function listen(server){
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server){
  const closed=once(server,'close');server.close();server.closeAllConnections();await closed;
}
async function run(server,options={}){
  const baseUrl=await listen(server),artifactPath=path.join(directory,'reports',`${++artifactNumber}.json`);
  try{
    const report=await checkDeployment({baseUrl,root:fixtureRoot,artifactPath,timeoutMs:2000,totalTimeoutMs:15000,...options});
    const saved=JSON.parse(await readFile(artifactPath,'utf8'));assert.deepEqual(saved,report);
    assert(!JSON.stringify(saved).includes(SECRET_SENTINEL));
    return {report,baseUrl};
  }finally{await close(server);}
}

/** The application still runs as a real HTTP Node service; only its external provider is simulated. */
function protocolProvider({start=.2,end=.6}={}){
  let calls=0;
  const fetchImpl=async(_url,options)=>{
    calls++;const body=JSON.parse(options.body);
    if(calls===1)return Response.json({id:'resp_fixture_1',output:[{type:'function_call',call_id:'analysis',name:'analyze_window',arguments:JSON.stringify({player_id:'A7',start_time:start,end_time:end})}]});
    if(calls===2)return Response.json({id:'resp_fixture_2',output:[{type:'function_call',call_id:'evidence',name:'get_evidence',arguments:'{"evidence_ids":[]}'}]});
    const facts=JSON.parse(body.input.findLast(item=>item.type==='function_call_output').output);
    const current=facts.claims.find(c=>c.kind==='current')??facts.claims.find(c=>c.kind==='availability');
    return Response.json({id:'resp_fixture_3',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({claim_ids:[current.id],evidence_ids:current.evidence_ids,overlay_type:current.kind==='current'?'receiving_heatmap':'none'})}]}]});
  };
  return {fetchImpl,get calls(){return calls;}};
}

/** Tamper a real service response to exercise what the remote deployment checker distrusts. */
function nodeService({provider,mutate,seen=[],root=fixtureRoot}={}){
  const server=createServer({root,env:provider?FAKE_ENV:{},...(provider?{fetchImpl:provider.fetchImpl}:{})});
  const handler=server.listeners('request')[0];server.removeAllListeners('request');
  server.on('request',(req,res)=>{
    seen.push({url:req.url,method:req.method,origin:req.headers.origin});
    if(mutate){
      const writeHead=res.writeHead.bind(res),end=res.end.bind(res);
      res.writeHead=(status,headers)=>{const safe={...headers};delete safe['content-length'];return writeHead(status,safe);};
      res.end=body=>end(mutate(req.url,body));
    }
    handler(req,res);
  });
  return server;
}
function mutateExplain(change){return (url,body)=>url==='/api/explain'?JSON.stringify(change(JSON.parse(body))):body;}

test('URL boundary accepts root HTTPS and exact loopback; rejects secrets, paths, aliases, and insecure public targets',()=>{
  assert.equal(parseDeploymentUrl('https://deployment.azurewebsites.net/').loopback,false);
  assert.equal(parseDeploymentUrl('http://127.0.0.1:4173').loopback,true);
  for(const url of ['http://deployment.azurewebsites.net','https://user:password@deployment.azurewebsites.net/','https://deployment.azurewebsites.net/?key=secret','https://deployment.azurewebsites.net/#token','https://deployment.azurewebsites.net/?','https://deployment.azurewebsites.net/#','https://deployment.azurewebsites.net/Off-Ball-Lens/','https://deployment.azurewebsites.net/api/','https://deployment.azurewebsites.net/x/../','https://deployment.azurewebsites.net//','https://deployment.azurewebsites.net\\','http://127.1:4173','http://2130706433:4173','file:///tmp/site'])assert.throws(()=>parseDeploymentUrl(url),undefined,url);
});

test('a static Pages-style host without the JSON API cannot pass',async()=>{
  const server=http.createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(`<html>${SECRET_SENTINEL}</html>`);});
  const {report}=await run(server,{offline:true});
  assert.equal(report.passed,false);assert.equal(report.failure.stage,'health-before');assert.equal(report.failure.code,'content_type_mismatch');assert.equal(report.realCloudVerified,false);
});

test('offline HTTP service matches all six scene/analysis bytes and canonical facts without cloud claims',async()=>{
  const seen=[],{report,baseUrl}=await run(nodeService({seen}),{offline:true});
  assert.equal(report.passed,true,JSON.stringify(report.failure));assert.equal(report.mode,'offline');assert.equal(report.scope,'local-http-offline');assert.equal(report.realCloudVerified,false);assert.equal(report.cloudProtocolVerified,false);assert.equal(report.serverReportedCloudVerified,false);
  assert.equal(report.files.length,12);assert.equal(report.files.filter(f=>f.path.startsWith('data/')).length,6);assert(report.files.every(f=>f.matched&&f.localSha256===f.remoteSha256));
  assert.deepEqual(report.catalog.scenarioIds,['used','unused','blocked']);
  assert.equal(report.explanation.summary.peakDAS,6);assert.equal(report.explanation.summary.peakTime,.4);assert.equal(report.explanation.summary.meanDAS,4.25);
  assert(report.explanation.evidence.some(e=>e.frameId==='used:0008'&&e.frameIndex===8&&e.playerId==='A7'&&e.as===28&&e.das===4));
  assert.equal(report.healthAfter.mode,'offline');assert.equal(report.explanation.cached,false);
  assert.equal(seen.find(r=>r.url==='/api/explain').origin,baseUrl);
});

test('cloud is required by default and offline does not silently qualify',async()=>{
  const seen=[],{report}=await run(nodeService({seen}));
  assert.equal(report.passed,false);assert.equal(report.mode,'cloud-required');assert.equal(report.failure.code,'cloud_not_configured');assert.equal(report.realCloudVerified,false);
  assert(!seen.some(r=>r.url==='/api/explain'));
});

test('explicit offline mode refuses a configured cloud service before making a model call',async()=>{
  const provider=protocolProvider(),{report}=await run(nodeService({provider}),{offline:true});
  assert.equal(report.passed,false);assert.equal(report.failure.code,'offline_mode_requires_unconfigured_server');assert.equal(provider.calls,0);
});

test('a stale deployed analysis hash is rejected before explanation',async()=>{
  const seen=[],server=nodeService({seen,mutate:(url,body)=>{
    if(url!=='/data/analysis/used.json')return body;
    const analysis=JSON.parse(body);analysis.inputFileHash='0'.repeat(64);return JSON.stringify(analysis);
  }});
  const {report}=await run(server,{offline:true});
  assert.equal(report.passed,false);assert.equal(report.failure.code,'deployed_file_hash_mismatch');assert.equal(report.failure.resource,'data/analysis/used.json');assert(!seen.some(r=>r.url==='/api/explain'));
});

test('a locally stale analysis cannot serve as a trusted baseline',async()=>{
  const staleRoot=path.join(directory,'stale-baseline');await cp(fixtureRoot,staleRoot,{recursive:true});
  const filename=path.join(staleRoot,'data','analysis','unused.json'),analysis=JSON.parse(await readFile(filename));analysis.inputFileHash='f'.repeat(64);await writeFile(filename,JSON.stringify(analysis));
  const seen=[],{report}=await run(nodeService({seen}),{root:staleRoot,offline:true});
  assert.equal(report.passed,false);assert.equal(report.failure.code,'local_analysis_hash_mismatch');assert.equal(seen.length,0);
});

test('legal shorter past window passes real local HTTP cloud protocol, but never counts as real Azure',async()=>{
  const provider=protocolProvider(),seen=[];
  const {report,baseUrl}=await run(nodeService({provider,seen,mutate:(url,body)=>{
    if(!url.startsWith('/api/'))return body;
    const value=JSON.parse(body);value.unknown={credential:SECRET_SENTINEL};
    if(value.trace)value.trace.modelDeployment=SECRET_SENTINEL;
    return JSON.stringify(value);
  }}));
  assert.equal(report.passed,true,JSON.stringify(report.failure));assert.equal(report.scope,'local-http-cloud-protocol');assert.equal(report.cloudProtocolVerified,true);assert.equal(report.serverReportedCloudVerified,true);assert.equal(report.realCloudVerified,false);assert.equal(provider.calls,3);
  assert.equal(report.explanation.context.startTime,.2);assert.equal(report.explanation.context.endTime,.6);assert.equal(report.explanation.context.asOfTime,.8);
  assert.equal(report.explanation.context.analysisFrameId,'used:0006');assert.equal(report.explanation.summary.meanDAS,5);assert.equal(report.explanation.summary.peakDAS,6);
  assert.deepEqual(report.explanation.evidence,[{id:'E:used:0006:A7',frameId:'used:0006',frameIndex:6,t:.6,playerId:'A7',status:'eligible',as:26,das:4}]);
  assert.deepEqual(report.explanation.toolTrace.map(t=>t.name),['analyze_window','get_evidence']);
  assert.equal(report.explanation.trace.responseIdCount,3);assert.equal(report.explanation.trace.responseIdSha256[0],sha('resp_fixture_1'));assert(!JSON.stringify(report).includes('resp_fixture_1'));
  assert.equal(report.healthBefore.mode,'cloud-configured');assert.equal(report.healthAfter.mode,'cloud-verified');assert.equal(seen.find(r=>r.url==='/api/explain').origin,baseUrl);
  assert(!JSON.stringify(report).includes(FAKE_ENV.AZURE_OPENAI_API_KEY));assert(!JSON.stringify(report).includes(FAKE_ENV.AZURE_OPENAI_DEPLOYMENT));
});

test('a legal no-sample answer does not complete this eligible-frame evidence probe',async()=>{
  const provider=protocolProvider({start:.51,end:.59}),{report}=await run(nodeService({provider}));
  assert.equal(provider.calls,3);assert.equal(report.passed,false);assert.equal(report.failure.code,'insufficient_probe_evidence');assert.equal(report.realCloudVerified,false);
});

test('actual used scene 3.4–4.0 s flight-only evidence is a legal API answer but insufficient for the AS/DAS probe',async()=>{
  let answer;
  const provider=protocolProvider({start:3.4,end:4}),server=nodeService({provider,root:ROOT,mutate:(url,body)=>{
    if(url==='/api/explain')answer=JSON.parse(body);
    return body;
  }});
  const {report}=await run(server,{root:ROOT});
  assert.equal(provider.calls,3);assert.equal(answer.source,'microsoft-foundry');assert.equal(answer.status,'cloud-verified');assert.equal(answer.cloud.verified,true);
  assert.equal(answer.context.asOfTime,5);assert.equal(answer.context.startTime,3.4);assert.equal(answer.context.endTime,4);assert.equal(answer.summary,null);
  assert(answer.evidence.some(e=>e.id==='E:used:0040:A7'&&e.frameId==='used:0040'&&e.t===4&&e.status==='invalid'&&e.as===null&&e.das===null));
  assert(answer.evidence.every(e=>e.as===null&&e.das===null));
  assert.equal(report.passed,false);assert.equal(report.failure.code,'insufficient_probe_evidence');assert.equal(report.realCloudVerified,false);assert.equal(report.cloudProtocolVerified,false);
});

const corruptions=[
  ['wrong numeric evidence',r=>{r.evidence[0].das+=1;return r;},'evidence_mismatch'],
  ['future frame evidence',r=>{Object.assign(r.evidence[0],{frameId:'used:0018',frameIndex:18,t:1.8});return r;},'evidence_mismatch'],
  ['future analysis window',r=>{r.context.endTime=1.2;return r;},'invalid_explanation_window'],
  ['wrong selected player',r=>{r.context.playerId='A9';return r;},'context_mismatch'],
  ['wrong summary',r=>{r.summary.meanDAS+=1;return r;},'summary_mismatch'],
  ['invented rendered text',r=>{r.text+=' The value is 999.';return r;},'rendered_text_mismatch'],
  ['missing response IDs',r=>{r.trace.responseIds=[];return r;},'invalid_response_trace'],
  ['missing completed evidence tool',r=>{r.toolTrace[1].status='rejected';return r;},'missing_completed_tools'],
  ['unverified source despite true flag',r=>{r.source='offline-template';return r;},'cloud_not_verified'],
  ['cached cloud response',r=>{r.cached=true;return r;},'cached_cloud_response']
];
for(const [name,change,code] of corruptions)test(`${name} cannot pass cloud verification`,async()=>{
  const {report}=await run(nodeService({provider:protocolProvider(),mutate:mutateExplain(change)}));
  assert.equal(report.passed,false);assert.equal(report.failure.code,code);assert.equal(report.realCloudVerified,false);assert.equal(report.cloudProtocolVerified,false);
});

test('a real HTTP fallback response is not cloud success',async()=>{
  const provider={fetchImpl:async()=>Response.json({error:SECRET_SENTINEL},{status:400})};
  const {report}=await run(nodeService({provider}));
  assert.equal(report.passed,false);assert.equal(report.failure.code,'cloud_not_verified');assert.equal(report.realCloudVerified,false);
});

test('cloud success also requires the final health state',async()=>{
  let healthReads=0;
  const {report}=await run(nodeService({provider:protocolProvider(),mutate:(url,body)=>{
    if(url!=='/api/health'||++healthReads===1)return body;
    const health=JSON.parse(body);health.mode='cloud-configured';health.cloud.verified=false;return JSON.stringify(health);
  }}));
  assert.equal(report.passed,false);assert.equal(report.failure.code,'final_health_mismatch');assert.equal(report.realCloudVerified,false);
});

test('redirect and secret-bearing error content are rejected without being recorded',async()=>{
  const redirect=http.createServer((_req,res)=>{res.writeHead(302,{location:`https://user:${SECRET_SENTINEL}@example.com/`});res.end(SECRET_SENTINEL);});
  const {report}=await run(redirect,{offline:true});assert.equal(report.failure.code,'redirect_rejected');assert.equal(report.failure.httpStatus,302);
  const error=http.createServer((_req,res)=>{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:SECRET_SENTINEL}));});
  const failure=await run(error,{offline:true});assert.equal(failure.report.failure.code,'http_status');assert.equal(failure.report.failure.httpStatus,500);
});

test('a stalled HTTP body has a bounded timeout',async()=>{
  const server=http.createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.write('{"ok":');});
  const start=Date.now(),{report}=await run(server,{offline:true,timeoutMs:75,totalTimeoutMs:1000});
  assert.equal(report.passed,false);assert.equal(report.failure.code,'request_timeout');assert(Date.now()-start<2000);
});
