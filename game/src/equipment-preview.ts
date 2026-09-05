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
    armor: stats.armor, maxHp: stats.maxHp, maxMana: stats.maxMana, blockChance: stats.blockChance,
    blockReduction: stats.blockReduction, critChance: stats.critChance, critMultiplier: stats.critMultiplier,
    manaRegeneration: stats.manaRegeneration, lifeRegeneration: stats.lifeRegeneration,
    moveSpeedMultiplier: stats.moveSpeedMultiplier, manaCostReduction: 1 - stats.manaCostMultiplier,
    cooldownReduction: 1 - stats.cooldownMultiplier, lifeOnHit: stats.lifeOnHit,
    attackSpeedMultiplier: stats.attackSpeedMultiplier, castSpeedMultiplier: stats.castSpeedMultiplier,
    spellDamageMultiplier: stats.spellDamageMultiplier,
    ...stats.attributes };
}
export type PreviewStat = keyof ReturnType<typeof values>;
export interface EquipmentStatChange { key: PreviewStat; before: number; after: number; }
/** Full build preview, including the removal of the other hand. No live state is changed. */
export function previewEquipmentChange(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget = {}) {
  const plan = planEquipmentChange(sheet, item, level, target);
  if (!plan.ok) return plan;
  const before = values(sheet, level), after = values({ ...sheet, inventory: plan.inventory, equipped: plan.equipped }, level);
  const changes: EquipmentStatChange[] = [];
  for (const key of Object.keys(before) as PreviewStat[]) if (Math.abs(after[key] - before[key]) > .00001)
    changes.push({ key, before: before[key], after: after[key] });
  return { ...plan, changes };
}
