export interface WaterView { left: number; top: number; width: number; height: number; }
/** Conservative coverage crop and a separate padded source for refracted edge samples. */
export function waterView(view: WaterView, water: WaterView | undefined) {
  if (!water) return null;
  const left = Math.max(view.left, water.left), top = Math.max(view.top, water.top);
  const right = Math.min(view.left + view.width, water.left + water.width), bottom = Math.min(view.top + view.height, water.top + water.height);
  if (right <= left || bottom <= top) return null;
  const crop = { left, top, width: right - left, height: bottom - top };
  // Height is clamped to +/-4; 192 world units cover the largest legal refraction bend.
  const sl = Math.max(view.left, left - 192), st = Math.max(view.top, top - 192);
  return { crop, source: { left: sl, top: st, width: Math.min(view.left + view.width, right + 192) - sl,
    height: Math.min(view.top + view.height, bottom + 192) - st } };
}
