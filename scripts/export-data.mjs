import {mkdir,writeFile} from 'node:fs/promises';
import {SCENARIOS,generateScenario} from '../src/scenarios.mjs';
const directory=new URL('../data/',import.meta.url);await mkdir(directory,{recursive:true});
for(const spec of SCENARIOS){const scene=generateScenario(spec.id);await writeFile(new URL(`${spec.id}.json`,directory),JSON.stringify(scene)+'\n');console.log(`${spec.id}: ${scene.frames.length} frames, ${scene.events.length} synchronized events`);}
