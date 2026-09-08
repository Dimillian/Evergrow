import { awardCharacterExperience } from '../src/character.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getZoneAt, scaledEnemyStats } from '../src/zone-progression.ts';
import { captureEncounterScale, encounterMemberLevel, validEncounterScales, isBossKind } from '../src/encounter-scaling.ts';
import { Simulation } from '../src/simulation.ts';
import { CampPopulation } from '../src/camp-population.ts';
import { executeEvent } from '../src/poi-command.ts';
import { validEvents } from '../src/poi-validation.ts';
import { freshEvents, type EventSite } from '../src/poi-content.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { createDungeonRun, dungeonMemberLevel, freshExpeditions } from '../src/dungeon-state.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { JourneySearch, rankJourneyCandidates } from '../src/journey-director.ts';
import { freshJourneys, guidedJourney } from '../src/journey-state.ts';
import { activityLevel } from '../src/activity-level.ts';
import { xpForNextLevel } from '../src/progression.ts';
import { vendorLevel, type TownNPC } from '../src/npcs.ts';
import { vendorStock, vendorStockLevel } from '../src/commerce.ts';
import { createCharacterSheet } from '../src/items.ts';
const world = { seed: 7319, blocked:()=>false, move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}) };
const make = () => new Simulation(world,{seed:7319,spawn:false});
const ok = () => ({ok:true,message:''});
const facts = (level=8) => ({x:0,y:0,level,time:100,events:freshEvents(),expeditions:freshExpeditions(),discovered:()=>false,campCleared:()=>false});

test('home preserves its geography and ordinary 1–12 range; rank offsets remain consistent at the cap',()=>{
 const home=getZoneAt(0,0,7319);assert.equal(home.level,1);assert.equal(home.maxLevel,12);
 for(const player of [1,8,12,16,50]){
  const scale=captureEncounterScale(home,player),base=Math.min(12,player);
  assert.deepEqual(new Set([0,1,2].map(seed=>encounterMemberLevel(scale,'normal',seed))),new Set([Math.max(1,base-1),base,Math.min(12,base+1)]));
  assert.equal(encounterMemberLevel(scale,'veteran',0),base+1);
  assert.equal(encounterMemberLevel(scale,'elite',0),base+2);
  assert.equal(encounterMemberLevel(scale,'normal',0,true),base+3);
 }
 const ranges=new Set<string>();for(let x=-18000;x<=18000;x+=3600)for(let y=-18000;y<=18000;y+=3600){const z=getZoneAt(x,y,7319);assert.ok(z.level<=z.maxLevel);ranges.add(`${z.level}-${z.maxLevel}`);}
 for(const band of ['1-12','4-18','7-22','12-28','18-35'])assert.ok(ranges.has(band),band);
 assert.deepEqual([1,2,3,4].map(xpForNextLevel),[100,170,230,305]);
});

test('camp baseline survives full-health sleeping, serialization, later levels and missing members',()=>{
 const camp={id:'site:7319:camp:test',x:500,y:0,radius:100,members:[{id:'guard',dx:0,dy:0,kind:'stalker' as const,rank:'veteran' as const},{id:'bow',dx:70,dy:0,kind:'archer' as const,rank:'normal' as const}]};
 let sim=make(),ledger=new CampPopulation();sim.player.level=8;
 const update=()=>ledger.update([camp],sim.player,sim.enemies,world,(m,x,y,s)=>sim.spawnEnemy(m.kind,x,y,m.rank,s),1000);
 update();const original=sim.enemies.map(e=>({level:e.level,seed:e.lootSeed,hp:e.maxHp}));
 const scales=JSON.parse(JSON.stringify(ledger.captureScales()));assert.ok(validEncounterScales(scales));
 sim=make();sim.player.level=40;ledger=new CampPopulation();ledger.restoreScales(scales);update();
 assert.deepEqual(sim.enemies.map(e=>({level:e.level,seed:e.lootSeed,hp:e.maxHp})),original);
 ledger.restoreDefeated({[camp.id]:['guard']});sim.enemies=[];ledger.restoreCleared([]);update();assert.equal(sim.enemies.length,1);assert.equal(sim.enemies[0].level,original[1].level);
});

test('old actors and partially cleared camps keep their old levels, wounds and progress',()=>{
 const sim=make();const e=sim.spawnEnemy('stalker',500,0,'normal',{campId:'site:7319:old',memberId:'guard',lootSeed:77,level:1})!;e.hp=7;
 const saved=sim.captureCheckpoint();delete saved.encounterScales;saved.level=16;
 sim.restoreCheckpoint(saved);assert.equal(sim.enemies[0].level,1);assert.equal(sim.enemies[0].hp,7);assert.equal(sim.encounterScale(e.campId!)?.fixed,true);
 const fresh=sim.spawnEnemy('stalker',600,0)!;assert.ok(fresh.level>=11&&fresh.level<=12);
 const ledger=new CampPopulation();ledger.restoreDefeated({'old-camp':['dead']});sim.enemies=[];
 ledger.update([{id:'old-camp',x:500,y:0,radius:100,members:[{id:'dead',dx:0,dy:0,kind:'stalker',rank:'normal'},{id:'alive',dx:70,dy:0,kind:'stalker',rank:'normal'}]}],sim.player,sim.enemies,world,(m,x,y,s)=>sim.spawnEnemy(m.kind,x,y,m.rank,s),1000);
 assert.equal(sim.enemies.length,1);assert.equal(sim.enemies[0].level,1);
});

