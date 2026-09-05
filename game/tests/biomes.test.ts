import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_IDS, BIOMES, sampleBiome, biomeGround, biomeAmbient, biomeMapColor } from '../src/biomes.ts';
import { mainPathX, World } from '../src/world.ts';

test('all seven organic biomes recur in a reachable world around the stable Deadwood start', () => {
  for (const seed of [7319, 18427, 90210, 1, -127, 999]) {
    assert.equal(sampleBiome(0, 0, seed).weights.deadwood, 1);
    const found = new Set<string>();
    for (let y = -12000; y <= 12000; y += 480) for (let x = -12000; x <= 12000; x += 480) {
      const sample = sampleBiome(x, y, seed);
      if (sample.weights[sample.id] > .8) found.add(sample.id);
    }
    assert.deepEqual([...found].sort(), [...BIOME_IDS].sort());
    const vertical = new Set(Array.from({ length: 101 }, (_, i) => sampleBiome(3600, (i - 50) * 400, seed).id));
    const horizontal = new Set(Array.from({ length: 101 }, (_, i) => sampleBiome((i - 50) * 400, 3600, seed).id));
    assert.ok(vertical.size >= 4 && horizontal.size >= 4, 'regions vary in both directions instead of fixed horizontal or vertical strips');
  }
});

test('material weights and lighting blend continuously across both axes and negative chunk boundaries', () => {
  let mixed = 0;
  for (const seed of [7319, -127]) for (const axis of [0, 1]) for (const offset of [-6500, -860, 0, 970, 5500]) {
    for (let n = -12000; n <= 12000; n += 16) {
      const a = sampleBiome(axis ? offset : n, axis ? n : offset, seed).weights;
      const b = sampleBiome(axis ? offset : n + 1, axis ? n + 1 : offset, seed).weights;
      assert.ok(Math.abs(BIOME_IDS.reduce((sum, id) => sum + a[id], 0) - 1) < 1e-12);
      for (const id of BIOME_IDS) {
        assert.ok(a[id] >= 0 && a[id] <= 1);
        assert.ok(Math.abs(a[id] - b[id]) < .006, 'one world unit cannot abruptly change a material');
      }
      if (Math.max(...Object.values(a)) < .85) mixed++;
      for (const blend of [biomeGround, biomeAmbient, biomeMapColor]) {
        const colorA = blend(a), colorB = blend(b);
        assert.ok(colorA.every((v, i) => Number.isFinite(v) && Math.abs(v - colorB[i]) < .7));
      }
    }
  }
  assert.ok(mixed > 1000, 'broad shared-material ecotones are common');
  for (const coordinate of [-4096, -256, 0, 256, 4096]) {
    const before = sampleBiome(coordinate - .001, 1713).weights;
    const after = sampleBiome(coordinate + .001, 1713).weights;
    assert.ok(BIOME_IDS.every(id => Math.abs(before[id] - after[id]) < .00002));
  }
});

test('climate memoization cannot change the world with travel order, other seeds or eviction', () => {
  const positions = [[-1420, 773], [1300, 970], [47850000, -47000256], [-47850000, 47000256]];
  const before = positions.map(([x, y]) => sampleBiome(x, y, 7319));
  for (let i = 0; i < 2400; i++) sampleBiome(i * 2100, -i * 2700, i % 2 ? 1 : 7319);
  assert.deepEqual(positions.map(([x, y]) => sampleBiome(x, y, 7319)), before);
  assert.ok(positions.some(([x, y]) => JSON.stringify(sampleBiome(x, y, 7319)) !== JSON.stringify(sampleBiome(x, y, 18427))));
  const mutable = sampleBiome(1300, 970); mutable.weights.deadwood = -100;
  assert.ok(sampleBiome(1300, 970).weights.deadwood >= 0);
  for (const id of BIOME_IDS) assert.ok(Object.isFrozen(BIOMES[id]));
});

test('map colors include roads and plazas without asking collision to generate map pixels', () => {
  class MapWorld extends World { override blocked(): boolean { throw new Error('Map rendering must not query collision.'); } }
  const world = new MapWorld();
  const trail = world.mapColor(mainPathX(500), 500);
  assert.notEqual(trail, world.mapColor(mainPathX(500) + 150, 500));
  const town = world.getSettlements(-600, -1400, 1200, 1100)[0];
  assert.notEqual(world.mapColor(town.x, town.y), trail);
  for (const building of town.buildings) {
    const y = building.door.y + 24;
    assert.equal(world.mapColor(mainPathX(y), y), world.mapColor(building.door.x, y));
  }
  const colors = new Set<string>();
  for (let x = -12000; x <= 12000; x += 400) colors.add(world.mapColor(x, 3400));
  assert.ok(colors.size >= BIOME_IDS.length);
});
