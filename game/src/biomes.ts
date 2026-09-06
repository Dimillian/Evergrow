export const BIOME_IDS = Object.freeze(['deadwood', 'verdant', 'swamp', 'frostpine', 'emberfall', 'autumn', 'highlands'] as const);
export type BiomeId = typeof BIOME_IDS[number];
export type BiomeWeights = Record<BiomeId, number>;
export interface BiomeSample { id: BiomeId; name: string; weights: BiomeWeights; }
export interface BiomeDefinition {
  readonly id: BiomeId;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly ground: readonly [number, number, number];
  readonly moss: readonly [number, number, number];
  readonly ambient: readonly [number, number, number];
}

export const BIOMES: Readonly<Record<BiomeId, BiomeDefinition>> = Object.freeze({
  deadwood: { id: 'deadwood', name: 'Deadwood', description: 'Ashen trunks, old shrines and pale fungi among the burial woods.',
    color: '#354a51', ground: [22, 40, 43], moss: [10, 35, 13], ambient: [131, 156, 174] },
  verdant: { id: 'verdant', name: 'Verdant Forest', description: 'Deep green canopies, ferns and luminous woodland flowers.',
    color: '#396348', ground: [28, 57, 34], moss: [15, 39, 10], ambient: [121, 172, 153] },
  swamp: { id: 'swamp', name: 'The Mire', description: 'Willows, reeds and pale lilies over shallow pools beneath cool mist.',
    color: '#315f64', ground: [21, 47, 50], moss: [8, 22, 17], ambient: [114, 160, 159] },
  frostpine: { id: 'frostpine', name: 'Frostpine Reach', description: 'Frost-laden conifers, blue crystal outcrops and scattered snow.',
    color: '#879fa8', ground: [68, 86, 96], moss: [17, 24, 25], ambient: [143, 167, 192] },
  emberfall: { id: 'emberfall', name: 'Emberfall', description: 'Blackened trees, split basalt and smouldering embers in ash.',
    color: '#70504d', ground: [47, 32, 34], moss: [23, 7, 2], ambient: [184, 139, 132] },
  autumn: { id: 'autumn', name: 'Amberwood', description: 'Copper crowns, golden leaves and old roots beneath an amber canopy.',
    color: '#867547', ground: [45, 46, 29], moss: [26, 18, 4], ambient: [170, 163, 135] },
  highlands: { id: 'highlands', name: 'Hollow Highlands', description: 'Wind-bent trees, pale limestone and heather on weathered moorland.',
    color: '#625c78', ground: [42, 42, 51], moss: [15, 12, 23], ambient: [145, 151, 179] },
});
for (const id of BIOME_IDS) {
  Object.freeze(BIOMES[id].ground); Object.freeze(BIOMES[id].moss); Object.freeze(BIOMES[id].ambient); Object.freeze(BIOMES[id]);
}

export const BIOME_FIELD_RULES = Object.freeze({ regionSize: 6400, influenceRadius: 1.18,
  startingCore: 1100, startingBlendEnd: 2600, cacheLimit: 512 });
const TAU = Math.PI * 2, UINT_RANGE = 0x100000000;
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function hash(x: number, y: number, seed: number): number {
  let n = seed ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1) ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), tx = smooth(x - ix), ty = smooth(y - iy);
  const a = hash(ix, iy, seed) / UINT_RANGE, b = hash(ix + 1, iy, seed) / UINT_RANGE;
  const c = hash(ix, iy + 1, seed) / UINT_RANGE, d = hash(ix + 1, iy + 1, seed) / UINT_RANGE;
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
interface Region { readonly x: number; readonly y: number; readonly biome: BiomeId; }
// Pure memoization: every value is regenerated from its full seed/cell identity.
// A shared bounded cache avoids recomputing climate for every ground pixel.
const regions = new Map<string, Region>();
function region(cx: number, cy: number, seed: number): Region {
  const key = `${seed}:${cx}:${cy}`, found = regions.get(key);
  if (found) return found;
  const temperature = noise(cx / 2.35 + 17.3, cy / 2.35 - 9.7, seed + 311);
  const moisture = noise(cx / 2.05 - 13.6, cy / 2.05 + 5.1, seed + 773);
  const elevation = noise(cx / 1.9 + 6.8, cy / 1.9 + 21.4, seed + 1297);
  const biome: BiomeId = temperature < .30 ? 'frostpine' : temperature > .72 ? 'emberfall'
    : elevation > .66 ? 'highlands' : moisture > .61 ? 'swamp'
      : temperature > .52 && moisture < .57 ? 'autumn' : moisture > .40 ? 'verdant' : 'deadwood';
  const value = Object.freeze({ x: cx + .5 + (hash(cx, cy, seed + 89) / UINT_RANGE - .5) * .52,
    y: cy + .5 + (hash(cx, cy, seed + 197) / UINT_RANGE - .5) * .52, biome });
  if (regions.size >= BIOME_FIELD_RULES.cacheLimit) regions.delete(regions.keys().next().value!);
  regions.set(key, value); return value;
}
const emptyWeights = (): BiomeWeights => ({ deadwood: 0, verdant: 0, swamp: 0, frostpine: 0, emberfall: 0, autumn: 0, highlands: 0 });

