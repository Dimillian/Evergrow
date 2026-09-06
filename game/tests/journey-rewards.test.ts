import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { executeEvent } from '../src/poi-command.ts';
import { stageJourneyCompletion, journeyXP } from '../src/journey-rewards.ts';
import { RewardFeedback } from '../src/reward-feedback.ts';
import { xpLevelFactor, xpForNextLevel } from '../src/progression.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
const sim=()=>new Simulation({seed:7319,blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false});
const site={id:'site:7319:caravan-test',kind:'caravan' as const,name:'Lost Caravan',x:0,y:30,seed:18,biome:'deadwood' as const,level:1};
test('unlisted POIs complete atomically with XP, reject failed writes and do not replay after reload',async()=>{
  const s=sim();s.player.xp=95;s.player.hp=31;s.player.mana=12;const before=s.captureCheckpoint();
  assert.equal((await executeEvent(s,site,'coin',()=>({ok:false,message:'Disk full'}))).ok,false);
  assert.deepEqual(s.captureCheckpoint(),before);assert.equal(s.drainEvents().length,0);
  let saved=before;assert.ok((await executeEvent(s,site,'coin',cp=>{saved=cp;return{ok:true,message:''};})).ok);
  assert.equal(saved.level,2);assert.equal(saved.xp,5);assert.equal(s.player.character.skillPoints,1);assert.equal(s.player.character.statPoints,5);
  assert.equal(s.player.hp,31);assert.equal(s.player.mana,12);assert.ok(saved.journeys?.completed?.includes(site.id));
  const events=s.drainEvents();assert.equal(events.filter(e=>e.type==='journey').length,1);assert.equal(events.filter(e=>e.type==='level').length,1);
  assert.ok(decodeCharacterSave(JSON.stringify({version:CHARACTER_SAVE_VERSION,id:'reward-test',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:5,checkpoint:saved})));
  const r=sim();r.restoreCheckpoint(saved);assert.equal((await executeEvent(r,site,'coin',()=>({ok:true,message:''}))).ok,false);assert.equal(r.player.xp,5);
});
test('partial loot delivery cannot award completion XP before all rewards fit',async()=>{
  const s=sim();s.groundGold=Array.from({length:64},(_,i)=>({id:i+500,x:400,y:400,amount:1,age:0}));
  const {GOLD_RULES}=await import('../src/gold.ts');s.groundGold=s.groundGold.slice(0,GOLD_RULES.maxPiles);
  while(s.groundGold.length<GOLD_RULES.maxPiles)s.groundGold.push({id:1000+s.groundGold.length,x:400,y:400,amount:1,age:0});
  const ok=()=>({ok:true,message:''});await executeEvent(s,site,'coin',ok);assert.equal(s.player.xp,0);assert.equal(s.journeys.completed?.length,0);
  s.groundGold=[];await executeEvent(s,site,'coin',ok);assert.equal(s.player.xp,10);assert.ok(s.journeys.completed?.includes(site.id));
});
test('source level and pre-award level set the bonus, independent of current XP bar',()=>{
  assert.equal(journeyXP('dungeon',1,1),60);assert.equal(journeyXP('camp',1,1),30);
  assert.equal(journeyXP('camp',25,50),Math.max(1,Math.round(scaledEnemyStats('stalker',25,'normal').xpReward*1.5*xpLevelFactor(50,25))));
  const s=sim();s.player.xp=xpForNextLevel(1)-1;const cp=s.captureCheckpoint();
  const receipt=stageJourneyCompletion(cp,{...site,region:'Deadwood'},s.player,0);assert.equal(receipt?.xp,10);assert.equal(cp.level,2);
  assert.equal(s.player.level,1);assert.equal(stageJourneyCompletion(cp,{...site,region:'Deadwood'},s.player,0),null);
  const full=s.captureCheckpoint();full.journeys!.completed=Array.from({length:4096},(_,i)=>`done:${i}`);
  assert.ok(stageJourneyCompletion(full,{...site,region:'Deadwood'},s.player,0));assert.equal(full.journeys!.completed!.length,4097);
  assert.equal(stageJourneyCompletion(full,{...site,region:'Deadwood'},s.player,0),null);
});
test('completion celebration waits for level-up, stays bounded and reset never replays it',()=>{
  const f=new RewardFeedback();f.handleEvents([{type:'journey',id:'a',name:'Ashen Watch',xp:30,x:0,y:0},{type:'level',level:2,skillPoints:1,statPoints:5,x:0,y:0}],false);
  f.update(0,1,false);assert.equal(f.journey,null);assert.ok(f.level);
  f.update(0,1.5,false);assert.equal(f.level,null);assert.deepEqual(f.journey,{id:'a',name:'Ashen Watch',xp:30,age:0});
  f.update(0,3.1,true);assert.equal(f.journey,null);f.reset();f.update(0,1,false);assert.equal(f.journey,null);
});
