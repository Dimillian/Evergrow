import { itemAffixGrowthLevel, normalizeLevel } from './progression-content.ts';

/** Item and passive manaRegen modifiers are whole/fractional mana per five seconds. */
export const MANA_RULES = Object.freeze({ perIntelligence:2, regenerationPeriod:5, costKnee:20, maxCostReduction:40,
  vialBase:8, vialPerLevel:.35, vialMaxFraction:.16 });
export const manaImplicitScale = (level:number) => 1 + .04 * itemAffixGrowthLevel(level);
/** Preserve ordinary investment; progressively taper additional efficiency toward 40%. */
export function manaCostMultiplier(bonus:number):number {
  if(bonus<=MANA_RULES.costKnee)return Math.min(2,1-bonus/100);
  const room=MANA_RULES.maxCostReduction-MANA_RULES.costKnee;
  const reduction=MANA_RULES.costKnee+room*(1-Math.exp(-(bonus-MANA_RULES.costKnee)/room));
  return 1-reduction/100;
}
/** Snapshot at death; the collecting character cannot increase the source-level amount. */
export const manaVialAmount = (level:number) => Math.round(MANA_RULES.vialBase+MANA_RULES.vialPerLevel*(normalizeLevel(level)-1));
export const manaVialRestoration = (maximum:number,amount:number) => Math.min(maximum*MANA_RULES.vialMaxFraction,amount);
