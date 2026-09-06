import { eventSite, type EventSite } from './poi-content.ts';
import { type WildernessSite } from './wilderness-sites.ts';
import { roadAnchors } from './road-shape.ts';
import { getZoneAt } from './zone-progression.ts';
import type { BiomeSample } from './biomes.ts';
interface SiteWorld {
  seed: number;
  getWildernessSites(x: number, y: number, w: number, h: number): WildernessSite[];
  blocked(x: number, y: number, r: number): boolean;
  isSanctuary(x: number, y: number): boolean;
  sampleBiome(x: number, y: number): BiomeSample;
}
/** Independent roadside placements leave the existing climate/camp geography intact. */
export function queryEventSites(world: SiteWorld, x: number, y: number, w: number, h: number): EventSite[] {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const sites = world.getWildernessSites(x - 220, y - 220, w + 440, h + 440).map(site => eventSite(site, world.seed));
  for (const anchor of roadAnchors(x, y, w, h, world.seed, 6531)) {
    const {seed, x: sx, y: sy} = anchor;
    if (Math.hypot(sx, sy) < 420 || world.isSanctuary(sx, sy) || world.blocked(sx, sy, 25)
      || world.getWildernessSites(sx - 330, sy - 330, 660, 660).some(s => Math.hypot(s.x - sx, s.y - sy) < s.radius + 300)) continue;
    sites.push({ id: `reliquary:${anchor.id}`, kind: 'reliquary', name: 'Roadside reliquary', x: sx, y: sy, seed, biome: world.sampleBiome(sx, sy).id, level: getZoneAt(sx, sy, world.seed).level });
  }
  return sites.filter(s => s.x >= x && s.x < x + w && s.y >= y && s.y < y + h);
}
