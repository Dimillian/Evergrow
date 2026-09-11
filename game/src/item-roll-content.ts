import type { Item } from './character-types.ts';

/** Uniform saved quantiles; widening preserves the midpoint before rounding and caps. */
export const ITEM_ROLL_RULES = Object.freeze({ minimum: .65, maximum: 1.35 });
export const itemRollMultiplier = (quantile: number): number =>
  ITEM_ROLL_RULES.minimum + Math.max(0, Math.min(1, quantile)) * (ITEM_ROLL_RULES.maximum - ITEM_ROLL_RULES.minimum);

/** A quality distinction for variable affixes, not an additional damage multiplier. */
export const GREATER_AFFIX_THRESHOLD = .9;
export const GREATER_AFFIX_SYMBOL = '✦';
export function isGreaterAffix(item: Item, index: number): boolean {
  const affix = item.affixes[index], roll = item.recipe.rolls[index];
  // Discrete rank/pierce recipes do not use the continuous roll-quality range.
  return !!affix && affix.value > 0 && affix.stat !== 'projectilePierce' && !affix.stat.startsWith('skill:')
    && Number.isFinite(roll) && roll >= GREATER_AFFIX_THRESHOLD && roll <= 1;
}
export const hasGreaterAffix = (item: Item): boolean => item.affixes.some((_, i) => isGreaterAffix(item, i));
