/** Uniform saved quantiles; widening preserves the midpoint before rounding and caps. */
export const ITEM_ROLL_RULES = Object.freeze({ minimum: .65, maximum: 1.35 });
export const itemRollMultiplier = (quantile: number): number =>
  ITEM_ROLL_RULES.minimum + Math.max(0, Math.min(1, quantile)) * (ITEM_ROLL_RULES.maximum - ITEM_ROLL_RULES.minimum);
