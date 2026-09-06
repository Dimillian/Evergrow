import test from 'node:test';
import assert from 'node:assert/strict';
import { Hydrology, DRY_WATER, HYDROLOGY } from '../src/hydrology.ts';
import { WaterSimulation, WATER_LIMITS } from '../src/water-simulation.ts';
import { WaterPresentation } from '../src/water-presentation.ts';
import { World } from '../src/world.ts';
const wet = () => ({ coverage: 1, depth: 1, flowX: 0, flowY: 0, bank: 0, kind: 'lake' as const });
const bounds = { x: -400, y: -300, width: 800, height: 600 };
const energy = (f: WaterSimulation) => f.height.reduce((n, v) => n + v * v, 0);

test('drainage is seeded, sparse, downhill and terminates in connected receiving basins', () => {
  for (const seed of [7319, 18427, 90210]) {
    const h = new Hydrology(seed), features = h.query(-20000, -20000, 40000, 40000);
    assert(features.some(f => f.kind === 'river')); assert(features.some(f => f.kind === 'lake'));
    for (const river of features.filter(f => f.kind === 'river')) {
      for (let i = 1; i < river.points.length; i++) assert(river.points[i].elevation < river.points[i - 1].elevation);
      const end = river.points.at(-1)!;
      assert(h.query(end.x - 100, end.y - 100, 200, 200).some(f => f.id !== river.id && Math.hypot(f.points[0].x - end.x, f.points[0].y - end.y) < .001), 'every outlet connects to another river or lake');
      assert(end.width >= river.points[0].width, 'channels widen downstream');
    }
    let water = 0, total = 0;
    for (let y = -20000; y < 20000; y += 256) for (let x = -20000; x < 20000; x += 256) { total++; water += h.sample(x, y).coverage > .5 ? 1 : 0; }
    assert(water / total > .002 && water / total < .10, `${seed}: sparse water coverage ${water / total}`);
    const other = new Hydrology(seed);
    for (const f of features.slice().reverse()) { const p = f.points[Math.floor(f.points.length / 2)]; assert.deepEqual(h.sample(p.x, p.y), other.sample(p.x, p.y)); }
    assert(h.cacheStats.buckets <= HYDROLOGY.buckets);
  }
});

test('water masks agree with ground contacts; river beds reject terrestrial props', () => {
  const world = new World(7319), rivers = world.hydrology.query(-12000, -12000, 24000, 24000).filter(f => f.kind === 'river');
  for (const river of rivers.slice(0, 5)) {
    const p = river.points[Math.floor(river.points.length / 2)], w = world.sampleWater(p.x, p.y);
    assert(w.coverage > .9);
    assert.equal(world.sampleGroundContact(p.x, p.y).water, w.coverage);
    for (const prop of world.getProps(p.x - 80, p.y - 80, 160, 160)) if (prop.id.startsWith('prop:')) assert(world.hydrology.sample(prop.x, prop.y).coverage <= .12);
  }
  assert.equal(world.sampleWater(0, -1150).coverage, 0, 'starting town remains dry');
});

test('fluid waves propagate, interfere, remain finite and dissipate', () => {
  const f = new WaterSimulation(); f.fit(bounds, wet);
  f.disturb({ x: 0, y: 0, radius: 24, strength: 2 }, false);
  const initial = energy(f);
  for (let i = 0; i < 30; i++) f.update(1 / 60);
  const reach = Math.floor((40 - f.left) / f.cell) + Math.floor((0 - f.top) / f.cell) * f.columns;
  assert(Math.abs(f.height[reach]) > .001, 'impulse reaches cells beyond its injection radius');
  for (let i = 0; i < 1500; i++) f.update(1 / 60);
  assert(energy(f) < initial * .01, 'waves damp without accumulating water');
  assert(f.height.every(Number.isFinite));
});

