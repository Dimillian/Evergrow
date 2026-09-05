import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleBiome } from '../src/biomes.ts';
import { mainPathX, World } from '../src/world.ts';

test('the starting biome and both neighboring biomes are deterministic and reachable', () => {
  for (const seed of [7319, 1, -127, 999]) {
    assert.equal(sampleBiome(0, 0, seed).id, 'deadwood');
    assert.equal(sampleBiome(-2600, 0, seed).id, 'verdant');
    assert.equal(sampleBiome(2600, 0, seed).id, 'swamp');
    assert.ok(2600 / 165 < 20, 'each neighboring biome is within twenty seconds of unobstructed travel');
    assert.deepEqual(sampleBiome(-1420, 773, seed), sampleBiome(-1420, 773, seed));
  }
});

test('biome material weights blend continuously across irregular boundaries', () => {
  let mixed = 0;
  for (const y of [-7000, -860, 0, 970, 5000]) {
    let previous = sampleBiome(-2500, y).weights;
    for (let x = -2496; x <= 2500; x += 4) {
      const current = sampleBiome(x, y).weights;
      assert.ok(Math.abs(current.deadwood + current.verdant + current.swamp - 1) < 1e-12);
      for (const id of ['deadwood', 'verdant', 'swamp'] as const) {
        assert.ok(current[id] >= 0 && current[id] <= 1);
        assert.ok(Math.abs(current[id] - previous[id]) < .02, 'four world pixels cannot abruptly change a material');
      }
      if (current.deadwood > .1 && current.deadwood < .9) mixed++;
      previous = current;
    }
  }
  assert.ok(mixed > 500, 'transitions span broad bands rather than thin borders');
  assert.notDeepEqual(sampleBiome(1300, 0).weights, sampleBiome(1300, 970).weights);
});

test('biome props mix deterministically and decorative groundcover remains passable', () => {
  const world = new World();
  const verdant = world.getProps(-3200, -500, 700, 1100);
  const swamp = world.getProps(2500, -500, 700, 1100);
  assert.ok(verdant.some(prop => prop.kind === 'tree' && prop.biome === 'verdant'));
  assert.ok(verdant.some(prop => prop.kind === 'fern' || prop.kind === 'flowers'));
  assert.ok(swamp.some(prop => prop.kind === 'willow'));
  assert.ok(swamp.some(prop => prop.kind === 'reeds'));
  const mixed = world.getProps(-1600, -500, 400, 1100);
  assert.ok(mixed.some(prop => prop.biome === 'verdant') && mixed.some(prop => prop.biome === 'deadwood'));
  for (const prop of [...verdant, ...swamp].filter(prop => prop.radius === 0)) assert.equal(world.blocked(prop.x, prop.y, 1), false);
});

test('map colors include roads and plazas without asking collision to generate map pixels', () => {
  class MapWorld extends World { override blocked(): boolean { throw new Error('Map rendering must not query collision.'); } }
  const world = new MapWorld();
  const trail = world.mapColor(mainPathX(500), 500);
  assert.notEqual(trail, world.mapColor(mainPathX(500) + 150, 500), 'compacted trail reads differently from surrounding ground');
  const town = world.getSettlements(-600, -1400, 1200, 1100)[0];
  assert.notEqual(world.mapColor(town.x, town.y), trail, 'town paving and wilderness dirt remain distinct');
  for (const building of town.buildings) {
    const y = building.door.y + 24;
    assert.equal(world.mapColor(mainPathX(y), y), world.mapColor(building.door.x, y), 'main road and side streets share the stone map palette');
  }
  assert.notEqual(world.mapColor(-2600, 0), world.mapColor(2600, 0));
});
