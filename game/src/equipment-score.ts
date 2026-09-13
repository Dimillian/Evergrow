import type { CharacterSheet, EquipmentSlot, StatModifiers } from './character-types.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { deriveAttackStats, UNARMED_WEAPON } from './equipment.ts';

type Priority = 'damage' | 'defense' | 'mana' | 'movement' | 'recovery';

function slotPriority(sheet: CharacterSheet, slot: EquipmentSlot): Priority | null {
  switch (slot) {
    case 'weapon': case 'gloves': return 'damage';
    case 'chest': case 'legs': return 'defense';
    case 'boots': return 'movement';
    case 'head': return 'mana';
    case 'cloak': return 'recovery';
    case 'offhand': {
      const kind = sheet.equipped.offhand?.kind;
      return kind === 'grimoire' ? 'mana' : kind === 'weapon' || kind === 'orb'
        || !kind && sheet.equipped.weapon?.weapon?.attackKind === 'bolt' ? 'damage' : 'defense';
    }
    default: return null;
  }
}

/** A slot-weighted estimate, not an optimizer for Unique powers or skill rotations. */
export function equipmentScorer(sheet: CharacterSheet, level: number, slot: EquipmentSlot, treeBonuses: StatModifiers): (candidate: CharacterSheet) => number {
  const priority = slotPriority(sheet, slot);
  return candidate => {
    const stats = deriveCharacterStats(candidate, treeBonuses, level);
    const main = candidate.equipped.weapon?.weapon ?? UNARMED_WEAPON;
    const attack = deriveAttackStats(stats, main);
    const offhand = main.hands === 1 && candidate.equipped.offhand?.weapon;
    const off = offhand ? deriveAttackStats(stats, offhand) : null;
    // Paired weapons alternate; adding their individual DPS would overvalue dual wield.
    const cadence = off ? 2 / (1 / attack.attacksPerSecond + 1 / off.attacksPerSecond) : attack.attacksPerSecond;
    const damage = (off ? (attack.damage + off.damage) / 2 : attack.damage) * cadence
      * (1 + stats.critChance * (stats.critMultiplier - 1)) * (stats.directDamageMultiplier ?? 1);
    // Compare protection against an even physical/elemental mix; capped stats come from the shared derivation.
    const resistance = Object.values(stats.resistances).reduce((sum, value) => sum + value, 0) / 4;
    const mitigation = (1 - (stats.damageReduction + resistance) / 2) * (1 - stats.blockChance * stats.blockReduction);
    const defense = (stats.maxHp + 5 * (stats.lifeRegeneration + cadence * stats.lifeOnHit)) / mitigation;
    const mana = (stats.maxMana + 5 * stats.manaRegeneration) / stats.manaCostMultiplier;
    const recovery = stats.potionMultiplier / stats.cooldownMultiplier;
    const values = { damage, defense, mana, movement: stats.moveSpeedMultiplier, recovery };
    const weights: Record<Priority, number> = { damage: 1, defense: 1, mana: .25, movement: 1, recovery: 1 };
    if (slot === 'cloak') { weights.defense = 2; weights.mana = 1; }
    if (priority) weights[priority] = 3;
    // Log ratios compare proportional gains across different units and keep rankings transitive.
    return (Object.keys(values) as Priority[]).reduce((score, key) => score + weights[key] * Math.log(values[key]), 0);
  };
}
