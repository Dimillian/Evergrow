import type { BiomeWeights } from './biomes.ts';

export interface GroundContact {
  readonly weights: BiomeWeights;
  readonly water: number;
  readonly natural: number;
  readonly indoors: boolean;
}
export function surfaceWaterWeight(weights: BiomeWeights, damp: number, road: number) {
  const t = Math.max(0, Math.min(1, (damp - .48) / (.75 - .48)));
  return weights.swamp * t * t * (3 - 2 * t) * (1 - road);
}
/** Matches the terrain's water, road and paving composition, including mixed climates. */
export function groundContact(weights: BiomeWeights, damp: number, road: number, paved: number, indoors: boolean): GroundContact {
  const natural = indoors ? 0 : (1 - road) * (1 - paved);
  return { weights, natural, water: surfaceWaterWeight(weights, damp, road) * natural, indoors };
}
