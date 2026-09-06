import test from 'node:test';
import assert from 'node:assert/strict';
import { freshJourneys, planJourney, validJourneys, miniJourneys, type JourneyGoal } from '../src/journey-state.ts';
import { journeyComplete, journeyObjective, reconcileJourneys, journeyNeedsRefresh, eligibleJourney, rankJourneyCandidates, JourneySearch, type JourneyFacts } from '../src/journey-director.ts';
import { executeJourneyCommand } from '../src/journey-command.ts';
import { publicJourneyMarker } from '../src/journey-marker.ts';
import { freshEvents } from '../src/poi-content.ts';
import { freshExpeditions, createDungeonRun } from '../src/dungeon-state.ts';
import { Simulation } from '../src/simulation.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { World } from '../src/world.ts';
const goal=(id='camp:1',kind:JourneyGoal['kind']='camp',level=1):JourneyGoal=>({id,kind,name:'Test activity',x:700,y:300,level,region:'Briarwatch'});
const facts=():JourneyFacts=>({events:freshEvents(),expeditions:freshExpeditions(),x:0,y:0,level:1,time:0,discovered:()=>false,campCleared:()=>false});
const simulation=()=>new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false});
test('tracking, dismissal and collapse are bounded plans without mutating the prior state',()=>{
  let state=freshJourneys();state.offers=[goal('a'),goal('b'),goal('c'),goal('d')];const before=JSON.stringify(state);
  const first=planJourney(state,{type:'track',id:'a'})!;assert.equal(JSON.stringify(state),before);assert.equal(first.tracked,'a');assert.equal(first.accepted.length,1);
  state=planJourney(first,{type:'track',id:'b'})!;state=planJourney(state,{type:'track',id:'c'})!;
  assert.equal(planJourney(state,{type:'track',id:'d'}),null);assert.ok(validJourneys(state));assert.ok(miniJourneys(state).length<=3);
  state=planJourney(state,{type:'untrack',id:'c'})!;assert.equal(state.accepted.length,3);assert.equal(state.tracked,null);
  state=planJourney(state,{type:'dismiss',id:'b'})!;assert.ok(state.dismissed.includes('b'));assert.ok(!state.accepted.some(g=>g.id==='b'));
  state=planJourney(state,{type:'collapse',value:true})!;assert.equal(state.collapsed,true);assert.ok(validJourneys(state));
});
test('failed persistence leaves accepted goals, progression and resources untouched',async ()=>{
  const sim=simulation();sim.journeys.offers=[goal()];const before=sim.captureCheckpoint();
  const result=await executeJourneyCommand(sim,{type:'track',id:'camp:1'},()=>({ok:false,message:'Storage full'}),facts());
  assert.equal(result.ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
  assert.ok((await executeJourneyCommand(sim,{type:'track',id:'camp:1'},c=>({ok:!!c.journeys?.tracked,message:''}),facts())).ok);
  assert.equal(sim.journeys.tracked,'camp:1');assert.deepEqual(sim.player.character,before.character);
});
test('completion uses claimed site and final chest ledgers, never missing actors or a boss kill alone',()=>{
  const f=facts(),g=goal();f.campCleared=()=>true;assert.equal(journeyObjective(g,f),'Open the strongbox');assert.equal(journeyComplete(g,f),false);
  f.events.sites[g.id]={...g,kind:'camp',seed:1,biome:'deadwood',phase:'completed',choice:null,delivered:0,bonusGranted:false};assert.equal(journeyComplete(g,f),false);
  f.events.sites[g.id].phase='claimed';assert.equal(journeyComplete(g,f),true);
  let state=freshJourneys();state.accepted=[g];state.tracked=g.id;f.time=4;
  state=reconcileJourneys(state,f,false);assert.equal(state.tracked,null);assert.equal(state.accepted[0].finishedAt,4);
  f.time=7;state=reconcileJourneys(state,f,true);assert.equal(state.history.length,1);assert.equal(state.accepted.length,0);
  assert.deepEqual(reconcileJourneys(state,f,true),state);assert.equal(eligibleJourney(g,state,f),false);
  const entrance={id:'crypt:test',name:'Crypt',x:0,y:0,seed:7319,level:2,biome:'deadwood' as const};
  const run=createDungeonRun(entrance);f.expeditions.runs=[run];const crypt=goal(entrance.id,'dungeon',2);
  run.states.warden.hp=0;assert.equal(journeyComplete(crypt,f),false);run.chestMasks[2]=15;assert.equal(journeyComplete(crypt,f),true);
});
test('combat leveling changes candidate fit without altering pinned targets or source levels',()=>{
  const f=facts();f.level=7;const state=freshJourneys();state.accepted=[goal('old','camp',1)];state.tracked='old';
  const candidates=[goal('low','camp',1),goal('matched','camp',7),goal('too-hard','dungeon',12)];
  const before=JSON.stringify(state);const ranked=rankJourneyCandidates(candidates,state,f,7319);
  assert.equal(ranked[0].id,'matched');assert.ok(!ranked.some(g=>g.id==='too-hard'));assert.equal(JSON.stringify(state),before);assert.equal(state.accepted[0].level,1);
});
test('unknown markers expose a coarse search cell, while known markers use actual positions',()=>{
  const g=goal();const rumor=publicJourneyMarker(g,false);assert.notEqual(rumor.x,g.x);assert.notEqual(rumor.y,g.y);assert.equal(rumor.name,'Search area');
  assert.deepEqual(publicJourneyMarker(g,true),{x:g.x,y:g.y,known:true,name:g.name});
});
test('guidance roundtrips with character saves and malformed or duplicate goals are rejected',()=>{
  const sim=simulation();sim.journeys.accepted=[goal()];sim.journeys.tracked='camp:1';sim.journeys.collapsed=true;
  const save={version:CHARACTER_SAVE_VERSION,id:'quest-test',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:5,checkpoint:sim.captureCheckpoint()};
  const decoded=decodeCharacterSave(JSON.stringify(save));assert.ok(decoded);const restored=simulation();restored.restoreCheckpoint(decoded.checkpoint);assert.deepEqual(restored.journeys,sim.journeys);
  save.checkpoint.journeys!.offers=[goal()];assert.equal(decodeCharacterSave(JSON.stringify(save)),null);
  const bad=freshJourneys();bad.accepted=[{...goal(),x:Infinity}];assert.equal(validJourneys(bad),false);
  bad.accepted=[goal()];bad.tracked='missing';assert.equal(validJourneys(bad),false);
});
test('real seeded search completes within nine bounded world queries without changing simulation',()=>{
  for(const seed of [7319,18427]){
    const world=new World(seed),f=facts(),s=freshJourneys();let calls=0;
    const query={seed,getPOIs:(x:number,y:number,w:number,h:number)=>{calls++;assert.ok(w<=2400&&h<=2400);return world.getPOIs(x,y,w,h);},getDungeonEntrances:world.getDungeonEntrances.bind(world),blocked:world.blocked.bind(world)};
    const search=new JourneySearch(query,f,[]);let done=false;for(let i=0;i<9&&!done;i++)done=search.step();assert.ok(done);assert.ok(calls<=9);
    const result=search.result(s,f).offers;assert.ok(result.length>0);assert.ok(result.length<=12);assert.ok(result.every(g=>g.level>=1));
    world.dispose();
  }
});

test('zone entry and travel refresh guidance after a quiet debounce without replacing pinned goals',()=>{
  const s=freshJourneys(),f=facts();s.offers=[goal()];s.recommended=s.offers[0].id;s.refreshedAt=0;s.x=f.x;s.y=f.y;s.areaId='old';
  f.time=6;f.areaId='new';assert.equal(journeyNeedsRefresh(s,f),false);
  f.time=9;assert.equal(journeyNeedsRefresh(s,f),true);
  f.areaId='old';f.level=1;f.time=100;assert.equal(journeyNeedsRefresh(s,f),false);
  f.x+=800;assert.equal(journeyNeedsRefresh(s,f),true);
  s.suggestions=false;assert.equal(journeyNeedsRefresh(s,f),true); // hiding HUD hints doesn't freeze the catalogue
});
test('stale offers cannot accept an unavailable expedition or spend a save transaction',async ()=>{
  const sim=simulation(),f=facts(),g=goal('crypt:new','dungeon');sim.journeys.offers=[g];
  f.expeditions.runs=[createDungeonRun({id:'crypt:active',name:'Crypt',x:0,y:0,seed:7319,level:2,biome:'deadwood'})];
  let writes=0;const result=await executeJourneyCommand(sim,{type:'track',id:g.id},()=>{writes++;return{ok:true,message:''};},f);
  assert.equal(result.ok,false);assert.equal(writes,0);assert.equal(sim.journeys.accepted.length,0);
});

test('natural completion awards XP without tracking and keeps its receipt beyond journal history',()=>{
  const sim=simulation();sim.player.hp=37;sim.player.mana=18;
  const town={...goal('town:arrival','town',1),x:sim.player.x,y:sim.player.y};
  assert.ok(sim.completeJourneyArrival(town));assert.equal(sim.player.xp,10);assert.equal(sim.player.hp,37);assert.equal(sim.player.mana,18);
  assert.equal(sim.journeys.tracked,null);assert.equal(sim.journeys.history[0].rewardXP,10);
  sim.journeys.history=[];const checkpoint=sim.captureCheckpoint(),restored=simulation();restored.restoreCheckpoint(checkpoint);
  assert.equal(restored.completeJourneyArrival(town),false);assert.equal(restored.player.xp,10);
  assert.equal(sim.drainEvents().filter(e=>e.type==='journey').length,1);
});
test('arrival cannot complete remotely or project surface coordinates into a dungeon',()=>{
  const sim=simulation(),g={...goal('town:far','town'),x:5000,y:0};
  assert.equal(sim.completeJourneyArrival(g),false);
  sim.expeditions.location='crypt:test';g.x=sim.player.x;g.y=sim.player.y;
  assert.equal(sim.completeJourneyArrival(g),false);assert.equal(sim.player.xp,0);
});

test('nearby includes hard content while a suitable current area favors a close recommendation',()=>{
  const f=facts();f.level=5;f.areaLevel=5;f.areaId='local';f.x=0;f.y=0;
  const local={...goal('local','camp',4),x:700,y:0};
  const distant={...goal('distant','camp',5),x:4000,y:0};
  const hard={...goal('hard','camp',12),x:350,y:0};
  const ranked=rankJourneyCandidates([distant,hard,local],freshJourneys(),f,7319);
  assert.equal(ranked[0].id,'local');assert.ok(!ranked.some(g=>g.id==='hard'));
});
test('nearby and recommendation projections stay distinct and label all level bands',async()=>{
  const {nearbyJourneys,recommendedJourney,journeyLevelFit}=await import('../src/journey-state.ts');
  const s=freshJourneys();s.offers=[{...goal('best','camp',5),x:1000,y:0},{...goal('hard','dungeon',12),x:200,y:0},{...goal('old','camp',1),x:300,y:0}];s.recommended='best';
  assert.equal(recommendedJourney(s)?.id,'best');assert.equal(nearbyJourneys(s,{x:0,y:0})[0].id,'hard');
  assert.equal(journeyLevelFit(12,5),'Harder');assert.equal(journeyLevelFit(1,5),'Easier');assert.equal(journeyLevelFit(4,5),'Good level');
  s.accepted=[goal('pinned','camp',1)];s.tracked='pinned';assert.equal(miniJourneys(s,{x:0,y:0})[0].id,'pinned');
});
