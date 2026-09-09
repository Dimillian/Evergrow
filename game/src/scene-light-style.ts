import { BIOME_IDS, type BiomeWeights } from './biomes.ts';
import type { GearLight } from './gear-material.ts';

/** Shared art direction, separate from terrain generation and combat visibility. */
export const SKY_DIRECTION = [-.56, -.70, .62] as const;
const palettes = {
  deadwood: [170, 197, 213, .15], verdant: [186, 214, 174, .11], swamp: [157, 196, 188, .22],
  frostpine: [184, 213, 238, .14], emberfall: [209, 159, 140, .10], autumn: [230, 205, 157, .10],
  highlands: [184, 185, 219, .14], steppe: [222, 218, 179, .06], sunscar: [239, 205, 165, .055],
} as const;
export function sceneClimate(weights: BiomeWeights, enclosure = 0) {
  const channels = [0, 1, 2].map(channel => Math.round(BIOME_IDS.reduce((sum, id) => sum + palettes[id][channel] * weights[id], 0)));
  const color = `#${channels.map(n => n.toString(16).padStart(2, '0')).join('')}`;
  const inside = Math.max(0, Math.min(1, enclosure));
  const outdoorFog = BIOME_IDS.reduce((sum, id) => sum + palettes[id][3] * weights[id], 0);
  const fog = outdoorFog * (1 - inside) + .085 * inside;
  const keyColor = channels.map((n, i) => Math.round(n * (1 - inside) + [172, 185, 212][i] * inside));
  const key: GearLight = { direction: SKY_DIRECTION, color: `#${keyColor.map(n => n.toString(16).padStart(2, '0')).join('')}`, power: .95 - .57 * inside };
  return { color: inside === 1 ? '#91a6b9' : color, fog, key };
}

/** Height projection points away from the same key that lights the material faces. */
export function shadowProjection(direction: readonly [number, number, number]) {
  const z = Math.max(.4, direction[2]);
  return { x: Math.max(-1.2, Math.min(1.2, -direction[0] / z)) * .65,
    y: Math.max(-1.2, Math.min(1.2, -direction[1] / z)) * .38 };
}
