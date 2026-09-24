import test from 'node:test';
import assert from 'node:assert/strict';
import { pinnedJourney, freshJourneys, planJourney, validJourneys, miniJourneys, journalJourneys, type JourneyGoal } from '../src/journey-state.ts';
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
test('accepting, pinning and dismissing are independent without an acceptance cap',()=>{
  let state=freshJourneys();state.offers=Array.from({length:40},(_,i)=>goal(`quest:${i}`));const before=JSON.stringify(state);
  const first=planJourney(state,{type:'track',id:'quest:0'})!;
  assert.equal(JSON.stringify(state),before);assert.equal(first.tracked,'quest:0');assert.equal(first.accepted.length,0);
  state=planJourney(first,{type:'acceptAll',ids:first.offers.map(g=>g.id)})!;
  assert.equal(state.accepted.length,40);assert.equal(state.offers.length,0);assert.ok(validJourneys(state));
  state=planJourney(state,{type:'untrack',id:'quest:0'})!;assert.equal(state.accepted.length,40);
  state=planJourney(state,{type:'dismiss',id:'quest:1'})!;
  assert.equal(state.accepted.length,39);assert.equal(state.offers[0].id,'quest:1');
  state=planJourney(state,{type:'accept',id:'quest:1'})!;assert.equal(state.accepted.length,40);assert.equal(state.tracked,null);
  state=planJourney(state,{type:'collapse',value:true})!;assert.equal(state.collapsed,true);assert.ok(validJourneys(state));
  assert.ok(miniJourneys(state).length<=3,'only the HUD projection is short');
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
  f.events.sites[g.id]={...g,kind:'camp',seed:1,biome:'deadwood',phase:'completed',choice:null,wavesCleared: 0, delivered:0,bonusGranted:false};assert.equal(journeyComplete(g,f),false);
  f.events.sites[g.id].phase='claimed';assert.equal(journeyComplete(g,f),true);
  let state=freshJourneys();state.accepted=[g];state.tracked=g.id;f.time=4;
  state=reconcileJourneys(state,f,false);assert.equal(state.tracked,null);assert.equal(state.accepted[0].finishedAt,4);
  f.time=7;state=reconcileJourneys(state,f,true);assert.equal(state.history.length,1);assert.equal(state.accepted.length,0);
  assert.deepEqual(reconcileJourneys(state,f,true),state);assert.equal(eligibleJourney(g,state,f),false);
  const entrance={id:'crypt:test',name:'Crypt',x:0,y:0,seed:7319,level:2,biome:'deadwood' as const};
  const run=createDungeonRun(entrance);f.expeditions.runs=[run];const crypt=goal(entrance.id,'dungeon',2);
  run.states.warden.hp=0;assert.equal(journeyComplete(crypt,f),false);run.chestMasks[2]=15;assert.equal(journeyComplete(crypt,f),true);
});
test('wilderness boss guidance reports the durable hoard delivery state',()=>{
  const f=facts(),lair=goal('site:lair','bossLair',8);
  assert.equal(journeyObjective(lair,f),'Defeat the boss');
  f.events.sites[lair.id]={...lair,kind:'bossLair',seed:7319,biome:'deadwood',phase:'completed',choice:null,wavesCleared:0,delivered:7,bonusGranted:true};
  assert.equal(journeyObjective(lair,f),'Boss defeated — hoard delivery pending');
  assert.equal(journeyComplete(lair,f),false);
  f.events.sites[lair.id].delivered=15;f.events.sites[lair.id].phase='claimed';
  assert.equal(journeyObjective(lair,f),'Completed');
  assert.equal(journeyComplete(lair,f),true);
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
    const result=search.result(s,f).offers;assert.ok(result.length>0);assert.equal(new Set(result.map(g=>g.id)).size,result.length);assert.ok(result.every(g=>g.level>=1));
    world.dispose();
  }
});

