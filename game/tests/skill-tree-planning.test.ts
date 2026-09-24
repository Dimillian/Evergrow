import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAtlasSkillFilter } from '../src/skill-tree-filters.ts';
import { SKILL_TREE, SKILL_NODES } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { searchSkillAtlas } from '../src/skill-tree-search.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import { Simulation } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { executeSkillRespec } from '../src/skill-respec-command.ts';
import { RESPEC_GOLD_PER_POINT, respecPoints } from '../src/skill-respec.ts';
import { specializationNode } from '../src/skill-progression.ts';
import type { Equipment } from '../src/model.ts';

const weapon = (id: string) => WEAPON_PROFILES.find(w => w.id === id)!;
const equipment: Equipment = { mainHand: weapon('longsword'), offHand: null };
const node = (id: string) => SKILL_NODES.get(`skill:${id}`)!;

test('Skills highlights every assignable unlock, including auras, without including its passive or Technique branches', () => {
  const matches = SKILL_TREE.nodes.filter(n => matchesAtlasSkillFilter(n, true, 'all', equipment));
  assert.deepEqual(new Set(matches.map(n => n.skill)), new Set(Object.keys(SKILL_DEFINITIONS)));
  assert.equal(matches.length, Object.keys(SKILL_DEFINITIONS).length);
  assert.ok(SKILL_TREE.nodes.every(n => matchesAtlasSkillFilter(n, false, 'all', equipment)));
});

test('weapon filters use compatible families and retain unrestricted utility skills', () => {
  for (const family of ['sword', 'axe', 'mace', 'dagger', 'bow', 'staff', 'wand', 'shield'] as const)
    assert.ok(matchesAtlasSkillFilter(node('brace'), true, family, equipment), family);
  assert.ok(matchesAtlasSkillFilter(node('lunge'), true, 'sword', equipment));
  assert.ok(!matchesAtlasSkillFilter(node('lunge'), true, 'mace', equipment));
  assert.ok(matchesAtlasSkillFilter(node('earthshatter'), true, 'mace', equipment));
  assert.ok(!matchesAtlasSkillFilter(node('earthshatter'), true, 'sword', equipment));
  assert.ok(matchesAtlasSkillFilter(node('fireball'), true, 'wand', equipment));
  assert.ok(!matchesAtlasSkillFilter(node('fireball'), true, 'bow', equipment));
  assert.ok(matchesAtlasSkillFilter(node('shieldBash'), true, 'shield', equipment));
  assert.ok(!matchesAtlasSkillFilter(node('shieldBash'), true, 'sword', equipment));
});

test('equipped filter accounts for offhand wands and unusable two-handed shield combinations', () => {
  const dual: Equipment = { ...equipment, offHand: { kind: 'weapon', weapon: weapon('cinder-wand') } };
  assert.ok(matchesAtlasSkillFilter(node('fireball'), true, 'equipped', dual));
  assert.ok(matchesAtlasSkillFilter(node('cleave'), true, 'equipped', dual));
  const shield: Equipment = { ...equipment, offHand: { kind: 'shield', shield: SHIELD_PROFILES[0] } };
  assert.ok(matchesAtlasSkillFilter(node('shieldBash'), true, 'equipped', shield));
  assert.ok(!matchesAtlasSkillFilter(node('shieldBash'), true, 'equipped', { ...shield, mainHand: weapon('greatblade') }));
});

test('skill highlighting intersects search and preserves complete paths through unhighlighted passives', () => {
  const matches = searchSkillAtlas('fireball').filter(({ node }) => matchesAtlasSkillFilter(node, true, 'staff', equipment));
  assert.deepEqual(matches.map(m => m.node.id), ['skill:fireball']);
  assert.equal(searchSkillAtlas('fireball').filter(({ node }) => matchesAtlasSkillFilter(node, true, 'bow', equipment)).length, 0);
  const route = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:meteor');
  assert.ok(route.includes('skill:meteor'));
  assert.ok(route.some(id => !matchesAtlasSkillFilter(SKILL_NODES.get(id)!, true, 'staff', equipment)));
});

