import type { StatModifiers } from './character-types.ts';
import { itemPowerScale } from './progression-content.ts';
export const BORROWED_FLAME = Object.freeze({ node: 'keystone:borrowed-flame', empoweredMultiplier: 1.4, baselineMultiplier: .85 });
/** Tree armor keeps its same-level defensive value; gear retains its own item-level scaling. */
export function scaleTreeDefenses(bonuses: StatModifiers, level: number): StatModifiers {
  return { ...bonuses, ...(bonuses.armor ? { armor: bonuses.armor * itemPowerScale(level) } : {}) };
}
