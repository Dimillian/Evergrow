import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIQUES, withUniqueChance, hasUnique } from '../src/unique-content.ts';
import { generateUnique, deriveItem, generateItem } from '../src/items.ts';
import { validItem } from '../src/item-validation.ts';
import { improveItem, improvementProblem } from '../src/item-improvement.ts';
import { isGreaterAffix } from '../src/item-roll-content.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { ENEMY_LOOT_TABLES, BOSS_CHEST_LOOT_TABLES } from '../src/loot-content.ts';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { activateSkill, type SkillContext } from '../src/skill-combat.ts';
import { resolveSkill, SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { advanceProjectiles } from '../src/projectile-combat.ts';
import { advanceSkillEffects, mitigateSkillHit } from '../src/player-skill-effects.ts';
import { releaseStoredEmbers } from '../src/unique-combat.ts';
import { freshChronicle, mergeChronicles, emptyChronicle } from '../src/chronicle.ts';
import { discoverUnique, uniqueCollection } from '../src/unique-collection.ts';
import { CHARACTER_SAVE_VERSION, decodeCharacterSave } from '../src/character-save.ts';
import { scheduleGroundEffect } from '../src/ground-effects.ts';
import { touchTargeting } from '../src/touch-targeting.ts';
import type { CombatEvent, Input, WorldQuery } from '../src/model.ts';
const world:WorldQuery={blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})};
function fixture(id:string,variant?:string,terrain=world){
 const u=UNIQUES.find(u=>u.id===id)!;const sim=new Simulation(terrain,{spawn:false,startX:0,startY:0});const p=sim.player;
 p.level=25;p.character.equipped.weapon=generateItem(93,25,'weapon',['fireball','iceNova','runicWard'].includes(u.skill)?'cinder-wand':'longsword','common');
 p.character.equipped.offhand=null;
 p.character.equipped[u.kind==='weapon'?'weapon':u.kind==='gloves'?'gloves':'offhand']=generateUnique(42,25,id);
 p.character.allocatedNodes=['origin',`skill:${u.skill}`];p.character.skillRanks[u.skill]=1;p.character.skillSlots[0]=u.skill;
 if(variant){p.character.allocatedNodes.push(`specialization:${variant}`);p.character.skillSpecializations[u.skill]=variant;}
 refreshCharacter(p);p.hp=p.maxHp;p.mana=p.maxMana=10000;p.derived.critChance=0;
 const events:CombatEvent[]=[];
 const context:SkillContext={player:p,world:terrain,enemies:sim.enemies,aimX:250,aimY:0,availableGroundEffects:16,availableProjectiles:128,
  visible:(ax,ay,bx,by)=>{for(let i=0;i<=20;i++)if(terrain.blocked(ax+(bx-ax)*i/20,ay+(by-ay)*i/20,1))return false;return true;},onScreen:()=>true,
  damage:(e,n)=>{e.hp-=n;},emit:e=>events.push(e),schedule:e=>scheduleGroundEffect(sim.groundEffects,e,{nextId:()=>100+sim.groundEffects.length,emit:()=>{}}),
  projectile:(x,y,angle,d,skill,effects)=>{
    const shot={id:sim.projectiles.length+1,sourceLevel:25,x,y,prevX:x,prevY:y,vx:Math.cos(angle)*d.speed,vy:Math.sin(angle)*d.speed,angle,radius:d.radius,damage:d.damage,life:d.life,maxLife:d.life,owner:d.owner,skill,effects:structuredClone(effects),hitIds:new Set<number>()};sim.projectiles.push(shot);return shot;
  }};
 return {sim,p,u,context,events,cast:()=>activateSkill(context,0)};
}
test('six unique recipes retain fixed integer affixes across seeds, levels, saves and enhancement',()=>{
 for(const u of UNIQUES)for(const level of [1,25,100,10000,1000000]){
  const item=generateUnique(42,level,u.id),other=generateUnique(84,level,u.id);
  assert.ok(validItem(item),`${u.id}:${level}`);assert.deepEqual(item.affixes,other.affixes);
  assert.deepEqual(item.affixes.map(a=>a.stat),u.affixes);assert.ok(item.affixes.every(a=>Number.isInteger(a.value)));
  assert.deepEqual(deriveItem(item),item);assert.ok(item.affixes.every((_,i)=>!isGreaterAffix(item,i)));
  const enhanced=improveItem(item,'enhance',level,99);assert.ok(validItem(enhanced));assert.equal(enhanced.recipe.uniqueId,u.id);
  for(const operation of ['rarity','rerollOne','rerollAll','relevel'] as const)assert.ok(improvementProblem(item,operation,level+20,0));
  for(const mutate of [(i:typeof item)=>i.recipe.uniqueId='unknown',(i:typeof item)=>i.recipe.rolls[0]=1,(i:typeof item)=>i.affixes[0].value++,(i:typeof item)=>i.tier='legendary'] ){
    const bad=structuredClone(item);mutate(bad);assert.equal(validItem(bad),false);
  }
 }
 const sim=new Simulation(world,{spawn:false});for(const [i,u]of UNIQUES.entries())sim.player.character.inventory[i]=generateUnique(i,25,u.id);
 const record={version:CHARACTER_SAVE_VERSION,id:'unique-save',name:'Test',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:10,checkpoint:sim.captureCheckpoint()};
 assert.ok(decodeCharacterSave(JSON.stringify(record)),'current and pre-unique characters use the same save envelope');
});
test('unique and legendary chances are equal without changing legendary odds; source/player levels remain separate',()=>{
 for(const table of [...Object.values(ENEMY_LOOT_TABLES).map(t=>t.tierWeights),...BOSS_CHEST_LOOT_TABLES.dungeon,...BOSS_CHEST_LOOT_TABLES.raid]){
  assert.equal(table.legendary,table.unique);assert.ok(Math.abs(Object.values(table).reduce((a,b)=>a+b,0)-100)<1e-9);
 }
 assert.equal(withUniqueChance({common:99,legendary:1}).legendary,1);
 const context={seed:42,level:80,playerLevel:25,rank:'elite' as const,biome:'verdant' as const,kind:'stalker' as const};
 const uniques=rollEnemyLoot({...context,tierOverride:'unique'});assert.ok(uniques.every(i=>i.itemLevel===25&&validItem(i)));
 assert.ok(rollEnemyLoot({...context,tierOverride:'legendary'}).every(i=>i.itemLevel===82));
});
test('every signature activates with Original and each of its three Techniques without changing the base recipe',()=>{
 for(const u of UNIQUES)for(const variant of [undefined,...SKILL_SPECIALIZATIONS.filter(v=>v.skill===u.skill).map(v=>v.id)]){
  const {p,cast}=fixture(u.id,variant);const before=resolveSkill(u.skill,p.derived,p.character);const mana=p.mana;
  assert.ok(cast(),`${u.id}:${variant}`);assert.equal(p.mana,mana-before.mana);
  assert.deepEqual(resolveSkill(u.skill,p.derived,p.character),before);
 }
});
test('Winter’s Reach moves both novas and contact checks to the aimed point, with terrain and reach limits',()=>{
 const f=fixture('winters-reach','iceNova-echo'); // Resolve the real echo identifier rather than relying on display text.
 const echo=SKILL_SPECIALIZATIONS.find(v=>v.skill==='iceNova'&&v.name==='Echoing Frost')!;
 f.p.character.allocatedNodes.push(`specialization:${echo.id}`);f.p.character.skillSpecializations.iceNova=echo.id;
 const near=f.sim.spawnEnemy('brute',15,0)!;const far=f.sim.spawnEnemy('brute',250,0)!;near.hp=far.hp=10000;
 assert.ok(f.cast());assert.equal(near.hp,10000);assert.ok(far.hp<10000);assert.equal(f.sim.groundEffects[0].x,250);
 assert.equal(touchTargeting(resolveSkill('iceNova',f.p.derived,f.p.character).recipe),'ground');
 const blocked=fixture('winters-reach',undefined,{...world,blocked:(x)=>x>=100});blocked.context.aimX=900;blocked.cast();
 assert.ok(blocked.events.some(e=>e.type==='blast'&&e.x<100));
 const clamped=fixture('winters-reach');clamped.context.aimX=900;clamped.cast();assert.ok(clamped.events.some(e=>e.type==='blast'&&e.x===420));
});
test('returning shields and arrows hit once per leg, keep source stats, and terminate against terrain',()=>{
 for(const id of ['returning-verdict','homeward-thorn']){
  const {sim,p,cast,context}=fixture(id);const enemy=sim.spawnEnemy('brute',70,0)!;enemy.hp=10000;assert.ok(cast());
  const counts=new Map<string,number>();
  const shots=sim.projectiles.map(s=>({damage:s.damage,sourceLevel:s.sourceLevel}));
  p.character.equipped.offhand=null;p.character.equipped.weapon=generateItem(88,1,'weapon','longsword','common');refreshCharacter(p);
  for(let i=0;i<360;i++)advanceProjectiles(sim.projectiles.filter(s=>s.life>0),1/120,{player:p,enemies:[enemy],world,schedule:()=>{},visible:context.visible,onScreen:()=>true,emit:()=>{},hurt:()=>{},damage:(_e,_n)=>{const phase=sim.projectiles.map(s=>s.effects?.returning?.leg).join();counts.set(phase,(counts.get(phase)??0)+1);}});
  assert.equal([...counts.values()].reduce((a,b)=>a+b,0),sim.projectiles.length*2,id);assert.ok(sim.projectiles.every(s=>s.life<=0));
  sim.projectiles.forEach((s,i)=>{assert.equal(s.damage,shots[i].damage);assert.equal(s.sourceLevel,shots[i].sourceLevel)});
  const wall=fixture(id,undefined,{...world,blocked:x=>x>=100});wall.cast();
  for(let i=0;i<360;i++)advanceProjectiles(wall.sim.projectiles.filter(s=>s.life>0),1/120,{player:wall.p,enemies:[],world:wall.context.world,schedule:()=>{},visible:()=>true,onScreen:()=>true,emit:()=>{},hurt:()=>{},damage:()=>{}});
  assert.ok(wall.sim.projectiles.every(s=>s.life<=0&&s.x<100));
 }
});
test('Cinderheart stores three complete paid casts, preserves their snapshots and never loses them to capacity',()=>{
 const fork=SKILL_SPECIALIZATIONS.find(v=>v.skill==='fireball'&&v.name==='Forked Flame')!;
 const {p,sim,cast}=fixture('cinderheart-testament',fork.id);
 for(let i=0;i<3;i++){p.castTime=0;assert.ok(cast());}assert.equal(sim.projectiles.length,0);assert.equal(p.skillEffects?.embers?.length,3);
 const snapshot=structuredClone(p.skillEffects!.embers!);p.castTime=0;const mana=p.mana;assert.equal(cast(),false);assert.equal(p.mana,mana);
 assert.equal(releaseStoredEmbers(p,8,16,()=>assert.fail()),false);assert.deepEqual(p.skillEffects!.embers,snapshot);
 const released:unknown[]=[];assert.equal(releaseStoredEmbers(p,9,16,s=>released.push(s)),true);assert.equal(released.length,9);assert.equal(p.skillEffects!.embers!.length,0);
 p.castTime=0;cast();p.character.equipped.offhand=null;refreshCharacter(p);assert.equal(p.skillEffects!.embers!.length,0);
 const expiry=fixture('cinderheart-testament');expiry.cast();advanceSkillEffects(expiry.p,21);assert.equal(expiry.p.skillEffects!.embers!.length,0);
});
test('Broken Seal only triggers on an enemy-depleted ward, with bounded non-critical non-leeching damage',()=>{
 const {p,cast}=fixture('broken-seal');cast();const ward=p.skillEffects!.ward!,capacity=ward.capacity;
 const first=mitigateSkillHit(p,capacity/2);assert.equal(first.burst,undefined);
 const broken=mitigateSkillHit(p,capacity+100);assert.ok(broken.burst);assert.equal(broken.burst.damage,Math.min(capacity,ward.rupture!.cap));
 assert.equal(broken.burst.offense.critChance,0);assert.equal(broken.burst.offense.lifeOnHit,0);assert.equal(mitigateSkillHit(p,100).burst,undefined);
 const expired=fixture('broken-seal');expired.cast();advanceSkillEffects(expired.p,30);assert.equal(mitigateSkillHit(expired.p,100).burst,undefined);
 const removed=fixture('broken-seal');removed.cast();removed.p.character.equipped.offhand=null;refreshCharacter(removed.p);assert.equal(mitigateSkillHit(removed.p,10000).burst,undefined);
});
test('Dervish repeats only while held, charges every revolution, stops on release/mana loss and permits full movement',()=>{
 const {sim,p}=fixture('dervish-grasp');const input:Input={moveX:1,moveY:0,aimX:500,aimY:0,attack:false,heal:false,dodge:false,skillSlot:null,heldSkillSlots:[0]};
 const start=p.mana;for(let i=0;i<360;i++)sim.update(1/120,input);
 assert.ok(p.x>400);assert.ok(p.mana<start-20);
 input.heldSkillSlots=[];for(let i=0;i<120;i++)sim.update(1/120,input);assert.equal(p.attack,null);
 p.mana=0;p.derived.manaRegeneration=0;input.heldSkillSlots=[0];for(let i=0;i<120;i++)sim.update(1/120,input);assert.equal(p.attack,null);
 assert.ok(hasUnique(p.character,'dervish-grasp'));
});
test('Chronicles retains first finder and highest level across re-pickups, retries, imports and removed gear',()=>{
 const a=freshChronicle('a','First',1),b=freshChronicle('b','Second',1),item=generateUnique(42,25,UNIQUES[0].id);
 discoverUnique(a,item,100);discoverUnique(a,item,200);discoverUnique(b,generateUnique(43,40,UNIQUES[0].id),300);
 const entry=uniqueCollection([...a.sources,...b.sources])[0];assert.deepEqual([entry.found,entry.firstAt,entry.finder,entry.level],[true,100,'First',40]);
 const ledger=emptyChronicle();ledger.sources={a:a.sources[0],b:b.sources[0]};const merged=mergeChronicles(ledger,ledger);
 assert.deepEqual(uniqueCollection(Object.values(merged.sources)),uniqueCollection([...a.sources,...b.sources]));
 assert.equal(uniqueCollection(a.sources).filter(u=>u.found).length,1);assert.equal(uniqueCollection([]).filter(u=>u.found).length,0);
});

