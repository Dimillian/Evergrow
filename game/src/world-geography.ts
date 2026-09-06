import { hydrology } from './hydrology.ts';
import { sampleBiome } from './biomes.ts';
import { validWorldRectangle } from './world-query.ts';
export const GEOGRAPHY_RULES = Object.freeze({ settlementSpacing: 11000, jitter: .22, cacheLimit: 512 });
export interface Place {
  id: number;
  cx: number;
  cy: number;
  x: number;
  y: number;
  seed: number;
  city: boolean;
}
export function geoHash(x: number, y: number, seed: number): number {
  let n = seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
const signed = (n: number) => n < 0 ? -2 * n - 1 : 2 * n;
export function placeId(cx: number, cy: number): number {
  const a = signed(cx), b = signed(cy);
  return a >= b ? a * a + a + b : a + b * b;
}
export function placeCell(id: number): [
  number,
  number
] {
  const r = Math.floor(Math.sqrt(id)), d = id - r * r;
  const a = d < r ? d : r, b = d < r ? r : d - r;
  const decode = (n: number) => n % 2 ? -(n + 1) / 2 : n / 2;
  return [decode(a), decode(b)];
}
const places = new Map<string, Place>();
const angle = (seed: number) => .24 + geoHash(0, 0, seed) / 4294967296 * .8;
export function geographyCoordinates(x: number, y: number, seed: number): [
  number,
  number
] {
  const a = angle(seed);
  y += 1150;
  return [(x * Math.cos(a) + y * Math.sin(a)) / 11000, (-x * Math.sin(a) + y * Math.cos(a)) / 11000];
}
/** Jittered two-dimensional sites, biased toward habitable ground; never query-order dependent. */
export function settlementPlace(seed: number, cx: number, cy: number): Place {
  const key = `${seed}:${cx}:${cy}`, cached = places.get(key);
  if (cached)
    return cached;
  const s = geoHash(cx, cy, seed), a = angle(seed), spacing = GEOGRAPHY_RULES.settlementSpacing;
  let x = 0, y = -1150, score = -Infinity, dryCandidate = false;
  if (cx || cy)
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt >= 3 && dryCandidate) break;
      const u = (cx + (geoHash(cx, cy, seed + attempt * 31 + 71) / 4294967296 - .5) * .44) * spacing;
      const v = (cy + (geoHash(cx, cy, seed + attempt * 37 + 93) / 4294967296 - .5) * .44) * spacing;
      const px = u * Math.cos(a) - v * Math.sin(a), py = u * Math.sin(a) + v * Math.cos(a) - 1150;
      const w = sampleBiome(px, py, seed).weights;
      const drainage = hydrology(seed);
      let waterPenalty = 0;
      for (const [dx, dy] of [[0, 0], [-650, 0], [650, 0], [0, -650], [0, 650], [-460, -460], [460, 460]])
        waterPenalty += drainage.sample(px + dx, py + dy).coverage;
      if (waterPenalty === 0) dryCandidate = true;
      const suitability = -waterPenalty * 20 + w.verdant + w.autumn * .7 - w.swamp - w.emberfall * .8 - w.highlands * .4;
      if (suitability > score) {
        score = suitability;
        x = px;
        y = py;
      }
    }
  const value = Object.freeze({ id: placeId(cx, cy), cx, cy, x, y, seed: s, city: !!(cx || cy) && s % 5 === 0 });
  if (places.size >= 512)
    places.delete(places.keys().next().value!);
  places.set(key, value);
  return value;
}
export function queryPlaces(seed: number, x: number, y: number, width: number, height: number, margin = 1000): Place[] {
  if (!validWorldRectangle(x, y, width, height))
    return [];
  const corners = [[x - margin, y - margin], [x + width + margin, y - margin], [x - margin, y + height + margin], [x + width + margin, y + height + margin]].map(([px, py]) => geographyCoordinates(px, py, seed));
  const minX = Math.floor(Math.min(...corners.map(p => p[0])) - 1), maxX = Math.ceil(Math.max(...corners.map(p => p[0])) + 1);
  const minY = Math.floor(Math.min(...corners.map(p => p[1])) - 1), maxY = Math.ceil(Math.max(...corners.map(p => p[1])) + 1);
  if ((maxX - minX + 1) * (maxY - minY + 1) > 4096)
    return [];
  const result: Place[] = [];
  for (let cy = minY; cy <= maxY; cy++)
    for (let cx = minX; cx <= maxX; cx++) {
      const p = settlementPlace(seed, cx, cy);
      if (p.x >= x - margin && p.x <= x + width + margin && p.y >= y - margin && p.y <= y + height + margin)
        result.push(p);
    }
  return result;
}
/** Every place has a strictly inward neighbor: a connected tree without global generation. */
export function parentPlace(seed: number, p: Place): Place | null {
  if (!p.cx && !p.cy)
    return null;
  const candidates: Place[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = p.cx + dx, cy = p.cy + dy;
      if (cx * cx + cy * cy < p.cx * p.cx + p.cy * p.cy)
        candidates.push(settlementPlace(seed, cx, cy));
    }
  return candidates.sort((a, b) => {
    const cost = (q: Place) => Math.hypot(q.x - p.x, q.y - p.y) + Math.hypot(q.cx, q.cy) * 6600;
    return cost(a) - cost(b) || a.id - b.id;
  })[0];
}
