import { PLAYER_DEFAULTS } from './combat-content.ts';
import { armorReduction } from './progression-content.ts';
import { EQUIPMENT_SLOTS, itemModifiers } from './items.ts';
import type { Attribute, CharacterSheet, DerivedCharacterStats, StatKey, StatModifiers } from './character-types.ts';

export const ATTRIBUTES: readonly Attribute[] = Object.freeze(['strength', 'dexterity', 'intelligence', 'vitality']);
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isNaN(value) ? min : value));

/** All item, attribute and node bonuses converge here. Percent bonuses are percentage points. */
export function deriveCharacterStats(sheet: CharacterSheet, treeBonuses: StatModifiers = {}, level = 1): DerivedCharacterStats {
  const modifiers: StatModifiers = {};
  const add = (source: StatModifiers) => {
    for (const [key, value] of Object.entries(source) as [StatKey, number][]) {
      if (Number.isFinite(value)) modifiers[key] = bounded((modifiers[key] ?? 0) + value, -1e9, 1e9);
    }
  };
  for (const slot of EQUIPMENT_SLOTS) if (sheet.equipped[slot]) add(itemModifiers(sheet.equipped[slot]!));
  add(treeBonuses);
  const value = (key: StatKey) => modifiers[key] ?? 0;
  const attributes = Object.fromEntries(ATTRIBUTES.map(key => [key,
    bounded(sheet.attributes[key] + value(key), 0, 1e9)])) as Record<Attribute, number>;
  const strength = Math.max(0, attributes.strength - 10), dexterity = Math.max(0, attributes.dexterity - 10);
  const intelligence = Math.max(0, attributes.intelligence - 10), vitality = Math.max(0, attributes.vitality - 10);
  const armor = bounded(value('armor'), 0, 1e9);
  const offhand = sheet.equipped.offhand;
  const shield = sheet.equipped.weapon?.weapon?.hands !== 2 && offhand?.kind === 'shield' ? offhand.shield : undefined;
  return {
    attributes,
    maxHp: Math.round(bounded(PLAYER_DEFAULTS.maxHp + vitality * 6 + value('maxHp'), 1, 1e9)),
    maxMana: Math.round(bounded(PLAYER_DEFAULTS.maxMana + intelligence * 4 + value('maxMana'), 1, 1e9)),
    attackDamageMultiplier: bounded(1 + (strength * 2 + value('damagePercent')) / 100, .1, 1e6),
    castSpeedMultiplier: bounded(1 + value('castSpeedPercent') / 100, .25, 6),
    attackSpeedMultiplier: bounded(1 + (dexterity * .5 + value('attackSpeedPercent')) / 100, .25, 6),
    armor, damageReduction: armorReduction(armor, level),
    critChance: bounded((dexterity * .15 + value('critChance')) / 100, 0, .75),
    critMultiplier: bounded(1.5 + value('critDamage') / 100, 1, 5),
    moveSpeedMultiplier: bounded(1 + value('moveSpeedPercent') / 100, .5, 1.75),
    spellDamageMultiplier: bounded(1 + (intelligence * 3 + value('spellDamagePercent')) / 100, .1, 1e6),
    manaRegeneration: bounded(PLAYER_DEFAULTS.manaRegeneration + value('manaRegen'), 0, 1e6),
    lifeRegeneration: bounded(value('lifeRegen'), 0, 1e6),
    manaCostMultiplier: bounded(1 - value('manaCostPercent') / 100, .25, 2),
    cooldownMultiplier: bounded(1 - value('cooldownPercent') / 100, .25, 2),
    lifeOnHit: bounded(value('lifeOnHit'), 0, 1e6),
    blockChance: shield ? bounded((shield.blockChance + value('blockChance')) / 100, 0, .75) : 0,
    blockReduction: shield ? bounded((shield.blockReduction + value('blockReduction')) / 100, 0, .9) : 0,
  };
}
