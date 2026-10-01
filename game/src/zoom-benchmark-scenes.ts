import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { waterReviewScene } from './water-review-scene.ts';
import { generateDungeon, type DungeonEntrance } from './dungeon.ts';
import { RiftWorld } from './rift-world.ts';
import { createDungeonRun, emptyContents, freshExpeditions } from './dungeon-state.ts';

export const ZOOM_BENCHMARK_SCENES = ['forest', 'water', 'crowd'] as const;
export const ZOOM_BENCHMARK_ZOOMS = [1.8, 1, .8] as const;
/** Disposable frozen fixtures. No simulation ticks, session, storage or input. */
export function zoomBenchmarkScene(kind: typeof ZOOM_BENCHMARK_SCENES[number]) {
  if (kind === 'crowd') {
    const entrance: DungeonEntrance = { id: 'dungeon:rift:1', name: 'Zoom benchmark', seed: 7342,
      level: 30, biome: 'verdant', x: 0, y: 0, rift: { attempt: 1 } };
    const floor = generateDungeon(entrance.seed, 30, entrance), world = new RiftWorld(floor, entrance);
    const center = floor.members.find(m => m.id === 'rift:0:0')!;
    const sim = new Simulation(world, { spawn: false, startX: center.x, startY: center.y });
    sim.expeditions = { ...freshExpeditions(), runs: [createDungeonRun(entrance)], location: entrance.id, surface: emptyContents() };
    sim.dungeonFloor = floor;
    const members = floor.members.filter(m => m.id !== 'warden')
      .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)).slice(0, 256);
    for (const m of members) {
      const enemy = sim.spawnEnemy(m.kind, m.x, m.y, m.rank, { campId: entrance.id, memberId: m.id, lootSeed: m.seed, level: 30 });
      if (enemy) enemy.angle = Math.atan2(center.y - enemy.y, center.x - enemy.x);
    }
    sim.time = 12;
    return { world, sim, x: center.x, y: center.y, seed: entrance.seed };
  }
  const seed = kind === 'forest' ? 18427 : 7319, world = new World(seed);
  const center = kind === 'forest' ? { x: 5000, y: 5000 } : waterReviewScene(world, 'river');
  const sim = new Simulation(world, { spawn: false, startX: center.x, startY: center.y });
  sim.time = 12;
  return { world, sim, x: center.x, y: center.y, seed };
}
