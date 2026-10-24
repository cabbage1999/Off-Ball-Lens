import {explain,foundryConfiguration} from '../src/agent.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
try{process.loadEnvFile(fileURLToPath(new URL('.env',root)));}catch(error){if(error.code!=='ENOENT')throw error;}
if(!foundryConfiguration(process.env).configured){
  console.error('Real Foundry check NOT RUN: configure .env using docs/foundry-setup.zh-CN.md. No model request was made.');process.exitCode=2;
}else{
  const scenario=JSON.parse(await readFile(new URL('data/used.json',root),'utf8'));
  const analysis=JSON.parse(await readFile(new URL('data/analysis/used.json',root),'utf8'));
  const frame=analysis.frames.find(f=>f.t>=5&&f.players?.A7?.status==='eligible');
  if(!frame)throw new Error('No valid A7 frame is available for the smoke test');
  const result=await explain({scenarioId:'used',playerId:'A7',asOfTime:frame.t,windowSeconds:5,question:'Which receiving opportunity should I look at, and where is the evidence?',audience:'analyst',language:'en'}, {bundle:{scenario,analysis},env:process.env});
  const passed=result.source==='microsoft-foundry'&&result.cloud.verified&&['analyze_window','get_evidence'].every(name=>result.toolTrace.some(t=>t.name===name&&t.status==='completed'));
  const record={checkedAt:new Date().toISOString(),passed,source:result.source,status:result.status,cloud:result.cloud,trace:result.trace,toolTrace:result.toolTrace,context:result.context,claims:result.claims,evidence:result.evidence,fallbackReason:result.fallbackReason??null};
  await mkdir(new URL('artifacts/',root),{recursive:true});
  await writeFile(new URL('artifacts/foundry-trace.json',root),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({passed,source:result.source,status:result.status,fallbackReason:result.fallbackReason??null,traceFile:'artifacts/foundry-trace.json'},null,2));
  if(!passed)process.exitCode=1;
}
