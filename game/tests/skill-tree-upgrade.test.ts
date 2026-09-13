import assert from 'node:assert/strict';
import test from 'node:test';
import { Simulation } from '../src/simulation.ts';
import { CHARACTER_SAVE_VERSION, decodeCharacterSave, type CharacterSave } from '../src/character-save.ts';
import { SKILL_TREE_VERSION } from '../src/skill-tree.ts';
import { ATLAS_V2_NODE_IDS, ATLAS_V2_EDGES } from '../src/skill-tree-v2.ts';

const graph = ATLAS_V2_NODE_IDS.map(() => [] as number[]);
for (const [a, b] of ATLAS_V2_EDGES) { graph[a].push(b); graph[b].push(a); }
const root = ATLAS_V2_NODE_IDS.indexOf('origin'), paths = new Map([[root, [root]]]), queue = [root];
for (let i = 0; i < queue.length; i++) for (const next of graph[queue[i]]) if (!paths.has(next)) {
  paths.set(next, [...paths.get(queue[i])!, next]); queue.push(next);
}
const route = (id: string) => paths.get(ATLAS_V2_NODE_IDS.indexOf(id))!.map(index => ATLAS_V2_NODE_IDS[index]);
function ledger(save: CharacterSave) {
  const sheet = save.checkpoint.character;
  sheet.skillPoints = save.checkpoint.level - sheet.allocatedNodes.length
    - Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0);
}
function v2Save(): CharacterSave {
  const simulation = new Simulation({ blocked: () => false, move: (x: number, y: number) => ({ x, y }) }, { spawn: false });
  simulation.player.level = 100; simulation.player.character.statPoints = 495;
  const save: CharacterSave = { version: CHARACTER_SAVE_VERSION, id: 'atlas-upgrade', name: 'Atlas traveler', createdAt: 1, updatedAt: 2,
    worldSeed: 7319, worldVersion: 10, checkpoint: simulation.captureCheckpoint() };
  const sheet = save.checkpoint.character;
  sheet.treeVersion = 2;
  sheet.allocatedNodes = [...new Set(['specialization:fireball-fork', 'skill:sidestep', 'doctrine:casting:0'].flatMap(route))];
  sheet.skillRanks = { fireball: 20, sidestep: 4 };
  sheet.activeSkillRanks = { fireball: 7, sidestep: 2 };
  sheet.skillSpecializations = { fireball: 'fireball-fork' };
  sheet.skillSlots = ['fireball', 'sidestep', null, null, null];
  sheet.gold = 1234;
  Object.assign(save.checkpoint, { x: 91, y: -157, xp: 17, hp: 41, mana: 23, kills: 11, time: 243,
    clearedCamps: ['camp:v2'], skillCooldowns: { fireball: 2, sidestep: 1 } });
  ledger(save);
  return save;
}

test('the published version-two atlas refunds its exact points and preserves all other progress', () => {
  const original = v2Save(), bytes = JSON.stringify(original), upgraded = decodeCharacterSave(bytes);
  assert.ok(upgraded);
  const expected = structuredClone(original), sheet = expected.checkpoint.character;
  Object.assign(sheet, { treeVersion: SKILL_TREE_VERSION, treeRefunded: true, skillPoints: 99, allocatedNodes: ['origin'],
    skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, skillSlots: [null, null, null, null, null], arcaneOverload: false });
  expected.checkpoint.skillCooldowns = {};
  assert.deepEqual(upgraded, expected);
  assert.equal(JSON.stringify(original), bytes, 'reading never mutates the source record');
  assert.deepEqual(decodeCharacterSave(JSON.stringify(upgraded)), upgraded, 'the same refund cannot happen twice');
});

test('an untouched version-two origin upgrades without announcing a refund', () => {
  const save = v2Save(), sheet = save.checkpoint.character;
  Object.assign(sheet, { allocatedNodes: ['origin'], skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {},
    skillSlots: [null, null, null, null, null], arcaneOverload: false });
  save.checkpoint.skillCooldowns = {}; ledger(save);
  const upgraded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(upgraded); assert.equal(upgraded.checkpoint.character.treeVersion, SKILL_TREE_VERSION);
  assert.equal(upgraded.checkpoint.character.treeRefunded, undefined);
});

test('version-two corruption cannot be laundered into a fresh refunded build', () => {
  const corruptions: Record<string, (save: CharacterSave) => void> = {
    unknownNode: save => { save.checkpoint.character.allocatedNodes.push('road:missing:1'); ledger(save); },
    disconnected: save => { save.checkpoint.character.allocatedNodes = save.checkpoint.character.allocatedNodes.filter(id => id !== 'road:crucible:1'); ledger(save); },
    duplicateNode: save => { save.checkpoint.character.allocatedNodes.push('origin'); ledger(save); },
    unpaidPoints: save => { save.checkpoint.character.skillPoints++; },
    excessiveRanks: save => { save.checkpoint.character.skillRanks.fireball = 21; ledger(save); },
    unownedRanks: save => { save.checkpoint.character.skillRanks.tempest = 3; ledger(save); },
    excessiveCastingRank: save => { save.checkpoint.character.activeSkillRanks.fireball = 21; },
    wrongTechnique: save => { save.checkpoint.character.skillSpecializations.fireball = 'arc-focus'; },
    unownedTechnique: save => { save.checkpoint.character.skillSpecializations.fireball = 'fireball-impact'; },
    competingDoctrines: save => { save.checkpoint.character.allocatedNodes.push('doctrine:casting:1'); ledger(save); },
    unownedBinding: save => { save.checkpoint.character.skillSlots[2] = 'tempest'; },
    duplicateBinding: save => { save.checkpoint.character.skillSlots[2] = 'fireball'; },
    unownedCooldown: save => { save.checkpoint.skillCooldowns.tempest = 1; },
    negativeCooldown: save => { save.checkpoint.skillCooldowns.fireball = -1; },
    unownedOverload: save => { save.checkpoint.character.arcaneOverload = true; },
    unknownTree: save => { save.checkpoint.character.treeVersion = 999; },
  };
  for (const [name, corrupt] of Object.entries(corruptions)) {
    const save = v2Save(); corrupt(save);
    assert.equal(decodeCharacterSave(JSON.stringify(save)), null, name);
  }
});
