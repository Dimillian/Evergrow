import { spawnSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function run(command,args,cwd=root){const result=spawnSync(command,args,{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
run('npm',['run','typecheck']);
run('npx',['vite','build','--config','vite.android.config.ts'],root+'game');
const assets=root+'android/app/src/main/assets';
await rm(assets,{recursive:true,force:true});
await cp(root+'game/dist-android',assets,{recursive:true});
run('./gradlew',['assembleDebug'],root+'android');
console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk');
if(process.argv.includes('--install')){
  const serial=process.env.ANDROID_SERIAL;
  const target=serial?['-s',serial]:['-d'];
  run('adb',[...target,'install','-r',root+'android/app/build/outputs/apk/debug/app-debug.apk']);
  run('adb',[...target,'shell','am','start','-n','com.dimillian.evergrow/.MainActivity']);
}
