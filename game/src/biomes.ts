export type BiomeId = 'deadwood' | 'verdant' | 'swamp';
export type BiomeWeights = Record<BiomeId, number>;
export interface BiomeSample { id: BiomeId; name: string; weights: BiomeWeights; }
export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  description: string;
  color: string;
  ground: readonly [number, number, number];
  moss: readonly [number, number, number];
}

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  deadwood: { id: 'deadwood', name: 'Deadwood', description: 'Ashen trunks, old shrines and the road north.',
    color: '#30434a', ground: [22, 40, 43], moss: [10, 35, 13] },
  verdant: { id: 'verdant', name: 'Verdant Forest', description: 'Deep green canopies, ferns and luminous woodland flowers.',
    color: '#3e704b', ground: [28, 57, 34], moss: [15, 39, 10] },
  swamp: { id: 'swamp', name: 'The Mire', description: 'Willows, reeds and shallow pools beneath cool mist.',
    color: '#32636b', ground: [21, 47, 50], moss: [8, 22, 17] },
};

function blendEdge(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Continuous world-space bands with broad, irregular boundaries and a stable starting biome. */
export function sampleBiome(x: number, y: number, seed = 7319): BiomeSample {
  const phase = (seed % 997) / 997 * Math.PI * 2;
  const warp = Math.sin(y / 710 + phase) * 180 + Math.sin(y / 289 - phase) * 105
    + Math.sin(x / 1200 + y / 1700 + phase) * 90;
  const longitude = x + warp;
  const verdant = 1 - blendEdge(-1750, -850, longitude);
  const swamp = blendEdge(850, 1750, longitude);
  const weights = { deadwood: 1 - verdant - swamp, verdant, swamp };
  const id: BiomeId = verdant > weights.deadwood ? 'verdant' : swamp > weights.deadwood ? 'swamp' : 'deadwood';
  return { id, name: BIOMES[id].name, weights };
}

export function biomeGround(weights: BiomeWeights, moss = 0): [number, number, number] {
  const color: [number, number, number] = [0, 0, 0];
  for (const id of ['deadwood', 'verdant', 'swamp'] as const) {
    for (let channel = 0; channel < 3; channel++) color[channel] += (BIOMES[id].ground[channel] + BIOMES[id].moss[channel] * moss) * weights[id];
  }
  return color;
}
