import { BIOMES, BIOME_IDS, type BiomeId } from './biomes.ts';
import type { World } from './world.ts';

export interface BiomeReviewScene { id: string; name: string; description: string; x: number; y: number; }

/** Finds actual generated regions and mixed boundaries; never adds or rearranges props. */
export function biomeReviewScenes(world: World): BiomeReviewScene[] {
  const candidates = new Map<BiomeId, Array<{ x: number; y: number }>>(BIOME_IDS.map(id => [id, []]));
  const edges: BiomeReviewScene[] = [];
  const pairs = [['frostpine', 'highlands'], ['autumn', 'emberfall']] as const;
  for (let y = -9600; y <= 9600; y += 240) for (let x = -9600; x <= 9600; x += 240) {
    const sample = world.sampleBiome(x, y);
    if (sample.weights[sample.id] > .94) candidates.get(sample.id)!.push({ x, y });
  }
  const scenes = BIOME_IDS.map(id => {
    const sorted = candidates.get(id)!.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const point = sorted.find(({ x, y }) => world.getBuildings(x - 450, y - 350, 900, 700).length === 0
      && world.getProps(x - 450, y - 310, 900, 620).filter(p => p.biome === id).length >= 25) ?? sorted[0];
    if (!point) throw new Error(`No ${id} region found in the review area.`);
    return { id, name: BIOMES[id].name, description: BIOMES[id].description, ...point };
  });
  for (const [a, b] of pairs) {
    let point: { x: number; y: number } | undefined;
    for (let y = -6000; y <= 6000; y += 80) for (let x = -6000; x <= 6000; x += 80) {
      const weights = world.sampleBiome(x, y).weights;
      if (weights[a] < .4 || weights[a] > .6 || weights[b] < .4 || weights[a] + weights[b] < .96) continue;
      if ((!point || Math.hypot(x, y) < Math.hypot(point.x, point.y))
        && world.getBuildings(x - 600, y - 400, 1200, 800).length === 0) point = { x, y };
    }
    if (point) edges.push({ id: `${a}-${b}`, name: `${BIOMES[a].name} / ${BIOMES[b].name}`,
      description: 'A real border: shared ground materials, interleaved vegetation and locally blended atmosphere.', ...point });
  }
  return [...scenes, ...edges];
}
