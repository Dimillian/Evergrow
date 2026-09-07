import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_IDS, startingBiome } from '../src/biomes.ts';
import { World } from '../src/world.ts';
import { settlementPlace } from '../src/world-geography.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import { freshTravel, townPortalAnchor, portalLanding } from '../src/travel.ts';

test('seeded homes cover every climate without favoring hospitable terrain', () => {
  const counts = new Map<string, number>();
  for (let seed = 0; seed < 9000; seed++) {
    const biome = startingBiome(seed);
    counts.set(biome, (counts.get(biome) ?? 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort(), [...BIOME_IDS].sort());
  for (const count of counts.values()) assert.ok(count > 850 && count < 1150);
});

test('every home climate offers a safe level-one southern arrival, services and a valid home portal', () => {
  const climates = new Set<string>(), names = new Set<string>(), layouts = new Set<string>(), kinds = new Set<string>();
  for (let seed = 0; seed < 48; seed++) {
    const world = new World(seed), home = settlementPlace(seed, 0, 0);
    const town = world.getSettlements(home.x - 1, home.y - 1, 2, 2).find(t => Number(t.id.split(':').at(-1)) === 0)!;
    assert.ok(town); assert.ok(town.y + town.radius < 0);
    names.add(town.name); kinds.add(town.kind); layouts.add(JSON.stringify(town.buildings.map(b => [b.width, b.height])));
    const climate = startingBiome(seed); climates.add(climate);
    assert.equal(world.sampleBiome(0, 0).id, climate);
    assert.equal(world.sampleBiome(town.x, town.y).id, climate);
    for (let y = 0; y >= town.y; y -= 40) {
      assert.equal(world.blocked(0, y, 16), false, `seed ${seed}: clear approach at ${y}`);
      assert.equal(world.hydrology.sample(0, y).coverage, 0, `seed ${seed}: dry approach at ${y}`);
      assert.equal(getZoneAt(0, y, seed).level, 1, `seed ${seed}: level-one approach at ${y}`);
    }
    for (const service of ['blacksmith', 'merchant', 'inn', 'chapel']) assert.ok(town.buildings.some(b => b.kind === service));
    const anchor = townPortalAnchor(town);
    assert.equal(anchor.band, freshTravel().homeTown);
    assert.ok(portalLanding(world, {x: anchor.x, y: anchor.y + 35}, 16));
    const regenerated = new World(seed);
    assert.deepEqual(regenerated.sampleBiome(0, 0), world.sampleBiome(0, 0));
    regenerated.dispose();
    world.dispose();
  }
  assert.equal(climates.size, BIOME_IDS.length);
  assert.ok(names.size > 30 && layouts.size > 30);
  assert.deepEqual([...kinds].sort(), ['city', 'town']);
});
