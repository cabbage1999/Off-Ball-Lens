/** Server-only boundary: Microsoft Agent Framework never enters the browser graph. */
import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {explain,offlineExplain,foundryConfiguration} from './agent.mjs';
import {createEvidenceSession} from './evidence-session.mjs';
import {renderFactPlan} from './evidence.mjs';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const FRAMEWORK='microsoft-agent-framework',PROVIDER='azure-openai-responses';
const MAX_LINE=65536,MAX_OUTPUT=524288,MAX_STDERR=65536,MAX_CALLS=10,MAX_MODEL_REQUESTS=6;
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const integer=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const fail=code=>Object.assign(new Error(code),{code});
const VALIDATION_ERRORS=new Set(['invalid_json','invalid_model_output','invalid_evidence_reference','missing_substantive_claim','missing_claim_evidence','unsupported_overlay','missing_tool_evidence']);
const SAFE_FAILURE=/^(?:cloud_http_\d{3}|cloud_timeout|agent_runtime_unavailable|invalid_model_output|invalid_evidence_reference|missing_substantive_claim|missing_claim_evidence|unsupported_overlay|missing_tool_evidence|invalid_json|tool_limit|round_limit|framework_(?:unavailable|protocol_error|worker_failed|worker_exit|output_limit|identity_mismatch|repair_limit|invalid_python|unsupported_api))$/;

function selectedContext(request){return {scenarioId:request.scenarioId,player_id:request.playerId,earliest_time:Math.max(0,request.asOfTime-request.windowSeconds),as_of_time:request.asOfTime,audience:request.audience,language:request.language};}

