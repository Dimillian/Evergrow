import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { addInventoryItem, equipItem, moveInventoryItem, unequipItem } from '../src/inventory.ts';
import { equipBest, planBestEquipment, matchesInventoryFilter, inventoryGridSources, sortInventory } from '../src/inventory-tools.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { Simulation } from '../src/simulation.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import { directionalControl } from '../src/ui-navigation.ts';

const ids = (sheet: CharacterSheet) => [...sheet.inventory, ...Object.values(sheet.equipped)].filter(i => i !== null).map(i => i.id).sort();

test('Equip Best upgrades rings and armor, respects level and stow capacity, and preserves all items in a full bag', () => {
  const sheet = createCharacterSheet('sword-shield');
  sheet.inventory = Array.from({ length: 64 }, (_, i) => generateItem(4000 + i, 1, 'head', undefined, 'common'));
  const sword = generateItem(81, 1, 'weapon', 'longsword', 'rare');
  const staff = generateItem(82, 1, 'weapon', 'ember-staff', 'legendary');
  const ring1 = generateItem(83, 1, 'ring', undefined, 'legendary');
  const ring2 = generateItem(84, 1, 'ring', undefined, 'epic');
  const locked = generateItem(85, 20, 'head', undefined, 'legendary');
  sheet.inventory.splice(0, 5, sword, staff, ring1, ring2, locked);
  const before = ids(sheet), offhand = sheet.equipped.offhand;
  assert.ok(equipBest(sheet, 1).ok);
  assert.equal(sheet.equipped.weapon, sword);
  assert.equal(sheet.equipped.offhand, offhand);
  assert.deepEqual(new Set([sheet.equipped.ring1?.id, sheet.equipped.ring2?.id]), new Set([ring1.id, ring2.id]));
  assert.notEqual(sheet.equipped.head?.id, locked.id);
  assert.deepEqual(ids(sheet), before);
  const after = structuredClone(sheet);
  assert.equal(equipBest(sheet, 1).ok, false, 'ties keep the equipped item');
  assert.deepEqual(sheet, after);
});

test('a different best weapon type requires a choice before any equipment changes', () => {
  const sheet = createCharacterSheet('sword-shield');
  const staff = generateItem(181, 1, 'weapon', 'ember-staff', 'legendary');
  const ring = generateItem(182, 1, 'ring', undefined, 'rare');
  addInventoryItem(sheet, staff); addInventoryItem(sheet, ring);
  const before = structuredClone(sheet), plan = planBestEquipment(sheet, 1);
  assert.ok(plan.ok); assert.equal(plan.weaponChange?.next, staff);
  assert.equal(plan.weaponChange?.current, sheet.equipped.weapon);
  assert.deepEqual(sheet, before, 'opening or canceling the preview changes no items');
  assert.equal(equipBest(sheet, 1).ok, false);
  assert.deepEqual(sheet, before, 'the command cannot silently bypass the warning');
});

test('Keep current weapon only preserves that exact weapon while upgrading other gear', () => {
  const sheet = createCharacterSheet('sword-shield'), weapon = sheet.equipped.weapon;
  addInventoryItem(sheet, generateItem(191, 1, 'weapon', 'ember-staff', 'legendary'));
  addInventoryItem(sheet, generateItem(192, 1, 'weapon', 'longsword', 'epic'));
  const ring = generateItem(193, 1, 'ring', undefined, 'rare'); addInventoryItem(sheet, ring);
  const before = ids(sheet);
  assert.ok(equipBest(sheet, 1, 'keep').ok);
  assert.equal(sheet.equipped.weapon, weapon); assert.equal(sheet.equipped.ring1, ring);
  assert.deepEqual(ids(sheet), before);
});

test('Equip anyway replaces weapon type and safely stows the shield without healing or losing skills', () => {
  const player = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;
  player.character = createCharacterSheet('sword-shield');
  const sheet = player.character, shield = sheet.equipped.offhand;
  const staff = generateItem(201, 1, 'weapon', 'ember-staff', 'legendary'); addInventoryItem(sheet, staff);
  const before = ids(sheet), assignments = [...sheet.skillSlots]; player.hp = 29; player.mana = 11;
  assert.ok(executeCharacterCommand(player, { type: 'equipBest', choice: 'replace' }).ok);
  assert.equal(sheet.equipped.weapon, staff); assert.equal(sheet.equipped.offhand, null);
  assert.ok(sheet.inventory.includes(shield)); assert.deepEqual(ids(sheet), before);
  assert.deepEqual(sheet.skillSlots, assignments); assert.equal(player.hp, 29); assert.equal(player.mana, 11);
});

