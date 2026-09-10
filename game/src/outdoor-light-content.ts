import type { World } from './world.ts';
import { landscapeNoise } from './natural-landscape.ts';

export const OUTDOOR_LIGHT_RULES = Object.freeze({ cell: 48, margin: 224, maskSize: 512, maxAxis: 640, maxCanopies: 80, cacheLimit: 4096, canopyHz: 10 });
export type OutdoorLightWorld = Pick<World, 'seed' | 'sampleBiome' | 'sampleGroundContact'>;
/** Shader metadata is derived from real ground contact, with dry buildings and simulated water excluded from land gloss. */
export function outdoorLightCell(world: OutdoorLightWorld, x: number, y: number): readonly number[] {
  const { weights } = world.sampleBiome(x, y);
  const contact = world.sampleGroundContact(x, y);
  const pockets = landscapeNoise(x / 155, y / 155, world.seed + 201);
  const moisture = contact.simulatedWater || contact.indoors ? 0 : Math.max(contact.water * .7,
    Math.max(0, pockets - .35) * (weights.swamp * 1.5 + weights.verdant * .32 + weights.deadwood * .35 + weights.autumn * .24));
  return [Math.round(weights.verdant * 255), Math.round(weights.swamp * 255), Math.round(Math.min(1, moisture) * 255), contact.indoors ? 0 : 255,
    ...[weights.deadwood, weights.frostpine, weights.emberfall, weights.autumn,
      weights.highlands, weights.steppe, weights.sunscar, Math.max(0, 1 - pockets)].map(w=>Math.round(w*255))];
}
