import {generateScenario} from './scenarios.mjs';
import {compareRun,sensitivity} from './model.mjs';
import {offlineExplain} from './agent.mjs';
const scenes=new Map();
self.onmessage=({data:{id,task,request}})=>{
  try{
    const key=`${request.scenarioId}:${request.seed??20261022}`;
    if(!scenes.has(key))scenes.set(key,generateScenario(request.scenarioId,request.seed??20261022));
    const scene=scenes.get(key),params={...request.params,alternative:request.alternative??'hold-width'};
    let result;
    if(task==='compare')result=compareRun(scene,request.startTime,request.horizon,params);
    else if(task==='team'){const c=compareRun(scene,request.startTime,request.horizon,{...params,includeTeamBest:true});if(!c.valid)throw new Error('No common pre-pass comparison window.');result=c.teamSummary;}
    else if(task==='sensitivity'){if(!compareRun(scene,request.startTime,request.horizon,params).valid)throw new Error('No common pre-pass comparison window.');result=sensitivity(scene,request.startTime,request.horizon,params);}
    else if(task==='explain')result=offlineExplain(request);
    else throw new Error('Unknown analysis job');
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error.message});}
};