const idle:Input={moveX:0,moveY:0,aimX:250,aimY:0,attack:false,heal:false,dodge:false,skillSlot:null,heldSkillSlots:[]};
test('runtime basic release preserves paid Fireball damage and source level exactly once',()=>{
 const {sim,p,cast}=fixture('cinderheart-testament');assert.ok(cast());
 const snapshot=structuredClone(p.skillEffects!.embers![0].shots[0]);
 p.level=30;p.castTime=0;p.stats.spellDamageMultiplier=9000;
 sim.update(1/120,{...idle,attack:true});
 for(let i=0;i<60;i++)sim.update(1/120,idle);
 const shots=sim.projectiles.filter(s=>s.skill==='fireball');
 assert.equal(shots.length,1);assert.equal(shots[0].damage,snapshot.definition.damage);assert.equal(shots[0].sourceLevel,25);
 assert.equal(p.skillEffects!.embers!.length,0);
 for(let i=0;i<120;i++)sim.update(1/120,{...idle,attack:true});
 assert.ok(sim.projectiles.filter(s=>s.skill==='fireball').every(s=>s.id===shots[0].id));
 const incompatible=fixture('cinderheart-testament');incompatible.cast();
 incompatible.p.character.equipped.weapon=generateItem(33,25,'weapon','longsword','common');refreshCharacter(incompatible.p);
 assert.equal(incompatible.p.skillEffects!.embers!.length,0);
});
test('runtime ward break damages nearby visible foes once and excludes distant or obscured foes',()=>{
 let wall=false;const terrain={...world,blocked:(x:number,y:number)=>wall&&x>30&&y>30};
 const {sim,p,cast}=fixture('broken-seal',undefined,terrain);
 const near=sim.spawnEnemy('brute',70,0)!,far=sim.spawnEnemy('brute',500,0)!,hidden=sim.spawnEnemy('brute',70,70)!;
 for(const e of [near,far,hidden])e.hp=e.maxHp=10000;wall=true;
 assert.ok(cast());const ward=p.skillEffects!.ward!,damage=Math.round(Math.min(ward.capacity,ward.rupture!.cap));
 sim.takeDamage(Math.ceil(ward.capacity)+1,0,25,'arcane');
 assert.equal(near.hp,10000-damage);assert.equal(far.hp,10000);assert.equal(hidden.hp,10000);
 assert.equal(sim.drainEvents().filter(e=>e.type==='blast'&&e.skill==='runicWard').length,1);
 p.invulnerable=0;sim.takeDamage(1,0,25,'arcane');assert.equal(near.hp,10000-damage);
});
test('only successful ground pickup records a Unique discovery, including after a full bag is cleared',()=>{
 const sim=new Simulation(world,{spawn:false,startX:0,startY:0});const p=sim.player;
 p.chronicle=freshChronicle('pickup','Finder',1);
 p.character.inventory=Array.from({length:120},(_,i)=>i<72?generateItem(900+i,1,'ring'):null);
 sim.groundItems.push({id:901,x:0,y:0,item:generateUnique(901,25,'dervish-grasp')});
 assert.ok(sim.requestGroundItem(901));sim.update(1/120,idle);
 assert.equal(uniqueCollection(p.chronicle.sources).filter(u=>u.found).length,0);
 p.character.inventory.fill(null);delete p.character.inventoryLayout;
 assert.equal(sim.requestGroundItem(901),null);sim.update(1/120,idle);
 assert.equal(sim.groundItems.length,0);assert.equal(uniqueCollection(p.chronicle.sources).filter(u=>u.found).length,1);
 const saved=sim.captureCheckpoint();const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(saved);
 assert.equal(uniqueCollection(restored.player.chronicle!.sources)[0].level,25);
});

test('a quick Whirlwind tap still starts one revolution after the held button is released',()=>{
 const {sim,p}=fixture('dervish-grasp');
 sim.update(1/120,{...idle,skillSlot:0,heldSkillSlots:[]});assert.equal(p.attack?.skill,'whirlwind');
 for(let i=0;i<240;i++)sim.update(1/120,idle);
 assert.equal(p.attack,null);
});
