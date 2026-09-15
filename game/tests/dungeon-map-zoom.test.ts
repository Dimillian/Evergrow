import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { generateDungeon } from '../src/dungeon.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { DungeonMap, dungeonMapBounds } = await import('../src/dungeon-map.ts');
css.deregister();

function chart(width: number, height: number) {
  const floor = generateDungeon(7319, 30), bounds = dungeonMapBounds(floor);
  const size = { width, height };
  const map = Object.assign(Object.create(DungeonMap.prototype), {
    floor, center: { x: bounds.x, y: bounds.y },
    canvas: { getBoundingClientRect: () => size }, tooltip: { hidden: false }, draw() {},
  });
  map.zoom = map.fitZoom(size);
  return { map, size, bounds };
}

test('compact dungeon overview remains reachable with wheel, pinch and minus-button zoom', () => {
  for (const [width, height] of [[740, 340], [740, 260], [320, 500]]) {
    for (const factor of [Math.exp(-120 * .001), .7, 1 / 1.3]) {
      const { map, bounds } = chart(width, height), fitted = map.zoom;
      assert.ok(fitted * bounds.width <= width - 60 + 1e-8);
      assert.ok(fitted * bounds.height <= height - 60 + 1e-8);
      map.zoomAt(factor);
      assert.ok(map.zoom <= fitted, 'zoom out must never enlarge the map');
      map.zoomAt(1.3);
      for (let i = 0; i < 50; i++) map.zoomAt(factor);
      assert.ok(map.zoom > 0 && map.zoom <= fitted, 'the opening overview remains reachable');
    }
  }
});

test('resizing a compact dungeon to desktop does not reverse zoom-out or move its anchor', () => {
  const { map, size } = chart(740, 260), fitted = map.zoom;
  size.width = 1180; size.height = 700;
  map.zoomAt(1 / 1.3);
  assert.ok(map.zoom <= fitted);
  const anchor = () => ({ x: map.center.x + (120 - size.width / 2) / map.zoom,
    y: map.center.y + (80 - size.height / 2) / map.zoom });
  const before = anchor();
  map.zoomAt(1.3, 120, 80);
  const after = anchor();
  assert.ok(Math.abs(after.x - before.x) < 1e-8);
  assert.ok(Math.abs(after.y - before.y) < 1e-8);
  map.zoomAt(1000);
  assert.equal(map.zoom, .8, 'desktop maximum remains bounded');
});

test('dungeon fitting stays positive when layout leaves less space than its padding', () => {
  const { map } = chart(40, 30);
  assert.ok(Number.isFinite(map.zoom) && map.zoom > 0);
  map.zoomAt(.5);
  assert.ok(Number.isFinite(map.zoom) && map.zoom > 0);
});
