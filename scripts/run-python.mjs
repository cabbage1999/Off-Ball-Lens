// A single launcher for the pinned Python author-model environment.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const local=join(root,'.venv-das',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.DAS_PYTHON || (existsSync(local)?local:(process.platform==='win32'?'python':'python3'));
const result=spawnSync(python,process.argv.slice(2),{cwd:root,stdio:'inherit'});
if(result.error){console.error('Python could not start. Create .venv-das and install requirements-das.lock; see README.md.');process.exit(1);}
process.exit(result.status ?? 1);
