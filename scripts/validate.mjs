import {writeFile,mkdir} from 'node:fs/promises';
import {SCENARIOS,generateScenario} from '../src/scenarios.mjs';
import {compareRun,sensitivity,MODEL_VERSION} from '../src/model.mjs';
const results=[];
for(const spec of SCENARIOS){
  const scene=generateScenario(spec.id),comparison=compareRun(scene),sweep=sensitivity(scene);
  let maxSpeed=0,maxAcceleration=0,minSeparation=Infinity;
  for(let i=0;i<scene.frames.length;i++){
    const frame=scene.frames[i];
    for(let j=0;j<frame.players.length;j++){
      const p=frame.players[j];maxSpeed=Math.max(maxSpeed,Math.hypot(p.vx,p.vy));
      if(i){const prev=scene.frames[i-1].players[j];maxAcceleration=Math.max(maxAcceleration,Math.hypot(p.vx-prev.vx,p.vy-prev.vy)/(frame.t-scene.frames[i-1].t));}
      for(let k=j+1;k<frame.players.length;k++)minSeparation=Math.min(minSeparation,Math.hypot(p.x-frame.players[k].x,p.y-frame.players[k].y));
    }
  }
  results.push({scenario:spec.id,frames:scene.frames.length,players:22,maxSpeed,maxAcceleration,minPlayerSeparation:minSeparation,comparison:comparison.summary,sensitivity:sweep});
}
const report={generatedAt:new Date().toISOString(),modelVersion:MODEL_VERSION,data:'Synthetic; independently authored trajectories. Scene hypotheses are not validation labels.',cloudIntegration:'Not validated by this script; requires the separate cloud smoke check with a configured deployment.',results};
await mkdir(new URL('../data/',import.meta.url),{recursive:true});await writeFile(new URL('../data/validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
