import { itemAffixGrowthLevel } from './progression-content.ts';

/** Whole percentage points per attribute above the starting ten. */
export const ATTRIBUTE_DAMAGE_BONUSES = Object.freeze({ strength: 1.5, intelligence: 1.5 });
export const isOffensiveAttribute = (stat: string): stat is 'strength' | 'intelligence' => stat === 'strength' || stat === 'intelligence';
/** Matches the tapered affix budget, normalized to a two-point jewelry implicit. */
export const offensiveAttributeImplicitScale = (level: number) => .5 + .15 * itemAffixGrowthLevel(level);
