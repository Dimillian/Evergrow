import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldMap, getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt } from '../src/world-map.ts';
import type { MapView } from '../src/world-map.ts';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('world/map projection is reversible at fractional centers and negative coordinates', () => {
  const view: MapView = { x: 21, y: 36, width: 977, height: 541, centerX: -1290.3125, centerY: 4831.0625, zoom: .173 };
  for (const [x, y] of [[0, 0], [-1536.25, -48.75], [9381.125, 7824.0625]]) {
    const p = projectMapPoint(x, y, view), restored = unprojectMapPoint(p.x, p.y, view);
    near(restored.x, x); near(restored.y, y);
  }
});

test('minimap scrolls continuously with the interpolated character and keeps its marker centered', () => {
  const r = getMinimapRect(960, 600);
  const view: MapView = { ...r, centerX: 10.125, centerY: -19.25, zoom: .08 };
  const a = projectMapPoint(150, 80, view);
  const next = { ...view, centerX: view.centerX + .25, centerY: view.centerY + .125 };
  const b = projectMapPoint(150, 80, next);
  near(a.x - b.x, .25 * view.zoom); near(a.y - b.y, .125 * view.zoom);
  const marker = projectMapPoint(next.centerX, next.centerY, next);
  near(marker.x, r.x + r.width / 2); near(marker.y, r.y + r.height / 2);
});

test('zoom preserves the hovered world anchor and clamps extreme wheel input', () => {
  const view: MapView = { x: 0, y: 0, width: 900, height: 600, centerX: -123.4, centerY: 567.8, zoom: .17 };
  const anchor = unprojectMapPoint(740, 120, view);
  const zoomed = zoomMapAt(view, 740, 120, .51), after = unprojectMapPoint(740, 120, zoomed);
  near(anchor.x, after.x); near(anchor.y, after.y);
  assert.equal(zoomMapAt(view, 740, 120, 1000).zoom, .7);
  assert.equal(zoomMapAt(view, 740, 120, .00001).zoom, .065);
  assert.equal(zoomMapAt(view, 740, 120, NaN).zoom, view.zoom);
});

test('minimap bounds leave a margin in narrow and desktop viewports', () => {
  for (const [w, h] of [[390, 844], [540, 450], [960, 600], [1440, 900]]) {
    const r = getMinimapRect(w, h);
    assert.ok(r.x > 0 && r.y > 0 && r.x + r.width < w && r.y + r.height < h);
  }
});

test('a static open chart avoids redraws but reacts to discovery and delayed storage failure', () => {
  let draws = 0, reveals = 0;
  const exploration = { revision: 1, storageStatus: 'saved', persistenceMessage: '', reveal() { reveals++; } };
  // Exercise the real update/render invalidation path without creating a DOM or canvas.
  const map = Object.assign(Object.create(WorldMap.prototype), {
    opened: true, disposed: false, presentation: null, exploration,
    drawChart() { draws++; },
  }) as WorldMap;
  const player = { x: 15.25, y: -71.125, angle: .4 };
  map.update(player, 1 / 60);
  for (let i = 0; i < 180; i++) map.update(player, 1 / 60);
  assert.equal(draws, 1, 'paused unchanged map does not redraw at the frame rate');
  assert.equal(reveals, 181, 'the lightweight exploration update remains active');
  exploration.revision++; map.update(player, 1 / 60); assert.equal(draws, 2);
  exploration.storageStatus = 'pending'; map.update(player, 1 / 60); assert.equal(draws, 3);
  exploration.storageStatus = 'session'; exploration.persistenceMessage = 'Local storage is unavailable.';
  map.update(player, 1 / 60); assert.equal(draws, 4, 'an asynchronous failed save refreshes its status');
  for (let i = 0; i < 120; i++) map.update(player, 1 / 60);
  assert.equal(draws, 4);
  map.update({ ...player, x: player.x + .125 }, 1 / 60); assert.equal(draws, 5);
  map.update({ ...player, x: player.x + .125, angle: .5 }, 1 / 60); assert.equal(draws, 6);
  (map as unknown as { render(): void }).render(); assert.equal(draws, 7, 'interaction events can explicitly redraw');
  map.update({ ...player, x: player.x + .125, angle: .5 }, 1 / 60);
  assert.equal(draws, 7, 'an explicit interaction draw also refreshes the presentation cache');
});
