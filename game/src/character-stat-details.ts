import { ELEMENTS, RESISTANCE_LABELS, RESISTANCE_RULES } from './resistance-content.ts';
import type { Player, WeaponDefinition } from './model.ts';
import type { Attribute, StatKey, DerivedCharacterStats } from './character-types.ts';
import { characterModifierSources } from './character-stats.ts';
import { getTreeBonuses } from './skill-tree.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { deriveAttackStats, WEAPON_ACTION_RULES } from './equipment.ts';
import { effectiveArmor } from './affix-combat.ts';
import { armorReduction, itemPowerScale } from './progression-content.ts';
import { PLAYER_ABILITIES, PLAYER_DEFAULTS, PLAYER_MOVEMENT } from './combat-content.ts';
import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';

export interface StatDetail {
  id: string; label: string; amount: number; value: string;
  description: string; calculation: string; sources: Array<{ label: string; value: string }>;
}
export interface StatDetailGroup { title: string; tone: string; rows: StatDetail[] }
/** A new derived stat must explicitly declare where players can inspect it. */
export const DERIVED_STAT_DETAILS = {
  resistances: 'resistances', attributes: 'attributes', attackDamageMultiplier: 'attackBonus', attackSpeedMultiplier: 'attackSpeed',
  castSpeedMultiplier: 'castSpeed', spellDamageMultiplier: 'spellDamage', critChance: 'critChance', critMultiplier: 'critDamage',
  maxHp: 'maxHp', maxMana: 'maxMana', armor: 'armor', damageReduction: 'armorReduction',
  moveSpeedMultiplier: 'movement', manaRegeneration: 'manaRegen', lifeRegeneration: 'lifeRegen',
  manaCostMultiplier: 'manaCost', cooldownMultiplier: 'cooldown', lifeOnHit: 'lifeOnHit', blockChance: 'blockChance', blockReduction: 'blockReduction',
  manaOnKill: 'manaOnKill', areaMultiplier: 'area', potionMultiplier: 'potion', projectilePierce: 'pierce',
  spellweavePercent: 'spellweave', afterguardPercent: 'afterguard', skillBonuses: 'skills',
} as const satisfies Record<keyof DerivedCharacterStats, string>;
const n = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const pct = (value: number) => `${n(value * 100, 1)}%`;

