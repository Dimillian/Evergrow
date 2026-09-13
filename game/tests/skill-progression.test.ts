import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_EXECUTION, skillUtilityLabel } from '../src/skill-execution-content.ts';
import { resolveSkill, learnedSkillRank, activeSkillRank, maximumSkillRank, SKILL_SPECIALIZATIONS, specializationNode, OVERLOAD_NODE } from '../src/skill-progression.ts';
import { CHARACTER_SAVE_VERSION, decodeCharacterSave } from '../src/character-save.ts';
import { PREVIOUS_NODE_IDS, PREVIOUS_EDGES } from '../src/skill-tree-previous.ts';
import { SKILL_TREE_VERSION } from '../src/skill-tree.ts';
const world={blocked:()=>false,move:(x:number,y:number)=>({x,y})};
function setup(){const sim=new Simulation(world,{spawn:false});sim.player.level=100;sim.player.character.skillPoints=99;sim.player.character.statPoints=495;const command=(cmd:Parameters<typeof executeCharacterCommand>[1])=>executeCharacterCommand(sim.player,cmd);return{sim,p:sim.player,sheet:sim.player.character,command,unlock:(id:string)=>assert.ok(command({type:'allocateNode',id}).ok,id)};}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const record=(sim:Simulation)=>({version:CHARACTER_SAVE_VERSION,id:'rank-test',name:'Rank test',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:10,checkpoint:sim.captureCheckpoint()});
test('rank purchases conserve points without healing or resetting cooldowns and stop at twenty',()=>{
 const{p,sheet,command,unlock}=setup();assert.equal(command({type:'upgradeSkill',skill:'fireball'}).ok,false);unlock('skill:fireball');p.hp=41;p.mana=23;p.skillCooldowns.fireball=2;const points=sheet.skillPoints;
 for(let rank=2;rank<=20;rank++){assert.ok(command({type:'upgradeSkill',skill:'fireball'}).ok);assert.equal(learnedSkillRank(sheet,'fireball'),rank);}
 assert.equal(maximumSkillRank(sheet,'fireball'),20);assert.equal(sheet.skillPoints,points-19);assert.equal(command({type:'upgradeSkill',skill:'fireball'}).ok,false);assert.equal(p.hp,41);assert.equal(p.mana,23);assert.equal(p.skillCooldowns.fireball,2);
 assert.ok(command({type:'configureSkill',skill:'fireball',rank:1,specialization:null}).ok);assert.equal(activeSkillRank(sheet,'fireball'),1);assert.equal(command({type:'configureSkill',skill:'fireball',rank:21,specialization:null}).ok,false);
});
test('ranks reward damage per mana and never lengthen cooldowns; utility ranks improve their role',()=>{
 const stats={manaCostMultiplier:1,cooldownMultiplier:1};for(const skill of Object.values(SKILL_DEFINITIONS)){
  const a=resolveSkill(skill.id,stats,undefined,1),b=resolveSkill(skill.id,stats,undefined,3);close(b.mana,Math.round(a.mana*1.03*10)/10);assert.equal(b.cooldown,a.cooldown);if(a.damageMultiplier)close(b.damageMultiplier/a.damageMultiplier,1.1);else assert.notDeepEqual(a.recipe,b.recipe);
 }
 assert.equal(resolveSkill('bulwark',{...stats,cooldownMultiplier:0}).cooldown,4);
 for(const id of ['rallyOfIron','ghostHunt','cataclysm','tempest','absoluteZero'] as const)assert.equal(resolveSkill(id,{...stats,cooldownMultiplier:0}).cooldown,12);
});
test('every Technique costs one point after its skill and selection changes no binding, rank, resource or cooldown',()=>{
 const base=JSON.stringify(SKILL_EXECUTION);for(const v of SKILL_SPECIALIZATIONS){const{p,sheet,command,unlock}=setup();unlock(`skill:${v.skill}`);const points=sheet.skillPoints;p.hp=41;p.mana=23;p.skillCooldowns[v.skill]=7;assert.equal(command({type:'configureSkill',skill:v.skill,rank:1,specialization:v.id}).ok,false);unlock(specializationNode(v.id));assert.equal(sheet.skillPoints,points-1);assert.equal(sheet.skillSpecializations[v.skill],v.id);assert.equal(resolveSkill(v.skill,p.derived,sheet).variant?.id,v.id);assert.ok(command({type:'configureSkill',skill:v.skill,rank:1,specialization:null}).ok);assert.equal(p.hp,41);assert.equal(p.mana,23);assert.equal(p.skillCooldowns[v.skill],7);}
 assert.equal(JSON.stringify(SKILL_EXECUTION),base);
});
test('Overload is an explicit optional Arcana damage-for-mana tradeoff',()=>{
 const{p,sheet,command,unlock}=setup();assert.equal(command({type:'overload',enabled:true}).ok,false);unlock(OVERLOAD_NODE);const before=resolveSkill('tempest',p.derived,sheet);assert.equal(sheet.arcaneOverload,false);command({type:'overload',enabled:true});const after=resolveSkill('tempest',p.derived,sheet);close(after.damageMultiplier,before.damageMultiplier*1.3);assert.ok(after.mana>before.mana&&after.upkeep>before.upkeep);assert.deepEqual(resolveSkill('cleave',p.derived,sheet),resolveSkill('cleave',p.derived,{...sheet,arcaneOverload:false}));
});
test('current saves round-trip paid ranks and reject unpaid, unknown and competing Doctrine power',()=>{
 const{sim,command,unlock}=setup();unlock('skill:fireball');unlock(specializationNode('fireball-fork'));unlock('doctrine:casting:0');command({type:'upgradeSkill',skill:'fireball'});const save=record(sim);assert.ok(decodeCharacterSave(JSON.stringify(save)));
 for(const mutate of[(s:typeof save)=>{s.checkpoint.character.skillPoints++;},(s:typeof save)=>{s.checkpoint.character.skillRanks.fireball=21;},(s:typeof save)=>{s.checkpoint.character.skillSpecializations.fireball='arc-focus';},(s:typeof save)=>{s.checkpoint.character.allocatedNodes.push('doctrine:casting:1');s.checkpoint.character.skillPoints--;},(s:typeof save)=>{s.checkpoint.character.treeVersion=99;}]){const bad=structuredClone(save);mutate(bad);assert.equal(decodeCharacterSave(JSON.stringify(bad)),null);}
});
test('previous tree refunds nodes and paid ranks on a copy, preserving character and world progress',()=>{
 const{sim}=setup(),save=record(sim),s=save.checkpoint.character;delete s.treeVersion;
 const graph=PREVIOUS_NODE_IDS.map(()=>[] as number[]);for(const[a,b]of PREVIOUS_EDGES){graph[a].push(b);graph[b].push(a);}const root=PREVIOUS_NODE_IDS.indexOf('origin'),target=PREVIOUS_NODE_IDS.indexOf('skill:fireball'),routes=new Map([[root,[root]]]),queue=[root];for(let i=0;i<queue.length;i++)for(const next of graph[queue[i]])if(!routes.has(next)){routes.set(next,[...routes.get(queue[i])!,next]);queue.push(next);}
 s.allocatedNodes=routes.get(target)!.map(i=>PREVIOUS_NODE_IDS[i]);s.skillRanks={fireball:5};s.activeSkillRanks={fireball:3};s.skillSlots[0]='fireball';s.skillPoints=99-(s.allocatedNodes.length-1)-4;save.checkpoint.skillCooldowns={fireball:2};
 const original=JSON.stringify(save),upgraded=decodeCharacterSave(original);assert.ok(upgraded);assert.equal(JSON.stringify(save),original);const current=upgraded.checkpoint.character;assert.equal(current.treeVersion,SKILL_TREE_VERSION);assert.equal(current.treeRefunded,true);assert.equal(current.skillPoints,99);assert.deepEqual(current.allocatedNodes,['origin']);assert.deepEqual(current.skillSlots,[null,null,null,null,null]);assert.deepEqual(current.equipped,s.equipped);assert.deepEqual(current.inventory,s.inventory);assert.equal(upgraded.checkpoint.level,100);assert.equal(upgraded.checkpoint.x,save.checkpoint.x);
 const bad=JSON.parse(original);bad.checkpoint.character.allocatedNodes.push('unknown');bad.checkpoint.character.skillPoints--;assert.equal(decodeCharacterSave(JSON.stringify(bad)),null);
 const disconnected=JSON.parse(original);disconnected.checkpoint.character.allocatedNodes=['origin','skill:fireball'];disconnected.checkpoint.character.skillPoints=94;assert.equal(decodeCharacterSave(JSON.stringify(disconnected)),null);
});
test('gear ranks taper without changing purchased ranks, costs or cooldowns',()=>{
 const{p,sheet,unlock}=setup();unlock('skill:fireball');sheet.skillRanks.fireball=3;const base=resolveSkill('fireball',p.derived,sheet),three=resolveSkill('fireball',{...p.derived,skillBonuses:{fireball:3}},sheet),ten=resolveSkill('fireball',{...p.derived,skillBonuses:{fireball:10}},sheet);close(three.damageMultiplier/base.damageMultiplier,1+.36/1.1);close(ten.damageMultiplier/base.damageMultiplier,1+.71/1.1);assert.equal(ten.mana,base.mana);assert.equal(ten.cooldown,base.cooldown);assert.equal(sheet.skillRanks.fireball,3);
});

