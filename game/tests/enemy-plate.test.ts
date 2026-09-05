import assert from 'node:assert/strict';
import test from 'node:test';
import { getEnemyPlateLayout } from '../src/enemy-plate.ts';
import { getMinimapRect } from '../src/world-map.ts';
import { getHUDLayout } from '../src/hud.ts';

test('enemy plate stays centered, compact, and below navigation on narrow game viewports', () => {
  assert.deepEqual(getEnemyPlateLayout(960, 600), { x: 345, y: 16, width: 270, height: 46 });
  assert.deepEqual(getEnemyPlateLayout(540, 450), { x: 180, y: 60, width: 180, height: 46 });
  for (const width of [540, 600, 659, 660, 719, 720, 960, 1440]) {
    const plate = getEnemyPlateLayout(width, 450), map = getMinimapRect(width, 450);
    assert.equal(plate.x + plate.width / 2, width / 2);
    assert.ok(plate.width >= 180 && plate.width <= 270);
    assert.equal(plate.height, 46);
    assert.ok(plate.x + plate.width <= map.x - 12, 'the minimap always keeps its horizontal clearance');
    assert.ok(plate.y >= 60 || plate.x >= 220, 'the plate clears the left navigation labels');
    assert.ok(plate.y + plate.height <= getHUDLayout(width, 450).y - 8);
  }
});

test('very narrow surfaces place the full plate below the minimap', () => {
  for (const width of [320, 390, 500, 539]) {
    const plate = getEnemyPlateLayout(width, 844), map = getMinimapRect(width, 844);
    assert.equal(plate.y, map.y + map.height + 8);
    assert.equal(plate.height, 46);
    assert.ok(plate.x >= 16 && plate.x + plate.width <= width - 16);
    assert.ok(plate.y + plate.height <= getHUDLayout(width, 844).y - 8);
  }
});

test('surfaces too small for a readable enemy plate omit it instead of overlapping the HUD', () => {
  for (const [width, height] of [[960, 160], [320, 240], [200, 844], [0, 0]]) {
    const plate = getEnemyPlateLayout(width, height);
    assert.equal(plate.height, 0);
    assert.ok(Object.values(plate).every(Number.isFinite));
    assert.ok(plate.x >= 0 && plate.y >= 0 && plate.width >= 0);
  }
});