function workerEnvironment(config){
  // Do not inherit application credentials, proxy settings, Python paths or shell
  // startup settings. The worker receives only the selected Azure credential.
  const env={PATH:'/usr/bin:/bin:/usr/sbin:/sbin',PYTHONUNBUFFERED:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',LANG:'en_US.UTF-8'};
  if(config.authHeaders.authorization)env.AZURE_FOUNDRY_AUTH_TOKEN=config.authHeaders.authorization.slice(7);
  else env.AZURE_OPENAI_API_KEY=config.authHeaders['api-key'];
  return env;
}

async function pythonExecutable(env,skipAccess=false){
  const executable=env.MAF_PYTHON??path.join(ROOT,'.venv-maf','bin','python');
  if(typeof executable!=='string'||executable.length>4096||executable.includes('\0')||!path.isAbsolute(executable)||!/^python(?:3(?:\.\d+)?)?(?:\.exe)?$/.test(path.basename(executable)))throw fail('framework_invalid_python');
  if(!skipAccess){try{await access(executable,constants.X_OK);}catch{throw fail('framework_unavailable');}}
  return executable;
}

/** Verify middleware provenance against every tool the Node session actually ran. */
function verifiedTrace(raw,events,config,calls,repairCount){
  const keys=['framework','provider','frameworkVersion','providerVersion','modelDeployment','modelRequests','rounds','toolCalls','responseIds','nativeToolCalls','repairCount','elapsedMs','apiStyle','outputMode'];
  if(!only(raw,keys)||raw.framework!==FRAMEWORK||raw.provider!==PROVIDER||raw.modelDeployment!==config.deployment||raw.apiStyle!=='responses'||raw.outputMode!=='strict_json_schema'||raw.repairCount!==repairCount)throw fail('framework_identity_mismatch');
  if(!token(raw.frameworkVersion)||!token(raw.providerVersion)||!integer(raw.modelRequests,MAX_MODEL_REQUESTS)||raw.modelRequests<1||raw.rounds!==raw.modelRequests||!integer(raw.toolCalls,MAX_CALLS)||!Number.isFinite(raw.elapsedMs)||raw.elapsedMs<0||raw.elapsedMs>45000)throw fail('framework_identity_mismatch');
  if(!Array.isArray(raw.responseIds)||!raw.responseIds.length||raw.responseIds.length>MAX_MODEL_REQUESTS||raw.responseIds.some(id=>!token(id))||new Set(raw.responseIds).size!==raw.responseIds.length||raw.responseIds.length!==raw.modelRequests)throw fail('framework_identity_mismatch');
  if(!Array.isArray(raw.nativeToolCalls)||raw.nativeToolCalls.length!==raw.toolCalls||raw.nativeToolCalls.length>MAX_CALLS)throw fail('framework_identity_mismatch');
  const ids=new Set(),dispatched=[];
  for(const call of raw.nativeToolCalls){
    if(!only(call,['response_id','call_id','name','status','dispatched','rejectionSource'])||!token(call.call_id)||!token(call.name)||!raw.responseIds.includes(call.response_id)||ids.has(call.call_id)||!['completed','rejected'].includes(call.status)||typeof call.dispatched!=='boolean')throw fail('framework_identity_mismatch');
    ids.add(call.call_id);
    if(!call.dispatched){if(call.status!=='rejected'||call.rejectionSource!=='python')throw fail('framework_identity_mismatch');continue;}
    const actual=calls.get(call.call_id);
    if(!actual||actual.name!==call.name||actual.responseId!==call.response_id||actual.status!==call.status||(call.rejectionSource!==undefined&&(call.status!=='rejected'||call.rejectionSource!=='node')))throw fail('framework_identity_mismatch');
    dispatched.push(call.call_id);
  }
  if(dispatched.length!==calls.size)throw fail('framework_identity_mismatch');
  if(!Array.isArray(events)||!events.length||events.length>100)throw fail('framework_identity_mismatch');
  const agentTrace=events.map(event=>{
    if(!only(event,['agent','event','status','modelRequest','responseId','callId','tool'])||event.agent!=='receiving-space-analyst'||typeof event.event!=='string'||!/^[a-z][a-z_-]{0,63}$/.test(event.event)||typeof event.status!=='string'||!/^[a-z][a-z_-]{0,31}$/.test(event.status))throw fail('framework_identity_mismatch');
    if(event.modelRequest!==undefined&&(!integer(event.modelRequest,MAX_MODEL_REQUESTS)||event.modelRequest<1))throw fail('framework_identity_mismatch');
    if(event.responseId!==undefined&&!raw.responseIds.includes(event.responseId))throw fail('framework_identity_mismatch');
    if(event.callId!==undefined&&!ids.has(event.callId))throw fail('framework_identity_mismatch');
    if(event.tool!==undefined&&(!token(event.tool)||!raw.nativeToolCalls.some(call=>call.name===event.tool&&(!event.callId||call.call_id===event.callId))))throw fail('framework_identity_mismatch');
    return {...event};
  });
  return {trace:{...raw,responseIds:[...raw.responseIds],nativeToolCalls:raw.nativeToolCalls.map(call=>({...call}))},agentTrace};
}

function runWorker(session,config,options,start,publicTrace){
  const budget=Math.min(40000,Math.max(1,options.deadlineMs??40000)),deadline=start+budget;
  const requestId=randomUUID(),selected=selectedContext(session.request),calls=new Map();
  return new Promise(async(resolve,reject)=>{
    let child,finished=false,failure=null,terminal=null,accepted=null,proof=null,repairCount=0;
    let buffer=Buffer.alloc(0),stdoutBytes=0,stderrBytes=0,inputBytes=0,exitTimer,killTimer,forceTimer;
    const cleanup=()=>{clearTimeout(deadlineTimer);clearTimeout(exitTimer);clearTimeout(killTimer);clearTimeout(forceTimer);options.signal?.removeEventListener('abort',onAbort);};
    const finish=(error,result)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(result);};
    const terminate=error=>{
      if(finished||failure)return;
      failure=error;
      if(!child)return finish(error);
      child.stdin?.end();child.kill('SIGTERM');
      killTimer=setTimeout(()=>child.kill('SIGKILL'),200);
      // SIGKILL normally emits close immediately; retain a bounded cleanup path
      // for broken transports rather than retaining a server concurrency slot.
      forceTimer=setTimeout(()=>finish(failure),1000);
    };
    const onAbort=()=>terminate(options.signal.reason??new DOMException('Aborted','AbortError'));
    const deadlineTimer=setTimeout(()=>terminate(fail('cloud_timeout')),Math.max(1,deadline-Date.now()));
    options.signal?.addEventListener('abort',onAbort,{once:true});
    if(options.signal?.aborted){onAbort();return;}
    const send=value=>{
      if(finished||failure)return;
      const line=JSON.stringify(value)+'\n',size=Buffer.byteLength(line);inputBytes+=size;
      if(size>MAX_LINE||inputBytes>MAX_OUTPUT)throw fail('framework_output_limit');
      child.stdin.write(line,error=>{if(error)terminate(fail('framework_worker_failed'));});
    };
    const handle=message=>{
      if(!object(message)||message.request_id!==requestId||terminal||accepted&&message.type!=='done')throw fail('framework_protocol_error');
      if(message.type==='tool_call'){
        if(!only(message,['type','request_id','call_id','name','arguments','origin'])||!token(message.call_id)||!token(message.name)||calls.has(message.call_id))throw fail('framework_protocol_error');
        if(calls.size>=MAX_CALLS)throw fail('tool_limit');
        const origin=message.origin;
        if(!only(origin,['framework','provider','response_id','call_id'])||origin.framework!==FRAMEWORK||origin.provider!==PROVIDER||origin.call_id!==message.call_id||!token(origin.response_id))throw fail('framework_identity_mismatch');
        const entry={name:message.name,responseId:origin.response_id,callId:message.call_id,status:'rejected'};
        calls.set(message.call_id,entry);
        let result;
        try{
          if(!['analyze_window','get_evidence'].includes(message.name)||!object(message.arguments)||JSON.stringify(message.arguments).length>3000)throw fail('invalid_tool_arguments');
          result=session.execute(message.name,message.arguments);entry.status='completed';
          publicTrace.push({name:message.name,status:'completed',source:'microsoft-foundry',framework:FRAMEWORK,provider:PROVIDER,callId:message.call_id,responseId:origin.response_id,arguments:message.arguments});
        }catch{
          result={error:'invalid_tool_arguments',selected_context:selected};
          publicTrace.push({name:['analyze_window','get_evidence'].includes(message.name)?message.name:'unsupported_tool',status:'rejected',source:'microsoft-foundry',framework:FRAMEWORK,provider:PROVIDER,callId:message.call_id,responseId:origin.response_id});
        }
        send({type:'tool_result',request_id:requestId,call_id:message.call_id,result});
        return;
      }
      if(message.type==='candidate'){
        if(!only(message,['type','request_id','plan','trace','agentTrace','parse_error'])||!Object.hasOwn(message,'plan')||(message.parse_error!==undefined&&(!['invalid_json','invalid_model_output'].includes(message.parse_error)||message.plan!==null)))throw fail('framework_protocol_error');
        proof=verifiedTrace(message.trace,message.agentTrace,config,calls,repairCount);
        try{
          if(message.parse_error)throw fail(message.parse_error);
          session.validate(message.plan);
        }catch(error){
          const reason=VALIDATION_ERRORS.has(error.message)?error.message:'invalid_model_output';
          if(repairCount>=1)throw fail('framework_repair_limit');
          repairCount++;
          publicTrace.push({name:'fact_validation',status:'repair-requested',reason});
          send({type:'validation',request_id:requestId,accepted:false,reason,context:selected});
          return;
        }
        accepted=structuredClone(message.plan);
        const preview=renderFactPlan(session.getPack(),accepted,session.request);
        send({type:'validation',request_id:requestId,accepted:true,preview:{text:preview.text,claim_ids:accepted.claim_ids,evidence_ids:accepted.evidence_ids,overlay_type:accepted.overlay_type},context:preview.context});
        return;
      }
      if(message.type==='done'){
        if(!only(message,['type','request_id','trace','agentTrace'])||!accepted)throw fail('framework_protocol_error');
        const finalProof=verifiedTrace(message.trace,message.agentTrace,config,calls,repairCount);
        if(JSON.stringify(finalProof.trace.responseIds)!==JSON.stringify(proof.trace.responseIds)||JSON.stringify(finalProof.trace.nativeToolCalls)!==JSON.stringify(proof.trace.nativeToolCalls)||finalProof.trace.modelRequests!==proof.trace.modelRequests)throw fail('framework_identity_mismatch');
        proof=finalProof;terminal='done';
        child.stdin.end();
        exitTimer=setTimeout(()=>terminate(fail('framework_worker_exit')),1000);
        return;
      }
      if(message.type==='error'){
        if(!only(message,['type','request_id','error','trace','agentTrace'])||!only(message.error,['code','message']))throw fail('framework_protocol_error');
        // Provider exception bodies and stderr can contain credentials or prose.
        // Only explicitly permitted codes cross this boundary.
        throw fail(SAFE_FAILURE.test(message.error.code)?message.error.code:'framework_worker_failed');
      }
      throw fail('framework_protocol_error');
    };
    try{
      const executable=await pythonExecutable(options.env??{},Boolean(options.spawnImpl));
      if(finished||failure)return;
      options.signal?.throwIfAborted();
      if(Date.now()>=deadline)throw fail('cloud_timeout');
      child=(options.spawnImpl??spawn)(executable,['-m','agent_runtime.worker'],{cwd:ROOT,env:workerEnvironment(config),stdio:['pipe','pipe','pipe'],windowsHide:true});
      if(!child?.stdin||!child?.stdout||!child?.stderr)throw fail('framework_worker_failed');
      child.on('error',()=>terminate(fail('framework_unavailable')));
      child.stdin.on('error',()=>terminate(fail('framework_worker_failed')));
      child.stdout.on('error',()=>terminate(fail('framework_worker_failed')));
      child.stderr.on('error',()=>terminate(fail('framework_worker_failed')));
      child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>MAX_STDERR)terminate(fail('framework_output_limit'));});
      child.stdout.on('data',chunk=>{
        if(finished||failure)return;
        try{
          stdoutBytes+=chunk.length;if(stdoutBytes>MAX_OUTPUT)throw fail('framework_output_limit');
          buffer=Buffer.concat([buffer,chunk]);
          let newline;
          while((newline=buffer.indexOf(10))!==-1){
            if(newline>MAX_LINE)throw fail('framework_output_limit');
            const line=buffer.subarray(0,newline);buffer=buffer.subarray(newline+1);
            if(!line.length)throw fail('framework_protocol_error');
            let message;try{message=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));}catch{throw fail('framework_protocol_error');}
            handle(message);
          }
          if(buffer.length>MAX_LINE)throw fail('framework_output_limit');
        }catch(error){terminate(error);}
      });
      child.on('close',(code,signal)=>{
        if(finished)return;
        if(failure)return finish(failure);
        if(options.signal?.aborted)return finish(options.signal.reason);
        if(code!==0||signal||terminal!=='done'||!accepted||buffer.length)return finish(fail('framework_worker_failed'));
        try{
          // Render only after Node validation, matching native IDs, done and a
          // clean worker exit. A child's self-declared success is insufficient.
          session.validate(accepted);
          finish(null,{plan:accepted,...proof,repairCount});
        }catch(error){finish(error);}
      });
      send({type:'run',request_id:requestId,selected_context:selected,question:session.request.question,model:config.deployment,endpoint:config.url,deadline_ms:Math.max(1,deadline-Date.now()),review:false,reasoning_effort:config.reasoningEffort??'minimal',per_request_timeout_ms:Math.min(12000,Math.max(1,options.timeoutMs??12000))});
    }catch(error){terminate(error);}
  });
}

