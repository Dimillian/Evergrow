import { SKILL_STATS, type SkillStat } from './equipment-affix-content.ts';
import type { SkillId } from './character-types.ts';
import type { CharacterSheet, Item } from './character-types.ts';
import { planEquipmentChange, type EquipmentTarget } from './inventory.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { getTreeBonuses } from './skill-tree.ts';
import { deriveAttackStats, UNARMED_WEAPON } from './equipment.ts';

function values(sheet: CharacterSheet, level: number) {
  const stats = deriveCharacterStats(sheet, getTreeBonuses(sheet.allocatedNodes), level);
  const main = deriveAttackStats(stats, sheet.equipped.weapon?.weapon ?? UNARMED_WEAPON);
  const offhand = sheet.equipped.offhand?.weapon;
  const off = offhand ? deriveAttackStats(stats, offhand) : null;
  return { damage: main.damage, cadence: main.attacksPerSecond, offDamage: off?.damage ?? 0, offCadence: off?.attacksPerSecond ?? 0,
    fireResistance: stats.resistances.fire, frostResistance: stats.resistances.frost,
    lightningResistance: stats.resistances.lightning, arcaneResistance: stats.resistances.arcane,
    armor: stats.armor, maxHp: stats.maxHp, maxMana: stats.maxMana, blockChance: stats.blockChance,
    blockReduction: stats.blockReduction, critChance: stats.critChance, critMultiplier: stats.critMultiplier,
    manaRegeneration: stats.manaRegeneration, lifeRegeneration: stats.lifeRegeneration,
    moveSpeedMultiplier: stats.moveSpeedMultiplier, manaCostReduction: 1 - stats.manaCostMultiplier,
    cooldownReduction: 1 - stats.cooldownMultiplier, lifeOnHit: stats.lifeOnHit,
    attackSpeedMultiplier: stats.attackSpeedMultiplier, castSpeedMultiplier: stats.castSpeedMultiplier,
    spellDamageMultiplier: stats.spellDamageMultiplier,
    manaOnKill: stats.manaOnKill, areaPercent: (stats.areaMultiplier ** 2 - 1) * 100,
    potionPercent: (stats.potionMultiplier - 1) * 100, projectilePierce: stats.projectilePierce,
    spellweavePercent: stats.spellweavePercent, afterguardPercent: stats.afterguardPercent,
    ...Object.fromEntries(Object.keys(SKILL_STATS).map(key => [key, stats.skillBonuses[key.slice(6) as SkillId] ?? 0])) as Record<SkillStat, number>,
    ...stats.attributes };
}
export type PreviewStat = keyof ReturnType<typeof values>;
export interface EquipmentStatChange { key: PreviewStat; before: number; after: number; }
/** Full build preview, including the removal of the other hand. No live state is changed. */
export function previewEquipmentChange(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget = {}) {
  const plan = planEquipmentChange(sheet, item, level, target);
  if (!plan.ok) return plan;
  return { ...plan, changes: compareCharacterStats(sheet, { ...sheet, inventory: plan.inventory, equipped: plan.equipped }, level) };
}
export function compareCharacterStats(beforeSheet: CharacterSheet, afterSheet: CharacterSheet, level: number): EquipmentStatChange[] {
  const before = values(beforeSheet, level), after = values(afterSheet, level);
  const changes: EquipmentStatChange[] = [];
  for (const key of Object.keys(before) as PreviewStat[]) if (Math.abs(after[key] - before[key]) > .00001)
    changes.push({ key, before: before[key], after: after[key] });
  return changes;
}
