import { chronicleValues } from '../src/chronicle.ts';
import { dungeonRunChest, dungeonRunExit } from '../src/dungeon-locations.ts';
import { enemyTraitBuffs } from '../src/enemy-debuffs.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiftKey, validRiftKey, riftModifiers, riftPoints, RIFT_RULES } from '../src/rift-content.ts';
import { validItem } from '../src/item-validation.ts';
import { itemFootprint } from '../src/inventory-grid.ts';
import { defaultEquipmentSlot } from '../src/inventory.ts';
import { improvementProblem } from '../src/item-improvement.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { updateDungeon } from '../src/dungeon-runtime.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { planDungeonTravel, claimDungeonChest, dungeonChestProblem } from '../src/dungeon-command.ts';
import { updateWildernessBoss } from '../src/wilderness-boss.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { riftRewardItems } from '../src/rift-rewards.ts';
import { riftRewardItemCount, riftRewardMask } from '../src/rift-content.ts';
import { LOOT_RULES } from '../src/combat-content.ts';
import { Simulation } from '../src/simulation.ts';
import { RiftWorld } from '../src/rift-world.ts';
import { tickRift, riftKill, updateRiftGuardian } from '../src/rift-runtime.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { enemyModifiers, enemyMovementMultiplier } from '../src/enemy-modifiers.ts';
import { World } from '../src/world.ts';
import { WorldLandscape } from '../src/world-landscape.ts';
import { RIFT_FIELD, riftPackCount } from '../src/rift-floor.ts';
import { BIOME_IDS, startingBiome } from '../src/biomes.ts';
import type { Building } from '../src/settlements.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
const portal:Building={id:'rift:test',seed:1,name:'Rift',kind:'rift',form:'fixture',x:0,y:-70,width:58,height:32,door:{x:0,y:0,width:42},walls:[],furniture:[]};
const surface={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),getBuildings:()=>[portal]};
const ok=()=>({ok:true,message:''});
async function setup(key=true,keySeed=7319){
 const sim=new Simulation(surface,{spawn:false});sim.player.level=25;sim.player.character.skillPoints=24;sim.player.character.statPoints=120;sim.player.x=sim.player.y=0;
 const item=createRiftKey(keySeed,25,3);if(key)sim.player.character.inventory[0]=item;
 const result=await planDungeonTravel(sim,{kind:'rift',portalId:portal.id,offset:0,attempt:0,...(key?{keyId:item.id}:{})},surface,ok);assert.ok(result.ok);
 const entrance=currentDungeon(result.checkpoint.expeditions!)!.entrance,floor=generateDungeon(entrance.seed,entrance.level,entrance);
 sim.world=new RiftWorld(floor,entrance);sim.restoreCheckpoint(result.checkpoint);
 return {sim,run:currentDungeon(sim.expeditions)!,floor};
}
test('rift keys are deterministic normal-pack items with canonical validation and distinct modifiers',()=>{
 for(let tier=1;tier<=5;tier++)for(let seed=0;seed<40;seed++){
  const key=createRiftKey(seed,25,tier);assert.equal(key.tier,['common','magic','rare','epic','legendary'][tier-1]);assert.equal(key.name,'Crimson Rift Key');assert.ok(validItem(key));assert.ok(validRiftKey(structuredClone(key)));
  assert.deepEqual(itemFootprint(key),{width:1,height:2});assert.equal(defaultEquipmentSlot({} as never,key),undefined);assert.ok(improvementProblem(key,'enhance',25));
  const mods=riftModifiers({attempt:1,keySeed:seed,keyTier:tier});assert.ok(mods.some(m=>m.beneficial));assert.ok(mods.some(m=>!m.beneficial));assert.equal(new Set(mods.map(m=>m.id)).size,mods.length);
  const broken=structuredClone(key);broken.recipe.riftKeyTier=9;assert.equal(validItem(broken),false);
 }
});
test('rifts use actual open-world terrain and huge irregular packs in every starting biome',()=>{
 for(const biome of BIOME_IDS){
  let seed=0;while(startingBiome(seed)!==biome)seed++;
  const entrance={id:'dungeon:rift:1',name:'Test',seed,level:25,biome,x:0,y:0,rift:{attempt:1}};
  const f=generateDungeon(seed,25,entrance),world=new RiftWorld(f,entrance),landscape=new WorldLandscape(seed,true),ordinary=new World(seed);
  assert.equal(f.events!.length,0);assert.equal(f.corridors.length,0);assert.equal(f.edges.length,0);
  assert.ok(f.members.length>=RIFT_FIELD.packs*RIFT_FIELD.minPack+1);
  assert.ok(f.members.filter(m=>m.id!=='warden').reduce((n,m)=>n+riftPoints(m.rank),0)>RIFT_RULES.progress*4);
  assert.equal(new Set(f.members.filter(m=>m.id!=='warden').map(m=>m.id.split(':')[1])).size,RIFT_FIELD.packs);
  assert.equal(world.blocked(f.entry.x,f.entry.y,25),false);
  for(const m of f.members){
    assert.equal(dungeonBlocked(f,m.x,m.y,ENEMY_DEFINITIONS[m.kind].radius),false,`${biome} ${seed} ${m.id}`);
    assert.equal(world.blocked(m.x,m.y,ENEMY_DEFINITIONS[m.kind].radius),false);
    assert.ok(world.sampleWater(m.x,m.y).coverage<.12);
    assert.deepEqual(world.sampleBiome(m.x,m.y),ordinary.sampleBiome(m.x,m.y));
  }
  for(const p of [f.exit,f.chests[2]])assert.equal(world.blocked(p.x,p.y,40),false);
  assert.deepEqual(world.getProps(-900,-900,1800,1800),landscape.getProps(-900,-900,1800,1800));
  assert.ok(world.getProps(-900,-900,1800,1800).length>0);
  assert.deepEqual(world.getSettlements(-4000,-4000,8000,8000),[]);
  assert.deepEqual(world.getEventSites(-4000,-4000,8000,8000),[]);
  assert.deepEqual(world.getPOIs(-4000,-4000,8000,8000),[]);
  assert.deepEqual(world.getContainers(0,0,1000),[]);
  // Discovery sectors have no physical boundary: the landscape continues beyond the roster.
  assert.deepEqual(world.move(0,0,0,100,15),landscape.move(0,0,0,100,15));
  world.dispose();ordinary.dispose();landscape.dispose();
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

test('save restoration retains keyed monster life, damage, traits and the remaining clock',async()=>{
 let keySeed=0;
 for(let i=0;i<1000;i++){const seed=Math.imul(i,0x9e3779b9)>>>0,mods=riftModifiers({attempt:1,keySeed:seed,keyTier:3});if(mods.some(m=>m.id==='vital')&&mods.some(m=>m.id==='savage')){keySeed=seed;break;}}
 assert.ok(keySeed,'fixture has both life and damage modifiers');
 const {sim,run,floor}=await setup(true,keySeed);
 const m=floor.members.find(m=>enemyModifiers({kind:m.kind,rank:m.rank,lootSeed:m.seed}).some(t=>t.name==='Savage'))!;
 assert.ok(m);
 const enemy=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 enemy.hp=Math.round(enemy.maxHp*.7);run.rift!.elapsed=187.25;
 const expected={hp:enemy.hp,maxHp:enemy.maxHp,damage:enemy.damage,rift:enemy.rift,modifiers:enemyModifiers(enemy)};
 const saved=sim.captureCheckpoint();sim.restoreCheckpoint(saved);
 const restored=sim.enemies.find(e=>e.campMemberId===m.id)!;
 assert.deepEqual({hp:restored.hp,maxHp:restored.maxHp,damage:restored.damage,rift:restored.rift,modifiers:enemyModifiers(restored)},expected);
 assert.equal(currentDungeon(sim.expeditions)!.rift!.elapsed,187.25);
 tickRift(sim,1);assert.equal(currentDungeon(sim.expeditions)!.rift!.elapsed,188.25);
 assert.ok(validExpeditions(sim.captureCheckpoint().expeditions));
});
test('surface champion damage also survives save restoration',()=>{
 const sim=new Simulation(surface,{spawn:false});
 let seed=0;while(!enemyModifiers({kind:'stalker',rank:'elite',lootSeed:seed}).some(t=>t.name==='Savage'))seed++;
 const enemy=sim.spawnEnemy('stalker',0,0,'elite',{campId:'test',memberId:'test:0',lootSeed:seed,level:25})!;
 const damage=enemy.damage;sim.restoreCheckpoint(sim.captureCheckpoint());assert.equal(sim.enemies[0].damage,damage);
});
test('victory clears hostile shots and prevents post-clear damage while collecting rewards',async()=>{
 const {sim,run,floor}=await setup(false),m=floor.members.find(m=>m.id==='warden')!;
 const boss=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 sim.player.x=m.x;sim.player.y=m.y;run.rift!.points=600;run.rift!.phase='boss';
 sim.projectiles.push({id:900,sourceLevel:25,x:m.x,y:m.y,prevX:m.x,prevY:m.y,vx:0,vy:0,angle:0,radius:5,damage:999,life:5,maxLife:5,owner:'enemy',hitIds:new Set()});
 boss.hp=0;riftKill(sim,boss);assert.equal(sim.projectiles[0].life,0);
 const hp=sim.player.hp;sim.takeDamage(999,0,25,'physical');assert.equal(sim.player.hp,hp);assert.equal(sim.player.dead,false);
 riftKill(sim,boss);assert.equal(sim.expeditions.rifts!.clears,1);
});
test('a crowded reward floor preserves dropped items and retries only outstanding chest rewards',async()=>{
 const {sim,run,floor}=await setup(false);run.rift!.phase='boss';run.rift!.points=600;
 const m=floor.members.find(m=>m.id==='warden')!,boss=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 boss.hp=0;riftKill(sim,boss);sim.player.x=floor.chests[2].x;sim.player.y=floor.chests[2].y;
 sim.groundItems=Array.from({length:LOOT_RULES.maxGroundItems},(_,i)=>({id:1000+i,x:sim.player.x,y:sim.player.y,item:createRiftKey(i,25)}));
 const original=structuredClone(sim.groundItems);
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,true); // Gold can still be delivered.
 assert.deepEqual(sim.groundItems,original);assert.equal(currentDungeon(sim.expeditions)!.rift!.claimed,false);
 const gold=structuredClone(sim.groundGold);sim.groundItems=[];
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,true);
 assert.equal(sim.groundItems.length,riftRewardItemCount(run.entrance.rift!));assert.deepEqual(sim.groundGold,gold);
 assert.equal(currentDungeon(sim.expeditions)!.rift!.claimed,true);
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,false);
});
test('key progression and reward masks remain deterministic for every grade and modifier count',()=>{
 for(let tier=1;tier<=5;tier++)for(let seed=0;seed<80;seed++){
  const entrance={id:'dungeon:rift:1',name:'Rift',x:0,y:0,seed,level:25,biome:'verdant' as const,rift:{attempt:1,keyTier:tier,keySeed:seed}};
  const items=riftRewardItems(entrance,25),key=items.at(-1)!;
  assert.equal(items.length,riftRewardItemCount(entrance.rift));assert.equal(riftRewardMask(entrance.rift),(1<<(items.length+1))-1);
  assert.equal(items.filter(i=>i.kind==='riftKey').length,1);assert.ok(validRiftKey(key));
  assert.ok(key.recipe.riftKeyTier===tier||key.recipe.riftKeyTier===Math.min(5,tier+1));
  const changed=riftRewardItems({...entrance,rift:{...entrance.rift,keySeed:seed+431}},25);
  assert.deepEqual(changed.at(-1),key,'changing key modifiers cannot change the replacement key');
 }
});