/** Warped two-dimensional climate regions. Compact, smooth influence kernels blend
 * all neighboring materials; neither terrain chunks nor dominant IDs form seams. */
export function sampleBiome(x: number, y: number, seed = 7319): BiomeSample {
  if (!Number.isFinite(x) || !Number.isFinite(y)) { const weights = emptyWeights(); weights.deadwood = 1; return { id: 'deadwood', name: BIOMES.deadwood.name, weights }; }
  seed |= 0;
  const phase = (seed % 997) / 997 * TAU;
  const wx = x + Math.sin(y / 2930 + phase) * 620 + Math.sin(x / 1841 + y / 1513 - phase) * 260;
  const wy = y + Math.sin(x / 3270 - phase) * 700 + Math.cos(y / 2231 - x / 1847 + phase) * 275;
  const gx = wx / BIOME_FIELD_RULES.regionSize, gy = wy / BIOME_FIELD_RULES.regionSize;
  const cx = Math.floor(gx), cy = Math.floor(gy), weights = emptyWeights();
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cell = region(cx + dx, cy + dy, seed);
    const d2 = (gx - cell.x) ** 2 + (gy - cell.y) ** 2;
    const influence = Math.max(0, 1 - d2 / BIOME_FIELD_RULES.influenceRadius ** 2) ** 4;
    weights[cell.biome] += influence; sum += influence;
  }
  // Nine cells contain every non-zero kernel: omitted cells are at least 1.24
  // region units away; kernels vanish smoothly at 1.18. There is always coverage.
  const startDistance = Math.hypot(wx - 145 * Math.sin(phase), wy + 265 * Math.sin(phase) - 105 * Math.cos(phase));
  const start = 1 - smooth((startDistance - BIOME_FIELD_RULES.startingCore)
    / (BIOME_FIELD_RULES.startingBlendEnd - BIOME_FIELD_RULES.startingCore));
  for (const id of BIOME_IDS) weights[id] = weights[id] / sum * (1 - start);
  weights.deadwood += start;
  let id: BiomeId = 'deadwood';
  for (const candidate of BIOME_IDS) if (weights[candidate] > weights[id]) id = candidate;
  return { id, name: BIOMES[id].name, weights };
}

export function biomeGround(weights: BiomeWeights, moss = 0): [number, number, number] {
  const color: [number, number, number] = [0, 0, 0];
  for (const id of BIOME_IDS) for (let channel = 0; channel < 3; channel++)
    color[channel] += (BIOMES[id].ground[channel] + BIOMES[id].moss[channel] * moss) * weights[id];
  return color;
}
export function biomeAmbient(weights: BiomeWeights): [number, number, number] {
  return [0, 1, 2].map(channel => BIOME_IDS.reduce((sum, id) => sum + BIOMES[id].ambient[channel] * weights[id], 0)) as [number, number, number];
}
const mapColors = Object.fromEntries(BIOME_IDS.map(id => [id, [1, 3, 5].map(offset => parseInt(BIOMES[id].color.slice(offset, offset + 2), 16))])) as Record<BiomeId, number[]>;
export function biomeMapColor(weights: BiomeWeights): [number, number, number] {
  return [0, 1, 2].map(channel => BIOME_IDS.reduce((sum, id) => sum + mapColors[id][channel] * weights[id], 0)) as [number, number, number];
}
