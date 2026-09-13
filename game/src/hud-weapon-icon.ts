import type { WeaponVisual } from './model.ts';
import { weaponShapes } from './weapon-shapes.ts';
import { drawGearShapes } from './equipment-art.ts';

const ANGLE = -Math.PI / 4;
const fits = new WeakMap<WeaponVisual, { x: number; y: number; span: number }>();
/** Fit the actual equipped silhouette, including short wands, to the square lens. */
export function weaponIconFit(visual: WeaponVisual): { x: number; y: number; span: number } {
  const cached = fits.get(visual);
  if (cached) return cached;
  const points = weaponShapes(visual).flatMap(shape => shape.points.map(([x, y]) =>
    [x * Math.cos(ANGLE) - y * Math.sin(ANGLE), x * Math.sin(ANGLE) + y * Math.cos(ANGLE)]));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const fit = { x: (left + right) / 2, y: (top + bottom) / 2, span: Math.max(right - left, bottom - top, 1) };
  fits.set(visual, fit);
  return fit;
}

export function drawHUDWeapon(c: CanvasRenderingContext2D, visual: WeaponVisual, size: number): void {
  const fit = weaponIconFit(visual), scale = size / fit.span;
  c.save(); c.scale(scale, scale); c.translate(-fit.x, -fit.y); c.rotate(ANGLE);
  drawGearShapes(c, weaponShapes(visual), color => color);
  c.restore();
}
