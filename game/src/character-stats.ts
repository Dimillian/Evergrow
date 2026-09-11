import { MANA_RULES, manaCostMultiplier } from './mana-content.ts';
import { activeCharms } from './inventory-grid.ts';
import { CHARM_REWARD_CAPS } from './charm-content.ts';
import { deriveResistances } from './resistance-content.ts';
import { AFFIX_COMBAT_RULES, SKILL_STATS, type SkillStat } from './equipment-affix-content.ts';
import { PLAYER_DEFAULTS } from './combat-content.ts';
import { armorReduction } from './progression-content.ts';
import { EQUIPMENT_SLOTS, itemModifiers, itemDisplayName } from './items.ts';
import type { Attribute, CharacterSheet, DerivedCharacterStats, StatKey, StatModifiers } from './character-types.ts';

export const DEXTERITY_BONUSES = Object.freeze({ attackSpeedPercent: .25, critChance: .075 });

export const ATTRIBUTES: readonly Attribute[] = Object.freeze(['strength', 'dexterity', 'intelligence', 'vitality']);
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isNaN(value) ? min : value));

/** Named sources shared by stat derivation and the character-sheet explanation. */
export function characterModifierSources(sheet: CharacterSheet, treeBonuses: StatModifiers = {}, level = Infinity): Array<{ label: string; modifiers: StatModifiers }> {
  const sources = EQUIPMENT_SLOTS.flatMap(slot => {
    const item = sheet.equipped[slot];
    return item ? [{ label: `${itemDisplayName(item)} (${slot === 'weapon' ? 'main hand' : slot === 'offhand' ? 'off hand' : slot === 'ring1' ? 'ring I' : slot === 'ring2' ? 'ring II' : slot})`, modifiers: itemModifiers(item) }] : [];
  });
  sources.push(...activeCharms(sheet,level).map(item=>({label:`${itemDisplayName(item)} (charm)`,modifiers:itemModifiers(item)})));
  sources.push({ label: 'Skill tree', modifiers: treeBonuses });
  const blessing = sheet.blessing?.remaining ? sheet.blessing.kind : null;
  if (blessing === 'haste') sources.push({ label: 'Haste blessing', modifiers: { attackSpeedPercent: 15, castSpeedPercent: 15 } });
  if (blessing === 'wellspring') sources.push({ label: 'Wellspring blessing', modifiers: { manaCostPercent: 20 } });
  if (blessing === 'fleet') sources.push({ label: 'Fleet blessing', modifiers: { moveSpeedPercent: 15 } });
  return sources;
}

/** All item, attribute and node bonuses converge here. Percent bonuses are percentage points. */
export function deriveCharacterStats(sheet: CharacterSheet, treeBonuses: StatModifiers = {}, level = 1): DerivedCharacterStats {
  const modifiers: StatModifiers = {};
  const add = (source: StatModifiers) => {
    for (const [key, value] of Object.entries(source) as [StatKey, number][]) {
      if (Number.isFinite(value)) modifiers[key] = bounded((modifiers[key] ?? 0) + value, -1e9, 1e9);
    }
  };
  for (const source of characterModifierSources(sheet, treeBonuses, level)) add(source.modifiers);
  const blessing = sheet.blessing?.remaining ? sheet.blessing.kind : null;
  const value = (key: StatKey) => modifiers[key] ?? 0;
  const attributes = Object.fromEntries(ATTRIBUTES.map(key => [key,
    bounded(sheet.attributes[key] + value(key), 0, 1e9)])) as Record<Attribute, number>;
  const strength = Math.max(0, attributes.strength - 10), dexterity = Math.max(0, attributes.dexterity - 10);
  const intelligence = Math.max(0, attributes.intelligence - 10), vitality = Math.max(0, attributes.vitality - 10);
  const armor = bounded(value('armor') * (blessing === 'bulwark' ? 1.4 : 1), 0, 1e9);
  const offhand = sheet.equipped.offhand;
  const shield = sheet.equipped.weapon?.weapon?.hands !== 2 && offhand?.kind === 'shield' ? offhand.shield : undefined;
  return {
    attributes, resistances: deriveResistances(modifiers),
    goldFindMultiplier: 1 + bounded(value('goldFindPercent'), 0, CHARM_REWARD_CAPS.gold) / 100,
    xpGainMultiplier: 1 + bounded(value('xpGainPercent'), 0, CHARM_REWARD_CAPS.xp) / 100,
    manaOnKill: bounded(value('manaOnKill'), 0, 1e6),
    areaMultiplier: Math.sqrt(1 + bounded(value('areaPercent'), 0, AFFIX_COMBAT_RULES.maxAreaPercent) / 100),
    potionMultiplier: 1 + bounded(value('potionPercent'), 0, 100) / 100,
    projectilePierce: Math.floor(bounded(value('projectilePierce'), 0, AFFIX_COMBAT_RULES.maxPierce)),
    spellweavePercent: bounded(value('spellweavePercent'), 0, 100), afterguardPercent: bounded(value('afterguardPercent'), 0, 100),
    skillBonuses: Object.fromEntries((Object.keys(SKILL_STATS) as SkillStat[]).filter(key => value(key) > 0)
      .map(key => [key.slice(6), Math.floor(bounded(value(key), 0, AFFIX_COMBAT_RULES.maxBonusRanks))])),
    maxHp: Math.round(bounded(PLAYER_DEFAULTS.maxHp + vitality * 6 + value('maxHp'), 1, 1e9)),
    maxMana: Math.round(bounded(PLAYER_DEFAULTS.maxMana + intelligence * MANA_RULES.perIntelligence + value('maxMana'), 1, 1e9)),
    attackDamageMultiplier: bounded(1 + (strength * 2 + value('damagePercent')) / 100, .1, 1e6),
    castSpeedMultiplier: bounded(1 + value('castSpeedPercent') / 100, .25, 6),
    attackSpeedMultiplier: bounded(1 + (dexterity * DEXTERITY_BONUSES.attackSpeedPercent + value('attackSpeedPercent')) / 100, .25, 6),
    armor, damageReduction: armorReduction(armor, level),
    critChance: bounded((dexterity * DEXTERITY_BONUSES.critChance + value('critChance')) / 100, 0, .75),
    critMultiplier: bounded(1.5 + value('critDamage') / 100, 1, 5),
    moveSpeedMultiplier: bounded(1 + value('moveSpeedPercent') / 100, .5, 1.75),
    spellDamageMultiplier: bounded(1 + (intelligence * 3 + value('spellDamagePercent')) / 100, .1, 1e6),
    manaRegeneration: bounded(PLAYER_DEFAULTS.manaRegeneration + value('manaRegen') / MANA_RULES.regenerationPeriod, 0, 1e6),
    lifeRegeneration: bounded(value('lifeRegen'), 0, 1e6),
    manaCostMultiplier: manaCostMultiplier(value('manaCostPercent')),
    cooldownMultiplier: bounded(1 - value('cooldownPercent') / 100, .25, 2),
    lifeOnHit: bounded(value('lifeOnHit'), 0, 1e6),
    blockChance: shield ? bounded((shield.blockChance + value('blockChance')) / 100, 0, .75) : 0,
    blockReduction: shield ? bounded((shield.blockReduction + value('blockReduction')) / 100, 0, .9) : 0,
  };
}
