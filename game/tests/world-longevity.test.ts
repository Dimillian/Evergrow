import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonRun, compactExpeditions, freshExpeditions } from '../src/dungeon-state.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { planDungeonTravel } from '../src/dungeon-command.ts';
import { Simulation } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { compactEvents, eventClaimed, freshEvents, eventLabel } from '../src/poi-content.ts';
import { validEvents } from '../src/poi-validation.ts';
import { executeEvent } from '../src/poi-command.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { journeyAvailable, journeyComplete, type JourneyFacts } from '../src/journey-director.ts';
import type { JourneyGoal } from '../src/journey-state.ts';

const entrance = { id: 'dungeon:test', name: 'Rootbound Crypt', seed: 7319, level: 4, biome: 'deadwood' as const, x: 600, y: 0 };
const world = { seed: 7319, blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({ x:x+dx,y:y+dy }) };
const ok = () => ({ ok: true, message: '' });
const exhausted = (id: string) => {
  const run = createDungeonRun({ ...entrance, id });
  for (const member of Object.values(run.states)) { member.hp = 0; member.admitted = true; }
  run.chestMasks = [9,9,15]; return run;
};
test('exhausted expeditions become exact receipts; a ninth new crypt works and retired rewards cannot regenerate', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 600 });
  for (let i=0;i<20;i++) sim.expeditions.runs.push(exhausted(`dungeon:${i}`));
  const result = await planDungeonTravel(sim, { kind:'enter',entrance }, world, ok);
  assert.ok(result.ok); assert.equal(result.checkpoint.expeditions!.runs.length,1);
  assert.equal(result.checkpoint.expeditions!.cleared!.length,20);
  assert.ok(validExpeditions(result.checkpoint.expeditions));
  assert.equal(sim.expeditions.runs.length,20,'planning does not mutate live history');
  compactExpeditions(sim.expeditions);
  assert.equal((await planDungeonTravel(sim,{kind:'enter',entrance:{...entrance,id:'dungeon:0'}},world,ok)).ok,false);
  const facts:JourneyFacts={events:freshEvents(),expeditions:sim.expeditions,x:0,y:0,level:4,time:0,discovered:()=>true,campCleared:()=>false};
  const goal:JourneyGoal={...entrance,id:'dungeon:0',kind:'dungeon',region:'Deadwood'};
  assert.ok(journeyComplete(goal,facts)); assert.equal(journeyAvailable(goal,facts),false);
});
test('retirement protects every remaining reward, living member, partial chest and return link', () => {
  const state = freshExpeditions();
  for(const id of ['item','gold','pickup','member','actor','chest','return','active','empty']) state.runs.push(exhausted(`dungeon:${id}`));
  const run = (name:string) => state.runs.find(r=>r.entrance.id===`dungeon:${name}`)!;
  run('item').contents.groundItems.push({id:1,x:0,y:0,item:generateItem(17,4,'ring')});
  run('gold').contents.groundGold.push({id:2,x:0,y:0,amount:42,age:0});
  run('pickup').contents.pickups.push({id:3,x:0,y:0,kind:'mana',life:10,radius:5,restoreFraction:.2});
  run('member').states.warden.hp=1;
  run('actor').contents.actors.push({kind:'stalker',rank:'normal',level:4,biome:'deadwood',seed:1,x:0,y:0,homeX:0,homeY:0,hp:1});
  run('chest').chestMasks[0]=1; state.location='dungeon:active';
  compactExpeditions(state,'dungeon:return');
  assert.deepEqual(state.cleared,['dungeon:empty']); assert.equal(state.runs.length,8);
  const malformed=structuredClone(state);malformed.cleared!.push('dungeon:item');assert.equal(validExpeditions(malformed),false);
});
test('hundreds of POI claims compact without losing opened art, beacons, partial rewards or exactly-once XP',async()=>{
  const sim = new Simulation(world,{spawn:false}); const state=sim.eventState;
  for(let i=0;i<350;i++){
    const id=`site:7319:caravan:${i}`;
    state.sites[id]={id,kind:'caravan',name:'Caravan',x:0,y:0,seed:18,biome:'deadwood',level:1,phase:'claimed',choice:'coin',delivered:4,bonusGranted:true};
  }
  const old=state.sites['site:7319:caravan:0'];
  state.sites['site:beacon']={...old,id:'site:beacon',kind:'watchtower',choice:null,delivered:0};
  state.sites['site:pending']={...old,id:'site:pending',phase:'completed',delivered:0,bonusGranted:false};
  compactEvents(state);
  assert.equal(state.claimed!.length,318);assert.equal(Object.keys(state.sites).length,34);
  assert.ok(validEvents(state)); assert.ok(eventClaimed(state,old.id)); assert.equal(eventLabel(old,state,false),'Claimed');
  assert.equal((await executeEvent(sim,old,'coin',ok)).ok,false);assert.equal(sim.player.xp,0);
  assert.ok(state.sites['site:beacon']);assert.ok(state.sites['site:pending']);
});
test('large exact histories survive save validation and reloading beyond former camp and journey quotas',()=>{
  const sim=new Simulation(world,{spawn:false}), checkpoint=sim.captureCheckpoint();
  checkpoint.clearedCamps=Array.from({length:4096},(_,i)=>`site:camp:${i}`);
  checkpoint.journeys!.completed=Array.from({length:8192},(_,i)=>`site:done:${i}`);
  checkpoint.expeditions!.cleared=Array.from({length:1000},(_,i)=>`dungeon:${i}`);
  const record={version:CHARACTER_SAVE_VERSION,id:'long-run',name:'Test',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:5,checkpoint};
  const decoded=decodeCharacterSave(JSON.stringify(record));assert.ok(decoded);
  sim.restoreCheckpoint(decoded.checkpoint);assert.equal(sim.getCampState('site:camp:0'),'cleared');
  assert.equal(sim.journeys.completed!.length,8192);assert.equal(sim.expeditions.cleared!.length,1000);
});
