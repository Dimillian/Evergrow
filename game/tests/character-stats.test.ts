import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { allocateAttribute } from '../src/inventory.ts';
import type { StatModifiers } from '../src/character-types.ts';

test('neutral starter gear preserves current basic attack and resource values', () => {
  const stats = deriveCharacterStats(createCharacterSheet());
  assert.equal(stats.maxHp, 100); assert.equal(stats.maxMana, 100);
  assert.equal(stats.attackDamageMultiplier, 1); assert.equal(stats.attackSpeedMultiplier, 1);
  assert.equal(stats.manaRegeneration, 9); assert.equal(stats.moveSpeedMultiplier, 1);
  assert.equal(stats.critChance, 0); assert.equal(stats.critMultiplier, 1.5);
  assert.equal(stats.armor, 0); assert.equal(stats.damageReduction, 0);
  assert.equal(stats.cooldownMultiplier, 1); assert.equal(stats.lifeOnHit, 0);
  assert.equal(stats.blockChance, 0); assert.equal(stats.blockReduction, 0);
});

test('assigned attributes drive actual combat resources, damage and cadence', () => {
  const sheet = createCharacterSheet(); sheet.statPoints = 20;
  for (const attribute of ['strength', 'dexterity', 'intelligence', 'vitality'] as const) {
    for (let count = 0; count < 5; count++) allocateAttribute(sheet, attribute);
  }
  const stats = deriveCharacterStats(sheet);
  assert.equal(stats.attackDamageMultiplier, 1.1); assert.equal(stats.attackSpeedMultiplier, 1.025);
  assert.equal(stats.critChance, .0075); assert.equal(stats.maxMana, 120);
  assert.equal(stats.spellDamageMultiplier, 1.15); assert.equal(stats.maxHp, 130);
  assert.equal(sheet.statPoints, 0);
});

test('the same bonuses derive identically from equipment or tree nodes', () => {
  const modifiers: StatModifiers = { strength: 5, dexterity: 5, intelligence: 5, vitality: 5,
    maxHp: 10, maxMana: 11, armor: 20, damagePercent: 4, attackSpeedPercent: 5,
    critChance: 3, critDamage: 15, moveSpeedPercent: 8, spellDamagePercent: 7,
    manaRegen: 2, lifeRegen: 1, cooldownPercent: 10, lifeOnHit: 2 };
  const gearSheet = createCharacterSheet();
  gearSheet.equipped.ring1 = generateItem(54, 1, 'ring');
  gearSheet.equipped.ring1.implicit = modifiers; gearSheet.equipped.ring1.affixes = [];
  const gearStats = deriveCharacterStats(gearSheet), treeStats = deriveCharacterStats(createCharacterSheet(), modifiers);
  assert.deepEqual(gearStats, treeStats);
  assert.ok(gearStats.damageReduction > 0); assert.equal(gearStats.lifeOnHit, 2);
  assert.equal(gearStats.cooldownMultiplier, .9);
  assert.equal(gearStats.lifeRegeneration, 1); assert.equal(gearStats.manaRegeneration, 11);
});

test('attribute and direct bonuses accumulate once across multiple items and the tree', () => {
  const sheet = createCharacterSheet();
  sheet.equipped.head!.implicit = { strength: 2, damagePercent: 10, maxHp: 10 };
  sheet.equipped.head!.affixes = [{ name: 'Might', stat: 'strength', value: 3 }];
  sheet.equipped.chest!.implicit = { vitality: 2, armor: 120 };
  const stats = deriveCharacterStats(sheet, { strength: 3, damagePercent: 4, vitality: 1 });
  assert.equal(stats.attributes.strength, 18); assert.equal(stats.attributes.vitality, 13);
  assert.equal(stats.attackDamageMultiplier, 1.3); assert.equal(stats.maxHp, 128);
  assert.equal(stats.damageReduction, .5);
  assert.equal(sheet.attributes.strength, 10); assert.equal(sheet.attributes.vitality, 10);
});

test('extreme build bonuses are bounded before they reach combat and malformed modifiers are ignored', () => {
  const sheet = createCharacterSheet();
  const capped = deriveCharacterStats(sheet, { armor: 1e12, critChance: 1e12, critDamage: 1e12,
    attackSpeedPercent: 1e12, moveSpeedPercent: 1e12, cooldownPercent: 1e12 });
  assert.equal(capped.damageReduction, .8); assert.equal(capped.critChance, .75); assert.equal(capped.critMultiplier, 5);
  assert.equal(capped.attackSpeedMultiplier, 6); assert.equal(capped.moveSpeedMultiplier, 1.75); assert.equal(capped.cooldownMultiplier, .25);
  const invalid = deriveCharacterStats(sheet, { damagePercent: NaN, maxHp: Infinity, critChance: -Infinity });
  assert.equal(invalid.attackDamageMultiplier, 1); assert.equal(invalid.maxHp, 100); assert.equal(invalid.critChance, 0);
  sheet.equipped.head!.implicit = { maxHp: Number.MAX_VALUE };
  sheet.equipped.chest!.implicit = { maxHp: Number.MAX_VALUE };
  assert.equal(deriveCharacterStats(sheet).maxHp, 1e9);
});


test('block modifiers require a usable equipped shield and combine as percentage points exactly once', () => {
  const sheet = createCharacterSheet();
  const bonuses: StatModifiers = { blockChance: 5, blockReduction: 10 };
  assert.equal(deriveCharacterStats(sheet, bonuses).blockChance, 0);
  sheet.equipped.offhand = generateItem(144, 1, 'shield', 'iron-buckler');
  sheet.equipped.offhand.affixes = [];
  assert.equal(deriveCharacterStats(sheet, bonuses).blockChance, 0, 'two-handed weapon prevents shield use');
  sheet.equipped.weapon = null;
  const stats = deriveCharacterStats(sheet, bonuses);
  assert.equal(stats.blockChance, .25); assert.equal(stats.blockReduction, .65);
  const bounded = deriveCharacterStats(sheet, { blockChance: 10000, blockReduction: 10000 });
  assert.equal(bounded.blockChance, .75); assert.equal(bounded.blockReduction, .9);
  sheet.equipped.offhand = generateItem(144, 1, 'weapon', 'rondel-dagger');
  assert.equal(deriveCharacterStats(sheet, bonuses).blockChance, 0);
});

test('gear and tree combine independent cast speed and mana efficiency with bounded reduction', () => {
  const sheet = createCharacterSheet();
  sheet.equipped.head!.implicit = { castSpeedPercent: 10, manaCostPercent: 15 };
  const stats = deriveCharacterStats(sheet, { castSpeedPercent: 20, manaCostPercent: 10 });
  assert.equal(stats.castSpeedMultiplier, 1.3);
  assert.equal(stats.attackSpeedMultiplier, 1);
  assert.equal(stats.manaCostMultiplier, .75);
  const capped = deriveCharacterStats(sheet, { castSpeedPercent: 1e9, manaCostPercent: 1e9 });
  assert.equal(capped.castSpeedMultiplier, 6); assert.equal(capped.manaCostMultiplier, .25);
});
