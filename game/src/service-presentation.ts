import type { Item, StatKey } from './character-types.ts';
import { itemModifiers, STAT_LABELS, formatStatValue } from './items.ts';

export const STOCK_CATEGORIES = ['weapons', 'armor', 'accessories'] as const;
export type StockCategory = typeof STOCK_CATEGORIES[number];
export const STOCK_CATEGORY_NAMES: Record<StockCategory, string> = { weapons: 'Weapons', armor: 'Armor', accessories: 'Accessories' };
export function stockCategory(item: Item): StockCategory {
  if (item.kind === 'weapon') return 'weapons';
  if (['ring', 'amulet', 'grimoire', 'orb', 'charm'].includes(item.kind)) return 'accessories';
  return 'armor';
}
export interface EnhancementGain { label: string; before: string; after: string; gain: string; }
/** Compare the actual derived item, never a guessed percentage or character DPS. */
export function enhancementGains(item: Item, next: Item): EnhancementGain[] {
  const rows: EnhancementGain[] = [];
  if (item.weapon && next.weapon && item.weapon.damage !== next.weapon.damage) {
    rows.push({ label: 'Base weapon damage', before: String(item.weapon.damage), after: String(next.weapon.damage), gain: `+${next.weapon.damage-item.weapon.damage}` });
  }
  const before = itemModifiers(item), after = itemModifiers(next);
  if (item.shield && next.shield) {
    before.blockChance = (before.blockChance ?? 0) + item.shield.blockChance;
    before.blockReduction = (before.blockReduction ?? 0) + item.shield.blockReduction;
    after.blockChance = (after.blockChance ?? 0) + next.shield.blockChance;
    after.blockReduction = (after.blockReduction ?? 0) + next.shield.blockReduction;
  }
  for (const stat of Object.keys(after) as StatKey[]) {
    const a = before[stat] ?? 0, b = after[stat] ?? 0;
    if (a === b) continue;
    rows.push({label:STAT_LABELS[stat],before:formatStatValue(stat,a),after:formatStatValue(stat,b),gain:formatStatValue(stat,b-a)});
  }
  return rows;
}
