import test from 'node:test';
import assert from 'node:assert/strict';
import { LocationController } from '../src/location-controller.ts';
import { Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
const surface={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const entrance={id:'dungeon:order',name:'Crypt',seed:7319,level:4,biome:'deadwood' as const,x:600,y:0};
test('location controller waits for durable write before swapping world, restoring actors and establishing arrival coverage',async()=>{
  const sim=new Simulation(surface,{spawn:false,startX:600}); const calls:string[]=[];
  let settle!:(value:{ok:boolean;message:string})=>void;
  const controller=new LocationController({simulation:()=>sim,surface:()=>surface,
    persist:()=>{calls.push('save');return new Promise(resolve=>{settle=resolve;});},
    restoreWorld:cp=>{calls.push('world');const run=currentDungeon(cp.expeditions!)!;sim.world=new DungeonWorld(generateDungeon(run.entrance.seed,run.entrance.level),run.entrance);},
    arrived:()=>{assert.ok(sim.dungeonFloor);calls.push('arrival');sim.setSpawnExclusion({x:-400,y:-300,width:800,height:600});},
    notify:()=>{calls.push('notice');}});
  const before=sim.captureCheckpoint();const pending=controller.dungeon({kind:'enter',entrance});
  assert.deepEqual(calls,['save']);assert.equal(sim.world,surface);assert.deepEqual(sim.captureCheckpoint(),before);
  settle({ok:false,message:'Disk full'});assert.equal(await pending,false);assert.deepEqual(calls,['save','notice']);assert.deepEqual(sim.captureCheckpoint(),before);
  calls.length=0;const retry=controller.dungeon({kind:'enter',entrance});settle({ok:true,message:''});
  assert.equal(await retry,true);assert.deepEqual(calls,['save','world','arrival','notice']);assert.equal(sim.expeditions.location,entrance.id);
  (sim.world as unknown as DungeonWorld).dispose();
});