/** Display actual combat projections. Explanations never recalculate or modify gameplay stats. */
export function characterStatDetails(p: Player): StatDetailGroup[] {
  const s = p.derived, sheet = p.character;
  const contributions = characterModifierSources(sheet, getTreeBonuses(sheet.allocatedNodes));
  const sources = (keys: StatKey[]) => contributions.flatMap(source => {
    const values = [...new Set(keys)].filter(key => source.modifiers[key]).map(key => `${formatStatValue(key, source.modifiers[key]!)} ${STAT_LABELS[key]}`);
    return values.length ? [{ label: source.label, value: values.join(' · ') }] : [];
  });
  const row = (id: string, label: string, amount: number, value: string, description: string, calculation: string, keys: StatKey[] = []): StatDetail =>
    ({ id, label, amount, value, description, calculation, sources: sources(keys) });
  const addAttribute = (r: StatDetail, attribute: Attribute) => {
    r.sources.unshift({ label: `${STAT_LABELS[attribute]} · starting + assigned`, value: n(sheet.attributes[attribute]) });
    return r;
  };
  const attributes = (['strength', 'dexterity', 'intelligence', 'vitality'] as const).map(attribute =>
    addAttribute(row(attribute, STAT_LABELS[attribute], s.attributes[attribute], n(s.attributes[attribute], 0), {
      strength: 'Each point above 10 adds 2% physical attack damage.',
      dexterity: 'Each point above 10 adds 0.5% attack speed and 0.15 percentage points of critical chance.',
      intelligence: 'Each point above 10 adds 4 mana and 3% spell and added elemental damage.',
      vitality: 'Each point above 10 adds 6 maximum life.',
    }[attribute], 'Starting + assigned points + equipment + skill tree. Only points above 10 grant combat bonuses.', [attribute]), attribute));
  const weaponRows = (weapon: WeaponDefinition, off = false): StatDetail[] => {
    const a = deriveAttackStats(p.stats, weapon), bolt = weapon.attackKind === 'bolt';
    const prefix = off ? 'off-' : '', attribute = bolt ? 'intelligence' : 'strength';
    const damage = addAttribute(row(`${prefix}damage`, off ? 'Off-hand damage' : bolt ? 'Bolt damage' : 'Attack damage', a.damage, n(a.damage, 0),
      'Basic hit before criticals, enemy defenses and conditional Spellweave. Skill damage uses its own rank and specialization. Each hand uses its own weapon.',
      `${n(weapon.damage)} weapon × ${n(bolt ? p.stats.spellDamageMultiplier : p.stats.attackDamageMultiplier)} + ${n(a.elementalDamage)} added elemental = ${n(a.damage)} (rounded).`,
      [attribute, bolt ? 'spellDamagePercent' : 'damagePercent', ...(weapon.enchantment ? ['intelligence', 'spellDamagePercent'] as StatKey[] : [])]), attribute);
    damage.sources.unshift({ label: weapon.name, value: `${n(weapon.damage)} base ${weapon.damageType} damage` });
    if (weapon.enchantment) damage.sources.push({ label: `${weapon.name} · enchantment`, value: `${n(weapon.enchantment.damage)} × ${n(p.stats.spellDamageMultiplier)} = ${n(a.elementalDamage)} elemental` });
    const speed = row(`${prefix}rate`, off ? bolt ? 'Off-hand casts / s' : 'Off-hand attacks / s' : bolt ? 'Casts per second' : 'Attacks per second', a.attacksPerSecond, n(a.attacksPerSecond),
      `Basic ${bolt ? 'casting' : 'attack'} cadence. Paired weapons alternate; their rates are not added together. Skills use their own timing.`,
      `${n(weapon.baseAttacksPerSecond)} weapon × ${WEAPON_ACTION_RULES.speedMultiplier} cadence × ${n(bolt ? p.stats.castSpeedMultiplier : p.stats.attackSpeedMultiplier)} speed. Limited to 0.25–12 / s.`, bolt ? ['castSpeedPercent'] : ['dexterity', 'attackSpeedPercent']);
    speed.sources.unshift({ label: weapon.name, value: `${n(weapon.baseAttacksPerSecond)} base / s` });
    if (!bolt) addAttribute(speed, 'dexterity');
    return [damage, speed];
  };
  const offense = [...weaponRows(p.equipment.mainHand), ...(p.equipment.offHand?.kind === 'weapon' ? weaponRows(p.equipment.offHand.weapon, true) : []),
    addAttribute(row('attackBonus', 'Physical damage bonus', s.attackDamageMultiplier - 1, pct(s.attackDamageMultiplier - 1), 'Scales physical weapon damage, including bow attacks.', '2% per Strength above 10 + physical damage bonuses; minimum total multiplier 10%.', ['strength', 'damagePercent']), 'strength'),
    addAttribute(row('attackSpeed', 'Attack speed bonus', s.attackSpeedMultiplier - 1, pct(s.attackSpeedMultiplier - 1), 'Affects melee weapons and bows. Wands and staves use cast speed.', '0.5% per Dexterity above 10 + attack speed bonuses. Total speed multiplier: 25–600%.', ['dexterity', 'attackSpeedPercent']), 'dexterity'),
    addAttribute(row('spellDamage', 'Spell damage bonus', s.spellDamageMultiplier - 1, pct(s.spellDamageMultiplier - 1), 'Scales spells, basic magic bolts and weapon enchantment damage.', '3% per Intelligence above 10 + spell damage bonuses; minimum total multiplier 10%.', ['intelligence', 'spellDamagePercent']), 'intelligence'),
    row('castSpeed', 'Cast speed bonus', s.castSpeedMultiplier - 1, pct(s.castSpeedMultiplier - 1), 'Shortens magic casting actions. Does not reduce cooldowns.', 'Cast speed bonuses add together. Total speed multiplier: 25–600%.', ['castSpeedPercent']),
    addAttribute(row('critChance', 'Critical chance', s.critChance, pct(s.critChance), 'Chance for a direct hit to critically strike. Damage-over-time ticks do not crit.', '0.15 percentage points per Dexterity above 10 + critical chance bonuses. Cap: 75%.', ['dexterity', 'critChance']), 'dexterity'),
    row('critDamage', 'Critical damage', s.critMultiplier, pct(s.critMultiplier), 'Total damage on a critical hit: 150% means 1.5× normal damage.', '150% base + critical damage bonuses. Total range: 100–500%.', ['critDamage']),
  ];
  const armor = effectiveArmor(p), armorSources = sources(['armor']);
  if (sheet.blessing?.remaining && sheet.blessing.kind === 'bulwark') armorSources.push({ label: 'Bulwark blessing', value: '×1.4 armor' });
  if (armor !== s.armor) armorSources.push({ label: 'Afterguard · active', value: `+${n(s.afterguardPercent)}% armor` });
  const defense = [
    { ...row('armor', 'Armor', armor, n(armor, 0), 'Reduces physical damage only. Elemental hits use resistance instead. Higher-level enemies require more armor for the same protection.', 'Equipment + skill tree armor, multiplied by any active Bulwark blessing and Afterguard.'), sources: armorSources },
    { ...row('armorReduction', `Reduction vs level ${p.level}`, armorReduction(armor, p.level), pct(armorReduction(armor, p.level)), 'Physical reduction against an attacker at your level. Combat uses the actual attacker level; block applies afterward.', `${n(armor)} ÷ (${n(armor)} + ${n(120 * itemPowerScale(p.level))}). Cap: 80%.`), sources: armorSources },
    row('blockChance', 'Passive block chance', s.blockChance, pct(s.blockChance), 'Requires an equipped shield and a one-handed main weapon. Active guarding guarantees a block.', 'Shield chance + block chance bonuses. Cap: 75%. Without a usable shield: 0%.', ['blockChance']),
    row('blockReduction', 'Blocked damage reduction', s.blockReduction, pct(s.blockReduction), 'Damage prevented by a passive block, after armor or elemental resistance. Hits still deal at least 1 damage.', 'Shield reduction + block reduction bonuses. Cap: 90%. Without a usable shield: 0%.', ['blockReduction']),
  ];
  if (p.equipment.offHand?.kind === 'shield') {
    const shield = p.equipment.offHand.shield;
    defense[2].sources.unshift({ label: 'Equipped shield', value: `${n(shield.blockChance)}% base chance` });
    defense[3].sources.unshift({ label: 'Equipped shield', value: `${n(shield.blockReduction)}% base reduction` });
    if (p.guardTime > 0) defense.push(row('activeGuard', 'Active guard reduction', Math.max(p.guardReduction, s.blockReduction), pct(Math.max(p.guardReduction, s.blockReduction)), 'Current guard skill: guarantees a block while guarding.', `Higher of ${pct(p.guardReduction)} skill reduction and ${pct(s.blockReduction)} passive shield reduction. ${n(p.guardTime)}s remaining.`));
  }
  const resistances = ELEMENTS.map(element => row(`${element}Resistance`, RESISTANCE_LABELS[`${element}Resistance`], s.resistances[element], pct(s.resistances[element]),
    `Reduces incoming ${element} damage. Armor does not apply; shields may still block afterward. Resistance does not shorten status effects.`,
    `0% base + ${element} resistance + all-element resistance. Cap: ${pct(RESISTANCE_RULES.cap)}. A 100-damage hit becomes ${n(100 * (1 - s.resistances[element]))} before block and rounding.`, [`${element}Resistance`, 'allResistance']));
  const resources = [
    addAttribute(row('maxHp', 'Maximum life', s.maxHp, n(s.maxHp, 0), 'Your life capacity. Increasing it does not heal missing life.', `${PLAYER_DEFAULTS.maxHp} base + 6 per Vitality above 10 + flat life bonuses, rounded.`, ['vitality', 'maxHp']), 'vitality'),
    row('lifeRegen', 'Life regeneration', s.lifeRegeneration, `${n(s.lifeRegeneration)} / s`, 'Restores life continuously, up to maximum life.', 'Flat regeneration bonuses add together; minimum 0.', ['lifeRegen']),
    row('lifeOnHit', 'Life on hit', s.lifeOnHit, n(s.lifeOnHit, 1), 'Restores life on direct hits, up to missing life. Periodic damage does not trigger it.', 'Flat life-on-hit bonuses add together; minimum 0.', ['lifeOnHit']),
    addAttribute(row('maxMana', 'Maximum mana', s.maxMana, n(s.maxMana, 0), 'Your mana capacity. Increasing it does not refill mana.', `${PLAYER_DEFAULTS.maxMana} base + 4 per Intelligence above 10 + flat mana bonuses, rounded.`, ['intelligence', 'maxMana']), 'intelligence'),
    row('manaRegen', 'Mana regeneration', s.manaRegeneration, `${n(s.manaRegeneration)} / s`, 'Restores mana continuously, up to maximum mana.', `${PLAYER_DEFAULTS.manaRegeneration} / s base + flat regeneration bonuses; minimum 0.`, ['manaRegen']),
    row('manaOnKill', 'Mana on kill', s.manaOnKill, n(s.manaOnKill, 1), 'Restores mana when you kill an enemy, up to missing mana.', 'Flat mana-on-kill bonuses add together.', ['manaOnKill']),
    row('potion', 'Potion restoration bonus', s.potionMultiplier - 1, pct(s.potionMultiplier - 1), 'Increases both life and mana restored by your dual potion; limited by missing resources.', `${pct(PLAYER_ABILITIES.potion.lifeFraction)} life / ${pct(PLAYER_ABILITIES.potion.manaFraction)} mana × ${n(s.potionMultiplier)}. Bonus cap: 100%.`, ['potionPercent']),
  ];
  const utility = [
    row('movement', 'Movement speed', s.moveSpeedMultiplier, pct(s.moveSpeedMultiplier), '100% is normal travel speed. Attacking and casting slow movement. Dodge uses its own speed.', `${PLAYER_MOVEMENT.speed} base units / s × ${n(s.moveSpeedMultiplier)} = ${n(PLAYER_MOVEMENT.speed * s.moveSpeedMultiplier)} before movement penalties. Range: 50–175%.`, ['moveSpeedPercent']),
    row('manaCost', 'Mana cost reduction', 1 - s.manaCostMultiplier, pct(1 - s.manaCostMultiplier), 'Reduces mana spent. Spell rank, specialization and minimum costs still apply.', `Base action cost × ${n(s.manaCostMultiplier)}, then action-specific rounding. Reduction cap: 75%.`, ['manaCostPercent']),
    row('cooldown', 'Cooldown reduction', 1 - s.cooldownMultiplier, pct(1 - s.cooldownMultiplier), 'Affects skill cooldowns, dodge recharge and potion cooldown. Does not change attack or cast speed.', `Base cooldown × ${n(s.cooldownMultiplier)}. Reduction cap: 75%; skill-specific minimums still apply.`, ['cooldownPercent']),
    row('area', 'Area of effect', s.areaMultiplier ** 2 - 1, `+${pct(s.areaMultiplier ** 2 - 1)}`, 'Enlarges supported sweeps, novas and explosions. Does not add projectile travel distance.', `Radius/reach × ${n(s.areaMultiplier)}; area uses the square of this multiplier. Bonus cap: ${AFFIX_COMBAT_RULES.maxAreaPercent}%.`, ['areaPercent']),
    row('pierce', 'Projectile pierce', s.projectilePierce, n(s.projectilePierce, 0), 'Additional targets for supported projectiles. Explosive projectiles still detonate on contact.', `Pierce bonuses add, then round down. Cap: ${AFFIX_COMBAT_RULES.maxPierce} extra targets.`, ['projectilePierce']),
    row('spellweave', 'Spellweave damage', s.spellweavePercent, `+${n(s.spellweavePercent)}%`, 'A melee hit empowers the next spell; a spell hit empowers the next melee attack. Bows do not trigger it.', `Separate ×${n(1 + s.spellweavePercent / 100)} damage when consumed. Lasts ${AFFIX_COMBAT_RULES.weaveDuration}s; does not stack. Bonus cap: 100%.`, ['spellweavePercent']),
    row('afterguard', 'Armor after block', s.afterguardPercent, `+${n(s.afterguardPercent)}%`, 'Blocking temporarily increases armor. Further blocks refresh the duration.', `Armor × ${n(1 + s.afterguardPercent / 100)} for ${AFFIX_COMBAT_RULES.guardDuration}s. Bonus cap: 100%. Active bonus is included in Armor above.`, ['afterguardPercent']),
  ];
  const ranks = Object.entries(s.skillBonuses).flatMap(([id, ranks]) => {
    const skill = SKILL_DEFINITIONS[id as keyof typeof SKILL_DEFINITIONS];
    return skill && ranks ? [row(`skill:${id}`, `${skill.name} bonus ranks`, ranks, `+${n(ranks, 0)}`, 'Adds effective ranks once this skill is learned. Does not unlock it or spend skill points.', `Equipped and tree bonus ranks add, then round down. Cap: ${AFFIX_COMBAT_RULES.maxBonusRanks}.`, [`skill:${skill.id}`])] : [];
  });
  return [{ title: 'Attributes', tone: 'attributes', rows: attributes }, { title: 'Offense', tone: 'offense', rows: offense },
    { title: 'Defense', tone: 'defense', rows: defense }, { title: 'Elemental resistances', tone: 'resistances', rows: resistances }, { title: 'Life & mana', tone: 'resources', rows: resources },
    { title: 'Utility & efficiency', tone: 'utility', rows: utility }, ...(ranks.length ? [{ title: 'Skill bonuses', tone: 'skills', rows: ranks }] : [])];
}
