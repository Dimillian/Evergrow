import { ATTRIBUTE_DAMAGE_BONUSES } from './attribute-content.ts';
import { MANA_RULES } from './mana-content.ts';
import { CHAIN_SUSTAIN } from './skill-execution-content.ts';
import { CHARM_REWARD_CAPS } from './charm-content.ts';
import { ELEMENTS, RESISTANCE_LABELS, RESISTANCE_RULES } from './resistance-content.ts';
import type { Player, WeaponDefinition } from './model.ts';
import type { Attribute, StatKey, DerivedCharacterStats } from './character-types.ts';
import { characterModifierSources, DEXTERITY_BONUSES } from './character-stats.ts';
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
  goldFindMultiplier: 'goldFind', xpGainMultiplier: 'xpGain', resistances: 'resistances', attributes: 'attributes', attackDamageMultiplier: 'attackBonus', attackSpeedMultiplier: 'attackSpeed',
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
  const attributeBonus = (attribute: Attribute, perPoint: number) => n(Math.max(0, s.attributes[attribute] - 10) * perPoint);
  const contributions = characterModifierSources(sheet, getTreeBonuses(sheet.allocatedNodes), p.level);
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
      strength: `+${ATTRIBUTE_DAMAGE_BONUSES.strength}% physical damage per added point.`,
      dexterity: `+${DEXTERITY_BONUSES.attackSpeedPercent}% attack speed and +${DEXTERITY_BONUSES.critChance}% critical chance per added point.`,
      intelligence: `+${MANA_RULES.perIntelligence} mana and +${ATTRIBUTE_DAMAGE_BONUSES.intelligence}% spell / elemental damage per added point.`,
      vitality: '+6 maximum life per added point.',
    }[attribute], 'Starting + assigned + gear + charms + skill tree', [attribute]), attribute));
  const weaponRows = (weapon: WeaponDefinition, off = false): StatDetail[] => {
    const a = deriveAttackStats(p.stats, weapon), bolt = weapon.attackKind === 'bolt';
    const prefix = off ? 'off-' : '', attribute = bolt ? 'intelligence' : 'strength';
    const damage = addAttribute(row(`${prefix}damage`, off ? 'Off-hand damage' : bolt ? 'Bolt damage' : 'Attack damage', a.damage, n(a.damage, 0),
      'Basic hit before criticals and enemy defenses. Excludes Spellweave; skills use their own potency.',
      `${n(weapon.damage)} weapon × ${n(bolt ? p.stats.spellDamageMultiplier : p.stats.attackDamageMultiplier)}${a.elementalDamage ? ` + ${n(a.elementalDamage)} elemental` : ''} = ${n(a.damage, 0)}`,
      [attribute, bolt ? 'spellDamagePercent' : 'damagePercent', ...(weapon.enchantment ? ['intelligence', 'spellDamagePercent'] as StatKey[] : [])]), attribute);
    damage.sources.unshift({ label: weapon.name, value: `${n(weapon.damage)} base ${weapon.damageType} damage` });
    if (weapon.enchantment) damage.sources.push({ label: `${weapon.name} · enchantment`, value: `${n(weapon.enchantment.damage)} × ${n(p.stats.spellDamageMultiplier)} = ${n(a.elementalDamage)} elemental` });
    const speed = row(`${prefix}rate`, off ? bolt ? 'Off-hand casts / s' : 'Off-hand attacks / s' : bolt ? 'Casts per second' : 'Attacks per second', a.attacksPerSecond, n(a.attacksPerSecond),
      `Basic ${bolt ? 'casting' : 'attack'} rate. Paired weapons alternate; skills use their own timing.`,
      `${n(weapon.baseAttacksPerSecond)} × ${WEAPON_ACTION_RULES.speedMultiplier} cadence × ${n(bolt ? p.stats.castSpeedMultiplier : p.stats.attackSpeedMultiplier)} speed\nLimit: 0.25–12 / s`, bolt ? ['castSpeedPercent'] : ['dexterity', 'attackSpeedPercent']);
    speed.sources.unshift({ label: weapon.name, value: `${n(weapon.baseAttacksPerSecond)} base / s` });
    if (!bolt) addAttribute(speed, 'dexterity');
    return [damage, speed];
  };
  const offense = [...weaponRows(p.equipment.mainHand), ...(p.equipment.offHand?.kind === 'weapon' ? weaponRows(p.equipment.offHand.weapon, true) : []),
    addAttribute(row('attackBonus', 'Physical damage bonus', s.attackDamageMultiplier - 1, pct(s.attackDamageMultiplier - 1), 'Scales physical weapon damage, including bow attacks.', `+${attributeBonus('strength', ATTRIBUTE_DAMAGE_BONUSES.strength)}% Strength + damage bonuses\nDamage × ${n(s.attackDamageMultiplier)}`, ['strength', 'damagePercent']), 'strength'),
    addAttribute(row('attackSpeed', 'Attack speed bonus', s.attackSpeedMultiplier - 1, pct(s.attackSpeedMultiplier - 1), 'Affects melee weapons and bows. Wands and staves use cast speed.', `+${attributeBonus('dexterity', DEXTERITY_BONUSES.attackSpeedPercent)}% Dexterity + speed bonuses\nTotal speed: 25–600%`, ['dexterity', 'attackSpeedPercent']), 'dexterity'),
    addAttribute(row('spellDamage', 'Spell damage bonus', s.spellDamageMultiplier - 1, pct(s.spellDamageMultiplier - 1), 'Scales spells, basic magic bolts and weapon enchantment damage.', `+${attributeBonus('intelligence', ATTRIBUTE_DAMAGE_BONUSES.intelligence)}% Intelligence + damage bonuses\nDamage × ${n(s.spellDamageMultiplier)}`, ['intelligence', 'spellDamagePercent']), 'intelligence'),
    row('castSpeed', 'Cast speed bonus', s.castSpeedMultiplier - 1, pct(s.castSpeedMultiplier - 1), 'Shortens magic casting actions. Does not reduce cooldowns.', `Sum of cast speed bonuses\nTotal speed: 25–600%`, ['castSpeedPercent']),
    addAttribute(row('critChance', 'Critical chance', s.critChance, pct(s.critChance), 'Chance to critically strike. Burn damage cannot crit.', `+${attributeBonus('dexterity', DEXTERITY_BONUSES.critChance)}% Dexterity + critical bonuses\nCap: 75%`, ['dexterity', 'critChance']), 'dexterity'),
    row('critDamage', 'Critical damage', s.critMultiplier, pct(s.critMultiplier), 'Damage on a critical hit. 150% = 1.5× damage.', `150% + critical damage bonuses\nLimit: 100–500%`, ['critDamage']),
  ];
  const armor = effectiveArmor(p), armorSources = sources(['armor']);
  if (sheet.blessing?.remaining && sheet.blessing.kind === 'bulwark') armorSources.push({ label: 'Bulwark blessing', value: '×1.4 armor' });
  if (armor !== s.armor) armorSources.push({ label: 'Afterguard · active', value: `+${n(s.afterguardPercent)}% armor` });
  const defense = [
    { ...row('armor', 'Armor', armor, n(armor, 0), 'Reduces physical damage. Higher-level enemies require more armor.', `Equipment + skill tree armor\nActive Bulwark and Afterguard multiply the total.`), sources: armorSources },
    { ...row('armorReduction', `Reduction vs level ${p.level}`, armorReduction(armor, p.level), pct(armorReduction(armor, p.level)), `Physical protection against a level ${p.level} attacker. Block applies afterward.`, `${n(armor)} ÷ (${n(armor)} + ${n(120 * itemPowerScale(p.level))}) = ${pct(armorReduction(armor, p.level))}\nCap: 80%`), sources: armorSources },
    row('blockChance', 'Passive block chance', s.blockChance, pct(s.blockChance), 'Requires a usable shield. Active guarding guarantees a block.', `Shield chance + bonuses\nCap: 75% · No usable shield: 0%`, ['blockChance']),
    row('blockReduction', 'Blocked damage reduction', s.blockReduction, pct(s.blockReduction), 'Damage prevented by a block, after armor or resistance.', `Shield reduction + bonuses\nCap: 90% · Minimum hit: 1`, ['blockReduction']),
  ];
  if (p.equipment.offHand?.kind === 'shield') {
    const shield = p.equipment.offHand.shield;
    defense[2].sources.unshift({ label: 'Equipped shield', value: `${n(shield.blockChance)}% base chance` });
    defense[3].sources.unshift({ label: 'Equipped shield', value: `${n(shield.blockReduction)}% base reduction` });
    if (p.guardTime > 0) defense.push(row('activeGuard', 'Active guard reduction', Math.max(p.guardReduction, s.blockReduction), pct(Math.max(p.guardReduction, s.blockReduction)), 'Guaranteed block while guarding.', `Higher of ${pct(p.guardReduction)} guard / ${pct(s.blockReduction)} shield\n${n(p.guardTime)}s remaining`));
  }
  const resistances = ELEMENTS.map(element => row(`${element}Resistance`, RESISTANCE_LABELS[`${element}Resistance`], s.resistances[element], pct(s.resistances[element]),
    `Reduces ${element} damage before block. Does not shorten status effects.`,
    `${element[0].toUpperCase() + element.slice(1)} + all-element bonuses · Cap: ${pct(RESISTANCE_RULES.cap)}\n100 damage → ${n(100 * (1 - s.resistances[element]))} before block`, [`${element}Resistance`, 'allResistance']));
  const resources = [
    addAttribute(row('maxHp', 'Maximum life', s.maxHp, n(s.maxHp, 0), 'Life capacity. Increasing it does not heal you.', `${PLAYER_DEFAULTS.maxHp} + ${attributeBonus('vitality', 6)} Vitality + life bonuses`, ['vitality', 'maxHp']), 'vitality'),
    row('lifeRegen', 'Life regeneration', s.lifeRegeneration, `${n(s.lifeRegeneration)} / s`, 'Restores life continuously, up to maximum life.', 'Sum of regeneration bonuses', ['lifeRegen']),
    row('lifeOnHit', 'Life on hit', s.lifeOnHit, n(s.lifeOnHit, 1), `Life per direct hit. Chains: ${CHAIN_SUSTAIN.subsequentTarget * 100}% on additional targets, none on repeat targets. Periodic damage gives none.`, 'Sum of life-on-hit bonuses', ['lifeOnHit']),
    addAttribute(row('maxMana', 'Maximum mana', s.maxMana, n(s.maxMana, 0), 'Mana capacity. Increasing it does not refill mana.', `${PLAYER_DEFAULTS.maxMana} + ${attributeBonus('intelligence', MANA_RULES.perIntelligence)} Intelligence + mana bonuses`, ['intelligence', 'maxMana']), 'intelligence'),
    row('manaRegen', 'Mana regeneration', s.manaRegeneration, `${n(s.manaRegeneration)} / s`, 'Restores mana continuously, up to maximum mana.', `${PLAYER_DEFAULTS.manaRegeneration} / s + bonuses ÷ ${MANA_RULES.regenerationPeriod}`, ['manaRegen']),
    row('manaOnKill', 'Mana on kill', s.manaOnKill, n(s.manaOnKill, 1), 'Restores mana when you kill an enemy, up to missing mana.', 'Sum of mana-on-kill bonuses', ['manaOnKill']),
    row('potion', 'Potion restoration bonus', s.potionMultiplier - 1, pct(s.potionMultiplier - 1), 'Boosts potion life and mana recovery, up to missing resources.', `${pct(PLAYER_ABILITIES.potion.lifeFraction)} life / ${pct(PLAYER_ABILITIES.potion.manaFraction)} mana × ${n(s.potionMultiplier)}\nBonus cap: 100%`, ['potionPercent']),
  ];
  const utility = [
    row('goldFind','Gold found',s.goldFindMultiplier-1,pct(s.goldFindMultiplier-1),'Increases gold dropped by enemies, chests and breakable objects. Excludes trading.',`Loot gold × ${n(s.goldFindMultiplier)}\nBonus cap: ${CHARM_REWARD_CAPS.gold}%`,['goldFindPercent']),
    row('xpGain','Experience gained',s.xpGainMultiplier-1,pct(s.xpGainMultiplier-1),'Increases experience from kills, events and journeys.',`Experience × ${n(s.xpGainMultiplier)}\nBonus cap: ${CHARM_REWARD_CAPS.xp}%`,['xpGainPercent']),
    row('movement', 'Movement speed', s.moveSpeedMultiplier, pct(s.moveSpeedMultiplier), '100% is normal speed. Attacks slow movement; dodge has its own speed.', `${PLAYER_MOVEMENT.speed} × ${n(s.moveSpeedMultiplier)} = ${n(PLAYER_MOVEMENT.speed * s.moveSpeedMultiplier)} units / s\nBefore action penalties · Limit: 50–175%`, ['moveSpeedPercent']),
    row('manaCost', 'Mana cost reduction', 1 - s.manaCostMultiplier, pct(1 - s.manaCostMultiplier), 'Reduces action mana costs. Skill minimums still apply.', `Action cost × ${n(s.manaCostMultiplier)}\nFirst 20% at full value · Further bonuses taper toward 40%`, ['manaCostPercent']),
    row('cooldown', 'Cooldown reduction', 1 - s.cooldownMultiplier, pct(1 - s.cooldownMultiplier), 'Shortens skill, dodge and potion cooldowns.', `Cooldown × ${n(s.cooldownMultiplier)}\nCap: 75% · Skill minimums still apply`, ['cooldownPercent']),
    row('area', 'Area of effect', s.areaMultiplier ** 2 - 1, `+${pct(s.areaMultiplier ** 2 - 1)}`, 'Enlarges skill sweeps, novas and explosions. Does not extend projectile travel.', `Radius / reach × ${n(s.areaMultiplier)}\nArea bonus cap: ${AFFIX_COMBAT_RULES.maxAreaPercent}%`, ['areaPercent']),
    row('pierce', 'Projectile pierce', s.projectilePierce, n(s.projectilePierce, 0), 'Extra projectile targets. Explosive projectiles still detonate on contact.', `Sum of pierce bonuses, rounded down\nCap: ${AFFIX_COMBAT_RULES.maxPierce} extra targets`, ['projectilePierce']),
    row('spellweave', 'Spellweave damage', s.spellweavePercent, `+${n(s.spellweavePercent)}%`, 'Melee empowers your next spell; spells empower your next melee hit. Excludes bows.', `Damage × ${n(1 + s.spellweavePercent / 100)}\n${AFFIX_COMBAT_RULES.weaveDuration}s · Does not stack · Bonus cap: 100%`, ['spellweavePercent']),
    row('afterguard', 'Armor after block', s.afterguardPercent, `+${n(s.afterguardPercent)}%`, 'Blocks boost armor temporarily. Further blocks refresh it.', `Armor × ${n(1 + s.afterguardPercent / 100)} for ${AFFIX_COMBAT_RULES.guardDuration}s\nBonus cap: 100% · Included in Armor while active`, ['afterguardPercent']),
  ];
  const ranks = Object.entries(s.skillBonuses).flatMap(([id, ranks]) => {
    const skill = SKILL_DEFINITIONS[id as keyof typeof SKILL_DEFINITIONS];
    return skill && ranks ? [row(`skill:${id}`, `${skill.name} bonus ranks`, ranks, `+${n(ranks, 0)}`, 'Adds ranks once this skill is learned. Costs no skill points.', `Equipment + skill tree ranks, rounded down\nCap: +${AFFIX_COMBAT_RULES.maxBonusRanks}`, [`skill:${skill.id}`])] : [];
  });
  return [{ title: 'Attributes', tone: 'attributes', rows: attributes }, { title: 'Offense', tone: 'offense', rows: offense },
    { title: 'Defense', tone: 'defense', rows: defense }, { title: 'Elemental resistances', tone: 'resistances', rows: resistances }, { title: 'Life & mana', tone: 'resources', rows: resources },
    { title: 'Utility & efficiency', tone: 'utility', rows: utility }, ...(ranks.length ? [{ title: 'Skill bonuses', tone: 'skills', rows: ranks }] : [])];
}
