import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { equipBest, planBestEquipment } from '../src/inventory-tools.ts';
import type { Item, ItemKind, StatModifiers } from '../src/character-types.ts';

// Explicit stat fixtures isolate ranking from random item rolls and the displayed power estimate.
function gear(seed: number, kind: ItemKind, modifiers: StatModifiers, profile?: string): Item {
  const item = generateItem(seed, 1, kind, profile, 'common');
  item.implicit = {};
  item.affixes = Object.entries(modifiers).map(([stat, value]) => ({ stat: stat as keyof StatModifiers, value, name: stat }));
  return item;
}

test('Auto Equip chooses relevant multi-stat bonuses over a higher power number for physical and caster gloves', () => {
  for (const caster of [false, true]) {
    const sheet = createCharacterSheet(caster ? 'wand' : 'sword-shield');
    const physical = gear(6001, 'gloves', { attackSpeedPercent: 20, damagePercent: 15 });
    const magic = gear(6002, 'gloves', { castSpeedPercent: 20, spellDamagePercent: 15 });
    const best = caster ? magic : physical, other = caster ? physical : magic;
    other.power = 999; best.power = 1;
    addInventoryItem(sheet, other); addInventoryItem(sheet, best);
    assert.ok(equipBest(sheet, 1).ok);
    assert.equal(sheet.equipped.gloves, best);
    assert.equal(equipBest(sheet, 1).ok, false, 'repeated clicks keep the same gear');
  }
});

test('Auto Equip favors movement on boots, protection on chest armor, and mana support on headgear', () => {
  const sheet = createCharacterSheet('wand');
  const boots = gear(6011, 'boots', { moveSpeedPercent: 15, maxHp: 4 });
  const chest = gear(6012, 'chest', { armor: 30, maxHp: 30 });
  const head = gear(6013, 'head', { maxMana: 30, manaCostPercent: 10 });
  for (const item of [gear(6014, 'boots', { armor: 5, maxHp: 8 }), gear(6015, 'chest', { maxMana: 30 }),
    gear(6016, 'head', { armor: 5, maxHp: 8 }), boots, chest, head]) addInventoryItem(sheet, item);
  const before = structuredClone(sheet);
  assert.ok(planBestEquipment(sheet, 1).ok);
  assert.deepEqual(sheet, before, 'ranking never mutates the live sheet');
  assert.ok(equipBest(sheet, 1).ok);
  assert.equal(sheet.equipped.boots, boots);
  assert.equal(sheet.equipped.chest, chest);
  assert.equal(sheet.equipped.head, head);
});

test('Auto Equip compares actual weapon damage and cadence, including elemental bonuses', () => {
  const sheet = createCharacterSheet('sword-shield');
  const slow = gear(6021, 'weapon', {}, 'longsword');
  const quick = gear(6022, 'weapon', {}, 'longsword');
  slow.weapon!.damage = 50; slow.weapon!.baseAttacksPerSecond = 1;
  quick.weapon!.damage = 30; quick.weapon!.baseAttacksPerSecond = 2;
  quick.weapon!.enchantment = { element: 'fire', damage: 10 };
  slow.power = 999; quick.power = 1;
  addInventoryItem(sheet, slow); addInventoryItem(sheet, quick);
  assert.ok(equipBest(sheet, 1).ok);
  assert.equal(sheet.equipped.weapon, quick);
});

test('Auto Equip preserves a capped stat tie and fills both ring slots without moving the same rings again', () => {
  const sheet = createCharacterSheet('sword-shield');
  sheet.equipped.boots = gear(6031, 'boots', { moveSpeedPercent: 75 });
  addInventoryItem(sheet, gear(6032, 'boots', { moveSpeedPercent: 100 }));
  const before = structuredClone(sheet);
  assert.equal(equipBest(sheet, 1).ok, false);
  assert.deepEqual(sheet, before, 'a larger capped roll is not an upgrade');
  const first = gear(6033, 'ring', { damagePercent: 20, maxHp: 10 });
  const second = gear(6034, 'ring', { allResistance: 8, maxHp: 20 });
  addInventoryItem(sheet, first); addInventoryItem(sheet, second);
  assert.ok(equipBest(sheet, 1).ok);
  assert.deepEqual(new Set([sheet.equipped.ring1, sheet.equipped.ring2]), new Set([first, second]));
  assert.equal(equipBest(sheet, 1).ok, false);
});

test('Auto Equip counts a displaced shield when comparing a two-handed weapon', () => {
  const sheet = createCharacterSheet('sword-shield');
  sheet.equipped.offhand!.implicit = { maxHp: 500, allResistance: 30 };
  const twoHanded = gear(6041, 'weapon', {}, 'greatblade');
  twoHanded.weapon!.damage = sheet.equipped.weapon!.weapon!.damage + 1;
  twoHanded.weapon!.baseAttacksPerSecond = sheet.equipped.weapon!.weapon!.baseAttacksPerSecond;
  addInventoryItem(sheet, twoHanded);
  const before = structuredClone(sheet);
  assert.equal(equipBest(sheet, 1).ok, false);
  assert.deepEqual(sheet, before, 'a small damage gain must not ignore a large defensive loss');
});