test('key movement modifiers apply to guardian pursuit without changing attack geometry',async()=>{
 const {sim,run,floor}=await setup(),m=floor.members.find(m=>m.id==='warden')!;
 const boss=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 let seed=0;while(!riftModifiers({attempt:1,keySeed:seed,keyTier:5}).some(m=>m.id==='swift'))seed++;
 boss.rift={attempt:1,keySeed:seed,keyTier:5};boss.state='chase';boss.awareness=1;
 sim.player.x=boss.x+500;sim.player.y=boss.y;
 let speed=0;updateWildernessBoss(boss,1/120,{player:sim.player,enemies:[boss],world:surface,time:0,trial:null,visible:()=>true,move:(_e,vx,vy)=>{speed=Math.hypot(vx,vy);},hurt:()=>{},shoot:()=>{},emit:()=>{}});
 assert.ok(Math.abs(speed-ENEMY_DEFINITIONS[boss.kind].speed*1.20)<1e-8);
});


test('open-world rift streaming retains nearby packs without visible births or stationary respawn churn',async()=>{
 const {sim}=await setup(false);
 updateDungeon(sim,null);assert.equal(sim.enemies.length,0);
 const view={x:-400,y:-300,width:800,height:600};updateDungeon(sim,view);
 assert.ok(sim.enemies.length>64,'multiple large packs populate around the arrival');
 assert.ok(sim.enemies.every(e=>isSpawnHidden(e.x,e.y,view,e.radius)));
 assert.ok(sim.enemies.every(e=>Math.hypot(e.x,e.y)<=RIFT_FIELD.admissionRange));
 const ids=sim.enemies.map(e=>e.id).sort((a,b)=>a-b);
 for(let i=0;i<8;i++){sim.time+=RIFT_FIELD.admissionInterval;updateDungeon(sim,view);}
 assert.deepEqual(sim.enemies.map(e=>e.id).sort((a,b)=>a-b),ids,'stationary actors retain identities');
 assert.equal(sim.enemies.some(e=>e.campMemberId==='warden'),false);
});

 test('Teeming keys add separated packs to the same landscape at every rarity',()=>{
  for(let tier=1;tier<=5;tier++){
    let keySeed=0;while(!riftModifiers({attempt:1,keySeed,keyTier:tier}).some(m=>m.id==='density'))keySeed++;
    const rift={attempt:1,keySeed,keyTier:tier};
    assert.equal(riftModifiers(rift).find(m=>m.id==='density')!.value,25+10*(tier-1));
    const entrance={id:'dungeon:rift:1',name:'Density',seed:7342,level:30,biome:'verdant' as const,x:0,y:0,rift};
    const floor=generateDungeon(7342,30,entrance),members=floor.members.filter(m=>m.id!=='warden');
    assert.equal(new Set(members.map(m=>m.id.split(':')[1])).size,riftPackCount(rift));
    assert.ok(members.length>=riftPackCount(rift)*RIFT_FIELD.minPack);
    assert.deepEqual(generateDungeon(7342,30,structuredClone(entrance)),floor);
    for(let i=0;i<members.length;i++){
      const a=members[i],radius=ENEMY_DEFINITIONS[a.kind].radius*1.28;
      assert.ok(Math.hypot(a.x,a.y)<=3680);
      assert.equal(dungeonBlocked(floor,a.x,a.y,radius),false);
      for(let j=i+1;j<members.length;j++){const b=members[j];
        assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=radius+ENEMY_DEFINITIONS[b.kind].radius*1.28+8,'packs must not overlap');
      }
    }
  }
 });

