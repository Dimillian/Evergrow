import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, EQUIPMENT_SLOTS, generateItem, ITEM_KINDS, itemModifiers, TIER_NAMES } from '../src/items.ts';
import { STARTING_SWORD } from '../src/equipment.ts';
import { SHIELD_PROFILES, WEAPON_PROFILES } from '../src/weapon-content.ts';
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
    assert.equal(Boolean(item.shield), item.kind === 'shield');
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

test('explicit authored profiles cover one-hand, two-hand, bow, staff, and shield roles deterministically', () => {
  assert.equal(WEAPON_PROFILES.length, 13); assert.equal(SHIELD_PROFILES.length, 3);
  const families = new Set<string>();
  for (const profile of WEAPON_PROFILES) {
    const item = generateItem(872, 1, 'weapon', profile.id), high = generateItem(872, 30, 'weapon', profile.id);
    assert.equal(item.baseName, profile.name); assert.equal(item.weapon!.family, profile.family); families.add(profile.family);
    assert.equal(item.weapon!.hands, profile.hands); assert.equal(item.weapon!.attackKind, profile.attackKind);
    assert.equal(item.weapon!.damageType, profile.damageType); assert.ok(high.weapon!.damage > item.weapon!.damage);
    assert.deepEqual(item, generateItem(872, 1, undefined, profile.id));
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.visual));
  }
  assert.deepEqual([...families].sort(), ['axe', 'bow', 'dagger', 'mace', 'staff', 'sword']);
  assert.equal(WEAPON_PROFILES.filter(profile => profile.hands === 1).length, 4);
  assert.equal(WEAPON_PROFILES.filter(profile => profile.attackKind === 'arrow').length, 3);
  assert.equal(WEAPON_PROFILES.filter(profile => profile.attackKind === 'bolt').length, 3);
  assert.deepEqual(WEAPON_PROFILES.filter(profile => profile.family === 'staff').map(profile => profile.damageType), ['fire', 'frost', 'lightning']);
  for (const profile of SHIELD_PROFILES) {
    const item = generateItem(873, 1, 'shield', profile.id), high = generateItem(873, 30, 'shield', profile.id);
    assert.equal(item.shield!.blockChance, profile.blockChance); assert.equal(item.shield!.blockReduction, profile.blockReduction);
    assert.ok(high.implicit.armor! > item.implicit.armor!);
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.visual));
    item.shield!.visual.base = '#000'; assert.notEqual(profile.visual.base, '#000');
  }
  assert.notEqual(generateItem(872, 1, 'weapon', 'longsword').id, generateItem(872, 1, 'weapon', 'greatblade').id);
  assert.throws(() => generateItem(1, 1, 'weapon', 'missing-profile'), RangeError);
  assert.throws(() => generateItem(1, 1, 'weapon', 'iron-buckler'), RangeError);
  assert.throws(() => generateItem(1, 1, 'chest', 'greatblade'), RangeError);
});

test('the starter sheet has neutral worn gear, a full independent outfit and five empty skill slots', () => {
  const first = createCharacterSheet(), other = createCharacterSheet();
  assert.equal(first.inventory.length, 48); assert.equal(first.inventory.filter(Boolean).length, 8);
  assert.deepEqual(first.skillSlots, [null, null, null, null, null]);
  assert.deepEqual(first.allocatedNodes, ['origin']);
  assert.equal(first.statPoints, 0); assert.equal(first.skillPoints, 0);
  assert.equal(first.equipped.weapon!.weapon!.damage, 24);
  assert.equal(first.equipped.weapon!.weapon!.baseAttacksPerSecond, 2);
  assert.equal(first.equipped.weapon!.weapon!.hands, 2); assert.equal(first.equipped.offhand, null);
  assert.ok(first.inventory.some(item => item?.kind === 'shield'));
  for (const attackKind of ['melee', 'arrow', 'bolt']) assert.ok(first.inventory.some(item => item?.weapon?.attackKind === attackKind));
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

test('explicit reward tiers control quality and affix count, preserving the base roll and distinct identity', () => {
  const tiers = ['common', 'magic', 'rare', 'epic', 'legendary'] as const;
  const variants = tiers.map(tier => generateItem(813, 12, 'weapon', 'longsword', tier));
  assert.equal(new Set(variants.map(item => item.id)).size, tiers.length);
  variants.forEach((item, index) => {
    assert.equal(item.tier, tiers[index]);
    assert.equal(item.affixes.length, index);
    assert.deepEqual(item, generateItem(813, 12, 'weapon', 'longsword', tiers[index]));
    assert.equal(item.baseName, 'Longsword');
    assert.deepEqual(item.appearance, variants[0].appearance);
    if (index > 0) assert.ok(item.weapon!.damage > variants[index - 1].weapon!.damage);
  });
  assert.throws(() => generateItem(1, 1, 'weapon', 'longsword', 'unknown' as ItemTier), RangeError);
});

test('percentage affixes approach bounded quality ranges while flat stats and base item power keep scaling', () => {
  const percentBounds: Partial<Record<import('../src/character-types.ts').StatKey, number>> = {
    damagePercent: 4 + 25 * .35, attackSpeedPercent: 3 + 25 * .18,
    critChance: 1 + 25 * .08, critDamage: 6 + 25 * .35,
    moveSpeedPercent: 2 + 25 * .12, spellDamagePercent: 5 + 25 * .45,
    cooldownPercent: 2 + 25 * .1, blockChance: 2 + 25 * .08, blockReduction: 4 + 25 * .12,
  };
  const seen = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    const low = generateItem(seed, 1, 'shield', 'iron-buckler', 'legendary');
    const mid = generateItem(seed, 100, 'shield', 'iron-buckler', 'legendary');
    const high = generateItem(seed, 1_000_000, 'shield', 'iron-buckler', 'legendary');
    assert.ok(high.implicit.armor! > mid.implicit.armor! * 1000);
    high.affixes.forEach((affix, index) => {
      assert.equal(affix.stat, mid.affixes[index].stat);
      assert.ok(mid.affixes[index].value > low.affixes[index].value);
      assert.ok(affix.value >= mid.affixes[index].value);
      const bound = percentBounds[affix.stat];
      if (bound !== undefined) {
        seen.add(affix.stat);
        assert.ok(affix.value <= bound * 1.15 * 1.5 + .05);
      } else assert.ok(affix.value > mid.affixes[index].value * 1000);
    });
  }
  assert.deepEqual([...seen].sort(), Object.keys(percentBounds).sort());
  const lowRing = generateItem(915, 1, 'ring', undefined, 'legendary');
  const highRing = generateItem(915, 1_000_000, 'ring', undefined, 'legendary');
  assert.equal(lowRing.implicit.damagePercent, 3);
  assert.ok(highRing.implicit.damagePercent! > lowRing.implicit.damagePercent!);
  assert.ok(highRing.implicit.damagePercent! <= 2 * 1.65 * 1.5 + .05);
  assert.ok(generateItem(915, 1_000_000, 'weapon', 'greatblade', 'common').weapon!.damage > 1_000_000);
});