test('trial waves and reward identities lock at activation, including level-one elites and failed writes',async()=>{
 const sim=make();sim.player.level=8;
 const site:EventSite={id:'site:7319:trial',kind:'graveyard',name:'Graves',x:0,y:30,level:1,seed:7319,biome:'deadwood'};
 const before=sim.captureCheckpoint();assert.equal((await executeEvent(sim,site,null,()=>({ok:false,message:'full'}))).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
 assert.ok((await executeEvent(sim,site,null,ok)).ok);
 const record=sim.eventState.sites[site.id];assert.equal(record.level,8);assert.ok(validEvents(sim.eventState));
 const guardians=sim.eventState.trial!.guardians;assert.ok(guardians.some(g=>g.rank==='elite'));for(const g of guardians)assert.equal(g.hp,scaledEnemyStats(g.kind,encounterMemberLevel(record.scaling!,g.rank,g.seed),g.rank).maxHp);
 const rewards=eventRewards(record),checkpoint=sim.captureCheckpoint();checkpoint.level=30;sim.restoreCheckpoint(checkpoint);
 assert.deepEqual(sim.eventState.trial!.guardians,guardians);assert.deepEqual(eventRewards(sim.eventState.sites[site.id]),rewards);
 const low=make();await executeEvent(low,site,null,ok);assert.ok(low.eventState.trial!.guardians.some(g=>g.rank==='elite'));assert.ok(validEvents(low.eventState));
 // Legacy active trials still validate against their original one-level roster.
 const old=structuredClone(low.eventState);delete old.sites[site.id].scaling;
 const {recipeMembers}=await import('../src/event-recipes.ts');old.trial!.guardians=recipeMembers(old.sites[site.id]).map(m=>({...m,hp:scaledEnemyStats(m.kind,1,m.rank).maxHp,x:0,y:30,admitted:false,dead:false}));
 assert.ok(validEvents(old));
});

test('new dungeon snapshots rank levels and old expeditions retain their exact floor and HP',()=>{
 const entrance={id:'dungeon:test',name:'Crypt',seed:7319,level:8,biome:'deadwood' as const,x:0,y:100};
 for(const scaling of [undefined,captureEncounterScale(getZoneAt(0,0),8)]){
  const run=createDungeonRun({...entrance,scaling}),floor=generateDungeon(entrance.seed,entrance.level);
  const expedition={...freshExpeditions(),runs:[run]};assert.ok(validExpeditions(expedition));
  for(const m of floor.members){const expected=scaling?encounterMemberLevel(scaling,m.rank,m.seed,isBossKind(m.kind)):8;assert.equal(dungeonMemberLevel(run.entrance,m),expected);assert.equal(run.states[m.id].hp,scaledEnemyStats(m.kind,expected,m.rank).maxHp);}
  assert.deepEqual(JSON.parse(JSON.stringify(expedition)).runs[0].states,run.states);
 }
});

test('guidance recommends local scaled activities, accepts challenging bosses, and retains a manual pin',()=>{
 const f=facts(),goal={id:'site:test',kind:'bossLair' as const,name:'Boss',level:11,x:500,y:0,region:'Home'};
 assert.equal(rankJourneyCandidates([goal],freshJourneys(),f,7319).length,1);
 assert.equal(rankJourneyCandidates([{...goal,level:12}],freshJourneys(),f,7319).length,0);
 const known={...goal,kind:'camp' as const,description:''};
 const search=new JourneySearch({...world,getPOIs:()=>[],getDungeonEntrances:()=>[]},f,[known]);
 const result=search.result(freshJourneys(),f);assert.equal(result.recommended,known.id);assert.equal(result.offers[0].level,8);
 const state={...freshJourneys(),...result,accepted:[goal],tracked:goal.id};assert.equal(guidedJourney(state)?.id,goal.id);
 f.events.sites[goal.id]={...goal,level:4,biome:'deadwood',seed:1,phase:'completed',choice:null,wavesCleared:0,delivered:0,bonusGranted:false};
 assert.equal(activityLevel(goal,f,7319),4,'saved source wins over a current-player preview');
});

test('vendors stay useful within their range without rerolling unsold stock within an epoch',()=>{
 const npc={id:'shop',name:'Shop',role:'blacksmith',x:0,y:0,level:1,maxLevel:12,seed:1,buildingId:'shop'} as TownNPC;
 assert.equal(vendorLevel(npc,8),8);assert.equal(vendorLevel(npc,30),12);
 const sheet=createCharacterSheet();assert.deepEqual(vendorStock(sheet,npc,7),vendorStock(sheet,npc,9));
 assert.ok(vendorStock(sheet,npc,30).every(i=>i!.itemLevel===12));
 for(const town of [npc,{...npc,level:7,maxLevel:22}])for(const level of [1,3,4,8,9,10,12,13,22,30]){
  const displayed=vendorStockLevel(town,level);
  assert.ok(vendorStock(sheet,town,level).every(item=>item!.itemLevel===displayed));
  assert.ok(displayed>=town.level&&displayed<=town.maxLevel!);
 }
 assert.equal(vendorStockLevel(npc,8),7,'stock label must not display the level-eight service ceiling');
 assert.equal(vendorStockLevel(npc,12),10);
 assert.equal(vendorStockLevel(npc,13),12);
});

test('onward routes survive road enumeration order at the exact region cap',async()=>{
 const {World}=await import('../src/world.ts');
 for(const [seed,x,y] of [[18427,1200,1000],[1,0,0],[1,1200,1000]]){
  const w=new World(seed),area=getZoneAt(x,y,seed),f={...facts(area.maxLevel),x,y};
  try{
   const search=new JourneySearch(w,f,[]);while(!search.step()){}
   const result=search.result(freshJourneys(),f),lead=result.offers.find(g=>g.id===result.recommended)!;
   assert.equal(lead?.kind,'frontier',`seed ${seed} at ${x},${y} must leave the capped region`);
   assert.ok(getZoneAt(lead.x,lead.y,seed).maxLevel>area.maxLevel);
   assert.ok(lead.level<=f.level+2);
   assert.ok(!w.blocked(lead.x,lead.y,22));
   assert.ok(result.offers.some(g=>g.kind==='camp'),'nearby activities remain available');
   const dismissed={...freshJourneys(),dismissed:[lead.id]};
   const next=search.result(dismissed,f);
   assert.equal(next.offers.find(g=>g.id===next.recommended)?.kind,'frontier');
   assert.notEqual(next.recommended,lead.id,'a dismissed route must not mask the next suitable destination');
  }finally{w.dispose();}
 }
});

test('at the home cap road guidance leads to a higher ceiling across three different worlds',async()=>{
 const {World}=await import('../src/world.ts');
 for(const seed of [7319,18427,90210]){
  const w=new World(seed),f=facts(16),search=new JourneySearch(w,f,[]);
  while(!search.step()){}
  const result=search.result(freshJourneys(),f),lead=result.offers.find(g=>g.id===result.recommended)!;
  assert.equal(lead.kind,'frontier');const zone=getZoneAt(lead.x,lead.y,seed);
  assert.ok(zone.maxLevel>12&&zone.level<=16);assert.ok(!w.blocked(lead.x,lead.y,22));w.dispose();
 }
});

test('new encounter state and old v4/v3 saves decode without resetting characters or exploration identity',async()=>{
 const {decodeCharacterSave}=await import('../src/character-save.ts');
 const sim=make();awardCharacterExperience(sim.player,Array.from({length:7},(_,i)=>xpForNextLevel(i+1)).reduce((a,b)=>a+b,0));
 const site:EventSite={id:'site:7319:save',kind:'graveyard',name:'Graves',x:0,y:30,level:1,seed:7319,biome:'deadwood'};
 await executeEvent(sim,site,null,ok);
 const checkpoint=sim.captureCheckpoint();checkpoint.encounterScales={'site:7319:camp':captureEncounterScale(getZoneAt(0,0),8)};
 const save={version:4,id:'compatible',name:'Wayfarer',worldSeed:7319,worldVersion:9,createdAt:1,updatedAt:2,checkpoint};
 const decoded=decodeCharacterSave(JSON.stringify(save));assert.ok(decoded);assert.deepEqual(decoded.checkpoint,checkpoint);
 const legacy=structuredClone(save);delete legacy.checkpoint.encounterScales;legacy.checkpoint.events=freshEvents();
 assert.ok(decodeCharacterSave(JSON.stringify(legacy)));
 const oldAppearance=JSON.parse(JSON.stringify(legacy));oldAppearance.version=3;delete oldAppearance.checkpoint.character.look;
 const migrated=decodeCharacterSave(JSON.stringify(oldAppearance));assert.ok(migrated);assert.equal(migrated.checkpoint.level,8);assert.equal(migrated.worldSeed,7319);assert.equal(migrated.worldVersion,9);
 const broken=structuredClone(save);broken.checkpoint.encounterScales!['site:7319:camp'].base=99;
 assert.equal(decodeCharacterSave(JSON.stringify(broken)),null);
 const mismatched=structuredClone(save);mismatched.checkpoint.events!.sites[site.id].level=20;
 assert.equal(decodeCharacterSave(JSON.stringify(mismatched)),null);
});
