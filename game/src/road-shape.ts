import { sampleBiome } from './biomes.ts';
import { geoHash, parentPlace, queryPlaces, settlementPlace, type Place } from './world-geography.ts';
import { validWorldRectangle } from './world-query.ts';
export interface RoadPath {
  id: string;
  main: boolean;
  points: readonly (readonly [
    number,
    number
  ])[];
  from: Place;
  to: Place;
  length: number;
}
const paths = new Map<string, RoadPath>();
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
/** One polyline is shared by terrain, atlas, prop clearance and regional travel costs. */
export function connectingRoad(seed: number, from: Place, to: Place): RoadPath {
  if (from.id > to.id)
    [from, to] = [to, from];
  const id = `${seed}:${from.id}:${to.id}`, found = paths.get(id);
  if (found)
    return found;
  const main = parentPlace(seed, from)?.id === to.id || parentPlace(seed, to)?.id === from.id;
  const direction = to.y >= from.y ? 1 : -1;
  const a = [from.x, from.y + direction * 1100], b = [to.x, to.y - direction * 1100];
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  let bend = 0, best = Infinity;
  for (const sign of [-1, 1]) {
    const amount = sign * length * (.13 + geoHash(from.id, to.id, seed) / 4294967296 * .12);
    let cost = 0;
    for (const t of [.25, .5, .75]) {
      const w = sampleBiome(a[0] + dx * t + nx * amount * Math.sin(Math.PI * t), a[1] + dy * t + ny * amount * Math.sin(Math.PI * t), seed).weights;
      cost += w.swamp * 2 + w.highlands + w.emberfall * .7;
    }
    if (cost < best) {
      best = cost;
      bend = amount;
    }
  }
  const mid: [
    number,
    number
  ] = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  const points: Array<readonly [
    number,
    number
  ]> = [[from.x, from.y], [a[0], a[1]]];
  const cubic = (p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[], steps: number) => {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      points.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  };
  const tangent = [dx * .18, dy * .18], steps = Math.max(24, Math.ceil(length / 160));
  cubic(a, [a[0], a[1] + direction * length * .22], [mid[0] - tangent[0], mid[1] - tangent[1]], mid, steps);
  cubic(mid, [mid[0] + tangent[0], mid[1] + tangent[1]], [b[0], b[1] - direction * length * .22], b, steps);
  points.push([to.x, to.y]);
  const total = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
  const value = Object.freeze({ id, main, from, to, points: Object.freeze(points.map(p => Object.freeze(p))), length: total });
  if (paths.size >= 512)
    paths.delete(paths.keys().next().value!);
  paths.set(id, value);
  return value;
}
export function roadPaths(x: number, y: number, width: number, height: number, seed = 7319): RoadPath[] {
  if (!validWorldRectangle(x, y, width, height))
    return [];
  const result = new Map<string, RoadPath>();
  for (const p of queryPlaces(seed, x, y, width, height, 24000)) {
    const parent = parentPlace(seed, p);
    if (parent) {
      const r = connectingRoad(seed, p, parent);
      result.set(r.id, r);
    }
    // Occasional lateral links close loops instead of giving every town four grid streets.
    if (geoHash(p.cx, p.cy, seed + 573) % 7 === 0) {
      const q = settlementPlace(seed, p.cx + 1, p.cy + 1), r = connectingRoad(seed, p, q);
      result.set(r.id, r);
    }
  }
  return [...result.values()].filter(r => r.points.some((p, i) => {
    const q = r.points[Math.max(0, i - 1)];
    return Math.max(p[0], q[0]) >= x - 80 && Math.min(p[0], q[0]) <= x + width + 80 && Math.max(p[1], q[1]) >= y - 80 && Math.min(p[1], q[1]) <= y + height + 80;
  }));
}
interface Segment {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  length2: number;
}
const buckets = new Map<string, readonly Segment[]>();
function segmentsAt(x: number, y: number, seed: number): readonly Segment[] {
  const cx = Math.floor(x / 1024), cy = Math.floor(y / 1024), key = `${seed}:${cx}:${cy}`, cached = buckets.get(key);
  if (cached)
    return cached;
  const result: Segment[] = [];
  for (const road of roadPaths(cx * 1024 - 300, cy * 1024 - 300, 1624, 1624, seed))
    for (let i = 1; i < road.points.length; i++) {
      const [ax, ay] = road.points[i - 1], [bx, by] = road.points[i];
      if (Math.max(ax, bx) < cx * 1024 - 300 || Math.min(ax, bx) > (cx + 1) * 1024 + 300 || Math.max(ay, by) < cy * 1024 - 300 || Math.min(ay, by) > (cy + 1) * 1024 + 300)
        continue;
      result.push({ ax, ay, dx: bx - ax, dy: by - ay, length2: (bx - ax) ** 2 + (by - ay) ** 2 });
    }
  if (buckets.size >= 512)
    buckets.delete(buckets.keys().next().value!);
  buckets.set(key, result);
  return result;
}
export function pathDistance(x: number, y: number, seed = 7319): number {
  let distance = Infinity;
  for (const s of segmentsAt(x, y, seed)) {
    const t = clamp(((x - s.ax) * s.dx + (y - s.ay) * s.dy) / s.length2);
    distance = Math.min(distance, Math.hypot(x - s.ax - t * s.dx, y - s.ay - t * s.dy));
  }
  return distance;
}
export function roadSurface(x: number, y: number, seed: number): {
  weight: number;
  distance: number;
  tracks: number;
} {
  const distance = pathDistance(x, y, seed), phase = seed % 997 / 997 * Math.PI * 2;
  const width = 28 + Math.sin(x / 211 + y / 257 + phase) * 3;
  const erosion = Math.sin(x / 43 + Math.sin(y / 61) + phase) * 1.8 + Math.sin(y / 19 - x / 37 + phase * 2) * .8;
  return { distance, weight: 1 - smooth(width - 5, width + 19, distance + erosion), tracks: (1 - smooth(1, 4.5, Math.abs(distance - 10.5))) * (.5 + .25 * Math.sin((x + y) / 83 + phase)) };
}
const costs = new Map<string, number>();
export function placeTravel(seed: number, p: Place): number {
  const key = `${seed}:${p.id}`, cached = costs.get(key);
  if (cached !== undefined)
    return cached;
  let total = 0, current = p;
  // Bounded even at the furthest supported coordinates.
  for (let i = 0; i < 128; i++) {
    const parent = parentPlace(seed, current);
    if (!parent)
      break;
    total += connectingRoad(seed, current, parent).length;
    current = parent;
  }
  if (current.cx || current.cy)
    total += Math.hypot(current.x, current.y) * 1.4;
  if (costs.size >= 512)
    costs.delete(costs.keys().next().value!);
  costs.set(key, total);
  return total;
}
export function routeDangerDistance(x: number, y: number, seed: number): {
  travel: number;
  remoteness: number;
} {
  let best = Infinity, travel = 0;
  for (const r of roadPaths(x - 12000, y - 12000, 24000, 24000, seed)) {
    let walked = 0;
    const from = placeTravel(seed, r.from), to = placeTravel(seed, r.to);
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (length * length));
      const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
      if (d < best) {
        best = d;
        travel = from + (to - from) * (walked + t * length) / r.length;
      }
      walked += length;
    }
  }
  return { travel, remoteness: best };
}
export interface RoadAnchor {
  id: string;
  x: number;
  y: number;
  seed: number;
}
const anchors = new Map<string, RoadAnchor | null>();
/** Roadside objects own two-dimensional cells and follow the actual local route. */
export function roadAnchors(x: number, y: number, width: number, height: number, seed: number, salt: number): RoadAnchor[] {
  if (!validWorldRectangle(x, y, width, height))
    return [];
  const size = 2200, minX = Math.floor(x / size), maxX = Math.floor((x + width) / size), minY = Math.floor(y / size), maxY = Math.floor((y + height) / size);
  if ((maxX - minX + 1) * (maxY - minY + 1) > 4096)
    return [];
  const result: RoadAnchor[] = [];
  for (let cy = minY; cy <= maxY; cy++)
    for (let cx = minX; cx <= maxX; cx++) {
      const key = `${seed}:${salt}:${cx}:${cy}`;
      if (!anchors.has(key)) {
        const hash = geoHash(cx, cy, seed + salt), routes = roadPaths(cx * size, cy * size, size, size, seed);
        let anchor: RoadAnchor | null = null;
        if (routes.length && hash % 4 !== 0) {
          const r = routes[hash % routes.length];
          const choices = r.points.slice(1).map((p, i) => ({ p, a: r.points[i] })).filter(({ p }) => p[0] > cx * size + 100 && p[0] < (cx + 1) * size - 100 && p[1] > cy * size + 100 && p[1] < (cy + 1) * size - 100);
          if (choices.length) {
            const { p, a } = choices[hash % choices.length], length = Math.hypot(p[0] - a[0], p[1] - a[1]), side = hash % 2 ? 1 : -1;
            anchor = { id: key, seed: hash, x: p[0] - (p[1] - a[1]) / length * 84 * side, y: p[1] + (p[0] - a[0]) / length * 84 * side };
          }
        }
        if (anchors.size >= 2048)
          anchors.delete(anchors.keys().next().value!);
        anchors.set(key, anchor);
      }
      const a = anchors.get(key);
      if (a && a.x >= x && a.x < x + width && a.y >= y && a.y < y + height)
        result.push(a);
    }
  return result;
}
