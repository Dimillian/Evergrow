import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_DIFFICULTIES, difficultyLootWeights, difficultyEnemyStats, storedDifficultyHealth } from '../src/world-difficulty.ts';
import { changeWorldDifficulty, difficultyChangeProblem } from '../src/world-difficulty-command.ts';
import { Simulation } from '../src/simulation.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { applyEnemyModifiers } from '../src/enemy-modifiers.ts';
import { validActors, validExpeditions } from '../src/dungeon-validation.ts';
import { decodeCharacterSave, type CharacterCheckpoint } from '../src/character-save.ts';
import { createDungeonRun, currentDungeon, syncDungeon } from '../src/dungeon-state.ts';
import { planDungeonTravel } from '../src/dungeon-command.ts';
import { ENEMY_LOOT_TABLES, BOSS_CHEST_LOOT_TABLES } from '../src/loot-content.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { executeEvent } from '../src/poi-command.ts';
import { validEvents } from '../src/poi-validation.ts';
import { riftEnemyStats } from '../src/rift-content.ts';
import { difficultyBadgeShapes, difficultyBadgeSVG } from '../src/world-difficulty-art.ts';
import { getMinimapChartRect, getMinimapRect, getMinimapDifficultyRect, getMinimapHomeRect } from '../src/map-view.ts';
const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),isSanctuary:(x:number,y:number)=>Math.hypot(x,y)<100};
const make=()=>new Simulation(world,{spawn:false,startX:0,startY:0});
const ok=async()=>({ok:true,message:''});
const decoded=(checkpoint:CharacterCheckpoint)=>decodeCharacterSave(JSON.stringify({version:4,id:'test',name:'Test',worldSeed:7319,worldVersion:10,createdAt:1,updatedAt:2,checkpoint}));
const entrance={id:'dungeon:test',name:'Crypt',seed:7319,level:8,biome:'deadwood' as const,x:600,y:0};

test('Normal is unchanged; every rank and boss gets explicit health, damage and XP multipliers',()=>{
 for(const d of WORLD_DIFFICULTIES)for(const rank of ['normal','veteran','elite'] as const)for(const kind of ['stalker','archer','warden'] as const){
  const sim=make();sim.player.character.difficulty=d.id;
  const e=sim.spawnEnemy(kind,500,0,rank,{campId:'test',memberId:'guard',level:50,lootSeed:77})!;
  const baseline=applyEnemyModifiers(scaledEnemyStats(kind,50,rank),{kind,rank,lootSeed:77});
  assert.equal(e.maxHp,baseline.maxHp*d.health);
  assert.equal(e.xpReward,Math.round(baseline.xpReward*d.experience));
  assert.ok(e.damage>=baseline.damage);
  assert.equal(e.rewardDifficulty,d.id);
  assert.equal(e.level,50);
  assert.ok(validActors(sim.captureCheckpoint().actors));
 }
 const base=scaledEnemyStats('stalker',50,'normal');assert.deepEqual(difficultyEnemyStats(base,undefined),base);
});

test('difficulty is saved before commitment; changing it preserves wounds, progress and lowest encounter rewards',async()=>{
 const sim=make();sim.player.hp=31;sim.player.mana=19;
 const foe=sim.spawnEnemy('stalker',500,0)!;foe.hp=foe.maxHp*.37;
 const before=sim.captureCheckpoint();
 assert.equal((await changeWorldDifficulty(sim,'cataclysm',async()=>({ok:false,message:'Disk full'}))).ok,false);
 assert.deepEqual(sim.captureCheckpoint(),before);
 let persisted:CharacterCheckpoint|undefined;
 assert.ok((await changeWorldDifficulty(sim,'nightmare',async c=>{persisted=c;assert.equal(sim.player.character.difficulty,undefined);return ok();})).ok);
 assert.ok(decoded(persisted!));
 assert.equal(sim.player.hp,31);assert.equal(sim.player.mana,19);
 assert.equal(sim.player.character.difficulty,'nightmare');
 assert.ok(Math.abs(sim.enemies[0].hp/sim.enemies[0].maxHp-.37)<1e-12);
 assert.equal(sim.enemies[0].rewardDifficulty,'normal');
 const fresh=sim.spawnEnemy('stalker',800,0)!;assert.equal(fresh.rewardDifficulty,'nightmare');
 fresh.hp*=.43;
 for(const id of ['veteran','cataclysm','normal','nightmare'] as const){
  assert.ok((await changeWorldDifficulty(sim,id,ok)).ok);
  assert.ok(Math.abs(sim.enemies[1].hp/sim.enemies[1].maxHp-.43)<1e-12);
  assert.ok(decoded(sim.captureCheckpoint()));
 }
 assert.equal(sim.enemies[1].rewardDifficulty,'normal');
});

