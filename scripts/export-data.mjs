import {mkdir,writeFile,rename} from 'node:fs/promises';
import {SCENARIOS,generateScenario} from '../src/scenarios.mjs';

const directory=new URL('../data/',import.meta.url);
const requested=process.argv.slice(2);
const ids=requested.length?[...new Set(requested)]:SCENARIOS.map(spec=>spec.id);
for(const id of ids)if(!SCENARIOS.some(spec=>spec.id===id))throw new RangeError(`Unknown scenario: ${id}`);
await mkdir(directory,{recursive:true});
for(const id of ids){
  const scene=generateScenario(id),temporary=new URL(`.${id}.export.tmp`,directory);
  await writeFile(temporary,JSON.stringify(scene)+'\n');
  await rename(temporary,new URL(`${id}.json`,directory));
  console.log(`${id}: ${scene.frames.length} frames, ${scene.events.length} synchronized events, ${scene.metadata.stages.length} complete tactical phases`);
}
