export interface NavigationRect { left: number; top: number; width: number; height: number; }

/** Choose the closest control in the requested direction, favoring the same row/column. */
export function directionalControl(rects: readonly NavigationRect[], current: number, key: string): number {
  const origin = rects[current];
  if (!origin) return 0;
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  let best = current, score = Infinity;
  rects.forEach((rect, index) => {
    if (index === current) return;
    const dx = rect.left + rect.width / 2 - origin.left - origin.width / 2;
    const dy = rect.top + rect.height / 2 - origin.top - origin.height / 2;
    const forward = (horizontal ? dx : dy) * sign, sideways = Math.abs(horizontal ? dy : dx);
    if (forward <= 1) return;
    const value = forward + sideways * 4;
    if (value < score) { score = value; best = index; }
  });
  return best;
}