test('same-type weapon upgrades need no warning; locked weapons and invalid choices never bypass validation', () => {
  const sheet = createCharacterSheet('sword-shield');
  const sword = generateItem(211, 1, 'weapon', 'longsword', 'rare'); addInventoryItem(sheet, sword);
  addInventoryItem(sheet, generateItem(212, 30, 'weapon', 'ember-staff', 'legendary'));
  const plan = planBestEquipment(sheet, 1); assert.ok(plan.ok); assert.equal(plan.weaponChange, null);
  assert.ok(equipBest(sheet, 1).ok); assert.equal(sheet.equipped.weapon, sword);
  const before = structuredClone(sheet);
  assert.equal(equipBest(sheet, 1, 'invalid' as never).ok, false); assert.deepEqual(sheet, before);
});

test('Equip Best retains two-hand reservations and current resource amounts', () => {
  const player = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;
  const sheet = player.character;
  addInventoryItem(sheet, generateItem(91, 1, 'weapon', 'ember-staff', 'common'));
  assert.ok(executeCharacterCommand(player, { type: 'equip', index: 0 }).ok);
  const staff = generateItem(92, 1, 'weapon', 'ember-staff', 'legendary');
  addInventoryItem(sheet, staff); addInventoryItem(sheet, generateItem(93, 1, 'shield', 'vigil-kite', 'legendary'));
  player.hp = 31; player.mana = 13;
  assert.ok(executeCharacterCommand(player, { type: 'equipBest' }).ok);
  assert.equal(sheet.equipped.weapon, staff); assert.equal(sheet.equipped.offhand, null);
  assert.equal(player.equipment.mainHand, staff.weapon);
  assert.equal(player.hp, 31); assert.equal(player.mana, 13);
});

test('sorts compact occupied cells without losing items, and recency survives sorting, moves and equipment swaps', () => {
  const sheet = createCharacterSheet();
  const old = generateItem(31, 1, 'ring', undefined, 'legendary');
  const middle = generateItem(32, 1, 'head', undefined, 'rare');
  const newest = generateItem(33, 1, 'weapon', 'longsword', 'common');
  for (const item of [old, middle, newest]) assert.ok(addInventoryItem(sheet, item));
  const before = ids(sheet);
  moveInventoryItem(sheet, 2, 63);
  sortInventory(sheet, 'rarity'); assert.equal(sheet.inventory[0], old);
  sortInventory(sheet, 'type'); assert.equal(sheet.inventory[0], newest);
  sortInventory(sheet, 'recent'); assert.deepEqual(sheet.inventory.slice(0, 3), [newest, middle, old]);
  assert.ok(equipItem(sheet, 1, 1).ok); assert.ok(unequipItem(sheet, 'head').ok);
  sortInventory(sheet, 'recent'); assert.deepEqual(sheet.inventory.slice(0, 3), [newest, middle, old]);
  assert.deepEqual(ids(sheet), before);
  const stable = structuredClone(sheet);
  assert.equal(sortInventory(sheet, 'unknown' as never).ok, false); assert.deepEqual(sheet, stable);
});

test('failed pickups do not change history and old sold identities are pruned on acquisition', () => {
  const sheet = createCharacterSheet(), item = generateItem(61, 1, 'ring');
  assert.ok(addInventoryItem(sheet, item));
  assert.equal(addInventoryItem(sheet, item), false); assert.deepEqual(sheet.recentItems, [item.id]);
  sheet.inventory[0] = null;
  const next = generateItem(62, 1, 'ring'); addInventoryItem(sheet, next);
  assert.deepEqual(sheet.recentItems, [next.id]);
});

