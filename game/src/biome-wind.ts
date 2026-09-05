import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';
import { BIOME_LIFE } from './biome-life-content.ts';

/** Climate changes strength, never the phase of the traveling front at a border. */
export function biomeWind(x: number, y: number, time: number, climate: BiomeId | BiomeWeights, reducedMotion = false) {
  if (reducedMotion) return { x: 0, y: 0, gust: 0 };
  const front = time * .82 - x * .011 - y * .004;
  const gust = Math.pow(Math.max(0, Math.sin(front)), 3);
  const breath = Math.sin(time * .37 - x * .003 + y * .002);
  const strength = typeof climate === 'string' ? BIOME_LIFE[climate].wind
    : BIOME_IDS.reduce((sum, id) => sum + climate[id] * BIOME_LIFE[id].wind, 0);
  return { x: (.22 + gust * 1.65 + breath * .16) * strength,
    y: (.12 + Math.sin(time * .24 + x * .002) * .09) * strength, gust };
}
