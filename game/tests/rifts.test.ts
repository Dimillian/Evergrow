import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiftKey, validRiftKey, riftModifiers, riftPoints, RIFT_RULES } from '../src/rift-content.ts';
import { validItem } from '../src/item-validation.ts';
import { itemFootprint } from '../src/inventory-grid.ts';
import { defaultEquipmentSlot } from '../src/inventory.ts';
import { improvementProblem } from '../src/item-improvement.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { planDungeonTravel, claimDungeonChest, dungeonChestProblem } from '../src/dungeon-command.ts';
import { Simulation } from '../src/simulation.ts';
import { RiftWorld } from '../src/rift-world.ts';
import { tickRift, riftKill } from '../src/rift-runtime.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { enemyModifiers, enemyMovementMultiplier } from '../src/enemy-modifiers.ts';
import { BIOME_IDS } from '../src/biomes.ts';
import type { Building } from '../src/settlements.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
const portal:Building={id:'rift:test',seed:1,name:'Rift',kind:'rift',form:'fixture',x:0,y:-70,width:58,height:32,door:{x:0,y:0,width:42},walls:[],furniture:[]};
const surface={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),getBuildings:()=>[portal]};
const ok=()=>({ok:true,message:''});
async function setup(key=true){
 const sim=new Simulation(surface,{spawn:false});sim.player.level=25;sim.player.character.skillPoints=24;sim.player.character.statPoints=120;sim.player.x=sim.player.y=0;
 const item=createRiftKey(7319,25,3);if(key)sim.player.character.inventory[0]=item;
 const result=await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:0,...(key?{keyId:item.id}:{})},surface,ok);assert.ok(result.ok);
 const entrance=currentDungeon(result.checkpoint.expeditions!)!.entrance,floor=generateDungeon(entrance.seed,entrance.level,entrance);
 sim.world=new RiftWorld(floor,entrance);sim.restoreCheckpoint(result.checkpoint);
 return {sim,run:currentDungeon(sim.expeditions)!,floor};
}
test('rift keys are deterministic normal-pack items with canonical validation and distinct modifiers',()=>{
 for(let tier=1;tier<=5;tier++)for(let seed=0;seed<40;seed++){
  const key=createRiftKey(seed,25,tier);assert.ok(validItem(key));assert.ok(validRiftKey(structuredClone(key)));
  assert.deepEqual(itemFootprint(key),{width:1,height:2});assert.equal(defaultEquipmentSlot({} as never,key),undefined);assert.ok(improvementProblem(key,'enhance',25));
  const mods=riftModifiers({attempt:1,keySeed:seed,keyTier:tier});assert.ok(mods.some(m=>m.beneficial));assert.ok(mods.some(m=>!m.beneficial));assert.equal(new Set(mods.map(m=>m.id)).size,mods.length);
  const broken=structuredClone(key);broken.recipe.riftKeyTier=9;assert.equal(validItem(broken),false);
 }
});
test('all rift biomes have connected broad floors and surplus rank-weighted targets',()=>{
 for(const biome of BIOME_IDS)for(let seed=0;seed<6;seed++){
  const f=generateDungeon(seed,25,{rift:{attempt:1},biome});assert.equal(f.events!.length,0);assert.equal(f.members.length,541);
  assert.ok(f.members.filter(m=>m.id!=='warden').reduce((n,m)=>n+riftPoints(m.rank),0)>RIFT_RULES.progress*1.5);
  for(const m of f.members)assert.equal(dungeonBlocked(f,m.x,m.y,25),false,`${biome} ${seed} ${m.id}`);
  const reached=new Set([0]);for(let i=0;i<16;i++)for(const [a,b]of f.edges){if(reached.has(a))reached.add(b);if(reached.has(b))reached.add(a);}assert.equal(reached.size,16);
 }
});
test('entry consumes a key only after persistence; failures preserve inventory and attempts',async()=>{
 const sim=new Simulation(surface,{spawn:false});sim.player.level=25;sim.player.character.skillPoints=24;sim.player.character.statPoints=120;sim.player.x=sim.player.y=0;const key=createRiftKey(11,25);sim.player.character.inventory[0]=key;
 const before=JSON.stringify(sim.captureCheckpoint());const result=await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:0,keyId:key.id},surface,()=>({ok:false,message:'disk'}));assert.equal(result.ok,false);assert.equal(JSON.stringify(sim.captureCheckpoint()),before);
 const {sim:entered,run}=await setup();assert.equal(entered.player.character.inventory.some(i=>i?.kind==='riftKey'),false);assert.equal(run.entrance.level,25);assert.ok(validExpeditions(entered.captureCheckpoint().expeditions));
});
test('entry enforces level, offset, locked key and stale-attempt boundaries',async()=>{
 const sim=new Simulation(surface,{spawn:false});sim.player.x=sim.player.y=0;
 assert.equal((await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:0},surface,ok)).ok,false);
 sim.player.level=25;sim.player.character.skillPoints=24;sim.player.character.statPoints=120;assert.equal((await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:11,attempt:0},surface,ok)).ok,false);
 const key=createRiftKey(12,25);key.locked=true;sim.player.character.inventory[0]=key;
 assert.equal((await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:0,keyId:key.id},surface,ok)).ok,false);
 assert.equal((await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:1},surface,ok)).ok,false);
});
test('progress summons guardian, timeout includes boss, and dead players cannot complete',async()=>{
 const {sim,run,floor}=await setup(false);const m=floor.members[0],enemy=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 run.rift!.points=599;riftKill(sim,enemy);assert.equal(run.rift!.phase,'boss');tickRift(sim,600);assert.equal(run.rift!.phase,'failed');
 const boss={...enemy,campMemberId:'warden'};riftKill(sim,boss);assert.equal(sim.expeditions.rifts!.clears,0);
});
test('rift monster kills retain XP/recharge but never create physical rewards',async()=>{
 const {sim,run,floor}=await setup(false),m=floor.members[0],enemy=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 const before=sim.player.xp;const result=awardKillRewards(enemy,0,7,{player:sim.player,groundItems:sim.groundItems,groundGold:sim.groundGold,pickups:sim.pickups,suppressDrops:true,nextId:()=>99,emit:()=>{}});
 assert.ok(sim.player.xp>before);assert.equal(result.kills,1);assert.equal(result.recharge,0);assert.equal(sim.groundItems.length+sim.groundGold.length+sim.pickups.length,0);
});
test('successful chest is atomic, guaranteed key, exactly once, and survives save validation',async()=>{
 const {sim,run,floor}=await setup();run.rift!.points=600;run.rift!.phase='boss';run.rift!.elapsed=405;
 const m=floor.members.find(m=>m.id==='warden')!,boss=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;boss.hp=0;run.states.warden.hp=0;riftKill(sim,boss);
 assert.equal(run.rift!.phase,'complete');assert.equal(sim.expeditions.rifts!.clears,1);assert.equal(sim.expeditions.rifts!.best[0].seconds,405);
 sim.player.x=floor.chests[2].x;sim.player.y=floor.chests[2].y;
 assert.equal(dungeonChestProblem(sim,2),null);assert.equal((await claimDungeonChest(sim,2,()=>({ok:false,message:'disk'}))).ok,false);assert.equal(sim.groundItems.length,0);assert.equal(run.rift!.claimed,false);
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,true);assert.equal(sim.groundItems.filter(d=>d.item.kind==='riftKey').length,1);assert.ok(sim.groundItems.length>=9);assert.ok(sim.groundGold.length);
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,false);const checkpoint=sim.captureCheckpoint();assert.ok(validExpeditions(checkpoint.expeditions));
 const saved=decodeCharacterSave(JSON.stringify({version:4,id:'test',name:'Rift',worldSeed:7319,worldVersion:10,createdAt:1,updatedAt:2,checkpoint}));assert.ok(saved,'complete checkpoint validates');assert.ok(decodeCharacterSave(JSON.stringify(saved)),'decoded keys remain valid on the next save');
});
test('death and timeout return to the departure town, clear run and never restore a consumed key',async()=>{
 const {sim,run}=await setup();run.rift!.phase='failed';sim.player.dead=true;
 const result=await planDungeonTravel(sim,{kind:'death'},surface,ok);assert.ok(result.ok);assert.equal(result.checkpoint.dead,false);assert.equal(result.checkpoint.expeditions!.location,null);assert.equal(result.checkpoint.expeditions!.runs.length,0);assert.equal(result.checkpoint.character.inventory.some(i=>i?.kind==='riftKey'),false);assert.ok(Math.hypot(result.checkpoint.x,result.checkpoint.y)<100);
});
test('rank modifiers are stable, distinct and leave bosses on their own authored recipes',()=>{
 for(let seed=0;seed<50;seed++){const e={kind:'stalker' as const,rank:'elite' as const,lootSeed:seed};const mods=enemyModifiers(e);assert.equal(mods.length,2);assert.equal(new Set(mods.map(m=>m.name)).size,2);assert.deepEqual(mods,enemyModifiers({...e}));assert.ok(enemyMovementMultiplier(e)>=1);assert.equal(enemyModifiers({...e,kind:'warden'}).length,0);}
});
