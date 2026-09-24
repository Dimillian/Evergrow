import test from 'node:test';
import assert from 'node:assert/strict';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, type DungeonEntrance } from '../src/dungeon.ts';
import { GroundLayer } from '../src/ground-layer.ts';
import { FrameProfiler } from '../src/frame-profiler.ts';

// No-op Canvas records cache ownership through real dungeon surface generation, not pixels.
function canvas(): HTMLCanvasElement {
  const noop = () => {};
  const context = {
    save: noop, restore: noop, translate: noop, scale: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, drawImage: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
  };
  return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
}

test('dungeon renderer, terrain graph and exported counters share the actual bounded tile cache', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: canvas } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document'); });
  const entrance: DungeonEntrance = { id: 'dungeon:cache', name: 'Cache test', seed: 7319, level: 4, biome: 'deadwood', x: 0, y: 0 };
  const world = new DungeonWorld(generateDungeon(entrance.seed, entrance.level), entrance);
  const layer = new GroundLayer(canvas);
  t.after(() => { layer.reset(); world.dispose(); });
  assert.equal(world.cacheStats.groundTiles, 0);
  layer.draw(canvas().getContext('2d')!, world, 2, 2, 32, 32);
  assert.equal(world.cacheStats.groundTiles, 4, 'four actual dungeon tiles are resident');
  assert.deepEqual(layer.stats, { terrainTiles: 4, terrainQueued: 0 });
  const tile = world.getGroundTile(0, 0, canvas);
  assert.equal(world.getGroundTile(0, 0, canvas), tile);
  assert.equal(world.cacheStats.groundTiles, 4, 'cache hits do not inflate the counter');
  const profiler = new FrameProfiler(true, () => 0);
  profiler.begin(0);
  profiler.setCounters({ enemies: 0, projectiles: 0, groundEffects: 0, ...layer.stats });
  profiler.finish();
  const report = JSON.parse(JSON.stringify(profiler.snapshot()));
  assert.equal(report.metrics.terrainTiles.max, 4); assert.equal(report.timeline[0].terrainTiles, 4);
  for (let i = 2; i < 68; i++) world.getGroundTile(i, 0, canvas);
  assert.equal(world.cacheStats.groundTiles, 64, 'evicted tiles are excluded');
  assert.equal(layer.stats.terrainTiles, 64);
  world.dispose(); assert.equal(world.cacheStats.groundTiles, 0); assert.equal(layer.stats.terrainTiles, 0);
  layer.reset(); assert.deepEqual(layer.stats, { terrainTiles: 0, terrainQueued: 0 });
});
