import test from 'node:test';
import assert from 'node:assert/strict';
import { groundLootVisibility, hoveredGroundLoot } from '../src/ground-loot-hover.ts';

test('loot hit testing follows the packed label before nearby silhouettes', () => {
  const labels = [
    { id: 1, x: 10, y: 20, width: 80, height: 19, anchorX: 50, anchorY: 60 },
    { id: 2, x: 100, y: 20, width: 80, height: 19, anchorX: 110, anchorY: 30 },
  ];
  assert.equal(hoveredGroundLoot(labels, 110, 25)?.id, 2);
  assert.equal(hoveredGroundLoot(labels, 50, 60)?.id, 1);
  assert.equal(hoveredGroundLoot(labels, 250, 90), undefined);
});

test('Ctrl mode reveals silhouettes and their hovered plates without invisible label hit areas', () => {
  const labels = [
    { id: 1, x: 10, y: 20, width: 80, height: 14, anchorX: 50, anchorY: 80 },
    { id: 2, x: 100, y: 20, width: 80, height: 14, anchorX: 140, anchorY: 80 },
  ];
  const visible = (result: ReturnType<typeof groundLootVisibility>) => result.filter(b => b.visible).map(b => b.id);
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: true })), [1, 2]);
  const hidden = groundLootVisibility(labels, { showAll: false });
  assert.deepEqual(visible(hidden), []);
  assert.equal(hoveredGroundLoot(hidden, 50, 25), undefined, 'hidden label does not intercept clicks');
  assert.equal(hoveredGroundLoot(hidden, 50, 80)?.id, 1, 'physical loot stays targetable');
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: false, pointer: { x: 50, y: 25 } })), []);
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: false, pointer: { x: 50, y: 80 } })), [1]);
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: false, retainedId: 1, pointer: { x: 50, y: 25 } })), [1]);
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: false, retainedId: 1, pointer: { x: 250, y: 150 } })), []);
  assert.deepEqual(visible(groundLootVisibility(labels, { showAll: false, selectedId: 2 })), [2]);
});

test('a hidden neighboring plate cannot mask a physical item under the pointer', () => {
  const labels = [
    { id: 1, x: 10, y: 20, width: 80, height: 14, anchorX: 50, anchorY: 100 },
    { id: 2, x: 100, y: 20, width: 80, height: 14, anchorX: 50, anchorY: 25 },
  ];
  const result = groundLootVisibility(labels, { showAll: false, pointer: { x: 50, y: 25 } });
  assert.deepEqual(result.filter(b => b.visible).map(b => b.id), [2]);
  assert.equal(hoveredGroundLoot(result, 50, 25)?.id, 2);
});
