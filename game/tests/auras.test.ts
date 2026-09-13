import test from 'node:test';
import assert from 'node:assert/strict';
import { AURA_IDS,AURAS,resolveAura,admittedAuras } from '../src/aura-content.ts';
import { advanceAuras,auraPower,manaCapacity,bloodOathHit } from '../src/auras.ts';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { buildSkillRoutes } from '../src/skill-tree-routes.ts';
import { activeBuffs } from '../src/active-buffs.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { generateItem } from '../src/items.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { CHARACTER_SAVE_VERSION,decodeCharacterSave } from '../src/character-save.ts';
import { SkillStudy } from '../src/tools/skill-scene.ts';
import type { AuraId } from '../src/aura-content.ts';
const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const input={moveX:0,moveY:0,aimX:300,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};
function fixture(...ids:AuraId[]){
 const sim=new Simulation(world,{spawn:false,startX:0,startY:0}),p=sim.player;
 p.level=500;p.character.skillPoints=499;p.character.statPoints=2495;
 p.character.equipped.weapon=generateItem(42,25,'weapon','longsword','common');p.character.equipped.offhand=null;
 for(const id of ids){assert.ok(executeCharacterCommand(p,{type:'allocateNode',id:`skill:${id}`}).ok);assert.ok(executeCharacterCommand(p,{type:'assignSkill',slot:ids.indexOf(id),skill:id}).ok);}
 refreshCharacter(p);p.mana=manaCapacity(p);p.hp=p.maxHp;
 return {sim,p,command:(c:Parameters<typeof executeCharacterCommand>[1])=>executeCharacterCommand(p,c)};
}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('aura paths reach the requested costs, with twenty worthwhile ranks',()=>{
 const paths=buildSkillRoutes(new Set(['origin']));
 for(const id of AURA_IDS){assert.equal(paths.get(`skill:${id}`)!.cost,AURAS[id].points);const {p,command}=fixture(id),points=p.character.skillPoints;
  for(let rank=2;rank<=20;rank++){assert.ok(command({type:'upgradeSkill',skill:id}).ok);assert.ok(resolveAura(id,rank).power>resolveAura(id,rank-1).power);assert.ok(resolveAura(id,rank).reservation<resolveAura(id,rank-1).reservation);}
  assert.equal(p.character.skillPoints,points-19);assert.equal(command({type:'upgradeSkill',skill:id}).ok,false);close(auraPower(p,id),resolveAura(id,20).power);
 }
});
test('reservation rejects overcommit atomically, never refills on unassign and caps recovery',()=>{
 const {sim,p,command}=fixture('ironroot','bloodOath');assert.equal(p.auras!.reservation,80);
 assert.ok(command({type:'allocateNode',id:'skill:stillwater'}).ok);const before=structuredClone(p.character);
 assert.equal(command({type:'assignSkill',slot:2,skill:'stillwater'}).ok,false);assert.deepEqual(p.character,before);
 const capacity=manaCapacity(p);p.mana=capacity-1;for(let i=0;i<240;i++)sim.update(1/120,input);assert.equal(p.mana,capacity);
 assert.ok(command({type:'assignSkill',slot:0,skill:null}).ok);assert.equal(p.mana,capacity);assert.ok(manaCapacity(p)>capacity);assert.equal(auraPower(p,'ironroot'),0);
 assert.ok(command({type:'assignSkill',slot:2,skill:'bloodOath'}).ok);assert.equal(p.auras!.reservation,45);assert.equal(p.character.skillSlots[1],null);
});
test('downranking cannot overreserve and malformed projections consistently admit the same auras',()=>{
 const {p,command}=fixture('ironroot','stillwater');assert.ok(command({type:'allocateNode',id:'skill:hawkeye'}).ok);
 for(let i=0;i<19;i++)assert.ok(command({type:'upgradeSkill',skill:'ironroot'}).ok);
 assert.ok(command({type:'assignSkill',slot:2,skill:'hawkeye'}).ok);const before=structuredClone(p.character);
 assert.equal(command({type:'configureSkill',skill:'ironroot',rank:1,specialization:null}).ok,false);assert.deepEqual(p.character,before);
 p.character.skillSlots=['stillwater','hawkeye','ironroot',null,null];delete p.character.activeSkillRanks.ironroot;delete p.character.skillRanks.ironroot;refreshCharacter(p);
 assert.deepEqual(admittedAuras(p.character),['stillwater','hawkeye']);assert.equal(auraPower(p,'ironroot'),0);
});
test('auras restore from real checkpoints; transient buildup does not',()=>{
 const {p,sim}=fixture('ironroot','bloodOath');p.auras!.blood={target:1,stacks:5,remaining:3};
 const save={version:CHARACTER_SAVE_VERSION,id:'aura-save',name:'Aura',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:10,checkpoint:sim.captureCheckpoint()};
 const parsed=decodeCharacterSave(JSON.stringify(save));assert.ok(parsed);
 const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(parsed.checkpoint);
 assert.equal(restored.player.auras!.reservation,80);assert.equal(restored.player.auras!.blood,undefined);assert.ok(restored.player.mana<=manaCapacity(restored.player));
});
test('Ironroot affects actual armor and incoming physical damage, never elemental hits',()=>{
 const on=fixture('ironroot'),off=fixture();off.p.character=structuredClone(on.p.character);off.p.character.skillSlots.fill(null);refreshCharacter(off.p);
 close(on.p.derived.armor,off.p.derived.armor*1.4);
 for(const kind of ['physical','fire'] as const){on.p.hp=on.p.maxHp;off.p.hp=off.p.maxHp;on.p.derived.blockChance=off.p.derived.blockChance=0;
  on.sim.takeDamage(100,0,500,kind);off.sim.takeDamage(100,0,500,kind);
  const a=on.p.maxHp-on.p.hp,b=off.p.maxHp-off.p.hp;if(kind==='physical')assert.ok(a<b);else assert.equal(a,b);
 }
});
test('Blood Oath rewards repeated direct melee hits and expires or resets with target changes',()=>{
 const {p,sim}=fixture('bloodOath'),e=sim.spawnEnemy('brute',30,0)!,other=sim.spawnEnemy('brute',50,0)!;
 const context={player:p,enemies:sim.enemies,random:()=>1,visible:()=>true,emit:()=>{},killed:()=>{}};
 const losses:number[]=[];for(let i=0;i<7;i++){e.hp=10000;damageEnemy(e,100,0,true,context);losses.push(10000-e.hp);}
 assert.deepEqual(losses,[100,104,108,112,116,120,120]);assert.equal(p.auras!.blood!.stacks,5);
 const buff=activeBuffs(p).find(b=>b.id==='blood-oath-stacks')!;assert.equal(buff.charges,5);assert.ok(buff.summary.includes('+20%'));
 assert.equal(bloodOathHit(p,other,false),1);assert.equal(p.auras!.blood!.target,e.id);
 assert.equal(bloodOathHit(p,other,true),1);assert.equal(p.auras!.blood!.stacks,1);
 advanceAuras(p,sim.enemies,3.1,false,()=>true,()=>{},()=>{});assert.equal(p.auras!.blood,undefined);
});
test('Stillwater costs recover progressively, clear on motion and do not compound on refresh',()=>{
 const {p}=fixture('stillwater'),base=p.derived.manaCostMultiplier;
 advanceAuras(p,[],.6,false,()=>true,()=>{},()=>{});close(p.derived.manaCostMultiplier,base*.94);
 assert.equal(activeBuffs(p).find(b=>b.id==='stillwater-focus')!.progress,.5);
 advanceAuras(p,[],.6,false,()=>true,()=>{},()=>{});close(p.derived.manaCostMultiplier,base*.88);
 refreshCharacter(p);advanceAuras(p,[],0,false,()=>true,()=>{},()=>{});close(p.derived.manaCostMultiplier,base*.88);
 advanceAuras(p,[],0,true,()=>true,()=>{},()=>{});close(p.derived.manaCostMultiplier,base);assert.ok(!activeBuffs(p).some(b=>b.id==='stillwater-focus'));
});
test('Elemental Spikes cycle real damage, obey reach and sight, and do not trigger on-hit effects',()=>{
 const {sim,p}=fixture('elementalSpikes');const e=sim.spawnEnemy('brute',30,0)!;e.hp=e.maxHp=100000;e.stagger=100;
 p.hp-=10;p.derived.lifeOnHit=1000;p.derived.lifeRegeneration=0;p.derived.critChance=1;
 const hp=p.hp,expected=Math.round(deriveAttackStats(p.stats,p.equipment.mainHand).damage*.3),styles:string[]=[];
 for(let i=0;i<217;i++){sim.update(1/120,input);for(const event of sim.drainEvents())if(event.type==='blast'&&event.skill==='elementalSpikes')styles.push(event.style!);}
 assert.deepEqual(styles,['fire','frost','lightning']);assert.equal(e.maxHp-e.hp,expected*3);assert.equal(p.hp,hp);assert.equal(e.burnTime,0);
 let hits=0;advanceAuras(p,[e],1,false,()=>false,()=>hits++,()=>{});assert.equal(hits,0);
 e.x=300;advanceAuras(p,[e],1,false,()=>true,()=>hits++,()=>{});assert.equal(hits,0);
});
test('Thornbound slows in range; Resonance applies only to the matching elemental portion and never stacks',()=>{
 const {sim,p}=fixture('thornbound','elementalResonance'),e=sim.spawnEnemy('brute',30,0)!;
 advanceAuras(p,[e],1,false,()=>true,()=>{},()=>{});assert.ok(e.slowTime>0);assert.ok(e.slowFactor<1);
 const context={player:p,enemies:sim.enemies,random:()=>1,visible:()=>true,emit:()=>{},killed:()=>{}};
 e.hp=10000;damageEnemy(e,100,0,false,context,false,'fire',40);assert.equal(e.hp,9900);
 damageEnemy(e,100,0,false,context,false,'fire',40);assert.equal(e.hp,9796);
 damageEnemy(e,100,0,false,context,false,'frost',40);assert.equal(e.hp,9696);
 assert.equal(e.auraExposure!.fire!.power,10);assert.equal(e.auraExposure!.frost!.power,10);
});
test('Hawkeye snapshots extra arrow speed, reach and distant critical chance on actual releases',()=>{
 const make=(baseline:boolean)=>new SkillStudy(world,{skill:'hawkeye',rank:1,specialization:'',weapon:'crescent-recurve',facing:0,targets:'none',enemy:'brute',x:0,y:0,scenario:'followup',baseline});
 const on=make(false),off=make(true);for(let i=0;i<200&&!on.simulation.projectiles.length;i++){on.step();off.step();}
 const a=on.simulation.projectiles[0],b=off.simulation.projectiles[0];assert.ok(a&&b);close(Math.hypot(a.vx,a.vy)/Math.hypot(b.vx,b.vy),1.2);assert.equal(a.maxLife,b.maxLife);close(a.effects!.hawkeye!.crit,.1);
 on.simulation.player.character.skillSlots.fill(null);refreshCharacter(on.simulation.player);close(a.effects!.hawkeye!.crit,.1);
});

test('pressing an assigned aura never casts, pays mana or starts an action',()=>{
 for(const id of AURA_IDS){const {p,sim}=fixture(id);p.derived.manaRegeneration=0;const mana=p.mana;sim.drainEvents();
 sim.update(1/120,{...input,skillSlot:0});assert.equal(p.mana,mana);assert.equal(p.attack,null);assert.equal(p.castTime,0);assert.equal(p.skillCooldowns[id],undefined);
 assert.ok(!sim.drainEvents().some(e=>e.type==='cast'||e.type==='swing'));assert.ok(activeBuffs(p).some(b=>b.id===`aura:${id}`));
 }
});
