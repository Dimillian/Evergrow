/** Disposable CPU study: real dungeon geometry/AI, no browser or save access. */
import { performance } from 'node:perf_hooks';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { DungeonGeometry, generateDungeon, type DungeonEntrance } from '../src/dungeon.ts';
import { cryptFloorContains } from '../src/dungeon-contours.ts';
import { createDungeonRun, freshExpeditions, emptyContents } from '../src/dungeon-state.ts';
import type { Input } from '../src/model.ts';
const input:Input={moveX:0,moveY:0,aimX:0,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};
const report=[];
for(const count of [24,48,96]){
 const entrance:DungeonEntrance={id:'dungeon:benchmark',x:0,y:0,seed:7319,name:'Study',level:20,biome:'verdant',theme:'rootbound',expedition:{attempt:1,stage:0,choice:0,modifier:'elite'}};
 const floor=generateDungeon(entrance.seed,20,entrance),world=new DungeonGeometry(floor);
 if(process.argv.includes('--uncached'))world.blocked=(x,y,r)=>{
  if(![x,y,r].every(Number.isFinite)||r<0||r>1000||!cryptFloorContains(floor,x,y))return true;
  for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!cryptFloorContains(floor,x+Math.cos(a)*r,y+Math.sin(a)*r))return true;}
  return false;
 };
 const room=floor.rooms.find(r=>r.kind==='combat')!,px=room.x+room.width/2,py=room.y+room.height/2;
 const sim=new Simulation(world,{spawn:false,startX:px,startY:py});
 const run=createDungeonRun(entrance);sim.expeditions={...freshExpeditions(),runs:[run],location:entrance.id,surface:emptyContents()};sim.dungeonFloor=floor;
 for(let i=0;i<count;i++){
  const radius=120+(i%4)*55,angle=i*2.399963;
  const x=px+Math.cos(angle)*radius,y=py+Math.sin(angle)*radius;
  if(world.blocked(x,y,22))throw Error('Bad benchmark position');
  const e=sim.spawnEnemy((['stalker','archer','brute','caster'] as const)[i%4],x,y)!;
  e.state='chase';e.awareness=1;e.lastSeenX=px;e.lastSeenY=py;e.seesPlayer=true;e.homeX=px;e.homeY=py;
 }
 const timings=[];
 for(let tick=0;tick<360;tick++){
  sim.player.hp=sim.player.maxHp;sim.player.dead=false;
  const start=performance.now();sim.update(FIXED_STEP,input);const ms=performance.now()-start;
  if(tick>=60)timings.push(ms);
 }
 timings.sort((a,b)=>a-b);
 report.push({enemies:count,medianMs:+timings[150].toFixed(3),p95Ms:+timings[285].toFixed(3),totalMs:+timings.reduce((a,b)=>a+b,0).toFixed(1)});
}
console.log(JSON.stringify({collision:process.argv.includes('--uncached')?'uncached':'indexed',results:report},null,2));
