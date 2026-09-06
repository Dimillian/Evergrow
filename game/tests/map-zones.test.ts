import test from 'node:test';
import assert from 'node:assert/strict';
import { mapZoneLabels, drawMapZoneLevels } from '../src/map-zone-art.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import { projectMapPoint, unprojectMapPoint, type MapView } from '../src/map-view.ts';
const view: MapView = { x: 0, y: 0, width: 1000, height: 800, centerX: 0, centerY: 0, zoom: .04 };
test('map danger labels agree with gameplay, hide unknown regions, and avoid towns and one another', () => {
  assert.deepEqual(mapZoneLabels(view, { isRevealed: () => false }, 7319, []), []);
  const known = { isRevealed: (x: number, y: number) => x < 3000 && Math.hypot(x, y) < 9000 };
  const towns = [{ x: 0, y: 0 }], labels = mapZoneLabels(view, known, 18427, towns);
  assert.ok(labels.length > 2);
  for (const z of labels) {
    assert.ok(known.isRevealed(z.x, z.y));
    assert.deepEqual(getZoneAt(z.x, z.y, 18427), z);
    const p = projectMapPoint(z.x, z.y, view);
    for (const other of [...towns, ...labels.filter(q => q.id !== z.id)]) {
      const q = projectMapPoint(other.x, other.y, view);
      assert.ok(Math.abs(p.x - q.x) >= 160 || Math.abs(p.y - q.y) >= 72);
    }
  }
});
test('danger contour strokes never cross a hidden discovery hole', () => {
  const known = { isRevealed: (x: number, y: number) => Math.hypot(x, y) < 9000 && !(x > 1800 && x < 4400 && y > -5000 && y < 5000) };
  let last = { x: 0, y: 0 }, strokes = 0;
  const context = { save() { }, restore() { }, beginPath() { }, rect() { }, clip() { }, setLineDash() { }, stroke() { },
    moveTo(x: number, y: number) { last = { x, y }; }, lineTo(x: number, y: number) {
      for (let i = 0; i <= 20; i++) {
        const p = unprojectMapPoint(last.x + (x - last.x) * i / 20, last.y + (y - last.y) * i / 20, view);
        assert.ok(known.isRevealed(p.x, p.y));
      }
      strokes++;
      last = { x, y };
    } };
  drawMapZoneLevels(context as unknown as CanvasRenderingContext2D, view, known, 7319, []);
  assert.ok(strokes > 50);
});
