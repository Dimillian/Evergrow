/** Shared-art kill/loot animation and bounded CPU stress study. No simulation or saves.
 * CANVAS_MODULE=/installed/@napi-rs/canvas node --expose-gc --experimental-strip-types game/scripts/render-impact-feedback.mjs /output
 * IMPACT_SOURCE=/absolute/game/src compares a committed source snapshot. IMPACT_BENCH_ONLY=1 skips PNGs.
 * Native CPU raster only; excludes the browser, WebGL CRT, terrain and gameplay.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
if(!process.env.CANVAS_MODULE || !process.argv[2])throw Error('Supply CANVAS_MODULE and an output directory.');
const {createCanvas,GlobalFonts,Path2D}=require(process.env.CANVAS_MODULE);
const source=process.env.IMPACT_SOURCE?pathToFileURL(resolve(process.env.IMPACT_SOURCE)+'/'):new URL('../src/',import.meta.url);
globalThis.Path2D=Path2D;
globalThis.document={createElement:()=>createCanvas(1,1),querySelector:()=>null};
for(const [file,name]of [['PixelifySans-Variable.ttf','Pixelify Sans'],['Barlow-Medium.ttf','Evergrow Numerals']])GlobalFonts.registerFromPath(fileURLToPath(new URL('assets/fonts/'+file,source)),name);
const {DEATH_RESPONSE_TIMING}=await import(new URL('death-content.ts',source));
const {EnemyDeaths}=await import(new URL('death-presentation.ts',source));
const {drawEnemyRemains,resetDeathArt}=await import(new URL('death-art.ts',source));
const {drawHumanoid}=await import(new URL('art.ts',source));
const {MaterialResponses}=await import(new URL('material-response.ts',source));
const {drawMaterialBurst}=await import(new URL('material-response-art.ts',source));
const {LootDropPresentation,lootDropEvent}=await import(new URL('loot-drop-presentation.ts',source));
const {drawGroundLoot}=await import(new URL('loot-art.ts',source));
const {generateItem,generateUnique,TIER_COLORS}=await import(new URL('items.ts',source));
const output=resolve(process.argv[2]);mkdirSync(output,{recursive:true});
const canvas=createCanvas(960,620),c=canvas.getContext('2d');
const elements=[undefined,'frost','fire','lightning'];
const samples=[generateItem(4,25,'weapon','longsword','common'),generateItem(5,25,'head',undefined,'magic'),generateItem(6,25,'weapon','crescent-recurve','rare'),generateItem(7,25,'boots',undefined,'epic'),generateItem(8,25,'weapon','ember-staff','legendary'),generateUnique(9,25,'triune-carapace')];
function fixture(crowded){
  resetDeathArt();const deaths=new EnemyDeaths(()=>.3),materials=new MaterialResponses(),loot=new LootDropPresentation();
  const count=crowded?45:4;
  for(let i=0;i<count;i++){
    const e={type:'kill',x:crowded?50+(i%9)*105:0,y:crowded?110+Math.floor(i/9)*90:0,angle:Math.PI+.8,facing:.8,targetId:70+i,remainingHp:0,enemyKind:'stalker',style:elements[i%4],motion:{vx:38,vy:16,attack:0,attackAngle:.8,phase:1,scale:1}};
    deaths.handle(e);materials.handle(e);
  }
  const drops=Array.from({length:crowded?64:6},(_,i)=>({id:300+i,x:crowded?40+(i%16)*57:80+i*160,y:crowded?360+Math.floor(i/16)*65:540,item:samples[i%6]}));
  loot.handle(drops.map(lootDropEvent).filter(Boolean));loot.advance(drops,0,{x:480,y:310});
  return {deaths,materials,loot,drops};
}
function label(value,x,y,size=18,color='#c7d7d1') {c.font=`${size}px "Pixelify Sans"`;c.fillStyle=color;c.textAlign='center';c.fillText(value,x,y);}
if(!process.env.IMPACT_BENCH_ONLY){
  const scene=fixture(false);mkdirSync(resolve(output,'frames'),{recursive:true});
  for(let frame=0;frame<90;frame++){
    const time=frame/24,age=Math.max(0,time-.45);
    c.fillStyle='#0b151b';c.fillRect(0,0,960,620);
    label('EVERGROW / KILL & LOOT FEEDBACK',480,32,23);label('Shared runtime art · presentation study',480,55,14,'#78949a');
    for(let i=0;i<4;i++){
      const x=120+i*240;label(['DIRECTIONAL IMPACT','FREEZE & FRACTURE','CINDERS & ASH','ELECTRICAL RECOIL'][i],x,87,16,['#d5cfb4','#9ce0ed','#ed994c','#a9ccff'][i]);
      c.save();c.translate(x,270);c.scale(2.6,2.6);
      if(time<.45)drawHumanoid(c,{kind:'stalker',angle:.8,time:1,moving:0,attack:0,attackAngle:.8,hitFlash:0,dodging:false});
      else {
        const r=scene.deaths.remains[i];r.age=age;
        if(age<r.duration)drawEnemyRemains(c,r,false);
        const burst=scene.materials.bursts[i];burst.age=age-(i===1?(DEATH_RESPONSE_TIMING?.frostHold??0):0);if(burst.age<burst.duration)drawMaterialBurst(c,burst,false);
      }
      c.restore();
    }
    c.strokeStyle='#31505b';c.beginPath();c.moveTo(32,305);c.lineTo(928,305);c.stroke();
    label('A LITTLE WEIGHT. A CLEAR ARRIVAL.',480,340,20);
    if(time>=.45){scene.loot.advance(scene.drops,age,{x:480,y:310});drawGroundLoot(c,scene.drops,time,false,age,scene.loot);}
    for(let i=0;i<6;i++)label(samples[i].tier.toUpperCase(),80+i*160,587,16,TIER_COLORS[samples[i].tier]);
    writeFileSync(resolve(output,'frames',`${String(frame).padStart(3,'0')}.png`),canvas.toBuffer('image/png'));
    if(frame===16)writeFileSync(resolve(output,'poster.png'),canvas.toBuffer('image/png'));
  }
}
const timings=[];
for(let cycle=0;cycle<3;cycle++){
  const scene=fixture(true);
  for(let frame=0;frame<60;frame++){
    canvas.width=960;
    const begin=performance.now(),time=frame/60;
    scene.loot.advance(scene.drops,time,{x:480,y:310});
    for(const r of scene.deaths.remains)drawEnemyRemains(c,r,false);
    for(const burst of scene.materials.bursts)drawMaterialBurst(c,burst,false);
    drawGroundLoot(c,scene.drops,time,false,time,scene.loot);
    c.getImageData(0,0,1,1); // Flush deferred native raster work inside the measurement.
    const elapsed=performance.now()-begin;if(cycle>0)timings.push(elapsed);
    scene.deaths.update(1/60);scene.materials.update(1/60);globalThis.gc?.();
  }
}
timings.sort((a,b)=>a-b);
const report={mode:'Native Canvas CPU only; no simulation, terrain, browser, WebGL or audio',corpses:45,drops:64,fragmentBudget:384,frames:timings.length,p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],max:timings.at(-1)};
writeFileSync(resolve(output,'timings.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
