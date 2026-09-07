import { propDefinition } from './biome-props.ts';
import { pathDistance } from './road-shape.ts';
import { BIOMES, BIOME_IDS, type BiomeId } from './biomes.ts';
import type { World } from './world.ts';

export interface BiomeReviewScene { id: string; name: string; description: string; x: number; y: number; }

/** Finds actual generated regions and mixed boundaries; never adds or rearranges props. */
export function biomeReviewScenes(world: World, ids: readonly BiomeId[] = BIOME_IDS, variant = 0): BiomeReviewScene[] {
  const candidates = new Map<BiomeId, Array<{ x: number; y: number }>>(ids.map(id => [id, []]));
  const edges: BiomeReviewScene[] = [];
  const pairs = [['frostpine', 'highlands'], ['autumn', 'emberfall']] as const;
  for (let y = -36000; y <= 36000; y += 640) for (let x = -36000; x <= 36000; x += 640) {
    const sample = world.sampleBiome(x, y);
    if (sample.weights[sample.id] > .94) candidates.get(sample.id)!.push({ x, y });
  }
  const scenes = ids.map(id => {
    const sorted = candidates.get(id)!.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const options: Array<{x:number;y:number}> = [];
    for(const p of sorted) {
      const {x,y}=p;
      if(pathDistance(x,y,world.seed)>520
        && world.getBuildings(x-450,y-350,900,700).length===0
        && world.getWildernessSites(x-450,y-350,900,700).length===0
        && world.getProps(x-450,y-310,900,620).filter(p=>p.biome===id).length>=10
        && (id!=='sunscar'||world.getProps(x-220,y-150,440,300).some(p=>p.kind==='sandstone'))
        && (!['deadwood','verdant','autumn','frostpine'].includes(id)||world.getProps(x-300,y-230,600,460).filter(p=>propDefinition(p.kind).canopy).length>=3)) options.push(p);
      if(options.length>=Math.min(64,variant*7+1))break;
    }
    const point = options[Math.min(options.length-1, variant*7)] ?? sorted[0];
    if (!point) throw new Error(`No ${id} region found in the review area.`);
    return { id, name: BIOMES[id].name, description: BIOMES[id].description, ...point };
  });
  for (const [a, b] of pairs) {
    let point: { x: number; y: number } | undefined;
    for (let y = -20000; y <= 20000; y += 240) for (let x = -20000; x <= 20000; x += 240) {
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
