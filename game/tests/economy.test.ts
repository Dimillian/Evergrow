import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ECONOMY, validateEconomy, economyConfig, economyKill, economyActivity, estimateEconomy, economyItem, enhancementCosts } from '../src/tools/economy-model.ts';
import { toolForPath } from '../src/tools/catalog.ts';
import { Simulation } from '../src/simulation.ts';
import { awardKillRewards, type KillRewardContext } from '../src/combat-rewards.ts';
import { difficultyEnemyStats } from '../src/world-difficulty.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { itemPrice, improvementPrice } from '../src/commerce.ts';
import { nextEnhancementLevel } from '../src/item-improvement.ts';
import { deriveItem, generateItem } from '../src/items.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { xpLevelFactor } from '../src/progression.ts';
import type { CombatEvent } from '../src/model.ts';

const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
test('economy view routes correctly, validates bounded inputs and round-trips URL settings',()=>{
  assert.equal(toolForPath('/progression.html?view=economy&player=20')?.id,'economy');
  const config={...DEFAULT_ECONOMY,player:20,goblins:35,champion:15,elite:5};
  assert.deepEqual(economyConfig(new URLSearchParams(Object.entries(config).map(([k,v])=>[k,String(v)]))),config);
  for(const change of [{champion:90,elite:20},{minutes:Infinity},{killsPerMinute:NaN},{area:0},{rank:11},{seed:1.5},{material:'glass'},{difficulty:'bogus'},{sell:-1}]) {
    assert.throws(()=>validateEconomy({...config,...change} as typeof config));
  }
  assert.throws(()=>estimateEconomy(config,1000000));
});

test('sampled kill rewards match runtime commitment across ranks, goblins, difficulty, bonuses and level gaps',()=>{
  const sim=new Simulation(world,{spawn:false});
  for(const kind of ['stalker','goblin','goblinChief'] as const)for(const rank of ['normal','veteran','elite'] as const)for(const difficulty of ['normal','cataclysm'] as const) {
    const config={...DEFAULT_ECONOMY,player:20,area:10,goldFind:37,xpBonus:23,sell:100,difficulty};
    const enemy=sim.spawnEnemy(kind,500,500,rank)!;
    Object.assign(enemy,{level:config.area,biome:config.biome,rewardDifficulty:difficulty,lootSeed:67421,xpReward:difficultyEnemyStats(scaledEnemyStats(kind,config.area,rank),difficulty).xpReward});
    sim.player.level=config.player;sim.player.xp=0;sim.player.derived.goldFindMultiplier=1.37;sim.player.derived.xpGainMultiplier=1.23;
    const events:CombatEvent[]=[];let id=0;
    const context:KillRewardContext={player:sim.player,groundGold:[],groundItems:[],pickups:[],nextId:()=>++id,emit:e=>events.push(e)};
    awardKillRewards(enemy,20,0,context);
    const expected={coins:context.groundGold.reduce((sum,pile)=>sum+pile.amount,0),sales:context.groundItems.reduce((sum,drop)=>sum+itemPrice(drop.item,'sell'),0),xp:events.reduce((sum,e)=>sum+(e.type==='experience'?e.amount:0),0)};
    assert.deepEqual(economyKill(config,kind,rank,67421),expected,`${kind}/${rank}/${difficulty}`);
  }
});

test('income is reproducible, respects mixture weights, separates sales and handles zero income',()=>{
  const base={...DEFAULT_ECONOMY,sell:100},before=structuredClone(base);
  const normal=estimateEconomy(base,128),elite=estimateEconomy({...base,elite:100},128);
  const mixed=estimateEconomy({...base,elite:25},128);
  for(const key of ['coins','sales','xp'] as const)assert.ok(Math.abs(mixed.kill[key]-(normal.kill[key]*.75+elite.kill[key]*.25))<1e-8);
  assert.deepEqual(normal,estimateEconomy(base,128));assert.deepEqual(base,before);
  const noSales=estimateEconomy({...base,sell:0},128);assert.equal(noSales.session.sales,0);assert.equal(noSales.session.coins,normal.session.coins);
  const bonus=estimateEconomy({...base,goldFind:100},128);assert.equal(bonus.session.sales,normal.session.sales);assert.equal(bonus.session.coins,normal.session.coins*2);
  const noCoins=estimateEconomy({...base,collect:0},128);assert.equal(noCoins.session.coins,0);assert.equal(noCoins.session.sales,normal.session.sales);
  const goblins=estimateEconomy({...base,goblins:100},128);assert.ok(goblins.session.coins<normal.session.coins*.4);
  const stopped=estimateEconomy({...base,killsPerMinute:0,activitiesPerHour:0},128);
  assert.deepEqual(stopped.session,{coins:0,sales:0,xp:0});assert.equal(stopped.goldPerLevel,null);assert.equal(stopped.minutesPerLevel,null);
  const doubled=estimateEconomy({...base,killsPerMinute:base.killsPerMinute*2},128);
  assert.equal(doubled.session.coins,normal.session.coins*2);assert.equal(doubled.minutesPerLevel,normal.minutesPerLevel!/2);
  assert.equal(doubled.goldPerLevel,normal.goldPerLevel);
});

test('completion income uses real reward bundles without charging enemy kills a second time',()=>{
  const config={...DEFAULT_ECONOMY,activity:'ruinedChapel' as const,killsPerMinute:0,activitiesPerHour:4,sell:100,goldFind:50,xpBonus:20};
  const seed=113;
  const reward=eventRewards({id:'test',name:'test',x:0,y:0,seed,biome:config.biome,level:config.area,kind:config.activity,difficulty:config.difficulty,phase:'completed',choice:null,delivered:0,wavesCleared:4,bonusGranted:false},config.player);
  assert.deepEqual(economyActivity(config,seed),{coins:Math.round(reward.gold*1.5),sales:reward.items.reduce((sum,item)=>sum+itemPrice(item,'sell'),0),xp:Math.round(reward.xp*xpLevelFactor(config.player,config.area)*1.2)});
  const estimate=estimateEconomy(config,64);assert.equal(estimate.killSamples,0);assert.equal(estimate.activitySamples,64);
  assert.ok(Math.abs(estimate.session.coins-estimate.activity.coins)<1e-8,'four per hour means one completion in fifteen minutes');
  const camp=estimateEconomy({...config,activity:'camp'},64);assert.equal(camp.minutesPerLevel,null);assert.ok(camp.session.coins>0);
});

test('affordability follows actual useful ranks, uses guaranteed costs, and does not mutate the item',()=>{
  const base=generateItem(1,1,'legs',undefined,'common','leather');
  const before=structuredClone(base),rows=enhancementCosts(base,10);
  assert.ok(rows.some(row=>row.to-row.from>1),'fixture exercises free ranks');
  let current=base,cumulative=0;
  for(const row of rows){
    assert.equal(row.to,nextEnhancementLevel(current));assert.equal(row.fee,improvementPrice(current,'enhance',1));
    cumulative+=row.fee;assert.equal(row.cumulative,cumulative);assert.equal(row.minutes,row.fee/10);
    current=deriveItem({...current,recipe:{...current.recipe,starter:false,enhancement:row.to}});
  }
  assert.deepEqual(base,before);assert.equal(enhancementCosts(base,0)[0].minutes,null);
  assert.deepEqual(enhancementCosts(economyItem({...DEFAULT_ECONOMY,rank:10}),10),[]);
  const item=economyItem({...DEFAULT_ECONOMY,itemLevel:10,rank:9});
  const last=enhancementCosts(item,20)[0];assert.equal(last.fee,77504);assert.equal(last.cumulative,last.fee);
});
