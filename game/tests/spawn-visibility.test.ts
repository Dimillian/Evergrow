import assert from 'node:assert/strict';
import test from 'node:test';
import { isSpawnHidden, type SpawnExclusion } from '../src/spawn-visibility.ts';

const view: SpawnExclusion = { x: -200, y: -100, width: 400, height: 200 };

test('all visible, padded and touching positions stay protected around the actual viewport', () => {
  for (const [x, y] of [[0, 0], [-200, -100], [200, 100], [-280, 0], [280, 0], [0, -220], [0, 220]]) {
    assert.equal(isSpawnHidden(x, y, view), false, `${x}, ${y}`);
  }
  for (const [x, y] of [[-280.01, 0], [280.01, 0], [0, -220.01], [0, 220.01]]) assert.equal(isSpawnHidden(x, y, view), true);
  assert.equal(isSpawnHidden(295, 0, view, 15), false, 'collision/body radius expands the protected area');
  assert.equal(isSpawnHidden(295.01, 0, view, 15), true);
  assert.equal(isSpawnHidden(0, -235, view, 15), false);
  assert.equal(isSpawnHidden(0, -235.01, view, 15), true);
});

test('wide viewports protect distant positions regardless of player-relative spawning distance', () => {
  const wide = { x: -1400, y: -800, width: 2800, height: 1600 };
  for (const [x, y] of [[900, 0], [-950, 600], [0, -850]]) assert.equal(isSpawnHidden(x, y, wide, 17), false);
  assert.equal(isSpawnHidden(1498, 0, wide, 17), true);
});

test('invalid geometry fails closed while explicit null supports headless authored placement', () => {
  assert.equal(isSpawnHidden(0, 0, null), true);
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.equal(isSpawnHidden(bad, 0, null), false); assert.equal(isSpawnHidden(0, bad, view), false);
    assert.equal(isSpawnHidden(2000, 0, view, bad), false);
    for (const field of ['x', 'y', 'width', 'height']) assert.equal(isSpawnHidden(2000, 0, { ...view, [field]: bad }), false);
  }
  for (const field of ['width', 'height']) for (const value of [0, -1])
    assert.equal(isSpawnHidden(2000, 0, { ...view, [field]: value }), false);
  assert.equal(isSpawnHidden(2000, 0, view, -1), false);
  assert.equal(isSpawnHidden(2000, 0, undefined as unknown as SpawnExclusion), false);
  assert.equal(isSpawnHidden(2000, 0, { ...view, x: Number.MAX_VALUE, width: Number.MAX_VALUE }), false);
});
