import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWaves, freshWaves } from '../src/wave-system.ts';
import { eventRecipe, EVENT_RECIPES, recipeMembers, sealPoint } from '../src/event-recipes.ts';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { eventInteractionSites, type EventSite } from '../src/poi-content.ts';
import { executeEvent, claimCompletedEvent, pendingEventReward } from '../src/poi-command.ts';
import { advanceTrial } from '../src/poi-runtime.ts';
import { validEvents } from '../src/poi-validation.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { treasureLanding, treasurePose, validTreasureFlight } from '../src/treasure-flight.ts';
const world:WorldQuery={blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
const view={x:-350,y:-220,width:700,height:440};
const site=(kind:EventSite['kind'],seed=0):EventSite=>({id:`site:7319:expansion-${kind}`,kind,name:kind,x:0,y:30,level:5,biome:'deadwood',seed});
const persist=()=>({ok:true,message:''});
function advance(sim:Simulation,dt=.5){advanceTrial({state:sim.eventState,player:sim.player,enemies:sim.enemies,world,view,dt,spawn:(k,x,y,r,source)=>sim.spawnEnemy(k,x,y,r,source)});}
test('wave clocks wait for admission, never count missing actors, and bank completed waves on timeout',()=>{
 const s=freshWaves(),rules={count:20,duration:90,interval:2,hold:0};
 advanceWaves(s,rules,30,{admitted:false,defeated:false,inObjective:true});assert.equal(s.elapsed,0);
 advanceWaves(s,rules,1,{admitted:true,defeated:false,inObjective:true});assert.equal(s.cleared,0);
 advanceWaves(s,rules,1,{admitted:true,defeated:true,inObjective:true});assert.equal(s.cleared,1);
 advanceWaves(s,rules,90,{admitted:false,defeated:false,inObjective:true});assert.equal(s.finished,true);assert.equal(s.cleared,1);assert.equal(s.elapsed,90);
});
test('each event recipe admits, progresses, validates and claims its physical reward exactly once',async()=>{
 for(const kind of Object.keys(EVENT_RECIPES) as EventSite['kind'][])for(const seed of [0,256]){
  const s=site(kind,seed),sim=new Simulation(world,{spawn:false});assert.equal((await executeEvent(sim,s,kind==='standingStones'?'haste':null,persist)).ok,true);
  const recipe=eventRecipe(s)!;assert.deepEqual(sim.eventState.trial!.guardians.map(g=>({wave:g.wave,kind:g.kind,rank:g.rank,seed:g.seed})),recipeMembers(s));
  assert.ok(validEvents(sim.eventState));
  const rounds=kind==='cursedChest'?4:recipe.rules.count;
  for(let wave=0;wave<rounds;wave++){
   for(let i=0;i<8;i++)advance(sim);
   const t=sim.eventState.trial!;assert.equal(t.wave,wave);assert.ok(sim.enemies.some(e=>e.hp>0));
   for(const enemy of sim.enemies){enemy.hp=0;enemy.state='dead';}
   advance(sim);
   if(recipe.mode==='defend')for(let i=0;i<24;i++)advance(sim);
   if(recipe.mode==='seals'){
    assert.equal(t.sealReady,true);const point=sealPoint(sim.eventState.sites[s.id],wave);sim.player.x=point.x;sim.player.y=point.y;
    assert.equal((await executeEvent(sim,{...s,...point},null,persist)).ok,true);sim.player.x=0;sim.player.y=30;
   }
   assert.ok(validEvents(sim.eventState),`${kind}, wave ${wave}`);
  }
  if(kind==='cursedChest')advance(sim,90);
  assert.equal(sim.eventState.trial,null);const r=sim.eventState.sites[s.id];assert.equal(r.wavesCleared,rounds);
  sim.player.x=300;assert.ok(pendingEventReward(sim,r));
  assert.equal(eventInteractionSites([s],sim.eventState).length,0,'no extra interaction prompt');
  assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,true);assert.ok(validEvents(sim.eventState));
  const count=sim.groundItems.length;assert.equal(count,eventRewards(r).items.length);assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,false);assert.equal(sim.groundItems.length,count);
 }
});
test('cursed score, remaining time and wounds survive checkpoint reconstruction',async()=>{
 const sim=new Simulation(world,{spawn:false}),s=site('cursedChest');await executeEvent(sim,s,null,persist);advance(sim);advance(sim,12);sim.enemies[0].hp=7;
 const checkpoint=sim.captureCheckpoint(),resumed=new Simulation(world,{spawn:false});resumed.restoreCheckpoint(checkpoint);
 assert.equal(resumed.eventState.trial!.elapsed,12);assert.equal(resumed.eventState.trial!.guardians[0].hp,7);assert.ok(validEvents(resumed.eventState));
 resumed.player.x=3000;advance(resumed);assert.equal(resumed.eventState.trial,null);assert.equal(resumed.eventState.sites[s.id].wavesCleared,0);
});
test('treasure scatters into reachable space, flies from its chest, and validates saved motion',()=>{
 const w={...world,blocked:(x:number)=>x>25};const point=treasureLanding(w,0,0,0,0);assert.ok(point.x<=25);
 const drop={...point,flight:{x:0,y:0,at:2,delay:.2}};
 assert.equal(treasurePose(drop,2).landed,false);assert.ok(treasurePose(drop,2.7).height>40);assert.equal(treasurePose(drop,4).landed,true);
 assert.equal(validTreasureFlight({...drop.flight,at:NaN}),false);
});