test('all thirty skills and ninety Techniques give useful, bounded upgrades through rank twenty',()=>{
 const {p,sheet}=setup();
 const immutable=JSON.stringify(SKILL_EXECUTION);
 for(const skill of Object.values(SKILL_DEFINITIONS)){
  for(const variant of [undefined,...SKILL_SPECIALIZATIONS.filter(v=>v.skill===skill.id)]){
   sheet.allocatedNodes=['origin',`skill:${skill.id}`,...(variant?[specializationNode(variant.id)]:[])];
   sheet.skillSpecializations=variant?{[skill.id]:variant.id}:{};
   for(const gearRanks of [0,10]){
    const stats={...p.derived,manaCostMultiplier:1,cooldownMultiplier:1,skillBonuses:{[skill.id]:gearRanks}};
    let previous=resolveSkill(skill.id,stats,sheet,1);
    for(let rank=2;rank<=20;rank++){
     const next=resolveSkill(skill.id,stats,sheet,rank),r=next.recipe;
     assert.equal(next.cooldown,previous.cooldown);
     assert.ok(next.mana>=previous.mana);
     if(previous.damageMultiplier)assert.ok(next.damageMultiplier>previous.damageMultiplier,`${skill.id} damage at ${rank}`);
     const label=skillUtilityLabel(skill.id,r);
     if(label)assert.notEqual(label,skillUtilityLabel(skill.id,previous.recipe),`${variant?.id??skill.id} utility at ${rank}`);
     assert.ok(next.damageMultiplier>previous.damageMultiplier||label,`${skill.id} has a useful upgrade`);
     if(r.kind==='guard')assert.ok(r.reduction<=.9);
     if(r.kind==='ward')assert.ok(r.fraction<=.35);
     if(r.kind==='stance')assert.ok(r.reduction<=.5);
     if(r.kind==='radial'&&r.shelter)assert.ok(r.shelter.reduction<=.75);
     previous=next;
    }
   }
  }
 }
 assert.equal(JSON.stringify(SKILL_EXECUTION),immutable);
});
test('rank-three saves retain purchases and assignments, then round-trip rank twenty with downcasting',()=>{
 const {sim,sheet,command,unlock}=setup();unlock('skill:fireball');
 for(let rank=2;rank<=3;rank++)assert.ok(command({type:'upgradeSkill',skill:'fireball'}).ok);
 sheet.skillSlots[0]='fireball';
 const before=record(sim),old=decodeCharacterSave(JSON.stringify(before));assert.ok(old);
 assert.deepEqual(old.checkpoint.character,before.checkpoint.character);
 for(let rank=4;rank<=20;rank++)assert.ok(command({type:'upgradeSkill',skill:'fireball'}).ok);
 assert.ok(command({type:'configureSkill',skill:'fireball',rank:3,specialization:null}).ok);
 const current=decodeCharacterSave(JSON.stringify(record(sim)));assert.ok(current);
 assert.equal(current.checkpoint.character.skillRanks.fireball,20);
 assert.equal(activeSkillRank(current.checkpoint.character,'fireball'),3);
 assert.equal(current.checkpoint.character.skillSlots[0],'fireball');
 assert.equal(current.checkpoint.character.skillPoints,before.checkpoint.character.skillPoints-17);
 const stats={manaCostMultiplier:1,cooldownMultiplier:1};
 const first=resolveSkill('fireball',stats,undefined,1),last=resolveSkill('fireball',stats,undefined,20);
 close(last.damageMultiplier/first.damageMultiplier,1.95);assert.equal(last.mana,15.4);
});