/** Run one isolated MAF Agent for one HTTP request; never cache fallback/cancel. */
export async function explainWithAgentFramework(input,options={}){
  options.signal?.throwIfAborted();
  const config=foundryConfiguration(options.env??{});
  if(!config.configured)return explain(input,options);
  const start=Date.now(),session=createEvidenceSession(input,options.bundle),toolTrace=[];
  try{
    if(config.apiStyle!=='responses')throw fail('framework_unsupported_api');
    const result=await runWorker(session,config,options,start,toolTrace);
    options.signal?.throwIfAborted();
    return renderFactPlan(session.getPack(),result.plan,session.request,{source:'microsoft-foundry',status:'cloud-verified',orchestrator:FRAMEWORK,toolTrace,agentTrace:result.agentTrace,
      cloud:{configured:true,verified:true,endpointKind:config.endpointKind,apiStyle:config.apiStyle,orchestrator:FRAMEWORK},trace:{...result.trace,elapsedMs:Date.now()-start,asOfTime:session.request.asOfTime,configHash:session.getPack().context.configHash}});
  }catch(error){
    options.signal?.throwIfAborted();
    const reason=SAFE_FAILURE.test(error?.message)?error.message:'framework_worker_failed';
    return {...offlineExplain(input,options.bundle),status:'fallback',fallbackReason:reason,orchestrator:FRAMEWORK,toolTrace,agentTrace:[],cloud:{configured:true,verified:false,apiStyle:config.apiStyle,orchestrator:FRAMEWORK},trace:{framework:FRAMEWORK,provider:PROVIDER,apiStyle:config.apiStyle,modelDeployment:config.deployment,elapsedMs:Date.now()-start}};
  }
}

export function explainWithOrchestrator(input,options={}){
  const config=foundryConfiguration(options.env??{});
  return config.configured&&config.orchestrator==='agent-framework'?explainWithAgentFramework(input,options):explain(input,options);
}
