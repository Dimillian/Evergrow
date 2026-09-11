/** Transient state shared only by projectiles/impacts released by one cast. */
export interface CastHitBudget { readonly repeatMultiplier: number; readonly targets: Set<number>; }
export const createCastHitBudget = (repeatMultiplier: number): CastHitBudget => ({repeatMultiplier, targets:new Set()});
export function castHitMultiplier(budget: CastHitBudget | undefined, target: number): number {
  if (!budget) return 1;
  if (budget.targets.has(target)) return budget.repeatMultiplier;
  budget.targets.add(target);
  return 1;
}
