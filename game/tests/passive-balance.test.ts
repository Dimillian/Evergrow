import test from 'node:test';
import assert from 'node:assert/strict';
import { TERRITORY_SPECIALTIES, BORDER_GARDENS, OUTER_SPECIALTIES, SKILL_DOCTRINES, type Specialty } from '../src/skill-tree-content.ts';
import { createCharacterSheet } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { resolveSkill } from '../src/skill-progression.ts';
import type { StatKey, StatModifiers } from '../src/character-types.ts';

const specialties = [...Object.values(TERRITORY_SPECIALTIES).flat(), ...BORDER_GARDENS.flatMap(g => g.specialties), ...Object.values(OUTER_SPECIALTIES).flat()];
const find = (name: string): Specialty => specialties.find(s => s.name === name)!;
function add(...sources: StatModifiers[]): StatModifiers {
  const result: StatModifiers = {};
  for (const source of sources) for (const [key, amount] of Object.entries(source)) result[key as StatKey] = (result[key as StatKey] ?? 0) + amount;
  return result;
}
const fourPurchases = (specialty: Specialty) => add(specialty.small, specialty.small, specialty.small, specialty.reward);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const critExpectation = (bonuses: StatModifiers) => {
  const stats = deriveCharacterStats(createCharacterSheet(), bonuses);
  return 1 + stats.critChance * (stats.critMultiplier - 1);
};

test('four reached damage-passive purchases compete with early and late skill ranks and retain broad value', () => {
  // Equal new points after reaching a cluster: approach travel is deliberately excluded.
  const sheet = createCharacterSheet(), baseline = { damagePercent: 200, spellDamagePercent: 200 };
  const before = deriveCharacterStats(sheet, baseline);
  const spell = deriveCharacterStats(sheet, add(baseline, fourPurchases(find('Kindling'))));
  const weapon = deriveCharacterStats(sheet, add(baseline, fourPurchases(find('Tempered Edge'))));
  const rankGain = (rank: number) => resolveSkill('fireball', before, undefined, rank + 4).damageMultiplier / resolveSkill('fireball', before, undefined, rank).damageMultiplier;
  const broadGain = spell.spellDamageMultiplier / before.spellDamageMultiplier;
  assert.ok(broadGain > rankGain(10));
  assert.ok(broadGain < rankGain(1));
  assert.ok(broadGain > 1.12, 'already-invested casters must notice a completed broad-damage purchase');
  close(broadGain, weapon.attackDamageMultiplier / before.attackDamageMultiplier);
  close(spell.manaCostMultiplier, before.manaCostMultiplier);
  close(weapon.manaCostMultiplier, before.manaCostMultiplier);
  // Shared base damage applies to both unlocked spells, while passive investment adds no rank mana premium.
  for (const id of ['fireball', 'arcLightning'] as const) {
    const a = resolveSkill(id, before, undefined, 1), b = resolveSkill(id, spell, undefined, 1);
    close(b.damageMultiplier * spell.spellDamageMultiplier / (a.damageMultiplier * before.spellDamageMultiplier), broadGain);
    close(a.mana, b.mana);
  }
});

test('critical damage investments are useful from zero chance and reward an established critical build', () => {
  for (const specialty of specialties) for (const bonuses of [specialty.small, specialty.reward]) {
    if (!bonuses.critDamage) continue;
    assert.ok((bonuses.critChance ?? 0) > 0, `${specialty.name} leaves critical damage inactive without gear`);
    assert.ok(critExpectation(bonuses) > 1, specialty.name);
  }
  const budget = fourPurchases(find('Knife Edge'));
  const earlyGain = critExpectation(budget);
  const developed = { critChance: 30, critDamage: 100 };
  const developedGain = critExpectation(add(developed, budget)) / critExpectation(developed);
  assert.ok(earlyGain > 1.05);
  assert.ok(developedGain > earlyGain);
  assert.ok(developedGain > 1.15 && developedGain < 1.25, 'four critical purchases should be competitive but bounded');
});

test('movement and casting clusters improve continuous behavior while all existing global caps survive repeated investments', () => {
  const sheet = createCharacterSheet();
  const start = deriveCharacterStats(sheet);
  const movement = deriveCharacterStats(sheet, fourPurchases(find('Light Foot')));
  const casting = deriveCharacterStats(sheet, fourPurchases(find('Live Wire')));
  assert.ok(movement.moveSpeedMultiplier / start.moveSpeedMultiplier >= 1.1);
  assert.ok(casting.castSpeedMultiplier / start.castSpeedMultiplier >= 1.15);
  const content = add(...specialties.flatMap(s => [s.small, s.reward]), ...SKILL_DOCTRINES.flatMap(d => d.choices.map(c => c.bonuses)));
  const saturated = deriveCharacterStats(sheet, add(...Array.from({ length: 100 }, () => content)));
  close(saturated.critChance, .75);
  close(saturated.critMultiplier, 5);
  close(saturated.moveSpeedMultiplier, 1.75);
  close(saturated.castSpeedMultiplier, 6);
  close(saturated.attackSpeedMultiplier, 6);
  assert.ok(saturated.manaCostMultiplier >= .6);
  close(saturated.cooldownMultiplier, .25);
  for (const resistance of Object.values(saturated.resistances)) assert.ok(resistance <= .75);
});
