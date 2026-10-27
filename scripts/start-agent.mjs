import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,['server.mjs'],{
  cwd:root,stdio:'inherit',env:{...process.env,FOUNDRY_ORCHESTRATOR:'agent-framework'}
});
child.once('error',()=>{console.error('The application could not start.');process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
