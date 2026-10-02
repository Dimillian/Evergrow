import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRom } from './validate-rom.mjs';

const projectRoot=fileURLToPath(new URL('..',import.meta.url));
const dataRoot=process.platform==='darwin'?join(homedir(),'Library','Application Support','modretro-chromatic'):
 process.platform==='win32'?join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'modretro-chromatic'):
 join(process.env.XDG_DATA_HOME||join(homedir(),'.local','share'),'modretro-chromatic');
const setupRoot=process.env.GB_STUDIO_SETUP_ROOT||join(dataRoot,'toolchain');
const cli=process.env.EVERGROW_GBSTUDIO_CLI||join(setupRoot,'.local','vendor','gb-studio','out','cli','gb-studio-cli.js');
try{await access(cli);}catch{
 console.error('GB Studio CLI is missing. Prepare the ModRetro Chromatic plugin build toolchain, or set EVERGROW_GBSTUDIO_CLI to an official GB Studio 4.3.2 CLI.');process.exit(1);
}
const output=join(projectRoot,'build','evergrow-chromatic.gbc');
await mkdir(join(projectRoot,'build'),{recursive:true});
// Invoke the genuine editable project compiler. No shell interpolation or engine ejection.
const result=await new Promise((done,reject)=>{
 const child=spawn(process.execPath,[cli,'make:rom',join(projectRoot,'project.gbsproj'),output,'--verbose'],{cwd:projectRoot,stdio:'inherit',shell:false});
 child.on('error',reject);child.on('exit',code=>done(code??1));
});
if(result)process.exit(result);
await validateRom(output);
