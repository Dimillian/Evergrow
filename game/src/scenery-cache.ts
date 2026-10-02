import type { Sprite } from './art-types.ts';

// Reserve space for the source, relief, edge, shadow, reflection and combined
// lighting canvases. This is a conservative CPU raster estimate, not GPU memory.
export const SCENERY_SURFACE_RESERVE = 14;
export class SceneryCache {
  private entries = new Map<string, { sprite: Sprite; pixels: number }>();
  private wanted = new Set<string>();
  private workingSet?: Iterable<string>;
  private pixels = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  readonly budget: number;
  constructor(budget: number) { this.budget = budget; }
  beginFrame(keys: Iterable<string>) {
    if (keys !== this.workingSet) { this.wanted = new Set(keys); this.workingSet = keys; }
    this.hits = this.misses = this.evictions = 0;
  }
  clear() { this.entries.clear(); this.wanted.clear(); this.workingSet = undefined; this.pixels = 0; this.hits = this.misses = this.evictions = 0; }
  get stats() { return { sprites: this.entries.size, pixels: this.pixels,
    reservedBytes: this.pixels * 4 * SCENERY_SURFACE_RESERVE,
    hits: this.hits, misses: this.misses, evictions: this.evictions }; }
  get(key: string): Sprite | undefined {
    const entry = this.entries.get(key);
    if (!entry) { this.misses++; return undefined; }
    this.hits++; this.entries.delete(key); this.entries.set(key, entry);
    return entry.sprite;
  }
  set(key: string, sprite: Sprite) {
    const pixels = [sprite.image, ...(sprite.foliage ?? [])].reduce((sum, image) => sum + image.width * image.height, 0);
    if (pixels * 4 * SCENERY_SURFACE_RESERVE > this.budget) return;
    const old = this.entries.get(key);
    if (old) { this.pixels -= old.pixels; this.entries.delete(key); }
    while ((this.pixels + pixels) * 4 * SCENERY_SURFACE_RESERVE > this.budget) {
      // All passes share one working set: an incoming tree cannot evict a still
      // visible sprite just because shadows and actors visit in different orders.
      let victim: string | undefined;
      for (const candidate of this.entries.keys()) if (!this.wanted.has(candidate)) { victim = candidate; break; }
      victim ??= this.entries.keys().next().value;
      if (victim === undefined) break;
      this.pixels -= this.entries.get(victim)!.pixels; this.entries.delete(victim); this.evictions++;
    }
    this.entries.set(key, { sprite, pixels }); this.pixels += pixels;
  }
}

/** Hysteresis avoids rebuilding raster tiers for tiny wheel/camera changes. */
export function sceneryZoom(zoom: number, previous = 1): number {
  const tiers = [.8, 1, 1.4, 1.8];
  let index = Math.max(0, tiers.indexOf(previous));
  while (index < tiers.length - 1 && zoom > (tiers[index] + tiers[index + 1]) / 2 + .025) index++;
  while (index > 0 && zoom < (tiers[index - 1] + tiers[index]) / 2 - .025) index--;
  return tiers[index];
}
