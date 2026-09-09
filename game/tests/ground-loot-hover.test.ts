import test from 'node:test';
import assert from 'node:assert/strict';
import { hoveredGroundLoot } from '../src/ground-loot-hover.ts';

test('loot hit testing follows the packed label before nearby silhouettes', () => {
  const labels = [
    { id: 1, x: 10, y: 20, width: 80, height: 19, anchorX: 50, anchorY: 60 },
    { id: 2, x: 100, y: 20, width: 80, height: 19, anchorX: 110, anchorY: 30 },
  ];
  assert.equal(hoveredGroundLoot(labels, 110, 25)?.id, 2);
  assert.equal(hoveredGroundLoot(labels, 50, 60)?.id, 1);
  assert.equal(hoveredGroundLoot(labels, 250, 90), undefined);
});
