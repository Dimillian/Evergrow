import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
import { World } from '../src/world.ts';
import { WILDERNESS_BOSSES, LAIR_RULES, isWildernessBoss } from '../src/wilderness-boss-content.ts';
import { updateWildernessBoss } from '../src/wilderness-boss.ts';
import { completeBossLair } from '../src/wilderness-boss-rewards.ts';
import { claimCompletedEvent, executeEvent, pendingEventReward } from '../src/poi-command.ts';
import { eventInteractionSites, eventSite } from '../src/poi-content.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { validEvents } from '../src/poi-validation.ts';
import { validActors } from '../src/dungeon-validation.ts';
import { enemyWarnings } from '../src/enemy-warning-art.ts';
import { CampPopulation } from '../src/camp-population.ts';
import { LOOT_RULES, ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { generateItem } from '../src/items.ts';
import { rankJourneyCandidates } from '../src/journey-director.ts';
import { freshJourneys } from '../src/journey-state.ts';
import { freshExpeditions } from '../src/dungeon-state.ts';
const flat={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const ok=()=>({ok:true,message:''});
function setup(kind:typeof WILDERNESS_BOSSES[number]='briarMatriarch'){
 const sim=new Simulation(flat,{spawn:false,startX:0,startY:155});
 const boss=sim.spawnEnemy(kind,0,0,'normal',{campId:'site:7319:lair:1:1',memberId:'site:7319:lair:1:1:member:0',lootSeed:456})!;
 const hits:number[]=[];
 const c:EnemyAIContext={world:flat,player:sim.player,enemies:sim.enemies,time:0,trial:null,visible:()=>true,move:(e,vx,vy,dt)=>{e.x+=vx*dt;e.y+=vy*dt;},hurt:n=>hits.push(n),shoot:()=>{},emit:()=>{}};
 return {sim,boss,c,hits};
}
test('lairs are rare, deterministic, clear, spaced and never below level three',()=>{
 const world=new World(7319),sites=world.getWildernessSites(-18000,-18000,36000,36000),lairs=sites.filter(s=>s.kind==='bossLair');
 assert.ok(lairs.length>=3);assert.ok(lairs.length<sites.length*.15);
 assert.equal(new Set(lairs.map(s=>s.members[0].kind)).size,3);
 for(const site of lairs){
  assert.ok(getZoneAt(site.x,site.y,world.seed).level>=3);assert.equal(site.members.length,11);
  assert.ok(isWildernessBoss(site.members[0].kind));assert.equal(site.members.filter(m=>m.rank==='elite').length,2);assert.equal(site.members.filter(m=>m.rank==='veteran').length,8);
  for(const m of site.members)assert.equal(world.blocked(site.x+m.dx,site.y+m.dy,ENEMY_DEFINITIONS[m.kind].radius),false,`${site.id} ${m.id}`);
  for(let y=0;y<site.radius+35;y+=10)assert.equal(world.blocked(site.x,site.y+y,12),false,`${site.id} approach`);
  for(const other of lairs)if(site!==other)assert.ok(Math.hypot(site.x-other.x,site.y-other.y)>=3000);
  assert.deepEqual(world.getWildernessSites(site.x-1,site.y-1,2,2).find(s=>s.id===site.id),site);
  assert.deepEqual(eventInteractionSites([eventSite(site)],{sites:{},trial:null}),[]);
 }
});
test('a camp admits the whole lair offscreen, retains guard casualties, and never resurrects a dead boss',()=>{
 const world=new World(7319),site=world.getWildernessSites(-9000,-9000,18000,18000).find(s=>s.kind==='bossLair')!;
 const sim=new Simulation(world,{spawn:false,startX:site.x,startY:site.y+800}),ledger=new CampPopulation();
 const spawn=(m:typeof site.members[number],x:number,y:number,source:Parameters<Simulation['spawnEnemy']>[4])=>sim.spawnEnemy(m.kind,x,y,m.rank,source);
 ledger.update([site],sim.player,sim.enemies,world,spawn,1200,{x:site.x-500,y:site.y-500,width:1000,height:1000});assert.equal(sim.enemies.length,0);
 ledger.update([site],sim.player,sim.enemies,world,spawn,1200,{x:site.x-100,y:site.y+700,width:200,height:200});assert.equal(sim.enemies.length,11);
 assert.ok(sim.enemies.every(e=>e.level===getZoneAt(site.x,site.y,world.seed).level&&e.hp===e.maxHp));
 sim.enemies[0].hp=0;sim.enemies[0].state='dead';sim.enemies[4].hp=0;sim.enemies[4].state='dead';
 const dead=ledger.defeatedMembers(),restored=new CampPopulation();restored.restoreDefeated(dead);sim.enemies=[];
 restored.update([site],sim.player,sim.enemies,world,spawn,1200,null);
 assert.equal(sim.enemies.length,9);assert.ok(!sim.enemies.some(e=>isWildernessBoss(e.kind)));assert.ok(validActors(sim.captureCheckpoint().actors));
});
test('bosses have distinct locked moves, phase two recovery, and a full-health reset only at home',()=>{
 for(const kind of WILDERNESS_BOSSES){const {sim,boss,c}=setup(kind);sim.player.x=100;sim.player.y=0;
  for(let turn=0;turn<3;turn++){boss.state='chase';boss.stateTime=0;boss.bossTurns=turn;updateWildernessBoss(boss,.01,c);assert.equal(boss.state,'windup');
   const aim=boss.attackAngle,tx=boss.attackTargetX;sim.player.y=60;updateWildernessBoss(boss,.1,c);assert.equal(boss.attackAngle,aim);assert.equal(boss.attackTargetX,tx);
   if(boss.bossMove!=='command')assert.ok(enemyWarnings(boss).every(w=>w.locked));
  }
  boss.hp=boss.maxHp*.4;boss.state='chase';boss.bossTurns=0;updateWildernessBoss(boss,.01,c);assert.equal(boss.bossPhases,1);
  boss.x=100;sim.player.x=2000;updateWildernessBoss(boss,.1,c);assert.equal(boss.state,'return');assert.ok(boss.hp<boss.maxHp);
  boss.x=boss.homeX;boss.y=boss.homeY;updateWildernessBoss(boss,.1,c);assert.equal(boss.hp,boss.maxHp);assert.equal(boss.bossPhases,0);
 }
});
test('committed strikes can be dodged and cannot hit repeatedly during their active window',()=>{
 const {sim,boss,c,hits}=setup();boss.state='chase';sim.player.x=80;sim.player.y=0;updateWildernessBoss(boss,.01,c);
 boss.stateTime=boss.stateDuration;updateWildernessBoss(boss,.01,c);assert.equal(hits.length,1);
 for(let i=0;i<10;i++)updateWildernessBoss(boss,.01,c);assert.equal(hits.length,1);
 boss.state='chase';boss.bossTurns=0;updateWildernessBoss(boss,.01,c);sim.player.x=-100;boss.stateTime=boss.stateDuration;updateWildernessBoss(boss,.01,c);assert.equal(hits.length,1);
});
test('Marshal rally affects only living retinue and cannot summon or resurrect guards',()=>{
 const {sim,boss,c}=setup('graveMarshal');const guard=sim.spawnEnemy('archer',80,20,'elite',{campId:boss.campId!,memberId:'1',lootSeed:3})!;
 const dead=sim.spawnEnemy('stalker',80,0)!;dead.state='dead';dead.hp=0;
 boss.state='chase';boss.bossTurns=2;updateWildernessBoss(boss,.01,c);boss.stateTime=boss.stateDuration;updateWildernessBoss(boss,.01,c);
 assert.equal(guard.rallyTime,LAIR_RULES.rallyDuration);assert.equal(dead.hp,0);assert.equal(sim.enemies.length,3);
});
test('boss hoards guarantee a rare, use stable rolls, and require no E interaction',async()=>{
 const {sim,boss}=setup();completeBossLair(boss,sim.eventState);const record=sim.eventState.sites[boss.campId!]!;
 assert.ok(validEvents(sim.eventState));assert.equal(eventRewards(record).items.length,3);assert.ok(['rare','epic','legendary'].includes(eventRewards(record).items[0].tier));
 assert.ok(!(await executeEvent(sim,record,null,ok)).ok);assert.ok(pendingEventReward(sim,record));
 const before=sim.captureCheckpoint();assert.ok(!(await claimCompletedEvent(sim,record.id,()=>({ok:false,message:'offline'}))).ok);assert.deepEqual(sim.captureCheckpoint(),before);
 assert.ok((await claimCompletedEvent(sim,record.id,ok)).ok);assert.equal(sim.groundItems.length,3);assert.equal(sim.groundGold.length,1);assert.ok(validEvents(sim.eventState));
 completeBossLair(boss,sim.eventState);assert.ok(!(await claimCompletedEvent(sim,record.id,ok)).ok);assert.equal(sim.groundItems.length,3);
});
test('full ground delivers the entire boss hoard atomically and reload never duplicates it',async()=>{
 const {sim,boss}=setup();completeBossLair(boss,sim.eventState);const id=boss.campId!;
 sim.groundItems=Array.from({length:LOOT_RULES.maxGroundItems},(_,i)=>({id:i+100,item:generateItem(77000+i,1),x:0,y:0}));
 const before=sim.captureCheckpoint();
 assert.equal((await claimCompletedEvent(sim,id,()=>({ok:false,message:'offline'}))).ok,false);
 assert.deepEqual(sim.captureCheckpoint(),before,'failed save cannot evict old items or pay the reward');
 assert.ok((await claimCompletedEvent(sim,id,ok)).ok);
 assert.equal(sim.groundItems.length,LOOT_RULES.maxGroundItems);
 assert.equal(sim.groundItems[0].id,103);
 assert.equal(sim.groundItems.filter(i=>i.item.id.startsWith('poi:')).length,3);
 const checkpoint=sim.captureCheckpoint(),restored=new Simulation(flat,{spawn:false});restored.restoreCheckpoint(checkpoint);
 const xp=restored.player.xp;
 assert.ok(!(await claimCompletedEvent(restored,id,ok)).ok);
 assert.deepEqual(restored.groundItems,sim.groundItems);assert.equal(restored.player.xp,xp);
 assert.equal(restored.groundGold.length,1);assert.ok(validEvents(restored.eventState));
});
test('boss corpses do not add generic equipment or gold on top of the hoard',()=>{
 const {sim,boss}=setup();awardKillRewards(boss,0,0,{player:sim.player,groundGold:sim.groundGold,groundItems:sim.groundItems,pickups:sim.pickups,nextId:()=>99,emit:()=>{}});
 assert.equal(sim.groundGold.length,0);assert.equal(sim.groundItems.length,0);
});
test('previously gold-only boss hoards automatically release their pending equipment',async()=>{
 const {sim,boss}=setup();completeBossLair(boss,sim.eventState);const id=boss.campId!;
 const record=sim.eventState.sites[id];record.delivered=8;record.bonusGranted=true;
 sim.groundItems=Array.from({length:LOOT_RULES.maxGroundItems},(_,i)=>({id:i+100,item:generateItem(88000+i,1),x:0,y:0}));
 assert.ok(pendingEventReward(sim,record));
 assert.ok((await claimCompletedEvent(sim,id,ok)).ok);
 assert.equal(sim.groundItems.filter(i=>i.item.id.startsWith('poi:')).length,3);
 assert.equal(sim.groundGold.length,0,'already delivered gold never repeats');
 assert.equal((await claimCompletedEvent(sim,id,ok)).ok,false);
});
test('nearby lairs stay pinnable but are not recommended to an underprepared character',()=>{
 const goal={id:'site:lair',name:'Briar Matriarch',kind:'bossLair' as const,x:0,y:0,level:3,region:'Test'};
 const facts={events:{sites:{},trial:null},expeditions:freshExpeditions(),x:0,y:0,level:3,time:0,discovered:()=>true,campCleared:()=>false};
 assert.equal(rankJourneyCandidates([goal],freshJourneys(),facts,7319).length,0);
 assert.equal(rankJourneyCandidates([goal],freshJourneys(),{...facts,level:5},7319).length,1);
});
