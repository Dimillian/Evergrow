import { sampleBiome } from './biomes.ts';
import { isWorldCoordinate, validWorldRectangle } from './world-query.ts';

export const HYDROLOGY = Object.freeze({ spacing: 4800, bucket: 512, nodes: 4096, features: 1024, buckets: 512 });
export interface WaterSample { coverage: number; depth: number; flowX: number; flowY: number; bank: number; kind: 'river' | 'lake' | 'dry'; }
export const DRY_WATER: Readonly<WaterSample> = Object.freeze({ coverage: 0, depth: 0, flowX: 0, flowY: 0, bank: 0, kind: 'dry' });
interface Node { cx: number; cy: number; x: number; y: number; tier: number; rain: number; }
export interface RiverPoint { readonly x: number; readonly y: number; readonly width: number; readonly elevation: number; }
export interface WaterFeature { readonly id: string; readonly kind: 'river' | 'lake'; readonly points: readonly RiverPoint[]; readonly runoff: number; }
interface Segment { ax: number; ay: number; bx: number; by: number; aw: number; bw: number; flowAX: number; flowAY: number; flowBX: number; flowBY: number; }
interface Lake { x: number; y: number; rx: number; ry: number; phase: number; }
interface Bucket { segments: Segment[]; lakes: Lake[]; }
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
function hash(x: number, y: number, seed: number) {
  let n = seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / 4294967296), 0x165667b1) ^ Math.imul(Math.floor(y / 4294967296), 0x85ebca77);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), tx = smooth(x - ix), ty = smooth(y - iy);
  return (hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty)
    + (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty;
}
function remember<T>(cache: Map<string, T>, key: string, value: T, max: number): T {
  if (cache.size >= max) cache.delete(cache.keys().next().value!);
  cache.set(key, value); return value;
}

/** Immutable drainage blueprints. Six descending terrain tiers bound upstream work and prohibit cycles.
 * Rain originates sparsely; every wet outlet continues to its receiving basin, independent of query order.
 * Rivers carve a continuously descending bed between anchors. No world-sized fluid state is allocated. */
