import assert from 'node:assert/strict';
import test from 'node:test';
import { roadPaths, pathDistance, roadSurface } from '../src/road-shape.ts';
import { parentPlace, queryPlaces, placeId, placeCell } from '../src/world-geography.ts';
test('settlements are widely separated in two dimensions and connected to the starting town', () => {
  for (const seed of [7319, 18427, 90210]) {
    const places = queryPlaces(seed, -22000, -22000, 44000, 44000, 0);
    assert.ok(places.length >= 8 && places.length <= 24);
    for (const a of places) {
      assert.deepEqual(placeCell(placeId(a.cx, a.cy)), [a.cx, a.cy]);
      for (const b of places)
        if (a.id !== b.id)
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 6000);
      let current = a, count = 0;
      while (current.id !== 0) {
        const parent = parentPlace(seed, current)!;
        assert.ok(parent.cx ** 2 + parent.cy ** 2 < current.cx ** 2 + current.cy ** 2);
        current = parent;
        assert.ok(++count < 20);
      }
    }
    assert.ok(new Set(places.map(p => Math.round(p.x / 3000))).size > 6);
  }
});
test('curved routes and their material remain deterministic and continuous across cache boundaries', () => {
  for (const seed of [7319, 18427]) {
    const roads = roadPaths(-12000, -12000, 24000, 24000, seed);
    assert.ok(roads.length > 4);
    assert.deepEqual(roadPaths(-12000, -12000, 24000, 24000, seed), roads);
    for (const road of roads) {
      assert.ok(road.length > Math.hypot(road.to.x - road.from.x, road.to.y - road.from.y) * 1.02);
      for (const [x, y] of road.points.filter((_, i) => i % 13 === 0)) {
        assert.ok(pathDistance(x, y, seed) < 1e-6);
        assert.ok(roadSurface(x, y, seed).weight > .99);
        const near = roadSurface(x + .001, y - .001, seed);
        assert.ok(Math.abs(near.weight - roadSurface(x, y, seed).weight) < .001);
      }
    }
  }
});
