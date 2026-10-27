import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {MODEL_VERSION,makeFactPack,renderFactPlan,validateExplainRequest} from '../src/evidence.mjs';
import {listScenarios} from '../src/scenarios.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const STATIC_FILES=['index.html','app.mjs','style.css','src/analysis.mjs','src/agent.mjs','src/evidence.mjs','src/evidence-session.mjs'];
const OVERLAYS=['receiving_heatmap','player_trail','das_curve','event','none'];
const MAX_FILE_BYTES=16*1024*1024,MAX_JSON_BYTES=128*1024;
const digest=value=>createHash('sha256').update(value).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
class CheckError extends Error {
  constructor(code,details={}){super(code);this.code=code;this.details=details;}
}
function requireCheck(condition,code,details){if(!condition)throw new CheckError(code,details);}
function equal(actual,expected,code){requireCheck(isDeepStrictEqual(actual,expected),code);}

/** A deployment URL is an origin, not a Pages repository path or a URL carrying credentials. */
export function parseDeploymentUrl(value){
  requireCheck(typeof value==='string'&&/^https?:\/\/[^\s\\/?#]+\/?$/.test(value),'invalid_base_url');
  let url;try{url=new URL(value);}catch{throw new CheckError('invalid_base_url');}
  requireCheck(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','invalid_base_url');
  const authority=value.slice(value.indexOf('://')+3).replace(/\/$/,''),hostname=authority.startsWith('[')?authority.slice(0,authority.indexOf(']')+1):authority.split(':')[0];
  requireCheck(url.hostname===hostname.toLowerCase(),'invalid_base_url');
  const loopback=['127.0.0.1','[::1]','localhost'].includes(url.hostname);
  requireCheck(url.protocol==='https:'||loopback&&url.protocol==='http:','public_target_requires_https');
  // Reject private/address aliases as public evidence. Only exact loopback names get the HTTP exception.
  requireCheck(loopback||!(/^\d+(?:\.\d+){3}$/.test(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.')||/\.(?:localhost|local|internal|test|invalid)$/.test(url.hostname)),'public_target_requires_dns_name');
  return {url,loopback};
}

function checkHealth(value){
  requireCheck(object(value)&&value.ok===true&&value.analysisMode==='precomputed'&&value.model===MODEL_VERSION&&object(value.cloud),'invalid_health');
  const {configured,verified}=value.cloud;
  requireCheck(typeof configured==='boolean'&&typeof verified==='boolean'&&(!verified||configured),'invalid_health');
  const mode=verified?'cloud-verified':configured?'cloud-configured':'offline';
  requireCheck(value.mode===mode,'invalid_health');
  return {ok:true,mode,analysisMode:'precomputed',model:MODEL_VERSION,cloud:{configured,verified}};
}

function checkTools(result,bundle,request,expectedPack,cloud){
  requireCheck(Array.isArray(result.toolTrace)&&result.toolTrace.length>=2&&result.toolTrace.length<=24,'invalid_tool_trace');
  let currentPack=null;
  const seenClaims=new Set(),seenEvidence=new Set(),completed=[];
  for(const item of result.toolTrace){
    if(!object(item)||item.status!=='completed')continue;
    requireCheck(['analyze_window','get_evidence'].includes(item.name)&&item.source===(cloud?'microsoft-foundry':'local-deterministic'),'invalid_tool_trace');
    const args=item.arguments;
    requireCheck(object(args),'invalid_tool_arguments');
    if(item.name==='analyze_window'){
      equal(Object.keys(args).sort(),['end_time','player_id','start_time'],'invalid_tool_arguments');
      requireCheck(args.player_id===request.playerId&&finite(args.start_time)&&finite(args.end_time),'invalid_tool_arguments');
      try{currentPack=makeFactPack(bundle,request,args.start_time,args.end_time);}catch{throw new CheckError('invalid_tool_window');}
      seenClaims.clear();seenEvidence.clear();
      completed.push({name:'analyze_window',status:'completed',source:item.source,playerId:request.playerId,startTime:args.start_time,endTime:args.end_time});
    }else{
      equal(Object.keys(args),['evidence_ids'],'invalid_tool_arguments');
      requireCheck(currentPack&&Array.isArray(args.evidence_ids)&&args.evidence_ids.length<=8&&args.evidence_ids.every(id=>typeof id==='string'),'invalid_tool_arguments');
      const ids=args.evidence_ids.length?args.evidence_ids:currentPack.evidence.map(e=>e.id);
      requireCheck(ids.every(id=>currentPack.evidence.some(e=>e.id===id)),'invalid_tool_evidence');
      for(const id of ids)seenEvidence.add(id);
      for(const claim of currentPack.claims)if(claim.evidence_ids.every(id=>ids.includes(id)))seenClaims.add(claim.id);
      completed.push({name:'get_evidence',status:'completed',source:item.source,evidenceCount:ids.length});
    }
  }
  requireCheck(currentPack&&completed.some(t=>t.name==='get_evidence'),'missing_completed_tools');
  equal(currentPack.context,expectedPack.context,'tool_context_mismatch');
  requireCheck(result.claims.every(c=>seenClaims.has(c.id))&&result.evidence.every(e=>seenEvidence.has(e.id)),'evidence_not_retrieved');
  return completed;
}

function checkExplanation(result,bundle,request,offline){
  requireCheck(object(result)&&object(result.context)&&Array.isArray(result.claims)&&result.claims.length>0&&result.claims.length<=8&&Array.isArray(result.evidence)&&result.evidence.length<=8,'invalid_explanation');
  // No-sample and unavailable-state answers are legal in the app, but cannot
  // complete this deliberate probe of a recorded eligible frame's AS/DAS values.
  requireCheck(result.evidence.some(e=>object(e)&&e.status==='eligible'&&finite(e.as)&&finite(e.das)),'insufficient_probe_evidence');
  requireCheck(object(result.cloud),'invalid_cloud_status');
  requireCheck(result.cached===undefined||typeof result.cached==='boolean','invalid_cache_status');
  if(offline){
    requireCheck(result.source==='offline-template'&&result.status==='offline'&&result.cloud.configured===false&&result.cloud.verified===false,'offline_mode_mismatch');
    requireCheck(result.context.startTime===Math.max(0,request.asOfTime-request.windowSeconds)&&result.context.endTime===request.asOfTime,'offline_window_mismatch');
  }else{
    requireCheck(result.source==='microsoft-foundry'&&result.status==='cloud-verified'&&result.cloud.configured===true&&result.cloud.verified===true&&!result.fallbackReason,'cloud_not_verified');
    requireCheck(result.cached!==true,'cached_cloud_response');
    requireCheck(['azure-resource','foundry-project','azure-regional'].includes(result.cloud.endpointKind),'invalid_cloud_endpoint_kind');
  }
  let pack;try{pack=makeFactPack(bundle,request,result.context.startTime,result.context.endTime);}catch{throw new CheckError('invalid_explanation_window');}
  equal(result.context,pack.context,'context_mismatch');
  equal(result.summary,pack.summary,'summary_mismatch');
  requireCheck(result.claims.every(c=>object(c)&&typeof c.id==='string')&&new Set(result.claims.map(c=>c.id)).size===result.claims.length,'invalid_claims');
  requireCheck(result.evidence.every(e=>object(e)&&typeof e.id==='string')&&new Set(result.evidence.map(e=>e.id)).size===result.evidence.length,'invalid_evidence');
  for(const claim of result.claims){
    const expected=pack.claims.find(c=>c.id===claim.id);
    requireCheck(expected,'unknown_claim');equal(claim,expected,'claim_mismatch');
  }
  requireCheck(result.claims.some(c=>c.kind!=='limits'),'missing_substantive_claim');
  for(const evidence of result.evidence){
    const expected=pack.evidence.find(e=>e.id===evidence.id);
    requireCheck(expected,'unknown_evidence');equal(evidence,expected,'evidence_mismatch');
    // Also tie references directly to the recorded tracking rows, independently of the renderer.
    const tracking=bundle.scenario.frames[evidence.frameIndex];
    requireCheck(tracking&&tracking.frameId===evidence.frameId&&Math.abs(tracking.t-evidence.t)<1e-8&&evidence.t<=request.asOfTime+1e-8&&evidence.t>=pack.context.startTime-1e-8&&evidence.t<=pack.context.endTime+1e-8,'invalid_evidence_frame');
  }
  requireCheck(object(result.overlay)&&OVERLAYS.includes(result.overlay.type),'invalid_overlay');
  const expected=renderFactPlan(pack,{claim_ids:result.claims.map(c=>c.id),evidence_ids:result.evidence.map(e=>e.id),overlay_type:result.overlay.type},request);
  for(const key of ['text','claims','evidence','context','summary','limitations','language','audience','overlay','wording'])equal(result[key],expected[key],`rendered_${key}_mismatch`);
  if(result.overlay.type==='receiving_heatmap')requireCheck(result.evidence.some(e=>e.status==='eligible'&&finite(e.das)),'unsupported_overlay');
  if(result.overlay.type==='event')requireCheck(result.evidence.some(e=>e.status==='event'),'unsupported_overlay');
  const toolTrace=checkTools(result,bundle,request,pack,!offline);
  let trace=null;
  if(!offline){
    const t=result.trace;
    requireCheck(object(t)&&Array.isArray(t.responseIds)&&t.responseIds.length>=2&&t.responseIds.length<=6&&t.responseIds.every(id=>typeof id==='string'&&id.length>0&&id.length<200)&&new Set(t.responseIds).size===t.responseIds.length,'invalid_response_trace');
    requireCheck(Number.isInteger(t.rounds)&&t.rounds>=t.responseIds.length&&t.rounds<=6&&Number.isInteger(t.repairCount)&&t.repairCount>=0&&t.repairCount<=1&&finite(t.elapsedMs)&&t.elapsedMs>=0&&t.asOfTime===request.asOfTime&&t.configHash===pack.context.configHash,'invalid_response_trace');
    // Opaque provider identifiers are validated but hashed: neither them nor modelDeployment
    // can become an accidental channel for a server to write credentials into this artifact.
    trace={responseIdCount:t.responseIds.length,responseIdSha256:t.responseIds.map(digest),rounds:t.rounds,repairCount:t.repairCount,elapsedMs:t.elapsedMs};
  }
  const c=pack.context,s=pack.summary;
  return {
    source:offline?'offline-template':'microsoft-foundry',status:offline?'offline':'cloud-verified',cached:result.cached===true,
    cloud:{configured:!offline,verified:!offline,...(!offline?{endpointKind:result.cloud.endpointKind}:{})},
    context:{scenarioId:c.scenarioId,playerId:c.playerId,asOfTime:c.asOfTime,startTime:c.startTime,endTime:c.endTime,analysisTime:c.analysisTime,analysisFrameId:c.analysisFrameId,mode:c.mode,modelVersion:c.modelVersion,configHash:c.configHash},
    summary:s?{startTime:s.startTime,endTime:s.endTime,duration:s.duration,startDAS:s.startDAS,endDAS:s.endDAS,deltaDAS:s.deltaDAS,meanDAS:s.meanDAS,peakDAS:s.peakDAS,peakTime:s.peakTime,peakFrameId:s.peakFrameId,carrierId:s.carrierId,sampleCount:s.sampleCount}:null,
    claimIds:expected.claims.map(c=>c.id),evidence:expected.evidence.map(e=>({id:e.id,frameId:e.frameId,frameIndex:e.frameIndex,t:e.t,playerId:e.playerId,status:e.status,as:e.as??null,das:e.das??null})),
    matchedLocalFacts:true,toolTrace,trace
  };
}

/** Uses real HTTP fetches only. No .env loading, provider key access, or provider request bypass. */
export async function checkDeployment({baseUrl,offline=false,root=ROOT,timeoutMs=60000,totalTimeoutMs=180000,artifactPath}={}){
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),passed:false,mode:offline?'offline':'cloud-required',scope:'unvalidated-target',realCloudVerified:false,cloudProtocolVerified:false,serverReportedCloudVerified:false,target:null,files:[],catalog:null,healthBefore:null,explanation:null,healthAfter:null,failure:null,
    verificationBoundary:'HTTP contract, local-byte/evidence comparison, and server-reported cloud status only. Neither a loopback simulation nor a public HTTPS response independently proves an Azure call. realCloudVerified remains false; independent provider-call evidence or Azure-side records are required for that separate gate.'};
  let stage='configuration',target;
  const deadline=Date.now()+totalTimeoutMs;
  async function getBytes(resource,{method='GET',body,mime,maxBytes=MAX_JSON_BYTES}={}){
    const remaining=deadline-Date.now();requireCheck(remaining>0,'check_deadline_exceeded',{resource});
    let response;
    try{
      response=await fetch(new URL(resource,target.url),{method,redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(Math.min(timeoutMs,remaining)),headers:{accept:mime,'cache-control':'no-cache',...(body?{'content-type':'application/json',origin:target.url.origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
      if(response.status!==200){await response.body?.cancel();throw new CheckError(response.status>=300&&response.status<400?'redirect_rejected':'http_status',{resource,httpStatus:response.status});}
      const contentType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      requireCheck((Array.isArray(mime)?mime:[mime]).includes(contentType),'content_type_mismatch',{resource});
      requireCheck(response.body,'empty_response',{resource});
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.byteLength;requireCheck(size<=maxBytes,'response_too_large',{resource});chunks.push(chunk);}
      return Buffer.concat(chunks,size);
    }catch(error){
      try{await response?.body?.cancel();}catch{/* Body may already be closed or locked. */}
      if(error instanceof CheckError)throw error;
      throw new CheckError(['AbortError','TimeoutError'].includes(error?.name)?'request_timeout':'http_request_failed',{resource});
    }
  }
  async function getJson(resource,options){
    const bytes=await getBytes(resource,{...options,mime:'application/json'});
    try{return JSON.parse(bytes.toString('utf8'));}catch{throw new CheckError('invalid_json',{resource});}
  }
  try{
    requireCheck(typeof offline==='boolean'&&Number.isInteger(timeoutMs)&&timeoutMs>=50&&timeoutMs<=60000&&Number.isInteger(totalTimeoutMs)&&totalTimeoutMs>=timeoutMs&&totalTimeoutMs<=600000,'invalid_check_options');
    target=parseDeploymentUrl(baseUrl);
    report.target={origin:target.url.origin,kind:target.loopback?'loopback':'specified-public-https'};
    report.scope=target.loopback?(offline?'local-http-offline':'local-http-cloud-protocol'):(offline?'public-https-offline':'public-https-cloud-protocol');
    stage='local-files';
    const catalog=listScenarios(),dataFiles=catalog.flatMap(s=>[`data/${s.id}.json`,`data/analysis/${s.id}.json`]),local=new Map(),bundles=new Map();
    for(const filename of [...STATIC_FILES,...dataFiles]){
      let bytes;try{bytes=await readFile(path.join(root,filename));}catch{throw new CheckError('local_file_unavailable',{resource:filename});}
      requireCheck(bytes.length>0&&bytes.length<=MAX_FILE_BYTES,'local_file_size',{resource:filename});
      local.set(filename,{bytes,sha256:digest(bytes)});
    }
    for(const {id} of catalog){
      let scenario,analysis;
      try{scenario=JSON.parse(local.get(`data/${id}.json`).bytes);analysis=JSON.parse(local.get(`data/analysis/${id}.json`).bytes);}catch{throw new CheckError('local_data_invalid');}
      requireCheck(scenario?.metadata?.id===id&&analysis?.scenarioId===id&&Array.isArray(scenario.frames)&&scenario.frames.length>0&&Array.isArray(analysis.frames)&&analysis.frames.length>0,'local_data_invalid');
      requireCheck(analysis.inputFileHash===local.get(`data/${id}.json`).sha256,'local_analysis_hash_mismatch',{resource:`data/analysis/${id}.json`});
      bundles.set(id,{scenario,analysis});
    }
    stage='health-before';report.healthBefore=checkHealth(await getJson('api/health'));
    if(offline)requireCheck(report.healthBefore.mode==='offline','offline_mode_requires_unconfigured_server');
    else requireCheck(report.healthBefore.cloud.configured,'cloud_not_configured');
    stage='scenarios';
    const advertised=await getJson('api/scenarios');equal(advertised?.scenarios,catalog,'scenario_catalog_mismatch');
    report.catalog={matched:true,scenarioIds:catalog.map(s=>s.id)};
    stage='static-files';
    for(const [filename,expected] of local){
      const resource=filename==='index.html'?'':filename;
      const mime=filename.endsWith('.json')?'application/json':filename.endsWith('.mjs')?['text/javascript','application/javascript']:filename.endsWith('.css')?'text/css':'text/html';
      const bytes=await getBytes(resource,{mime,maxBytes:expected.bytes.length+1}),sha256=digest(bytes),matched=sha256===expected.sha256;
      report.files.push({path:filename,bytes:bytes.length,localSha256:expected.sha256,remoteSha256:sha256,matched});
      requireCheck(matched,'deployed_file_hash_mismatch',{resource:filename});
    }
    const bundle=bundles.get('used'),playerId=bundle.scenario.metadata.targetId;
    const candidates=bundle.analysis.frames.filter(f=>f.status==='valid'&&f.players?.[playerId]?.status==='eligible'&&finite(f.players[playerId].as)&&finite(f.players[playerId].das));
    const frame=candidates.find(f=>f.t>=5)??candidates.at(-1);requireCheck(frame,'no_eligible_probe_frame');
    const request=validateExplainRequest({scenarioId:'used',playerId,asOfTime:frame.t,windowSeconds:5,question:`Explain the receiving opportunity using the recorded AS/DAS values and exact frame evidence in this past window. Deployment probe ${randomUUID()}.`,audience:'analyst',language:'en'},bundle);
    stage='explain';
    report.explanation=checkExplanation(await getJson('api/explain',{method:'POST',body:request}),bundle,request,offline);
    stage='health-after';report.healthAfter=checkHealth(await getJson('api/health'));
    requireCheck(offline?report.healthAfter.mode==='offline':report.healthAfter.mode==='cloud-verified'&&report.healthAfter.cloud.configured&&report.healthAfter.cloud.verified,'final_health_mismatch');
    report.cloudProtocolVerified=!offline;
    report.serverReportedCloudVerified=!offline;
    report.passed=true;
  }catch(error){
    // Never serialize exception messages, response bodies, headers, arbitrary server keys,
    // configuration, or the original user-supplied URL (which may itself contain secrets).
    report.failure={stage,code:error instanceof CheckError?error.code:'check_failed'};
    if(error instanceof CheckError&&typeof error.details.resource==='string')report.failure.resource=error.details.resource;
    if(error instanceof CheckError&&Number.isInteger(error.details.httpStatus))report.failure.httpStatus=error.details.httpStatus;
  }
  try{
    const filename=artifactPath??path.join(root,'artifacts','deployment-check.json');
    await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,JSON.stringify(report,null,2)+'\n');
  }catch{
    report.passed=false;report.realCloudVerified=false;report.cloudProtocolVerified=false;report.serverReportedCloudVerified=false;report.failure={stage:'artifact',code:'artifact_write_failed'};
  }
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help')console.log('Usage: node scripts/smoke-deployment.mjs --url https://YOUR-HOST/ [--offline]\nDefault: require a fresh Foundry HTTP explanation that passes the cloud protocol and local fact checks. --offline requires an unconfigured server.\nOnly root URLs are accepted. Loopback HTTP is allowed for engineering tests.\nHTTP alone cannot independently prove an Azure call: realCloudVerified always remains false; provider evidence is a separate gate.\nWrites artifacts/deployment-check.json; opaque provider response IDs are SHA-256 hashed. No .env or credentials are read.');
  else{
    const offline=args.includes('--offline'),rest=args.filter(arg=>arg!=='--offline');
    const url=rest.length===2&&rest[0]==='--url'?rest[1]:rest.length===1&&!rest[0].startsWith('--')?rest[0]:undefined;
    const report=await checkDeployment({baseUrl:args.filter(arg=>arg==='--offline').length<=1?url:undefined,offline});
    console.log(JSON.stringify({passed:report.passed,scope:report.scope,mode:report.mode,realCloudVerified:report.realCloudVerified,cloudProtocolVerified:report.cloudProtocolVerified,serverReportedCloudVerified:report.serverReportedCloudVerified,failure:report.failure,artifact:'artifacts/deployment-check.json'},null,2));
    if(!report.passed)process.exitCode=1;
  }
}