test('selection cannot run outside sanctuary, while dead or inside a dungeon',async()=>{
 const sim=make();sim.player.x=800;
 assert.ok(difficultyChangeProblem(sim));assert.equal((await changeWorldDifficulty(sim,'veteran',ok)).ok,false);
 sim.player.x=0;sim.player.dead=true;assert.ok(difficultyChangeProblem(sim));
 sim.player.dead=false;sim.expeditions.location='dungeon:test';assert.ok(difficultyChangeProblem(sim));
});

test('dungeon reward caps lower even after a side chest claim, while delivered recipes stay fixed',async()=>{
 const sim=make();sim.player.character.difficulty='cataclysm';
 const run=createDungeonRun(entrance);run.difficulty='cataclysm';run.chestMasks[0]=1;run.chestDifficulties={0:'cataclysm'};
 sim.expeditions.runs.push(run);
 assert.ok((await changeWorldDifficulty(sim,'normal',ok)).ok);
 const after=sim.expeditions.runs[0];assert.equal(after.difficulty,'normal');assert.equal(after.chestDifficulties![0],'cataclysm');
 assert.ok(validExpeditions(sim.expeditions));
 assert.ok((await changeWorldDifficulty(sim,'cataclysm',ok)).ok);assert.equal(sim.expeditions.runs[0].difficulty,'normal');
});

test('new dungeon strength and rewards follow character difficulty and store Normal-equivalent wounds',async()=>{
 const sim=make();sim.player.character.difficulty='veteran';sim.player.x=600;
 const plan=await planDungeonTravel(sim,{kind:'enter',entrance},world,ok);assert.ok(plan.ok);
 const run=currentDungeon(plan.checkpoint.expeditions!)!;assert.equal(run.difficulty,'veteran');
 sim.expeditions=plan.checkpoint.expeditions!;
 const e=sim.spawnEnemy('warden',800,0,'normal',{campId:run.entrance.id,memberId:'warden',lootSeed:7,level:run.entrance.level})!;
 e.hp*=.25;syncDungeon(run,[e],run.x,run.y);
 assert.equal(run.states.warden.hp,storedDifficultyHealth(e));
 assert.equal(e.rewardDifficulty,'veteran');
});

test('rift key health and damage stack once with world difficulty',()=>{
 const sim=make();sim.player.character.difficulty='nightmare';
 const run=createDungeonRun({...entrance,rift:{attempt:1,keySeed:7319,keyTier:3}});run.difficulty='nightmare';
 sim.expeditions.runs=[run];sim.expeditions.location=run.entrance.id;
 const e=sim.spawnEnemy('stalker',800,0,'normal',{campId:run.entrance.id,memberId:'g',lootSeed:1,level:25})!;
 const base=riftEnemyStats(scaledEnemyStats('stalker',25,'normal'),run.entrance.rift);
 assert.equal(e.maxHp,base.maxHp*2.6);assert.equal(e.damage,Math.round(base.damage*1.55));
 assert.ok(validActors(sim.captureCheckpoint().actors));
});

