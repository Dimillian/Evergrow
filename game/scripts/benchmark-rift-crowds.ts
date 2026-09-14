/** Real seeded rift landscape + combat, disposable headless state, no player saves. */
import { performance } from 'node:perf_hooks';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateDungeon, type DungeonEntrance } from '../src/dungeon.ts';
import { riftModifiers } from '../src/rift-content.ts';
import { RiftWorld } from '../src/rift-world.ts';
import { createDungeonRun, emptyContents, freshExpeditions } from '../src/dungeon-state.ts';
import type { Input } from '../src/model.ts';
const input:Input={moveX:0,moveY:0,aimX:0,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};
const counts=process.argv.includes('--profile')?[384]:[128,256,512];
const density=process.argv.includes('--density');
let keySeed=0;while(!riftModifiers({attempt:1,keySeed,keyTier:5}).some(m=>m.id==='density'))keySeed++;
const results=[];
for(const count of counts){
 const entrance:DungeonEntrance={id:'dungeon:rift:1',name:'Benchmark',seed:7342,level:30,biome:'verdant',x:0,y:0,rift:{attempt:1,...(density?{keySeed,keyTier:5}:{})}};
 const floor=generateDungeon(entrance.seed,30,entrance),world=new RiftWorld(floor,entrance);
 const anchor=floor.members.find(m=>m.id==='rift:0:0')!;
 const sim=new Simulation(world,{spawn:false,startX:anchor.x,startY:anchor.y});
 sim.expeditions={...freshExpeditions(),runs:[createDungeonRun(entrance)],location:entrance.id,surface:emptyContents()};sim.dungeonFloor=floor;
 const members=floor.members.filter(m=>m.id!=='warden').sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)).slice(0,count);
 for(const m of members){const e=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:entrance.id,memberId:m.id,lootSeed:m.seed,level:30})!;e.state='chase';e.awareness=1;e.lastSeenX=anchor.x;e.lastSeenY=anchor.y;e.seesPlayer=true;e.homeX=anchor.x;e.homeY=anchor.y;}
 sim.player.maxHp=1e9;
 const timings=[];
 for(let tick=0;tick<420;tick++){
  sim.player.hp=sim.player.maxHp;sim.player.dead=false;
  const t=performance.now();sim.update(FIXED_STEP,input);if(tick>=60)timings.push(performance.now()-t);
  if(sim.expeditions.runs[0].rift?.phase==='failed')throw Error('Benchmark run ended prematurely');
 }
 timings.sort((a,b)=>a-b);
 results.push({actors:sim.enemies.length,medianTickMs:+timings[180].toFixed(3),p95TickMs:+timings[342].toFixed(3),simulationMsPer60HzFrame:+(timings[180]*2).toFixed(3)});
 world.dispose();
}
console.log(JSON.stringify({seed:7342,densityBonus:density?65:0,simulationHz:120,results},null,2));