test('multiple types and rarities use OR within each group and AND between groups', () => {
  const ring = generateItem(11, 1, 'ring', undefined, 'rare');
  const sword = generateItem(12, 1, 'weapon', 'longsword', 'epic');
  const staff = generateItem(13, 1, 'weapon', 'ember-staff');
  assert.ok(matchesInventoryFilter(ring, new Set(['jewelry', 'weapons']), new Set(['rare', 'epic'])));
  assert.ok(matchesInventoryFilter(sword, new Set(['jewelry', 'weapons']), new Set(['rare', 'epic'])));
  assert.equal(matchesInventoryFilter(ring, new Set(['armor', 'weapons']), new Set(['rare', 'epic'])), false);
  assert.equal(matchesInventoryFilter(ring, new Set(['jewelry']), new Set(['common', 'epic'])), false);
  assert.ok(matchesInventoryFilter(sword, new Set(['offhand']), new Set()));
  assert.equal(matchesInventoryFilter(staff, new Set(['offhand']), new Set()), false);
  assert.ok(matchesInventoryFilter(ring, new Set(), new Set()));
  assert.equal(matchesInventoryFilter(null, new Set(), new Set()), false);
});

test('every primary sort uses the other two priorities rather than item level or name', () => {
  const sheet = createCharacterSheet();
  const a = generateItem(801, 1, 'ring', undefined, 'rare');
  const b = generateItem(802, 1, 'head', undefined, 'rare');
  const c = generateItem(803, 3, 'head', undefined, 'rare');
  const d = generateItem(804, 1, 'weapon', 'longsword', 'epic');
  const e = generateItem(805, 1, 'ring', undefined, 'epic');
  const f = generateItem(806, 1, 'weapon', 'longsword', 'common');
  sheet.inventory.splice(0, 6, f, c, e, b, d, a); sheet.recentItems = [a.id, b.id, c.id];
  sortInventory(sheet, 'rarity'); assert.deepEqual(sheet.inventory.slice(0, 6), [d, e, b, c, a, f]);
  sortInventory(sheet, 'type'); assert.deepEqual(sheet.inventory.slice(0, 6), [d, f, b, c, e, a]);
  sortInventory(sheet, 'recent'); assert.deepEqual(sheet.inventory.slice(0, 6), [a, b, c, d, e, f]);
});

test('filtered projection preserves all 64 cells and actual source indices without exposing excluded items as empty destinations', () => {
  const sheet = createCharacterSheet();
  sheet.inventory[4] = generateItem(821, 1, 'ring', undefined, 'rare');
  sheet.inventory[8] = generateItem(822, 1, 'head', undefined, 'epic');
  sheet.inventory[63] = generateItem(823, 1, 'weapon', 'longsword', 'rare');
  const before = structuredClone(sheet);
  const view = inventoryGridSources(sheet.inventory, new Set(['jewelry', 'armor']), new Set(['rare']));
  assert.equal(view.length, 64); assert.equal(view[0], 4);
  assert.equal(view.filter(index => index === null).length, 2);
  assert.ok(!view.includes(8) && !view.includes(63));
  for (const source of view.slice(1)) if (source !== null) assert.equal(sheet.inventory[source], null);
  assert.deepEqual(inventoryGridSources(sheet.inventory, new Set(), new Set()), Array.from({ length: 64 }, (_, i) => i));
  assert.deepEqual(sheet, before);
  sheet.inventory = Array.from({ length: 64 }, (_, i) => generateItem(900 + i, 1, 'ring'));
  assert.deepEqual(inventoryGridSources(sheet.inventory, new Set(['weapons']), new Set()), Array(64).fill(null), 'even zero matches in a full bag retains the full grid');
});

test('spatial navigation follows bag rows and reaches toolbar controls above the first row', () => {
  const rects = [{ left: 0, top: 0, width: 100, height: 44 }, ...Array.from({ length: 16 }, (_, i) => ({ left: i % 8 * 50, top: 60 + Math.floor(i / 8) * 50, width: 44, height: 44 }))];
  assert.equal(directionalControl(rects, 1, 'ArrowRight'), 2);
  assert.equal(directionalControl(rects, 1, 'ArrowDown'), 9);
  assert.equal(directionalControl(rects, 9, 'ArrowUp'), 1);
  assert.equal(directionalControl(rects, 1, 'ArrowUp'), 0);
  assert.equal(directionalControl(rects, 1, 'ArrowLeft'), 1);
});