test('quality boosts Epic+ odds in monster and rare-floor chest tables without changing Legendary/Unique equality',()=>{
 for(const weights of [ENEMY_LOOT_TABLES.normal.tierWeights,ENEMY_LOOT_TABLES.elite.tierWeights,...BOSS_CHEST_LOOT_TABLES.dungeon]){
  assert.equal(difficultyLootWeights(weights,undefined),weights);
  let previous=0;
  for(const d of WORLD_DIFFICULTIES){
   const next=difficultyLootWeights(weights,d.id),total=Object.values(next).reduce((a,b)=>a+b,0);
   const odds=(next.epic+next.legendary+next.unique)/total;
   assert.ok(odds>=previous);previous=odds;assert.equal(next.legendary,next.unique);
   assert.equal(next.common,weights.common);assert.equal(next.rare,weights.rare);
  }
 }
 for(let seed=0;seed<100;seed++){
  const source={seed,level:50,playerLevel:50,rank:'elite' as const,kind:'stalker' as const,biome:'deadwood' as const,firstKill:true};
  const normal=rollEnemyLoot(source),explicit=rollEnemyLoot({...source,difficulty:'normal'}),hard=rollEnemyLoot({...source,difficulty:'cataclysm'});
  assert.deepEqual(normal,explicit);assert.equal(normal.length,hard.length);
 }
});

test('trial rewards snapshot their tier and stay capped through later switches',async()=>{
 const sim=make();sim.player.character.difficulty='nightmare';
 const site={id:'site:7319:trial',kind:'graveyard' as const,name:'Graves',x:0,y:30,level:1,seed:7319,biome:'deadwood' as const};
 assert.ok((await executeEvent(sim,site,null,ok)).ok);
 const record=sim.eventState.sites[site.id], rewards=eventRewards(record),normal=eventRewards({...record,difficulty:'normal'});
 assert.equal(record.difficulty,'nightmare');assert.equal(rewards.gold,Math.round(normal.gold*1.6));assert.equal(rewards.xp,Math.round(normal.xp*1.45));
 assert.ok((await changeWorldDifficulty(sim,'normal',ok)).ok);
 assert.equal(sim.eventState.sites[site.id].difficulty,'normal');assert.ok(validEvents(sim.eventState));
});

test('badge silhouettes are distinct, bounded and safe to embed together; minimap badge avoids Home and time footer',()=>{
 const signatures=new Set<string>();
 for(const d of WORLD_DIFFICULTIES){
  const shapes=difficultyBadgeShapes(d.id);signatures.add(JSON.stringify(shapes));
  assert.ok(shapes.every(s=>s.points.every(p=>p.every(n=>Number.isFinite(n)&&Math.abs(n)<52))));
  assert.notEqual(difficultyBadgeSVG(d.id),difficultyBadgeSVG(d.id),'SVG material IDs never collide');
 }
 assert.equal(signatures.size,4);
 for(const w of [360,640,1200,2400]){
  const chart=getMinimapChartRect(getMinimapRect(w,800)),badge=getMinimapDifficultyRect(w,800),home=getMinimapHomeRect(w,800);
  assert.equal(badge.width,home.width);assert.equal(badge.height,home.height);assert.equal(badge.y,home.y);
  assert.ok(badge.x>home.x+home.width);assert.ok(badge.y>=chart.y);assert.ok(badge.y+badge.height<chart.y+chart.height);
 }
});


test('full-health actors remain valid across low and extreme levels despite fractional scaling roundoff',()=>{
 for(const level of [1,2,5,10,25,50,100,1000,1000000])for(const d of WORLD_DIFFICULTIES){
  const sim=make();sim.player.character.difficulty=d.id;
  sim.spawnEnemy('stalker',500,0,'normal',{campId:'test',memberId:'guard',level,lootSeed:77});
  const saved=sim.captureCheckpoint();
  assert.ok(validActors(saved.actors),`${d.id} level ${level}`);
  sim.restoreCheckpoint(saved);assert.equal(sim.enemies[0].hp,sim.enemies[0].maxHp);
 }
});
