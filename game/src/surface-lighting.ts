/** Three broad lighting bands with soft shoulders preserve carved, readable planes. */
export function volumeDiffuse(dot: number): number {
  const smooth = (a: number, b: number) => { const t = Math.max(0, Math.min(1, (dot - a) / (b - a))); return t * t * (3 - 2 * t); };
  return .12 + .38 * smooth(.12, .4) + .5 * smooth(.56, .86);
}
export function surfaceDot(normal: readonly number[], direction: readonly number[]): number {
  const length = Math.hypot(...normal) * Math.hypot(...direction);
  return length > 0 ? Math.max(0, normal.reduce((sum, n, i) => sum + n * direction[i], 0) / length) : 0;
}
/** Coarse light keys bound sprite variants and avoid rebaking for every tiny light movement. */
export function volumeLightKey(direction: readonly number[], power: number, color: string, distance: number): string {
  const angle = Math.atan2(direction[1], direction[0]);
  return `${Math.round(angle * 8 / Math.PI)}:${Math.round(direction[2] * 4)}:${Math.round(power * 5)}:${color}:${distance > 460 ? 1 : 0}`;
}
