import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConsoleCommand, consoleSuggestions, consoleEnemies, consoleItems, CONSOLE_LIMITS } from '../src/console-content.ts';
import { executeConsoleCommand, type ConsoleExecution } from '../src/console-command.ts';
import { canUseLocalConsole, isConsoleShortcut } from '../src/console-access.ts';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { generateItem } from '../src/items.ts';
import { manaCapacity } from '../src/auras.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { storedActor } from '../src/dungeon-state.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { shouldRetireRoamer } from '../src/roaming-encounters.ts';
import { type WorldQuery } from '../src/model.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';

const view={x:-400,y:-250,width:800,height:500};
const world:WorldQuery={seed:7319,blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
async function setup(customWorld=world){
  const data=new Map<string,string>();
  const repo=new CharacterRepository({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}});
  const session=new CharacterSession(repo,10), sim=new Simulation(customWorld,{seed:7319,spawn:false});
  sim.player.angle=0;
  assert.equal(await session.create(0,'Rowan',7319,sim.captureCheckpoint(),'console-test',100),true,session.error);
  let sequence=0;
  const context:ConsoleExecution={allowed:()=>true,view,seed:()=>7319,identity:()=>`test-${sequence++}`,
    persist:async checkpoint=>({ok:await session.save(checkpoint,101),message:session.error})};
  return {sim,repo,session,context};
}

