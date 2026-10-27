import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const executable=process.platform==='win32'?'Scripts/python.exe':'bin/python';
const target=path.join(root,'.venv-maf',executable);
function run(command,args){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(result.status||1);
}
if(!existsSync(target)){
  const candidates=process.env.MAF_BOOTSTRAP_PYTHON?[process.env.MAF_BOOTSTRAP_PYTHON]:
    [path.join(root,'.venv-das',executable),'python3.12','python3','python'];
  const python=candidates.find(command=>{
    const result=spawnSync(command,['-c','import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)'],{cwd:root,stdio:'ignore'});
    return !result.error&&result.status===0;
  });
  if(!python){
    console.error('Install Python 3.12, or set MAF_BOOTSTRAP_PYTHON to its executable, then run this command again.');
    process.exit(2);
  }
  run(python,['-m','venv',path.join(root,'.venv-maf')]);
}
const version=spawnSync(target,['-c','import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)'],{cwd:root,stdio:'ignore'});
if(version.error||version.status!==0){
  console.error('The existing .venv-maf must use Python 3.12. Select a Python 3.12 environment before installing the locked dependencies.');
  process.exit(2);
}
run(target,['-m','pip','install','-r','requirements-agent.lock']);
run(target,['-m','pip','check']);
console.log('Agent Framework environment ready. Configure .env locally, then run npm run start:agent.');
