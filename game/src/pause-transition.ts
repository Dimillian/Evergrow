/** Presentation time keeps running while simulation time is paused. */
export function advancePauseTransition(current: number, paused: boolean, dt: number, reducedMotion: boolean): number {
  const target = paused ? 1 : 0;
  if (reducedMotion) return target;
  const step = Math.max(0, dt) / (paused ? 1 : .75);
  return paused ? Math.min(1, current + step) : Math.max(0, current - step);
}