export class Hydrology {
  private nodes = new Map<string, Node>();
  private drains = new Map<string, Node | null>();
  private runoff = new Map<string, number>();
  private features = new Map<string, WaterFeature | null>();
  private buckets = new Map<string, Bucket>();
  readonly seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  get cacheStats() { return { nodes: this.nodes.size, drains: this.drains.size, runoff: this.runoff.size, features: this.features.size, buckets: this.buckets.size }; }
  private node(cx: number, cy: number): Node {
    const key = `${cx}:${cy}`, cached = this.nodes.get(key); if (cached) return cached;
    const x = (cx + .5 + (hash(cx, cy, this.seed + 11) - .5) * .46) * HYDROLOGY.spacing;
    const y = (cy + .5 + (hash(cx, cy, this.seed + 29) - .5) * .46) * HYDROLOGY.spacing;
    const w = sampleBiome(x, y, this.seed).weights;
    const elevation = clamp(noise(cx * .43, cy * .43, this.seed + 701) * .57 + hash(cx, cy, this.seed + 73) * .43 + w.highlands * .12);
    const tier = Math.min(5, Math.floor(elevation * 6));
    const wet = .17 + w.swamp * .22 + w.verdant * .08 + w.frostpine * .04 - w.emberfall * .13;
    const rain = hash(cx, cy, this.seed + 101) < wet && tier > 0 ? 1 + w.swamp * .6 : 0;
    return remember(this.nodes, key, Object.freeze({ cx, cy, x, y, tier, rain }), HYDROLOGY.nodes);
  }
  private drain(n: Node): Node | null {
    const key = `${n.cx}:${n.cy}`; if (this.drains.has(key)) return this.drains.get(key)!;
    let best: Node | null = null, score = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const q = this.node(n.cx + dx, n.cy + dy);
      const cost = q.tier * 10000 + Math.hypot(q.x - n.x, q.y - n.y);
      if (q.tier < n.tier && cost < score) { best = q; score = cost; }
    }
    return remember(this.drains, key, best, HYDROLOGY.nodes);
  }
  private discharge(n: Node): number {
    const key = `${n.cx}:${n.cy}`, cached = this.runoff.get(key); if (cached !== undefined) return cached;
    let total = n.rain;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const q = this.node(n.cx + dx, n.cy + dy); if (q.tier <= n.tier) continue;
      const d = this.drain(q); if (d?.cx === n.cx && d.cy === n.cy) total += this.discharge(q);
    }
    return remember(this.runoff, key, total, HYDROLOGY.nodes);
  }
  feature(cx: number, cy: number): WaterFeature | null {
    const key = `${cx}:${cy}`; if (this.features.has(key)) return this.features.get(key)!;
    const a = this.node(cx, cy), runoff = this.discharge(a);
    if (runoff <= 0) return remember(this.features, key, null, HYDROLOGY.features);
    const b = this.drain(a), points: RiverPoint[] = [];
    if (b) {
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
      const width = 32 + Math.sqrt(runoff) * 26, source = runoff <= a.rain, endWidth = 32 + Math.sqrt(this.discharge(b)) * 26;
      const phase = hash(cx, cy, this.seed + 37) * Math.PI * 2;
      const count = Math.ceil(length / 100);
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const bend = Math.sin(Math.PI * t) * (Math.sin(t * Math.PI * 2 + phase) * length * .08 + Math.sin(t * Math.PI * 6 + phase) * length * .016);
        let x = a.x + dx * t + nx * bend, y = a.y + dy * t + ny * bend;
        // The fixed starting settlement occupies a dry island; route channels around its outer bank.
        const ox = x, oy = y + 850, r = Math.hypot(ox, oy);
        if (r < 1500) { const angle = r > 1 ? Math.atan2(oy, ox) : phase; x = Math.cos(angle) * 1500; y = -850 + Math.sin(angle) * 1500; }
        points.push(Object.freeze({ x, y, width: (width + (endWidth - width) * t) * (source ? .22 + .78 * smooth(t / .2) : 1), elevation: (a.tier + (b.tier - a.tier) * t) * 80 }));
      }
    } else {
      points.push(Object.freeze({ x: a.x, y: a.y, width: 240 + Math.sqrt(runoff) * 160, elevation: a.tier * 80 }));
    }
    return remember(this.features, key, Object.freeze({ id: key, kind: b ? 'river' : 'lake', points: Object.freeze(points), runoff }), HYDROLOGY.features);
  }
  /** Conservative local segment index. Exact sampling uses the same geometry at every map scale. */
  private bucket(x: number, y: number): Bucket {
    const bx = Math.floor(x / HYDROLOGY.bucket), by = Math.floor(y / HYDROLOGY.bucket), key = `${bx}:${by}`;
    const cached = this.buckets.get(key); if (cached) return cached;
    const result: Bucket = { segments: [], lakes: [] }, left = bx * HYDROLOGY.bucket, top = by * HYDROLOGY.bucket;
    const cx = Math.floor((left + HYDROLOGY.bucket / 2) / HYDROLOGY.spacing), cy = Math.floor((top + HYDROLOGY.bucket / 2) / HYDROLOGY.spacing);
    for (let iy = cy - 2; iy <= cy + 2; iy++) for (let ix = cx - 2; ix <= cx + 2; ix++) {
      const f = this.feature(ix, iy); if (!f) continue;
      if (f.kind === 'lake') {
        const p = f.points[0], rx = p.width, ry = rx * (.62 + hash(ix, iy, this.seed + 53) * .3);
        if (p.x + rx * 1.2 < left || p.x - rx * 1.2 > left + 512 || p.y + ry * 1.2 < top || p.y - ry * 1.2 > top + 512) continue;
        result.lakes.push({ x: p.x, y: p.y, rx, ry, phase: hash(ix, iy, this.seed + 79) * Math.PI * 2 });
      } else for (let i = 1; i < f.points.length; i++) {
        const a = f.points[i - 1], b = f.points[i], margin = Math.max(a.width, b.width) + 80;
        if (Math.max(a.x, b.x) + margin < left || Math.min(a.x, b.x) - margin > left + 512 || Math.max(a.y, b.y) + margin < top || Math.min(a.y, b.y) - margin > top + 512) continue;
        const before = f.points[Math.max(0, i - 2)], after = f.points[Math.min(f.points.length - 1, i + 1)];
        const al = Math.hypot(b.x - before.x, b.y - before.y) || 1;
        const bl = Math.hypot(after.x - a.x, after.y - a.y) || 1;
        result.segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, aw: a.width, bw: b.width,
          flowAX: (b.x - before.x) / al, flowAY: (b.y - before.y) / al,
          flowBX: (after.x - a.x) / bl, flowBY: (after.y - a.y) / bl });
      }
    }
    return remember(this.buckets, key, result, HYDROLOGY.buckets);
  }
  sample(x: number, y: number): WaterSample {
    if (![x, y].every(isWorldCoordinate)) return { ...DRY_WATER };
    const bucket = this.bucket(x, y);
    let edge = -Infinity, depth = 0, flowX = 0, flowY = 0, kind: WaterSample['kind'] = 'dry';
    for (const s of bucket.segments) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, t = clamp(((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1));
      const width = s.aw + (s.bw - s.aw) * t, d = Math.hypot(x - s.ax - dx * t, y - s.ay - dy * t);
      const shore = width - d + Math.sin(x * .026 + Math.sin(y * .019)) * 5 + Math.sin(y * .053 + x * .017) * 2;
      if (shore > edge) { edge = shore; depth = .16 + clamp(shore / width) * .9; flowX = s.flowAX + (s.flowBX - s.flowAX) * t; flowY = s.flowAY + (s.flowBY - s.flowAY) * t; kind = 'river'; }
    }
    for (const lake of bucket.lakes) {
      const dx = (x - lake.x) / lake.rx, dy = (y - lake.y) / lake.ry, angle = Math.atan2(dy, dx);
      const radius = 1 + Math.sin(angle * 3 + lake.phase) * .11 + Math.sin(angle * 5 - lake.phase) * .045;
      const shore = (radius - Math.hypot(dx, dy)) * Math.min(lake.rx, lake.ry);
      if (shore > edge) { edge = shore; depth = .2 + clamp(shore / 260) * 1.6; flowX = flowY = 0; kind = 'lake'; }
    }
    if (edge < -30) return { ...DRY_WATER };
    const coverage = smooth(edge / 15), bank = (1 - smooth(Math.abs(edge + 3) / 30));
    if (coverage > 0) {
      // Blend overlapping segment tangents rather than switching the whole channel
      // to whichever capsule won its distance query. Compact support keeps bucket seams invisible.
      let fx = 0, fy = 0, total = 0;
      const roughness = Math.sin(x * .026 + Math.sin(y * .019)) * 5 + Math.sin(y * .053 + x * .017) * 2;
      for (const s of bucket.segments) {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const t = clamp(((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1));
        const shore = s.aw + (s.bw - s.aw) * t - Math.hypot(x - s.ax - dx * t, y - s.ay - dy * t) + roughness;
        const weight = smooth(1 - (edge - shore) / 32);
        fx += (s.flowAX + (s.flowBX - s.flowAX) * t) * weight;
        fy += (s.flowAY + (s.flowBY - s.flowAY) * t) * weight; total += weight;
      }
      for (const lake of bucket.lakes) {
        const dx = (x - lake.x) / lake.rx, dy = (y - lake.y) / lake.ry, angle = Math.atan2(dy, dx);
        const radius = 1 + Math.sin(angle * 3 + lake.phase) * .11 + Math.sin(angle * 5 - lake.phase) * .045;
        const shore = (radius - Math.hypot(dx, dy)) * Math.min(lake.rx, lake.ry);
        total += smooth(1 - (edge - shore) / 32);
      }
      if (total > 0) { flowX = fx / total; flowY = fy / total; }
    }
    return { coverage, depth: depth * coverage, flowX: flowX * coverage, flowY: flowY * coverage, bank, kind: coverage ? kind : 'dry' };
  }
  query(x: number, y: number, width: number, height: number): WaterFeature[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const s = HYDROLOGY.spacing, minX = Math.floor(x / s) - 2, minY = Math.floor(y / s) - 2;
    const maxX = Math.floor((x + width) / s) + 2, maxY = Math.floor((y + height) / s) + 2;
    if ((maxX - minX + 1) * (maxY - minY + 1) > 4096) return [];
    const out: WaterFeature[] = [];
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) { const f = this.feature(cx, cy); if (f) out.push(f); }
    return out;
  }
}
const worlds = new Map<number, Hydrology>();
export function hydrology(seed: number): Hydrology {
  seed >>>= 0; let world = worlds.get(seed); if (world) return world;
  if (worlds.size >= 4) worlds.delete(worlds.keys().next().value!);
  world = new Hydrology(seed); worlds.set(seed, world); return world;
}