test('automatic cursed payouts are durable, exactly once and preserve surviving enemies',async()=>{
 const sim=new Simulation(world,{spawn:false}),s=site('cursedChest');await executeEvent(sim,s,null,persist);
 advance(sim);for(const e of sim.enemies){e.hp=0;e.state='dead';}advance(sim);for(let i=0;i<6;i++)advance(sim);
 const survivors=sim.enemies.filter(e=>e.hp>0);advance(sim,90);assert.ok(survivors.length>0);
 const before=sim.captureCheckpoint();
 assert.equal((await claimCompletedEvent(sim,s.id,()=>({ok:false,message:'Failed'}))).ok,false);
 assert.deepEqual(sim.captureCheckpoint(),before);
 sim.player.x=300;assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,true);
 assert.equal(sim.groundItems.length,1);assert.ok(sim.groundItems[0].flight);
 assert.ok(survivors.every(e=>sim.enemies.includes(e)&&!e.campId));
 assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,false);
});

test('surface travel banks a timed score only after the departure checkpoint is saved',async()=>{
 const {executePortalTravel}=await import('../src/travel-command.ts');
 const w={...world,isSanctuary:(x:number)=>x>2000};
 const sim=new Simulation(w,{spawn:false}),s=site('cursedChest');await executeEvent(sim,s,null,persist);advance(sim);advance(sim,4);
 sim.portal.start(sim.player,sim.world);sim.portal.elapsed=3;
 const anchor={band:sim.travel.homeTown,x:2400,y:0,name:'Town',level:1};
 const before=sim.captureCheckpoint();
 assert.equal((await executePortalTravel(sim,anchor,false,()=>({ok:false,message:'Failed'}))).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
 sim.portal.start(sim.player,sim.world);sim.portal.elapsed=3;
 assert.equal((await executePortalTravel(sim,anchor,false,persist)).ok,true);
 assert.equal(sim.eventState.trial,null);assert.equal(sim.eventState.sites[s.id].phase,'completed');assert.ok(sim.enemies.every(e=>!e.campId));
});

test('placement keeps roadside sites close and every ritual anchor reachable',async()=>{
 const {World,pathDistance}=await import('../src/world.ts');const {eventSite}=await import('../src/poi-content.ts');const {planSeals}=await import('../src/event-recipes.ts');
 for(const seed of [7319,42]){
  const w=new World(seed),sites=w.getWildernessSites(-8000,-8000,16000,16000);
  for(const s of sites){const e=eventSite(s,seed);assert.equal(w.blocked(e.x,e.y,22),false,s.id);
   if(['caravan','hamlet','crossing'].includes(s.kind))assert.ok(pathDistance(s.x,s.y,seed)<s.radius+500);
   if(eventRecipe(e)?.mode==='seals'){const anchors=planSeals(e,w);assert.ok(anchors,s.id);assert.ok(anchors.every(p=>!w.blocked(p.x,p.y,22)));}
  }
 }
});

test('shared navigation supplies an obstacle detour without moving its target or changing collision',async()=>{
 const {WorldNavigation}=await import('../src/world-navigation.ts');
 const nav=new WorldNavigation({...world,blocked:(x:number,y:number)=>Math.abs(x)<30&&Math.abs(y)<160});
 let point={x:-240,y:0};for(let i=0;i<60&&point.x===-240&&point.y===0;i++)point=nav.target(-240,0,240,0);
 assert.ok(point.x!==-240||point.y!==0);assert.ok(Math.abs(point.y)>0,'the first route step detours around the wall');
});

test('automatic rewards resume after capacity clears or reload, without repeating XP or drops',async()=>{
 const {LOOT_RULES}=await import('../src/combat-content.ts');
 const {GOLD_RULES}=await import('../src/gold.ts');
 const {generateItem}=await import('../src/items.ts');
 const sim=new Simulation(world,{spawn:false}),s=site('quarry');
 await executeEvent(sim,s,null,persist);
 sim.eventState.trial=null;
 sim.eventState.sites[s.id].phase='completed';sim.eventState.sites[s.id].wavesCleared=3;
 sim.groundItems=Array.from({length:LOOT_RULES.maxGroundItems},(_,i)=>({id:100+i,x:500,y:500,item:generateItem(80000+i,1)}));
 sim.groundGold=Array.from({length:GOLD_RULES.maxPiles},(_,i)=>({id:1000+i,x:500,y:500,amount:1,age:1}));
 assert.ok((await claimCompletedEvent(sim,s.id,persist)).ok);
 assert.equal(sim.eventState.sites[s.id].bonusGranted,true);
 assert.equal(sim.eventState.sites[s.id].delivered,0);
 assert.equal(pendingEventReward(sim,sim.eventState.sites[s.id]),false,'full ground does not trigger empty save retries');
 const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(sim.captureCheckpoint());
 const xp=restored.player.xp, level=restored.player.level;
 restored.groundItems.splice(0,1);
 assert.ok((await claimCompletedEvent(restored,s.id,persist)).ok);
 assert.equal(restored.groundItems.filter(i=>i.item.id.startsWith('poi:')).length,1);
 assert.equal(restored.player.xp,xp);assert.equal(restored.player.level,level);
 restored.groundItems.splice(0,1);restored.groundGold.splice(0,1);
 assert.ok((await claimCompletedEvent(restored,s.id,persist)).ok);
 assert.equal(restored.eventState.sites[s.id].phase,'claimed');
 assert.equal(restored.groundItems.filter(i=>i.item.id.startsWith('poi:')).length,2);
 assert.equal((await claimCompletedEvent(restored,s.id,persist)).ok,false);
});

test('automatic event payout leaves unstarted, active, distant and dead-player events alone',async()=>{
 const sim=new Simulation(world,{spawn:false}),s=site('quarry');
 assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,false);
 await executeEvent(sim,s,null,persist);
 assert.equal((await claimCompletedEvent(sim,s.id,persist)).ok,false);
 sim.eventState.trial=null;sim.eventState.sites[s.id].phase='completed';
 sim.player.dead=true;assert.equal(pendingEventReward(sim,sim.eventState.sites[s.id]),false);
 sim.player.dead=false;sim.player.x=5000;assert.equal(pendingEventReward(sim,sim.eventState.sites[s.id]),false);
 sim.player.x=300;assert.ok(pendingEventReward(sim,sim.eventState.sites[s.id]));
});