test('zone entry and travel refresh guidance after a quiet debounce without replacing pinned goals',()=>{
  const s=freshJourneys(),f=facts();s.offers=[goal()];s.recommended=s.offers[0].id;s.refreshedAt=0;s.x=f.x;s.y=f.y;s.areaId='old';
  f.time=6;f.areaId='new';assert.equal(journeyNeedsRefresh(s,f),false);
  f.time=9;assert.equal(journeyNeedsRefresh(s,f),true);
  f.areaId='old';f.level=1;f.time=100;assert.equal(journeyNeedsRefresh(s,f),false);
  f.x+=800;assert.equal(journeyNeedsRefresh(s,f),true);
});
test('other active expeditions do not prevent accepting and pinning future work',async ()=>{
  const sim=simulation(),f=facts(),g=goal('crypt:new','dungeon');sim.journeys.offers=[g];
  f.expeditions.runs=[createDungeonRun({id:'crypt:active',name:'Crypt',x:0,y:0,seed:7319,level:2,biome:'deadwood'})];
  let writes=0;const persist=()=>{writes++;return{ok:true,message:''};};
  assert.ok((await executeJourneyCommand(sim,{type:'accept',id:g.id},persist,f)).ok);
  assert.ok((await executeJourneyCommand(sim,{type:'track',id:g.id},persist,f)).ok);
  assert.equal(writes,2);assert.equal(sim.journeys.accepted.length,1);assert.equal(sim.journeys.tracked,g.id);
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
  const {recommendedJourney,journeyLevelFit}=await import('../src/journey-state.ts');
  const s=freshJourneys();s.offers=[{...goal('best','camp',5),x:1000,y:0},{...goal('hard','dungeon',12),x:200,y:0},{...goal('old','camp',1),x:300,y:0}];s.recommended='best';
  assert.equal(recommendedJourney(s)?.id,'best');assert.equal(journalJourneys(s,{x:0,y:0}).nearby[0].id,'hard');
  assert.equal(journeyLevelFit(12,5),'Harder');assert.equal(journeyLevelFit(1,5),'Easier');assert.equal(journeyLevelFit(4,5),'Good level');
  s.accepted=[goal('pinned','camp',1)];s.tracked='pinned';assert.equal(miniJourneys(s)[0].id,'pinned');
});

test('HUD shows only accepted work and stays empty without unfinished accepted quests',()=>{
  let state=freshJourneys();const recommended=goal('recommended'),nearby=goal('nearby');
  state.offers=[recommended,nearby];state.recommended=recommended.id;state.tracked=nearby.id;
  const ids=()=>miniJourneys(state).map(g=>g.id);
  assert.deepEqual(ids(),[],'recommendations and unaccepted pins do not populate an empty checklist');
  state.accepted=[goal('accepted')];
  assert.deepEqual(ids(),['accepted'],'one accepted quest is not padded with suggestions or unrelated pins');
  state.townPin=goal('town','town');state.tracked=null;
  assert.deepEqual(ids(),['accepted'],'town navigation stays separate from the accepted checklist');
  delete state.townPin;
  state.accepted.push(goal('second'),goal('third'),goal('fourth'));state.tracked='fourth';
  assert.deepEqual(ids(),['fourth','accepted','second'],'the pinned accepted quest stays visible within the compact HUD');
  state.accepted=state.accepted.map(g=>({...g,finishedAt:1}));state.tracked=null;
  assert.deepEqual(ids(),[],'completed accepted records leave the checklist empty');
  state.accepted=[goal('accepted')];
  state=planJourney(state,{type:'dismiss',id:'accepted'})!;
  assert.deepEqual(ids(),[],'dismissing the final accepted quest leaves the checklist empty');
  state.recommended=null;assert.deepEqual(ids(),[],'unranked nearby activities are not recommendations');
});


test('navigation only follows an explicit pin, never accepted work or recommendations',()=>{
  let state=freshJourneys();const road=goal('frontier:next','frontier'),camp=goal('next-camp');
  state.offers=[road,camp];state.recommended=road.id;
  assert.equal(pinnedJourney(state),undefined);assert.equal(state.tracked,null);assert.equal(state.accepted.length,0);
  state.recommended=camp.id;assert.equal(pinnedJourney(state),undefined);
  state=planJourney(state,{type:'accept',id:camp.id})!;
  assert.equal(pinnedJourney(state),undefined,'accepting a quest does not start navigation');
  state=planJourney(state,{type:'track',id:road.id})!;
  assert.equal(pinnedJourney(state)?.id,road.id);
  state=planJourney(state,{type:'untrack',id:road.id})!;
  assert.equal(pinnedJourney(state),undefined,'unpinning does not navigate to the first accepted quest');
  state=planJourney(state,{type:'track',id:road.id})!;
  assert.equal(pinnedJourney(state)?.id,road.id);assert.ok(validJourneys(state));
});
test('finishing a pinned road lead clears navigation and arrival rewards stay exactly once',()=>{
  const sim=simulation(),road={...goal('frontier:arrival','frontier'),x:sim.player.x,y:sim.player.y},next=goal('next-camp');
  sim.journeys.accepted=[road];sim.journeys.tracked=road.id;sim.journeys.offers=[next];sim.journeys.recommended=next.id;
  assert.ok(sim.completeJourneyArrival(road));assert.equal(pinnedJourney(sim.journeys),undefined);
  const checkpoint=sim.captureCheckpoint(),restored=simulation();restored.restoreCheckpoint(checkpoint);
  assert.equal(pinnedJourney(restored.journeys),undefined);
  assert.equal(restored.completeJourneyArrival(road),false);assert.equal(restored.player.xp,sim.player.xp);
  assert.ok(validJourneys(restored.journeys));
});
test('completed recommendations refresh after a short beat, then old receipts cannot retrigger searches',()=>{
  const s=freshJourneys(),f=facts();s.refreshedAt=10;s.level=f.level;s.x=f.x;s.y=f.y;
  s.offers=[{...goal('frontier:done','frontier'),finishedAt:11}];s.recommended=null;
  f.time=12;assert.equal(journeyNeedsRefresh(s,f),false);
  f.time=13;assert.equal(journeyNeedsRefresh(s,f),true);
  assert.equal(pinnedJourney(s),undefined);
  s.history=s.offers;s.offers=[goal('next')];s.recommended='next';s.refreshedAt=13;
  f.time=30;assert.equal(journeyNeedsRefresh(s,f),false);
});