test('local access requires both the build permission and local ownership, including offline cloud',()=>{
  assert.equal(canUseLocalConsole(true,false,'local','127.0.0.1',false),true);
  assert.equal(canUseLocalConsole(true,false,'local','appassets.androidplatform.net',true),true);
  for(const [enabled,site,mode,host,android] of [[false,false,'local','localhost',false],[true,true,'local','localhost',false],
    [true,false,'cloud','localhost',false],[true,false,'local','example.com',false],[true,true,'local','localhost',true]] as const)
    assert.equal(canUseLocalConsole(enabled,site,mode,host,android),false);
  const key={code:'KeyK',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,isComposing:false};
  assert.equal(isConsoleShortcut(key),true);assert.equal(isConsoleShortcut({...key,metaKey:false,ctrlKey:true}),true);
  for(const other of [{code:'KeyR'},{isComposing:true},{altKey:true},{shiftKey:true},{metaKey:false}])assert.equal(isConsoleShortcut({...key,...other}),false);
});
test('parser validates every argument before dispatch and uses the runtime content catalogs',()=>{
  assert.deepEqual(parseConsoleCommand('drop helmet --level 25 --material steel --rarity rare --seed 0'),
    {type:'drop',kind:'head',level:25,count:1,seed:0,profile:undefined,material:'steel',rarity:'rare'});
  assert.deepEqual(parseConsoleCommand('spawn thornreaver'),{type:'spawn',kind:'thornReaver',rank:'normal',placement:'offscreen',level:undefined,count:1,seed:undefined});
  assert.deepEqual(parseConsoleCommand('spawn brute --placement nearby'),{type:'spawn',kind:'brute',rank:'normal',placement:'nearby',level:undefined,count:1,seed:undefined});
  for(const raw of ['drop','spawn','drop wrong','drop helmet --level 0','drop helmet --level 1e2','drop helmet --level NaN',
    'drop helmet --level 1000001','spawn brute --count 33','spawn brute --count -1','spawn brute --seed 4294967296',
    'hp','mp','mana','spawn brute --placement close','spawn brute --placement','spawn brute --placement nearby --placement offscreen','spawn brute --rank boss','spawn warden','spawn briarMatriarch','spawn goblinChief','drop riftKey','drop helmet --profile longsword',
    'drop weapon --material iron','drop helmet --material astralite','drop helmet --rarity unique','drop charm --material iron','drop helmet --level 2 --level 3',
    'drop helmet --unknown 1','drop helmet --rarity','refill-hp 20','refill-mp --level 10','refill;alert(1)','help no','x'.repeat(241)])assert.throws(()=>parseConsoleCommand(raw),raw);
  for(const kind of consoleItems)assert.equal(parseConsoleCommand(`drop ${kind}`).type,'drop');
  for(const kind of consoleEnemies)assert.equal(parseConsoleCommand(`spawn ${kind}`).type,'spawn');
});
test('suggestions cover command names, partial tokens, item-specific flags and runtime values',()=>{
  assert.ok(consoleSuggestions('refill-m').some(s=>s.value==='refill-mp'));
  assert.ok(consoleSuggestions('help sp').some(s=>s.value==='help spawn '||s.value==='help spawn'));
  assert.equal(consoleSuggestions('drop hel')[0].value,'drop helmet ');
  assert.ok(consoleSuggestions('drop helmet --material ste').some(s=>s.value==='drop helmet --material steel '));
  assert.ok(consoleSuggestions('drop weapon --profile long').some(s=>s.label==='longsword'));
  assert.deepEqual(consoleSuggestions('spawn brute --placement ').map(s=>s.label),['offscreen','nearby']);
  assert.equal(consoleSuggestions('spawn brute --placement ne')[0].value,'spawn brute --placement nearby ');
  assert.ok(consoleSuggestions('spawn brute --placement nearby ').every(s=>s.label!=='--placement'));
  assert.ok(consoleSuggestions('spawn bri').every(s=>s.label!=='briarMatriarch'));
  assert.ok(consoleSuggestions('drop helmet --level 25 ').every(s=>s.label!=='--level'));
  assert.equal(consoleSuggestions('refill-hp ').length,0);
});
test('help and denied commands never save, allocate identities or change state',async()=>{
  const {sim,context}=await setup();let called=0;
  context.persist=async()=>{called++;return {ok:true};};context.seed=context.identity=()=>{throw new Error('No RNG expected');};
  const before=sim.captureCheckpoint();assert.equal((await executeConsoleCommand(sim,'help drop',context)).ok,true);
  context.allowed=()=>false;
  for(const raw of ['drop helmet','spawn brute','refill-hp','refill-mp','refill','help'])assert.equal((await executeConsoleCommand(sim,raw,context)).ok,false);
  assert.equal(called,0);assert.deepEqual(sim.captureCheckpoint(),before);
});
test('targeted drops retain normal rolled stats, animate, save and receive independent physical identities',async()=>{
  const {sim,repo,context}=await setup();
  const raw='drop helmet --level 25 --material steel --rarity rare --seed 55';
  for(let i=0;i<2;i++)assert.equal((await executeConsoleCommand(sim,raw,context)).ok,true);
  const [a,b]=sim.groundItems, expected=generateItem(55,25,'head',undefined,'rare','steel');
  assert.deepEqual(a.item.recipe,expected.recipe);assert.deepEqual(a.item.affixes,expected.affixes);assert.deepEqual(a.item.implicit,expected.implicit);
  assert.equal(a.item.itemLevel,25);assert.equal(a.item.tier,'rare');assert.ok(a.flight);assert.notEqual(a.item.id,b.item.id);assert.notEqual(a.id,b.id);
  assert.equal(sim.nextEntityIdentity,3);
  const saved=repo.read(0).record!;assert.equal(saved.checkpoint.groundItems.length,2);
  const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(saved.checkpoint);
  assert.deepEqual(restored.groundItems,sim.groundItems);
  assert.equal((await executeConsoleCommand(sim,'drop weapon --profile longsword --level 40 --count 3',context)).ok,true);
  for(const drop of sim.groundItems.slice(2)){assert.equal(drop.item.weapon!.id,drop.item.id);assert.equal(drop.item.recipe.profileId,'longsword');}
});
test('failed or pending saves leave resources, drops, actors, RNG and identity allocation untouched',async()=>{
  for(const raw of ['refill-hp','refill-mp','refill','drop helmet --count 3','spawn brute --count 3','spawn brute --count 3 --placement nearby']){
    const {sim,context}=await setup();sim.player.hp=10;sim.player.mana=3;
    const before=sim.captureCheckpoint(), id=sim.nextEntityIdentity;
    let finish!:(result:{ok:boolean;message?:string})=>void;
    context.persist=()=>new Promise(resolve=>{finish=resolve;});
    const action=executeConsoleCommand(sim,raw,context);
    assert.deepEqual(sim.captureCheckpoint(),before,raw);assert.equal(sim.nextEntityIdentity,id);
    finish({ok:false,message:'Disk full'});assert.equal((await action).ok,false);
    assert.deepEqual(sim.captureCheckpoint(),before,raw);assert.equal(sim.nextEntityIdentity,id);
    context.persist=async()=>{throw new Error('Storage failed');};
    assert.equal((await executeConsoleCommand(sim,raw,context)).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
  }
});
test('resource commands refill only requested resources, respect aura reservations and do not change cooldowns or charges',async()=>{
  const {sim,context,repo}=await setup(),p=sim.player;p.hp=5;p.mana=2;p.flasks=0;p.healCooldown=.5;
  assert.equal((await executeConsoleCommand(sim,'refill-hp',context)).ok,true);assert.equal(p.hp,p.maxHp);assert.equal(p.mana,2);
  p.hp=7;p.auras!.reservation=40;
  assert.equal((await executeConsoleCommand(sim,'refill-mp',context)).ok,true);assert.equal(p.hp,7);assert.equal(p.mana,manaCapacity(p));
  p.mana=1;assert.equal((await executeConsoleCommand(sim,'refill',context)).ok,true);
  assert.equal(p.hp,p.maxHp);assert.equal(p.mana,manaCapacity(p));assert.equal(p.flasks,0);assert.equal(p.healCooldown,.5);
  assert.equal(repo.read(0).record!.checkpoint.mana,p.mana);
  p.dead=true;const before=sim.captureCheckpoint();assert.equal((await executeConsoleCommand(sim,'refill',context)).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);
});
test('spawned monsters retain level, rank, source stats and loot after save/load without changing other actors or progression',async()=>{
  const {sim,context,repo}=await setup();const existing=sim.spawnEnemy('hound',100,100)!;existing.hp=5;existing.state='windup';
  const before=sim.captureCheckpoint(), existingSnapshot=structuredClone(existing);
  const result=await executeConsoleCommand(sim,'spawn brute --level 20 --rank elite --count 3 --seed 17',context);assert.equal(result.ok,true,result.message);
  assert.deepEqual(existing,existingSnapshot);
  const spawned=sim.enemies.slice(1);assert.equal(spawned.length,3);
  for(const e of spawned){assert.equal(e.level,20);assert.equal(e.rank,'elite');assert.equal(e.campId,undefined);assert.equal(e.hp,e.maxHp);assert.ok(isSpawnHidden(e.x,e.y,view,e.radius));assert.equal(shouldRetireRoamer(e,sim.player,view,{x:1,y:0}),false);}
  assert.equal(sim.captureCheckpoint().randomState,before.randomState);assert.equal(sim.captureCheckpoint().spawnOrdinal,before.spawnOrdinal);assert.equal(sim.kills,0);assert.equal(sim.player.xp,0);
  const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(repo.read(0).record!.checkpoint);
  assert.deepEqual(restored.enemies.slice(1).map(storedActor),spawned.map(storedActor));
  const loot=(e:typeof existing)=>rollEnemyLoot({seed:e.lootSeed,kind:e.kind,rank:e.rank,level:e.level,biome:e.biome,firstKill:true});
  assert.deepEqual(loot(restored.enemies[1]),loot(spawned[0]));assert.equal(restored.enemies[1].damage,spawned[0].damage);
});
test('spawn placement fails atomically for towns, blocked terrain, missing cameras and dungeons',async()=>{
  for(const customWorld of [{...world,isSanctuary:()=>true},{...world,blocked:()=>true},{...world,dungeonLevel:12}]){
    const {sim,context}=await setup(customWorld);let saved=false;context.persist=async()=>{saved=true;return {ok:true};};
    for(const placement of ['offscreen','nearby']){
      assert.equal((await executeConsoleCommand(sim,`spawn brute --count 3 --placement ${placement}`,context)).ok,false);assert.equal(saved,false);assert.equal(sim.enemies.length,0);
    }
  }
  const {sim,context}=await setup();context.view=null;assert.equal((await executeConsoleCommand(sim,'spawn brute',context)).ok,false);
  context.view={...view,width:NaN};assert.equal((await executeConsoleCommand(sim,'spawn brute',context)).ok,false);
});
test('all mutations pass a complete checkpoint to persistence before live commitment',async()=>{
  const {sim,context}=await setup();let saved:CharacterCheckpoint|undefined;const oldHp=sim.player.hp=5;
  context.persist=async checkpoint=>{assert.equal(sim.player.hp,oldHp);saved=checkpoint;return {ok:true};};
  assert.equal((await executeConsoleCommand(sim,'refill-hp',context)).ok,true);assert.equal(saved!.hp,sim.player.maxHp);
});

test('repeating a seeded monster after save/load yields distinct physical loot with identical rolls',async()=>{
  const {awardKillRewards}=await import('../src/combat-rewards.ts');
  const {validActors}=await import('../src/dungeon-validation.ts');
  const {sim,context,repo,session}=await setup();
  assert.equal((await executeConsoleCommand(sim,'spawn brute --level 1 --rank elite --seed 17',context)).ok,true);
  const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(repo.read(0).record!.checkpoint);
  assert.equal((await executeConsoleCommand(restored,'spawn brute --level 1 --rank elite --seed 17',context)).ok,true);
  const [a,b]=restored.enemies;
  assert.equal(a.lootSeed,b.lootSeed);assert.notEqual(a.lootIdentity,b.lootIdentity);
  const rewardContext={player:restored.player,groundItems:restored.groundItems,groundGold:restored.groundGold,pickups:restored.pickups,
    nextId:()=>{const id=restored.nextEntityIdentity;restored.reserveIdentity(id+1);return id;},emit:()=>{}};
  // Identical pre-award player level and non-first kill status isolate equipment recipe equality.
  const initial=structuredClone(restored.player);
  awardKillRewards(a,5,0,rewardContext);const count=restored.groundItems.length;assert.ok(count>0);
  rewardContext.player=structuredClone(initial);awardKillRewards(b,5,0,rewardContext);
  const first=restored.groundItems.slice(0,count),second=restored.groundItems.slice(count);
  assert.deepEqual(first.map(d=>d.item.recipe),second.map(d=>d.item.recipe));assert.deepEqual(first.map(d=>d.item.affixes),second.map(d=>d.item.affixes));
  assert.equal(new Set(restored.groundItems.map(d=>d.item.id)).size,restored.groundItems.length);
  a.hp=b.hp=0;
  assert.equal(await session.save(restored.captureCheckpoint(),102),true,session.error);
  assert.equal(validActors([{...storedActor(a),lootIdentity:7}]),false);
  assert.equal(validActors([{...storedActor(a),lootIdentity:'x'.repeat(81)}]),false);
  assert.ok(consoleSuggestions('drop helmet ').every(s=>s.label!=='--profile'));
  assert.ok(consoleSuggestions('drop charm ').every(s=>s.label!=='--material'));
});


test('nearby placement admits visible monsters, avoids player and actors, and persists the whole group',async()=>{
  const {sim,context,repo}=await setup({...world,blocked:(_x,y)=>y<0});
  const existing=sim.spawnEnemy('hound',70,0)!;
  const before=structuredClone(existing), id=sim.nextEntityIdentity;
  const result=await executeConsoleCommand(sim,'spawn brute --placement nearby --level 20 --count 5',context);
  assert.equal(result.ok,true,result.message);assert.match(result.message!,/nearby/);
  assert.deepEqual(existing,before);assert.equal(sim.nextEntityIdentity,id+5);
  for(const e of sim.enemies.slice(1)){
    const distance=Math.hypot(e.x-sim.player.x,e.y-sim.player.y);
    assert.ok(distance<=CONSOLE_LIMITS.nearbyRadius);assert.ok(distance>=sim.player.radius+e.radius+12);
    assert.ok(e.y>=0);assert.equal(isSpawnHidden(e.x,e.y,view,e.radius),false);
    assert.equal(e.level,20);
    for(const other of sim.enemies)if(other!==e)assert.ok(Math.hypot(e.x-other.x,e.y-other.y)>=e.radius+other.radius+12);
  }
  const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(repo.read(0).record!.checkpoint);
  assert.deepEqual(restored.enemies.map(storedActor),sim.enemies.map(storedActor));
});
test('nearby placement never falls back to distant ground and rolls back an incomplete group',async()=>{
  // Permit only one candidate beside the player, plus distant ground that must stay unused.
  const customWorld={...world,blocked:(x:number,y:number)=>Math.hypot(x,y)<=CONSOLE_LIMITS.nearbyRadius&&Math.hypot(x-66,y)>5};
  const single=await setup(customWorld);
  const one=await executeConsoleCommand(single.sim,'spawn brute --placement nearby',single.context);
  assert.equal(one.ok,true,one.message);
  const {sim,context}=await setup(customWorld);
  let saves=0;context.persist=async()=>{saves++;return {ok:true};};
  const before=sim.captureCheckpoint(),id=sim.nextEntityIdentity;
  const result=await executeConsoleCommand(sim,'spawn brute --placement nearby --count 2',context);
  assert.equal(result.ok,false);assert.match(result.message!,/No clear nearby space/);
  assert.equal(saves,0);assert.deepEqual(sim.captureCheckpoint(),before);assert.equal(sim.nextEntityIdentity,id);
  assert.equal(sim.captureCheckpoint().randomState,before.randomState);
});