test('guardian arrival dismisses the roster, persists its warning and spawns near the player exactly once',async()=>{
 const {sim,run,floor}=await setup(false),m=floor.members[0];
 sim.player.x=m.x;sim.player.y=m.y;
 for(const member of floor.members.slice(0,12))sim.spawnEnemy(member.kind,member.x,member.y,member.rank,{campId:run.entrance.id,memberId:member.id,lootSeed:member.seed,level:25});
 const victim=sim.enemies[0],xp=sim.player.xp,kills=sim.kills;
 victim.hp=0;run.rift!.points=599;riftKill(sim,victim);
 assert.equal(sim.enemies.some(e=>e.hp>0),false);
 assert.ok(Object.entries(run.states).every(([id,s])=>id==='warden'||s.hp===0));
 assert.equal(sim.player.xp,xp);assert.equal(sim.kills,kills);assert.equal(sim.groundItems.length,0);
 updateDungeon(sim,{x:m.x-450,y:m.y-400,width:900,height:800});
 const arrival=structuredClone(run.rift!.guardian!);assert.ok(arrival);
 assert.ok(Math.hypot(arrival.x-sim.player.x,arrival.y-sim.player.y)<720);
 assert.equal(sim.world.blocked(arrival.x,arrival.y,ENEMY_DEFINITIONS[floor.members.at(-1)!.kind].radius),false);
 tickRift(sim,1);const checkpoint=sim.captureCheckpoint();assert.ok(validExpeditions(checkpoint.expeditions));
 sim.restoreCheckpoint(checkpoint);const resumed=currentDungeon(sim.expeditions)!;
 assert.deepEqual(resumed.rift!.guardian,arrival);updateRiftGuardian(sim);assert.equal(sim.enemies.some(e=>e.hp>0),false);
 tickRift(sim,RIFT_RULES.guardianArrival-1+.01);updateRiftGuardian(sim);
 const live=sim.enemies.filter(e=>e.hp>0);assert.equal(live.length,1);assert.equal(live[0].campMemberId,'warden');
 assert.equal(live[0].x,arrival.x);assert.equal(live[0].y,arrival.y);
 updateRiftGuardian(sim);assert.equal(sim.enemies.filter(e=>e.hp>0).length,1);
 assert.ok(validExpeditions(sim.captureCheckpoint().expeditions));
});
test('timeout during guardian warning cannot spawn it',async()=>{
 const {sim,run}=await setup(false);run.rift!.points=600;run.rift!.phase='boss';run.rift!.elapsed=599;
 updateRiftGuardian(sim);tickRift(sim,1);updateRiftGuardian(sim);
 assert.equal(run.rift!.phase,'failed');assert.equal(sim.enemies.some(e=>e.campMemberId==='warden'),false);
});
test('guardian treasure opens remotely at the kill site and exit uses that same destination after reload',async()=>{
 const {sim,run,floor}=await setup(false),m=floor.members[0];sim.player.x=m.x;sim.player.y=m.y;
 run.rift!.points=600;run.rift!.phase='boss';updateRiftGuardian(sim);tickRift(sim,3);updateRiftGuardian(sim);
 const boss=sim.enemies.find(e=>e.campMemberId==='warden')!;boss.hp=0;riftKill(sim,boss);
 const chest=dungeonRunChest(floor,run,2),exit=dungeonRunExit(floor,run);
 assert.equal(chest.x,boss.x);assert.equal(chest.y,boss.y);assert.ok(Math.hypot(exit.x-boss.x,exit.y-boss.y)<=151);
 assert.ok(Math.hypot(chest.x-sim.player.x,chest.y-sim.player.y)>75);
 assert.equal(dungeonChestProblem(sim,2),null);
 assert.equal((await claimDungeonChest(sim,2,ok)).ok,true);
 assert.ok(sim.groundItems.every(item=>item.flight?.x===chest.x&&item.flight?.y===chest.y));
 const checkpoint=sim.captureCheckpoint();assert.ok(validExpeditions(checkpoint.expeditions));sim.restoreCheckpoint(checkpoint);
 const restored=currentDungeon(sim.expeditions)!;assert.deepEqual(dungeonRunExit(floor,restored),exit);
 sim.player.x=exit.x;sim.player.y=exit.y;
 assert.equal((await planDungeonTravel(sim,{kind:'exit'},surface,ok)).ok,true);
});
test('rank modifier icons retain names, actual effects and permanent lifetimes',()=>{
 for(const rank of ['veteran','elite'] as const){
  const enemy={kind:'stalker' as const,rank,lootSeed:73,hp:100};
  const buffs=enemyTraitBuffs(enemy),traits=enemyModifiers(enemy);
  assert.equal(buffs.length,rank==='elite'?2:1);
  buffs.forEach((buff,i)=>{assert.equal(buff.name,traits[i].name);assert.equal(buff.summary,traits[i].description);assert.equal(buff.color,traits[i].color);assert.equal(buff.persistent,true);});
 }
 assert.deepEqual(enemyTraitBuffs({kind:'stalker',rank:'elite',lootSeed:73,hp:0}),[]);
});

