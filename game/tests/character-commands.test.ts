import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { generateItem } from '../src/items.ts';
import { SKILL_NODES } from '../src/skill-tree.ts';

const make = () => new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;

test('equipment commands commit gear and combat projections together without healing', () => {
  const player = make(), original = player.equipment.mainHand;
  const item = generateItem(41, 1, 'weapon', 'ember-staff');
  item.implicit = { maxHp: 50, spellDamagePercent: 20 }; item.affixes = [];
  player.character.inventory[47] = item; player.hp = 40; player.mana = 20;
  assert.equal(executeCharacterCommand(player, { type: 'equip', index: 47 }).ok, true);
  assert.equal(player.character.equipped.weapon, item);
  assert.equal(player.equipment.mainHand, item.weapon);
  assert.notEqual(player.equipment.mainHand, original);
  assert.equal(player.maxHp, 150); assert.equal(player.stats.spellDamageMultiplier, 1.2);
  assert.equal(player.hp, 40); assert.equal(player.mana, 20);
  player.hp = 140;
  assert.equal(executeCharacterCommand(player, { type: 'unequip', slot: 'weapon' }).ok, true);
  assert.equal(player.equipment.mainHand.family, 'unarmed');
  assert.equal(player.maxHp, 100); assert.equal(player.hp, 100, 'removing life clamps to the new maximum');
  assert.equal(player.stats.spellDamageMultiplier, 1);
});

test('full-pack hand conflicts fail atomically, including derived state and resources', () => {
  const player = make();
  player.character.inventory[47] = generateItem(71, 1, 'weapon', 'longsword');
  assert.ok(executeCharacterCommand(player, { type: 'equip', index: 47 }).ok);
  player.character.inventory[47] = generateItem(72, 1, 'shield', 'iron-buckler');
  assert.ok(executeCharacterCommand(player, { type: 'equip', index: 47 }).ok);
  player.character.inventory = Array.from({ length: 48 }, (_, index) => generateItem(1000 + index, 1, 'head'));
  player.character.inventory[0] = generateItem(90, 1, 'weapon', 'ember-staff');
  const before = structuredClone(player), derived = player.derived;
  assert.equal(executeCharacterCommand(player, { type: 'equip', index: 0 }).ok, false);
  assert.deepEqual(player, before); assert.equal(player.derived, derived);
});

test('attribute and tree commands spend one point and immediately refresh the character', () => {
  const player = make(); player.character.statPoints = 1; player.hp = 35;
  assert.ok(executeCharacterCommand(player, { type: 'allocateAttribute', attribute: 'vitality' }).ok);
  assert.equal(player.character.statPoints, 0); assert.equal(player.derived.attributes.vitality, 11);
  assert.equal(player.maxHp, 106); assert.equal(player.hp, 35);
  const before = structuredClone(player);
  assert.equal(executeCharacterCommand(player, { type: 'allocateAttribute', attribute: 'strength' }).ok, false);
  assert.deepEqual(player, before);
  const adjacent = SKILL_NODES.get('origin')!.neighbors[0];
  player.character.skillPoints = 1;
  const derived = player.derived;
  assert.ok(executeCharacterCommand(player, { type: 'allocateNode', id: adjacent }).ok);
  assert.equal(player.character.skillPoints, 0); assert.ok(player.character.allocatedNodes.includes(adjacent));
  assert.notEqual(player.derived, derived); assert.equal(player.hp, 35);
  const allocated = structuredClone(player);
  assert.equal(executeCharacterCommand(player, { type: 'allocateNode', id: adjacent }).ok, false);
  assert.deepEqual(player, allocated);
});

test('skill assignment commands preserve cooldowns and reject locked or invalid slots atomically', () => {
  const player = make(); player.character.allocatedNodes.push('skill:fireball');
  player.skillCooldowns.fireball = .6;
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 0, skill: 'fireball' }).ok);
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 3, skill: 'fireball' }).ok);
  assert.equal(player.character.skillSlots[0], null); assert.equal(player.character.skillSlots[3], 'fireball');
  assert.equal(player.skillCooldowns.fireball, .6);
  const before = structuredClone(player);
  for (const command of [{ type: 'assignSkill', slot: 3, skill: 'meteor' }, { type: 'assignSkill', slot: 9, skill: null }] as const) {
    assert.equal(executeCharacterCommand(player, command).ok, false); assert.deepEqual(player, before);
  }
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 3, skill: null }).ok);
  assert.equal(player.character.skillSlots[3], null); assert.equal(player.skillCooldowns.fireball, .6);
});

test('bag commands preserve item identities, and failed equip requirements leave every projection intact', () => {
  const player = make(); const first = player.character.inventory[0], second = player.character.inventory[1];
  assert.ok(executeCharacterCommand(player, { type: 'moveItem', from: 0, to: 1 }).ok);
  assert.equal(player.character.inventory[0], second); assert.equal(player.character.inventory[1], first);
  player.character.inventory[47] = generateItem(194, 20, 'weapon', 'longsword');
  const before = structuredClone(player);
  assert.equal(executeCharacterCommand(player, { type: 'equip', index: 47 }).ok, false);
  assert.deepEqual(player, before);
  assert.equal(executeCharacterCommand(player, { type: 'moveItem', from: -1, to: 2 }).ok, false);
  assert.deepEqual(player, before);
});
