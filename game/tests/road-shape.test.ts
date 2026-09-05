import assert from 'node:assert/strict';
import test from 'node:test';
import { branchY, mainPathX, pathDistance, roadSurface } from '../src/road-shape.ts';

test('visual road material still covers every main and branch centerline', () => {
  for (const seed of [1, 7319, 92831]) {
    for (let y = -4800; y <= 4800; y += 113) {
      const x = mainPathX(y), road = roadSurface(x, y, seed);
      assert.equal(pathDistance(x, y), 0);
      assert.equal(road.distance, 0);
      assert.equal(road.weight, 1);
    }
    for (let band = -3; band <= 3; band++) for (let x = -2500; x <= 2500; x += 133) {
      const y = branchY(x, band), road = roadSurface(x, y, seed);
      assert.equal(pathDistance(x, y), 0);
      assert.equal(road.distance, 0);
      assert.equal(road.weight, 1);
    }
  }
});

test('rounded road junctions remain continuous across their material shoulders', () => {
  const epsilon = .001;
  for (const seed of [1, 7319, 92831]) for (const band of [-2, 0, 2]) {
    let y = branchY(0, band);
    for (let i = 0; i < 24; i++) y = branchY(mainPathX(y), band);
    const x = mainPathX(y);
    let featherSamples = 0;
    for (let dx = -70; dx <= 70; dx += 5) for (let dy = -70; dy <= 70; dy += 5) {
      const center = roadSurface(x + dx, y + dy, seed).weight;
      if (center > 0 && center < 1) featherSamples++;
      for (const [ox, oy] of [[epsilon, 0], [0, epsilon]]) {
        const next = roadSurface(x + dx + ox, y + dy + oy, seed).weight;
        assert.ok(Math.abs(next - center) < epsilon * .2, 'crossing the shoulder has no material jump');
      }
    }
    assert.ok(featherSamples > 0, 'the probe includes actual junction transitions');
  }
});

test('varying road widths and junction rounding stay within reserved clear shoulders', () => {
  let beyondShoulders = 0;
  for (const seed of [1, 7319, 92831]) for (let y = -1800; y <= 1800; y += 37) {
    const centerX = mainPathX(y);
    for (let offset = -120; offset <= 120; offset += 4) {
      const x = centerX + offset, road = roadSurface(x, y, seed);
      assert.ok(road.weight >= 0 && road.weight <= 1);
      assert.ok(road.tracks >= 0 && road.tracks <= 1);
      assert.equal(road.distance, pathDistance(x, y));
      if (road.distance >= 76) {
        beyondShoulders++;
        assert.equal(road.weight, 0, 'visible road never enters the prop spawn area');
      }
    }
  }
  assert.ok(beyondShoulders > 0);
});
