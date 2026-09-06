import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { resolveSkill, learnedSkillRank, activeSkillRank, maximumSkillRank, SKILL_SPECIALIZATIONS, masteryNode, specializationNode, OVERLOAD_NODE } from '../src/skill-progression.ts';
import { CHARACTER_SAVE_VERSION, decodeCharacterSave } from '../src/character-save.ts';
import type { SkillId } from '../src/character-types.ts';

const world = { blocked: () => false, move: (x: number, y: number) => ({ x, y }) };
function setup() {
  const sim = new Simulation(world, { spawn: false });
  sim.player.level = 100; sim.player.character.skillPoints = 99; sim.player.character.statPoints = 495;
  const command = (cmd: Parameters<typeof executeCharacterCommand>[1]) => executeCharacterCommand(sim.player, cmd);
  const unlock = (id: string) => assert.ok(command({ type: 'allocateNode', id }).ok, id);
  return { sim, p: sim.player, sheet: sim.player.character, command, unlock };
}
const close = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-8, `${a} ≠ ${b}`);

test('rank purchases conserve points, do not heal or reset cooldowns, and stop at the mastery ceiling', () => {
  const { p, sheet, command, unlock } = setup();
  const before = JSON.stringify(sheet);
  assert.equal(command({ type: 'upgradeSkill', skill: 'fireball' }).ok, false);
  assert.equal(JSON.stringify(sheet), before);
  unlock('skill:fireball'); p.hp = 41; p.mana = 23; p.skillCooldowns.fireball = 2;
  const points = sheet.skillPoints;
  for (let rank = 2; rank <= 5; rank++) {
    assert.ok(command({ type: 'upgradeSkill', skill: 'fireball' }).ok);
    assert.equal(learnedSkillRank(sheet,'fireball'), rank); assert.equal(activeSkillRank(sheet,'fireball'),rank);
  }
  assert.equal(sheet.skillPoints, points-4);
  assert.equal(command({ type: 'upgradeSkill', skill: 'fireball' }).ok, false);
  unlock(masteryNode('fireball'));
  assert.equal(maximumSkillRank(sheet,'fireball'),7);
  assert.ok(command({ type: 'upgradeSkill', skill: 'fireball' }).ok);
  assert.ok(command({ type: 'upgradeSkill', skill: 'fireball' }).ok);
  assert.equal(command({ type: 'upgradeSkill', skill: 'fireball' }).ok,false);
  assert.equal(p.hp,41); assert.equal(p.mana,23); assert.equal(p.skillCooldowns.fireball,2);
});

test('lower casting ranks are reversible, free, and cannot exceed purchased ranks', () => {
  const { p, sheet, command, unlock } = setup(); unlock('skill:fireball');
  command({ type:'upgradeSkill',skill:'fireball' });
  const points=sheet.skillPoints;
  assert.ok(command({ type:'configureSkill',skill:'fireball',rank:1,specialization:null }).ok);
  command({ type:'upgradeSkill',skill:'fireball' });
  assert.equal(activeSkillRank(sheet,'fireball'),1);
  const before=JSON.stringify(sheet);
  assert.equal(command({ type:'configureSkill',skill:'fireball',rank:4,specialization:null }).ok,false);
  assert.equal(JSON.stringify(sheet),before);
  assert.ok(command({ type:'configureSkill',skill:'fireball',rank:3,specialization:null }).ok);
  assert.equal(sheet.skillPoints,points-1);
  close(resolveSkill('fireball',p.derived,sheet).damageMultiplier,SKILL_DEFINITIONS.fireball.damageMultiplier*1.3);
});

test('every skill rank has a finite resource tradeoff and basic skills remain cooldown free', () => {
  const stats={manaCostMultiplier:1,cooldownMultiplier:1};
  for (const skill of Object.values(SKILL_DEFINITIONS)) {
    let previous=resolveSkill(skill.id,stats,undefined,1);
    for(let rank=2;rank<=7;rank++) {
      const next=resolveSkill(skill.id,stats,undefined,rank);
      assert.ok(Number.isFinite(next.mana) && next.mana>previous.mana);
      if(skill.id==='bulwark') { assert.equal(next.recipe.kind,'guard'); if(next.recipe.kind==='guard') assert.ok(next.recipe.reduction<=.9); }
      else assert.ok(next.damageMultiplier>previous.damageMultiplier);
      if(skill.tier==='basic') assert.equal(next.cooldown,0); else assert.ok(next.cooldown>previous.cooldown);
      previous=next;
    }
  }
  assert.equal(resolveSkill('bulwark',{...stats,cooldownMultiplier:0}).cooldown,4);
  for(const id of ['cataclysm','tempest','absoluteZero'] as const) assert.equal(resolveSkill(id,{...stats,cooldownMultiplier:0}).cooldown,12);
});

