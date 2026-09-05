import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, EQUIPMENT_SLOTS, generateItem, ITEM_KINDS, itemModifiers, TIER_NAMES } from '../src/items.ts';
import { STARTING_SWORD } from '../src/equipment.ts';
import type { ItemTier } from '../src/character-types.ts';

test('equipment generation is reproducible, independent and safe at level boundaries', () => {
  const first = generateItem(419, 17, 'weapon'), second = generateItem(419, 17, 'weapon');
  assert.deepEqual(first, second);
  first.weapon!.visual.metal = '#000000'; first.affixes.push({ name: 'Test', stat: 'strength', value: 500 });
  assert.deepEqual(second, generateItem(419, 17, 'weapon'));
  for (const invalid of [NaN, Infinity, -Infinity, -10, 0]) {
    assert.equal(generateItem(15, invalid).itemLevel, 1);
  }
  assert.equal(generateItem(15, 2.9).itemLevel, 2);
  assert.ok(Number.isFinite(generateItem(15, Number.MAX_VALUE, 'weapon').weapon!.damage));
});

test('the seed corpus generates all five tiers and every equipment kind with coherent affixes', () => {
  const tiers = new Set<ItemTier>(), kinds = new Set<string>(), ids = new Set<string>();
  const affixCount = { common: 0, magic: 1, rare: 2, epic: 3, legendary: 4 };
  for (let seed = 0; seed < 4000; seed++) {
    const item = generateItem(seed, 5);
    tiers.add(item.tier); kinds.add(item.kind);
    assert.ok(!ids.has(item.id)); ids.add(item.id);
    assert.ok(item.name.length > 5 && item.baseName.length > 3);
    assert.equal(item.requiredLevel, 3);
    assert.equal(item.affixes.length, affixCount[item.tier]);
    assert.equal(new Set(item.affixes.map(affix => affix.stat)).size, item.affixes.length);
    for (const affix of item.affixes) assert.ok(affix.value > 0 && Number.isFinite(affix.value));
    assert.equal(Boolean(item.weapon), item.kind === 'weapon');
  }
  assert.deepEqual([...tiers].sort(), Object.keys(TIER_NAMES).sort());
  assert.deepEqual([...kinds].sort(), [...ITEM_KINDS].sort());
});

test('item level raises power, requirements and stats without changing a seeded weapon identity or cadence', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const low = generateItem(seed, 1, 'weapon'), high = generateItem(seed, 40, 'weapon');
    assert.equal(low.tier, high.tier); assert.equal(low.name, high.name);
    assert.ok(high.power > low.power); assert.ok(high.requiredLevel > low.requiredLevel);
    assert.ok(high.weapon!.damage > low.weapon!.damage);
    assert.equal(low.weapon!.baseAttacksPerSecond, high.weapon!.baseAttacksPerSecond);
    assert.equal(low.weapon!.reach, high.weapon!.reach);
    low.affixes.forEach((affix, index) => assert.ok(high.affixes[index].value > affix.value));
  }
});

test('sword profiles offer real speed, damage and reach choices', () => {
  const profiles = new Map<number, number>();
  for (let seed = 1; seed < 100; seed++) {
    const weapon = generateItem(seed, 1, 'weapon').weapon!;
    profiles.set(weapon.baseAttacksPerSecond, weapon.reach);
  }
  assert.equal(profiles.size, 3);
  assert.ok(profiles.get(1.5)! > profiles.get(2.3)!);
});

test('the starter sheet has neutral worn gear, a full independent outfit and five empty skill slots', () => {
  const first = createCharacterSheet(), other = createCharacterSheet();
  assert.equal(first.inventory.length, 48); assert.equal(first.inventory.filter(Boolean).length, 4);
  assert.deepEqual(first.skillSlots, [null, null, null, null, null]);
  assert.deepEqual(first.allocatedNodes, ['origin']);
  assert.equal(first.statPoints, 0); assert.equal(first.skillPoints, 0);
  assert.equal(first.equipped.weapon!.weapon!.damage, 24);
  assert.equal(first.equipped.weapon!.weapon!.baseAttacksPerSecond, 2);
  for (const slot of EQUIPMENT_SLOTS) if (first.equipped[slot]) assert.deepEqual(itemModifiers(first.equipped[slot]!), {});
  first.equipped.weapon!.weapon!.damage = 1000;
  first.equipped.chest!.appearance.base = '#000000';
  first.inventory[0]!.name = 'Changed'; first.attributes.strength = 50;
  assert.equal(other.equipped.weapon!.weapon!.damage, 24); assert.equal(STARTING_SWORD.damage, 24);
  assert.notEqual(other.equipped.chest!.appearance.base, '#000000');
  assert.notEqual(other.inventory[0]!.name, 'Changed'); assert.equal(other.attributes.strength, 10);
});

test('implicit and explicit modifiers combine without mutating the item', () => {
  const item = generateItem(10, 1, 'ring');
  item.implicit = { strength: 2, maxHp: 10 };
  item.affixes = [{ name: 'Might', stat: 'strength', value: 3 }];
  assert.deepEqual(itemModifiers(item), { strength: 5, maxHp: 10 });
  assert.equal(item.implicit.strength, 2);
});
