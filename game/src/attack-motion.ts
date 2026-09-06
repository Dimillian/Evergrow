/** Shared angular sweep for the rendered blade and deterministic melee contact. */
export function getActiveSwingOffset(progress: number, arc: number, hand: 'main' | 'off' = 'main'): number {
  const t = Math.max(0, Math.min(1, progress));
  return (hand === 'main' ? -1 : 1) * (-arc / 2 + arc * t * t * (3 - 2 * t));
}