test('nearest city remains pinnable after completion without changing accepted work',async()=>{
  const sim=simulation(),f=facts(),city=goal('town:nearest','town');
  sim.journeys.nearestTown=city;sim.journeys.completed=[city.id];
  sim.journeys.history=[{...city,finishedAt:1,rewardXP:10}];sim.journeys.accepted=[goal('a'),goal('b'),goal('c')];
  const before=sim.captureCheckpoint();
  const failed=await executeJourneyCommand(sim,{type:'track',id:city.id},()=>({ok:false,message:'Unavailable'}),f);
  assert.equal(failed.ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
  const pinned=await executeJourneyCommand(sim,{type:'track',id:city.id},()=>({ok:true,message:''}),f);
  assert.ok(pinned.ok);assert.equal(pinnedJourney(sim.journeys)?.id,city.id);assert.equal(sim.journeys.accepted.length,3);
  sim.journeys.nearestTown=goal('town:closer','town');assert.equal(pinnedJourney(sim.journeys)?.id,city.id);
  assert.ok(validJourneys(sim.journeys));
  const restored=simulation();restored.restoreCheckpoint(sim.captureCheckpoint());
  assert.deepEqual(restored.journeys.townPin,city);
  restored.player.x=city.x;restored.player.y=city.y;
  assert.equal(restored.completeJourneyArrival(city),false);assert.equal(restored.player.xp,before.xp);
  restored.journeys=reconcileJourneys(restored.journeys,{...f,x:city.x,y:city.y},true);
  assert.equal(restored.journeys.townPin,undefined);assert.equal(restored.journeys.nearestTown?.id,'town:closer');
});
test('city navigation pins cannot carry completion rewards or replace another explicit pin silently',()=>{
  let s=freshJourneys();s.nearestTown=goal('town:nearest','town');s.offers=[goal('activity')];
  s=planJourney(s,{type:'track',id:s.nearestTown.id})!;
  s=planJourney(s,{type:'track',id:'activity'})!;
  assert.equal(s.townPin,undefined);assert.equal(s.tracked,'activity');
  assert.ok(validJourneys(s));
  s.townPin=goal('town:nearest','town');assert.equal(validJourneys(s),false);
  s.tracked=null;s.townPin.rewardXP=10;assert.equal(validJourneys(s),false);
  delete s.townPin.rewardXP;s.townPin.kind='camp';assert.equal(validJourneys(s),false);
});
test('nearest settlement lookup matches a wider exhaustive neighborhood across geography boundaries',async()=>{
  const {nearestPlace,settlementPlace,geographyCoordinates}=await import('../src/world-geography.ts');
  for(const seed of [7319,18427])for(const [x,y]of [[0,0],[7800,-19000],[-26000,10000],[25000,26000]]){
    const [u,v]=geographyCoordinates(x,y,seed),cx=Math.round(u),cy=Math.round(v),all=[];
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)all.push(settlementPlace(seed,cx+dx,cy+dy));
    all.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||a.id-b.id);
    assert.equal(nearestPlace(seed,x,y).id,all[0].id);
  }
});

test('area journal retains all groups and dismissal returns the same activity to Nearby',()=>{
  let state=freshJourneys();const g=goal('target'),far={...goal('far'),x:12000,region:'Far Reach'};
  state.accepted=[g,far];state.history=Array.from({length:90},(_,i)=>({...goal(`done:${i}`),finishedAt:i}));
  state.tracked=g.id;
  state=planJourney(state,{type:'dismiss',id:g.id})!;
  assert.equal(state.tracked,g.id,'dismiss does not silently change a separate pin');
  const local=journalJourneys(state,{x:0,y:0});assert.equal(local.nearby[0].id,g.id);assert.equal(local.completed.length,90);
  assert.equal(local.accepted.length,0);assert.equal(journalJourneys(state,{x:0,y:0},'all').accepted[0].id,far.id);
  assert.equal(journalJourneys(state,{x:0,y:0},'Far Reach').accepted.length,1);
});

