import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const sources=['tests/native.c',...['ev_input','ev_menu','ev_render','ev_screen'].map(name=>`plugins/evergrow/engine/src/${name}.c`),'plugins/evergrow/engine/src/ev_content.c','plugins/evergrow/engine/src/ev_character.c','plugins/evergrow/engine/src/ev_world.c','plugins/evergrow/engine/src/ev_combat.c','plugins/evergrow/engine/src/ev_save.c'];
let result=spawnSync(process.env.CC||'cc',['-std=c11','-DEV_HOST','-Wno-unknown-pragmas','-Iplugins/evergrow/engine/include','-g','-fsanitize=address,undefined',...sources,'-o','tests/native-test'],{cwd:root,stdio:'inherit'});
if(result.status)process.exit(result.status);
result=spawnSync('./tests/native-test',[],{cwd:root,stdio:'inherit',timeout:60000,env:{...process.env,UBSAN_OPTIONS:'halt_on_error=1',ASAN_OPTIONS:'halt_on_error=1'}});process.exit(result.status??1);