function makeBuild() {
  const player = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;
  player.level = 100; player.character.skillPoints = 99;
  for (const id of ['skill:fireball', specializationNode('fireball-fork'), 'keystone:arcane-overload']) {
    if (SKILL_NODES.has(id)) assert.ok(executeCharacterCommand(player, { type: 'allocateNode', id }).ok);
  }
  for (let i = 0; i < 4; i++) assert.ok(executeCharacterCommand(player, { type: 'upgradeSkill', skill: 'fireball' }).ok);
  assert.ok(executeCharacterCommand(player, { type: 'configureSkill', skill: 'fireball', rank: 2, specialization: 'fireball-fork' }).ok);
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 0, skill: 'fireball' }).ok);
  player.character.gold = 100000;
  player.skillCooldowns.fireball = 3;
  player.hp = 30; player.mana = 7;
  return player;
}

test('full respec refunds nodes and purchased ranks exactly once, preserving other progress and never healing', () => {
  const p = makeBuild(), points = respecPoints(p.character), before = structuredClone(p);
  assert.ok(executeCharacterCommand(p, { type: 'respecSkills', points }).ok);
  assert.equal(p.character.skillPoints, 99);
  assert.equal(p.character.gold, before.character.gold! - points * RESPEC_GOLD_PER_POINT);
  assert.deepEqual(p.character.allocatedNodes, ['origin']);
  assert.deepEqual(p.character.skillRanks, {}); assert.deepEqual(p.character.activeSkillRanks, {});
  assert.deepEqual(p.character.skillSpecializations, {}); assert.deepEqual(p.character.skillSlots, Array(5).fill(null));
  assert.deepEqual(p.skillCooldowns, {}); assert.equal(p.character.arcaneOverload, false);
  assert.deepEqual(p.character.equipped, before.character.equipped); assert.deepEqual(p.character.attributes, before.character.attributes);
  assert.deepEqual(p.character.inventory, before.character.inventory);
  assert.equal(p.hp, 30); assert.equal(p.mana, 7); assert.equal(p.level, before.level);
  const reset = structuredClone(p);
  assert.equal(executeCharacterCommand(p, { type: 'respecSkills', points }).ok, false);
  assert.deepEqual(p, reset);
});

test('unaffordable and stale respec quotes leave all player state untouched', () => {
  for (const stale of [true, false]) {
    const p = makeBuild(), points = respecPoints(p.character);
    if (!stale) p.character.gold = points * RESPEC_GOLD_PER_POINT - 1;
    const before = structuredClone(p);
    assert.equal(executeCharacterCommand(p, { type: 'respecSkills', points: points + (stale ? 1 : 0) }).ok, false);
    assert.deepEqual(p, before);
  }
});

test('respec persistence receives one complete candidate; rejection or exceptions preserve live state', async () => {
  const p = makeBuild(), points = respecPoints(p.character), before = structuredClone(p);
  const result = await executeSkillRespec(p, { type: 'respecSkills', points }, async (sheet, hp, mana) => {
    assert.deepEqual(p, before);
    assert.deepEqual(sheet.allocatedNodes, ['origin']); assert.equal(sheet.skillPoints, 99);
    assert.equal(sheet.gold, before.character.gold! - points * RESPEC_GOLD_PER_POINT);
    assert.equal(hp, 30); assert.equal(mana, 7);
    return { ok: false, message: 'Disk full' };
  });
  assert.equal(result.ok, false); assert.deepEqual(p, before);
  await assert.rejects(executeSkillRespec(p, { type: 'respecSkills', points }, async () => { throw new Error('Disconnected'); }));
  assert.deepEqual(p, before);
  assert.ok((await executeSkillRespec(p, { type: 'respecSkills', points }, async () => ({ ok: true }))).ok);
  assert.equal(p.character.skillPoints, 99); assert.equal(p.character.gold, before.character.gold! - points * RESPEC_GOLD_PER_POINT);
});
