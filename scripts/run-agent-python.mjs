import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const local=path.join(root,'.venv-maf',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.MAF_PYTHON||local;
if(!process.env.MAF_PYTHON&&!existsSync(local)){
  console.error('Microsoft Agent Framework is not installed. Run npm run setup:agent with Python 3.12 available.');
  process.exit(2);
}
const result=spawnSync(python,process.argv.slice(2),{cwd:root,stdio:'inherit'});
if(result.error){console.error('The Agent Framework Python environment could not start.');process.exit(2);}
process.exit(result.status??1);
