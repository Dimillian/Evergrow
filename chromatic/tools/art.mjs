import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result=spawnSync(process.env.EVERGROW_PYTHON||'python3',[fileURLToPath(new URL('./generate-art.py',import.meta.url))],{stdio:'inherit',shell:false});
if(result.error)console.error(result.error.message);process.exit(result.status??1);
