import assert from 'node:assert/strict';
import test from 'node:test';
import { World } from '../src/world.ts';
import { settlementPlace } from '../src/world-geography.ts';
import { WORLD_QUERY_LIMITS } from '../src/world-query.ts';
import { EXPLORATION_LIMITS } from '../src/exploration.ts';
import { zoomMapAt, type MapView } from '../src/map-view.ts';

test('finite oversized and unsafe world requests return without entering unbounded generation loops', () => {
  const world = new World();
  for (const [x, y, width, height] of [[1e20, 0, 80, 80], [0, -1e20, 80, 80],
    [0, 0, 1e20, 1e20], [0, 0, WORLD_QUERY_LIMITS.span + 1, 100]]) {
    assert.deepEqual(world.getProps(x, y, width, height), []);
    assert.deepEqual(world.getSettlements(x, y, width, height), []);
    assert.deepEqual(world.getPOIs(x, y, width, height), []);
  }
  assert.deepEqual(world.getProps(0, 0, 100_000, 100_000), [], 'cell budgets apply even below the per-axis span limit');
  assert.deepEqual(world.move(0, 0, Number.MAX_VALUE, 0, 12), { x: 0, y: 0 });
  assert.deepEqual(world.move(0, 0, 10, 10, WORLD_QUERY_LIMITS.collisionRadius + 1), { x: 0, y: 0 });
  assert.equal(world.blocked(1e20, 0, 12), true);
  assert.equal(world.blocked(Number.MAX_SAFE_INTEGER, 0, 12), true, 'unsupported surrounding collision queries must fail closed');
  assert.equal(world.blocked(0, 0, Number.MAX_VALUE), true);
  assert.throws(() => world.getGroundTile(Number.MAX_SAFE_INTEGER, 0), RangeError,
    'integer tile indices must still produce safe world-space sample coordinates');
  assert.deepEqual(world.cacheStats, { groundTiles: 0, settlements: 0, wildernessSites: 0 });
});

test('cached settlement blueprints resist consumer edits and regenerate identically after release', () => {
  const world = new World();
  const at = (band: number) => {
    const p = settlementPlace(world.seed, band, band % 3);
    return world.getSettlements(p.x - 1, p.y - 1, 2, 2)[0];
  };
  const first = at(0), expected = JSON.stringify(first), building = first.buildings[0], version = world.generationVersion;
  assert.throws(() => { building.door.x += 200; }, TypeError);
  assert.throws(() => { building.walls[0].width = 0; }, TypeError);
  assert.throws(() => { first.streets.length = 0; }, TypeError);
  assert.equal(JSON.stringify(at(0)), expected);
  for (let band = 1; band <= 40; band++) at(band);
  assert.equal(world.cacheStats.settlements, 32);
  world.dispose(); world.dispose();
  assert.deepEqual(world.cacheStats, { groundTiles: 0, settlements: 0, wildernessSites: 0 });
  assert.equal(JSON.stringify(at(0)), expected, 'cache release must not alter seed/version/layout');
  assert.equal(world.generationVersion, version);
});

test('zoom anchor preservation yields to the chart coordinate boundary instead of escaping its domain', () => {
  const limit = EXPLORATION_LIMITS.coordinate;
  const view: MapView = { x: 0, y: 0, width: 960, height: 600, centerX: limit - 1, centerY: -limit + 1, zoom: .7 };
  const next = zoomMapAt(view, 0, 600, .065);
  assert.equal(next.centerX, limit); assert.equal(next.centerY, -limit);
  assert.ok(Number.isFinite(next.centerX) && Number.isFinite(next.centerY));
});
