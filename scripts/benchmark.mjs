import {writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import {SCENARIOS,generateScenario,frameAt} from '../src/scenarios.mjs';
import {analyzeFrame,compareRun,sensitivity,MODEL_VERSION} from '../src/model.mjs';
const measure=(fn,n=5)=>{const times=[];for(let i=0;i<n;i++){const t=performance.now();fn();times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {medianMs:Number(times[Math.floor(n/2)].toFixed(2)),minMs:Number(times[0].toFixed(2)),maxMs:Number(times.at(-1).toFixed(2)),runs:n};};
const report={date:new Date().toISOString(),modelVersion:MODEL_VERSION,runtime:process.version,platform:`${os.platform()} ${os.arch()}`,cpu:os.cpus()[0]?.model,measurements:[]};
for(const spec of SCENARIOS){const scene=generateScenario(spec.id);analyzeFrame(frameAt(scene,4));const comparison=compareRun(scene);report.measurements.push({scenario:spec.id,currentFrame:measure(()=>analyzeFrame(frameAt(scene,4))),comparison:measure(()=>compareRun(scene)),sensitivity:measure(()=>sensitivity(scene),3),summary:comparison.summary});}
await mkdir(new URL('../data/',import.meta.url),{recursive:true});await writeFile(new URL('../data/benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
