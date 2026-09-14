import { deriveCharacterStats } from '../src/character-stats.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, estimateItemPower, refreshEquipmentBudgets, roundItemStats, createCharacterSheet } from '../src/items.ts';
import { improveItem, rerollPool } from '../src/item-improvement.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { validItem } from '../src/item-validation.ts';
import { equippedGearPower } from '../src/leaderboard.ts';
import type { Item, StatKey } from '../src/character-types.ts';

const rolled = (item: Item, stats: StatKey[], roll: number) => deriveItem({...item,
  affixes: stats.map(stat => ({name: 'Test', stat, value: 0})), recipe: {...item.recipe, rolls: stats.map(() => roll)}});
const caster = new Set(['intelligence', 'spellDamagePercent', 'castSpeedPercent', 'manaRegen', 'maxMana', 'manaCostPercent']);

test('physical weapon drops and every enchanting operation exclude caster-only affixes', () => {
  for (const profile of WEAPON_PROFILES.filter(p => p.attackKind !== 'bolt')) for (let seed = 0; seed < 100; seed++) {
    let item = generateItem(seed, 50, 'weapon', profile.id, 'epic');
    for (const operation of ['rarity', 'rerollAll', 'rerollOne', 'enhance'] as const) {
      item = improveItem(item, operation, 50, seed + 97, 0);
      assert.ok(validItem(item));
      assert.ok(item.affixes.every(a => !caster.has(a.stat)), profile.id);
      assert.ok(rerollPool(item).every(a => !caster.has(a.stat)), profile.id);
    }
  }
});

test('weapon material advantage is narrower while perfect damage affixes can overcome it', () => {
  const base = generateItem(73, 50, 'weapon', 'greataxe', 'legendary', 'iron');
  const crystal = generateItem(73, 50, 'weapon', 'greataxe', 'legendary', 'crystal');
  assert.ok(crystal.weapon!.damage / base.weapon!.damage < 1.31);
  assert.ok(crystal.weapon!.damage > base.weapon!.damage);
  const stats: StatKey[] = ['damagePercent', 'strength', 'dexterity', 'critChance'];
  const good = rolled(base, stats, 1), weak = rolled(crystal, stats, 0);
  const sheet = createCharacterSheet();
  for (const slot of Object.keys(sheet.equipped) as (keyof typeof sheet.equipped)[]) sheet.equipped[slot] = null;
  sheet.attributes.strength += 147; sheet.attributes.vitality += 98;
  const dps = (item: Item) => {
    sheet.equipped.weapon = item;
    const stats = deriveCharacterStats(sheet, {}, 50), attack = deriveAttackStats(stats, item.weapon!);
    return attack.damage * attack.attacksPerSecond * (1 + stats.critChance * (stats.critMultiplier - 1));
  };
  assert.ok(dps(good) > dps(weak), `${dps(good)} > ${dps(weak)}`);
  assert.ok(good.affixes[0].value > 50);
  const gloves = rolled(generateItem(73, 50, 'gloves', undefined, 'legendary', 'iron'), ['attackSpeedPercent'], 1);
  assert.equal(gloves.affixes[0].value, 36);
});

test('power responds to actual rolls and affix relevance, ignores forged cached power', () => {
  const armor = generateItem(1977594883, 50, 'chest', undefined, 'legendary', 'iron');
  const stats: StatKey[] = ['vitality', 'maxHp', 'lifeRegen', 'armor'];
  const low = rolled(armor, stats, 0), high = rolled(armor, stats, 1);
  assert.ok(high.power > low.power * 1.2);
  assert.equal(estimateItemPower({...high, power: 999999}), high.power);
  const sword = generateItem(1, 50, 'weapon', 'longsword', 'magic');
  assert.ok(rolled(sword, ['damagePercent'], .5).power > rolled(sword, ['spellDamagePercent'], .5).power);
  const sheet = createCharacterSheet(); sheet.equipped.chest = low;
  const before = equippedGearPower(sheet); sheet.equipped.chest = high;
  assert.ok(equippedGearPower(sheet) > before);
});

test('owned weapon budget refresh preserves identity, quantiles, unrelated stats and is idempotent', () => {
  const old = rolled(generateItem(3580665801, 50, 'weapon', 'greataxe', 'legendary', 'crystal'),
    ['intelligence', 'spellDamagePercent', 'damagePercent', 'strength'], .95);
  const bytes = JSON.stringify(old), next = roundItemStats(refreshEquipmentBudgets(old));
  assert.ok(validItem(next));
  assert.ok(next.affixes.every(a => !caster.has(a.stat)));
  assert.equal(new Set(next.affixes.map(a => a.stat)).size, 4);
  assert.equal(next.id, old.id); assert.deepEqual(next.recipe, old.recipe);
  assert.equal(next.affixes[3].value, old.affixes[3].value);
  assert.equal(JSON.stringify(old), bytes);
  assert.deepEqual(roundItemStats(refreshEquipmentBudgets(next)), next);
});