test('rift Chronicle records durable entry, actual kills, successful clears and no duplicate credit',async()=>{
 const {sim,run,floor}=await setup();
 const values=()=>chronicleValues(sim.player.chronicle!.sources);
 assert.equal(values().riftAttempts,1);assert.equal(values().riftKeysUsed,1);
 const member=floor.members.find(m=>m.id!=='warden')!;
 const enemy=sim.spawnEnemy(member.kind,member.x,member.y,member.rank,{campId:run.entrance.id,memberId:member.id,lootSeed:member.seed,level:25})!;
 run.rift!.points=599;riftKill(sim,enemy);
 assert.equal(values().riftKills,1,'guardian transition does not credit dissolved monsters');
 const m=floor.members.find(m=>m.id==='warden')!;
 const boss=sim.spawnEnemy(m.kind,m.x,m.y,m.rank,{campId:run.entrance.id,memberId:m.id,lootSeed:m.seed,level:25})!;
 run.rift!.elapsed=245;riftKill(sim,boss);riftKill(sim,boss);
 assert.equal(values().riftClears,1);assert.equal(values().riftKeyedClears,1);
 assert.equal(values().bestRiftSeconds,245);assert.equal(values().highestRiftLevel,25);
 assert.equal(values().riftFastClears,1);assert.equal(values()['seen:riftBiome:'+run.entrance.biome],1);
 const checkpoint=sim.captureCheckpoint();sim.restoreCheckpoint(checkpoint);
 assert.equal(values().riftClears,1);assert.equal(values().riftAttempts,1);
});
test('rift failure outcomes count once and failed abandonment saves do not count',async()=>{
 const {sim,run}=await setup(false);tickRift(sim,600);tickRift(sim,1);
 assert.equal(chronicleValues(sim.player.chronicle!.sources).riftTimeouts,1);
 const {sim:dead}=await setup(false);dead.player.dead=true;tickRift(dead,1);tickRift(dead,1);
 assert.equal(chronicleValues(dead.player.chronicle!.sources).riftDeaths,1);
 const {sim:leaving}=await setup(false);leaving.player.x=leaving.player.y=0;
 const fail=await planDungeonTravel(leaving,{kind:'exit'},surface,()=>({ok:false,message:'disk'}));assert.equal(fail.ok,false);
 assert.equal(chronicleValues(leaving.player.chronicle!.sources).riftAbandoned,undefined);
 const success=await planDungeonTravel(leaving,{kind:'exit'},surface,ok);assert.ok(success.ok);
 assert.equal(chronicleValues(success.checkpoint.chronicle!.sources).riftAbandoned,1);
 assert.equal(chronicleValues(success.checkpoint.chronicle!.sources).riftDeaths,undefined);
 assert.equal(run.rift!.phase,'failed');
});
