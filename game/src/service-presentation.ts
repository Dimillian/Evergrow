import type { Item, StatKey } from './character-types.ts';
import { deriveItem, itemModifiers, STAT_LABELS, formatStatValue } from './items.ts';

export const STOCK_CATEGORIES = ['weapons', 'armor', 'accessories'] as const;
export type StockCategory = typeof STOCK_CATEGORIES[number];
export const STOCK_CATEGORY_NAMES: Record<StockCategory, string> = { weapons: 'Weapons', armor: 'Armor', accessories: 'Accessories' };
export function stockCategory(item: Item): StockCategory {
  if (item.kind === 'weapon') return 'weapons';
  if (['ring', 'amulet', 'grimoire', 'orb', 'charm'].includes(item.kind)) return 'accessories';
  return 'armor';
}
export interface EnhancementGain { label: string; before: string; after: string; gain: string; }
/** Read-only rank study using the same recipe derivation as the paid enhancement. */
export function previewEnhancement(item: Item, rank: number): Item {
  if (!Number.isInteger(rank) || rank < 0 || rank > 10 || item.kind === 'riftKey') throw new RangeError('Invalid enhancement preview');
  if (rank === item.recipe.enhancement) return item;
  return deriveItem({ ...item, recipe: { ...item.recipe, starter: rank === 0 && item.recipe.starter, enhancement: rank } });
}
/** Incremental gain for this one rank, independent of the item's current enhancement. */
export function enhancementStepGains(item: Item, rank: number): EnhancementGain[] {
  const next = previewEnhancement(item, rank);
  return rank === 0 ? [] : enhancementGains(previewEnhancement(item, rank - 1), next);
}
/** Compare the actual derived item, never a guessed percentage or character DPS. */
export function enhancementGains(item: Item, next: Item): EnhancementGain[] {
  const rows: EnhancementGain[] = [];
  if (item.weapon && next.weapon && item.weapon.damage !== next.weapon.damage) {
    const delta = next.weapon.damage - item.weapon.damage;
    rows.push({ label: 'Base weapon damage', before: String(item.weapon.damage), after: String(next.weapon.damage), gain: `${delta > 0 ? '+' : ''}${delta}` });
  }
  const before = itemModifiers(item), after = itemModifiers(next);
  if (item.shield && next.shield) {
    before.blockChance = (before.blockChance ?? 0) + item.shield.blockChance;
    before.blockReduction = (before.blockReduction ?? 0) + item.shield.blockReduction;
    after.blockChance = (after.blockChance ?? 0) + next.shield.blockChance;
    after.blockReduction = (after.blockReduction ?? 0) + next.shield.blockReduction;
  }
  for (const stat of new Set([...Object.keys(before), ...Object.keys(after)]) as Set<StatKey>) {
    const a = before[stat] ?? 0, b = after[stat] ?? 0;
    if (a === b) continue;
    rows.push({label:STAT_LABELS[stat],before:formatStatValue(stat,a),after:formatStatValue(stat,b),gain:formatStatValue(stat,b-a)});
  }
  return rows;
}