test('bulk acceptance is atomic, save-backed and rejects stale completed goals',async()=>{
  const sim=simulation(),f=facts();sim.journeys.offers=Array.from({length:20},(_,i)=>goal(`q:${i}`));
  const ids=sim.journeys.offers.map(g=>g.id),before=sim.captureCheckpoint();
  assert.equal((await executeJourneyCommand(sim,{type:'acceptAll',ids},()=>({ok:false,message:'Storage full'}),f)).ok,false);
  assert.deepEqual(sim.captureCheckpoint(),before);
  assert.equal(planJourney(sim.journeys,{type:'acceptAll',ids:[ids[0],ids[0]]}),null);
  assert.equal(planJourney(sim.journeys,{type:'acceptAll',ids:[...ids,'missing']}),null);
  let writes=0;
  const stale=sim.journeys.offers[0];f.events.sites[stale.id]={...stale,kind:'camp',seed:1,biome:'deadwood',phase:'claimed',choice:null,wavesCleared:0,delivered:0,bonusGranted:true};
  assert.equal((await executeJourneyCommand(sim,{type:'acceptAll',ids},()=>{writes++;return{ok:true,message:''};},f)).ok,false);
  assert.equal(writes,0);
  delete f.events.sites[stale.id];
  assert.ok((await executeJourneyCommand(sim,{type:'acceptAll',ids},checkpoint=>{
    writes++;assert.equal(sim.journeys.accepted.length,0);assert.equal(checkpoint.journeys!.accepted.length,20);return{ok:true,message:''};
  },f)).ok);
  assert.equal(writes,1);assert.equal(sim.journeys.accepted.length,20);assert.equal(sim.journeys.tracked,null);
});

test('catalogue refresh keeps known activities and completed history beyond old limits',()=>{
  const f=facts(),state=freshJourneys();
  state.offers=[{...goal('old-far'),x:19000}];state.tracked='old-far';
  state.history=Array.from({length:100},(_,i)=>({...goal(`done:${i}`),finishedAt:i}));
  const candidates=Array.from({length:80},(_,i)=>({...goal(`new:${i}`),kind:'camp' as const,description:'',x:100+i,y:50}));
  const search=new JourneySearch({seed:7319,blocked:()=>false,getPOIs:()=>candidates,getDungeonEntrances:()=>[]},f,[]);
  let steps=0;while(!search.step())steps++;
  assert.equal(steps,8,'scan still uses exactly nine bounded cells');
  const result=search.result(state,f);
  assert.equal(result.offers.length,81);assert.ok(result.offers.some(g=>g.id==='old-far'));assert.equal(result.history.length,100);
  assert.ok(validJourneys({...state,...result}));
});

test('old completion receipts restore known activity details without re-awarding XP',()=>{
  const f=facts(),state=freshJourneys(),g=goal('old-completed');state.completed=[g.id];
  const search=new JourneySearch({seed:7319,blocked:()=>false,getPOIs:()=>[],getDungeonEntrances:()=>[]},f,[{...g,kind:'camp',description:''}]);
  const result=search.result(state,f);
  assert.equal(result.history.find(v=>v.id===g.id)?.finishedAt,0);assert.ok(!result.offers.some(v=>v.id===g.id));
  const sim=simulation();sim.journeys={...state,...result};const before=sim.player.xp;
  assert.equal(sim.completeJourneyArrival({...g,kind:'town',x:0,y:0}),false);assert.equal(sim.player.xp,before);
});

test('large journals survive save decoding and old dismissal suppression is retired',()=>{
  const sim=simulation();sim.journeys.accepted=Array.from({length:40},(_,i)=>goal(`accepted:${i}`));
  sim.journeys.history=Array.from({length:100},(_,i)=>({...goal(`completed:${i}`),finishedAt:i}));
  sim.journeys.offers=[goal('pin-only')];sim.journeys.tracked='pin-only';
  const checkpoint=sim.captureCheckpoint();Object.assign(checkpoint.journeys!,{dismissed:['old-hidden'],suggestions:false});
  const raw=JSON.stringify({version:CHARACTER_SAVE_VERSION,id:'journal-save',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:10,checkpoint});
  const decoded=decodeCharacterSave(raw);assert.ok(decoded);
  assert.equal(decoded.checkpoint.journeys!.accepted.length,40);assert.equal(decoded.checkpoint.journeys!.history.length,100);
  assert.equal(decoded.checkpoint.journeys!.tracked,'pin-only');assert.equal(Object.hasOwn(decoded.checkpoint.journeys!,'dismissed'),false);
  assert.equal(Object.hasOwn(decoded.checkpoint.journeys!,'suggestions'),false);
  assert.ok(raw.includes('old-hidden'),'source bytes remain untouched');
});