test('specializations require their own node, remain exclusive, and never mutate base recipes', () => {
  const base=JSON.stringify(SKILL_EXECUTION);
  for(const variant of SKILL_SPECIALIZATIONS) {
    const {p,sheet,command,unlock}=setup(); unlock(`skill:${variant.skill}`);
    assert.equal(command({type:'configureSkill',skill:variant.skill,rank:1,specialization:variant.id}).ok,false);
    unlock(specializationNode(variant.id));
    assert.ok(command({type:'configureSkill',skill:variant.skill,rank:1,specialization:variant.id}).ok);
    const resolved=resolveSkill(variant.skill,p.derived,sheet);
    assert.equal(resolved.variant?.id,variant.id);
    close(resolved.damageMultiplier,SKILL_DEFINITIONS[variant.skill].damageMultiplier*variant.damage);
    assert.ok(command({type:'configureSkill',skill:variant.skill,rank:1,specialization:null}).ok);
    assert.equal(resolveSkill(variant.skill,p.derived,sheet).variant,undefined);
  }
  assert.equal(JSON.stringify(SKILL_EXECUTION),base);
  for(const skill of Object.values(SKILL_DEFINITIONS).filter(s=>s.tier==='basic')) assert.equal(SKILL_SPECIALIZATIONS.filter(s=>s.skill===skill.id).length,2);
});

test('Overload is optional and raises only Arcana damage, casting costs and storm upkeep', () => {
  const {p,sheet,command,unlock}=setup();
  assert.equal(command({type:'overload',enabled:true}).ok,false);
  const before=resolveSkill('tempest',p.derived,sheet), melee=resolveSkill('cleave',p.derived,sheet);
  unlock(OVERLOAD_NODE); assert.equal(sheet.arcaneOverload,false);
  command({type:'overload',enabled:true});
  const after=resolveSkill('tempest',p.derived,sheet);
  close(after.damageMultiplier,before.damageMultiplier*1.3);
  assert.ok(after.mana>before.mana && after.upkeep>before.upkeep);
  assert.deepEqual(resolveSkill('cleave',p.derived,sheet),resolveSkill('cleave',p.derived,{...sheet,arcaneOverload:false}));
  assert.equal(melee.damageMultiplier,resolveSkill('cleave',p.derived,sheet).damageMultiplier);
});

test('current saves round-trip purchased ranks and configurations, rejecting unowned or unpaid power', () => {
  const {sim,command,unlock}=setup();
  unlock('skill:fireball'); unlock(specializationNode('fireball-fork')); unlock(masteryNode('fireball')); unlock(OVERLOAD_NODE);
  for(let rank=2;rank<=7;rank++) assert.ok(command({type:'upgradeSkill',skill:'fireball'}).ok);
  command({type:'configureSkill',skill:'fireball',rank:4,specialization:'fireball-fork'});
  command({type:'overload',enabled:true});
  const record={version:CHARACTER_SAVE_VERSION,id:'rank-test',name:'Rank test',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:4,checkpoint:sim.captureCheckpoint()};
  const saved=decodeCharacterSave(JSON.stringify(record)); assert.ok(saved);
  const fresh=new Simulation(world,{spawn:false}); fresh.restoreCheckpoint(saved.checkpoint);
  assert.deepEqual(fresh.player.character,sim.player.character);
  for(const mutate of [
    (s:typeof record)=>{s.checkpoint.character.skillPoints++;},
    (s:typeof record)=>{s.checkpoint.character.skillRanks.fireball=8;},
    (s:typeof record)=>{s.checkpoint.character.activeSkillRanks.fireball=8;},
    (s:typeof record)=>{s.checkpoint.character.skillSpecializations.fireball='arc-focus';},
    (s:typeof record)=>{s.checkpoint.character.skillRanks.cleave=2;},
    (s:typeof record)=>{s.checkpoint.character.allocatedNodes=s.checkpoint.character.allocatedNodes.filter(id=>id!==masteryNode('fireball'));},
  ]) { const invalid=structuredClone(record); mutate(invalid); assert.equal(decodeCharacterSave(JSON.stringify(invalid)),null); }
  assert.equal(decodeCharacterSave(JSON.stringify({...record,version:2})),null);
});

test('development groups are frozen, bounded and attached to actual skill nodes', () => {
  for(const cluster of SKILL_TREE.clusters.filter(c=>!c.id.includes(':terrace:'))) {
    assert.ok(Object.isFrozen(cluster));
    const members=SKILL_TREE.nodes.filter(n=>n.cluster===cluster.id); assert.ok(members.length);
    for(const n of members) assert.ok(Math.hypot(n.x-cluster.x,n.y-cluster.y)<cluster.radius);
  }
  const masteries=SKILL_TREE.nodes.filter(n=>n.mastery);
  assert.equal(masteries.length,17);
  for(const n of masteries) assert.ok(SKILL_TREE.nodes.some(s=>s.skill===n.mastery));
  assert.equal(SKILL_TREE.nodes.filter(n=>n.skill && SKILL_DEFINITIONS[n.skill as SkillId].tier==='ultimate').length,3);
});