test('dry bank faces block flux and camera scrolling preserves world-space waves', () => {
  const f = new WaterSimulation(); f.fit(bounds, (x) => x < 0 ? wet() : { ...DRY_WATER });
  f.disturb({ x: -24, y: 0, radius: 20, strength: 1 }, false);
  for (let i = 0; i < 60; i++) f.update(1 / 60);
  for (let i = 0; i < f.wet.length; i++) if (!f.wet[i]) assert.equal(f.height[i], 0);
  const oldLeft = f.left, copy = f.height.slice();
  f.fit({ ...bounds, x: bounds.x + 32 }, (x) => x < 0 ? wet() : { ...DRY_WATER });
  const dx = (f.left - oldLeft) / f.cell;
  for (let y = 2; y < f.rows - 2; y++) for (let x = 2; x < f.columns - dx - 2; x++) assert.equal(f.height[y * f.columns + x], copy[y * f.columns + x + dx]);
  f.fit({ ...bounds, x: 20000 }, wet); assert.equal(energy(f), 0, 'teleport clears old waves');
});

test('fluid has bounded impulses, frame catch-up, droplets and reduced-motion state', () => {
  const f = new WaterSimulation(); f.fit(bounds, wet);
  for (let frame = 0; frame < 100; frame++) {
    for (let i = 0; i < 100; i++) f.disturb({ x: 0, y: 0, radius: 25, strength: 100 });
    f.update(1 / 60);
  }
  assert(f.droplets.length <= WATER_LIMITS.droplets); assert(f.height.every(Number.isFinite));
  const before = f.time; f.update(50); assert(f.time - before <= WATER_LIMITS.tick * WATER_LIMITS.substeps + 1e-9);
  f.update(1 / 60, true); assert.equal(energy(f), 0); assert.equal(f.droplets.length, 0);
});

test('actor footsteps and combat impacts disturb water; pause and teleport do not draw trails', () => {
  const p = new WaterPresentation(), world = {};
  p.update(world, bounds, wet, [{ id: -1, x: 0, y: 0 }], 1 / 60, false);
  p.update(world, bounds, wet, [{ id: -1, x: 24, y: 0 }], 1 / 60, false);
  assert(energy(p.fluid) > 0); const a = p.fluid.height.slice();
  p.update(world, bounds, wet, [{ id: -1, x: 48, y: 0 }], 0, false); assert.deepEqual(p.fluid.height, a);
  p.reset(); p.update(world, bounds, wet, [{ id: -1, x: 0, y: 0 }], 1 / 60, false);
  p.update(world, bounds, wet, [{ id: -1, x: 200, y: 0 }], 1 / 60, false); assert.equal(energy(p.fluid), 0);
  p.handleEvents([{ type: 'blast', x: 0, y: 0, radius: 80 }], false);
  p.update(world, bounds, wet, [], 1 / 60, false); assert(energy(p.fluid) > 0);
});

test('fluid propagation uses fixed steps independent of render frame rate', () => {
  const a = new WaterSimulation(), b = new WaterSimulation();
  for (const f of [a, b]) { f.fit(bounds, wet); f.disturb({ x: 8, y: 8, radius: 30, strength: 1.3 }, false); }
  for (let i = 0; i < 120; i++) a.update(1 / 60);
  for (let i = 0; i < 60; i++) b.update(1 / 30);
  assert.deepEqual(a.height, b.height); assert.deepEqual(a.u, b.u);
});

test('hydrology cache eviction does not rewrite an explored waterway', () => {
  const h = new Hydrology(7319), river = h.query(-10000, -10000, 20000, 20000).find(f => f.kind === 'river')!;
  const p = river.points[20], expected = h.sample(p.x, p.y);
  for (let x = 0; x < 1400; x++) h.feature(x, 20);
  assert(h.cacheStats.features <= HYDROLOGY.features);
  assert(h.cacheStats.nodes <= HYDROLOGY.nodes);
  assert.deepEqual(h.sample(p.x, p.y), expected);
});
