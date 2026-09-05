import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMapPOI, unprojectMapPoint, WorldMap, type MapView } from '../src/world-map.ts';
import type { MapPOI } from '../src/exploration.ts';

const view: MapView = { x: 20, y: 40, width: 160, height: 120, centerX: -1130.25, centerY: 51.75, zoom: .08 };
const markerAt = (x: number, y: number, id = 'marker', chart = view): MapPOI => ({
  id, name: id, kind: 'town', description: 'A charted settlement.', ...unprojectMapPoint(x, y, chart),
});

test('overlapping POI hit areas choose the nearest visible marker, regardless of discovery order', () => {
  const near = markerAt(102, 100, 'near'), far = markerAt(106, 100, 'far');
  for (const pois of [[near, far], [far, near]]) {
    assert.equal(pickMapPOI(pois, view, { x: 100, y: 100 }, 8)?.id, 'near');
  }
});

test('minimap headers, footers, and outer edges never activate nearby chart markers', () => {
  for (const [x, y, px, py] of [[100, 41, 100, 39], [100, 159, 100, 160],
    [21, 100, 19, 100], [179, 100, 180, 100]]) {
    assert.equal(pickMapPOI([markerAt(x, y)], view, { x: px, y: py }, 8), null);
    assert.ok(pickMapPOI([markerAt(x, y)], view, { x, y }, 8));
  }
});

test('POI hover keeps its screen-space hit radius at map zoom extremes and ignores offscreen markers', () => {
  for (const zoom of [.065, .08, .7]) {
    const chart = { ...view, zoom };
    const poi = markerAt(100, 100, 'marker', chart);
    assert.equal(pickMapPOI([poi], chart, { x: 107.9, y: 100 }, 8), poi);
    assert.equal(pickMapPOI([poi], chart, { x: 108.1, y: 100 }, 8), null);
    assert.equal(pickMapPOI([markerAt(18, 100, 'offscreen', chart)], chart, { x: 21, y: 100 }, 8), null);
  }
});

test('POI cards use their measured responsive dimensions when staying inside the chart', () => {
  const properties = new Map<string, string>();
  const tooltip = { hidden: true, offsetWidth: 270, offsetHeight: 126,
    style: { left: '', top: '', setProperty(name: string, value: string) { properties.set(name, value); } } };
  const name = { textContent: '' }, kind = { textContent: '' }, description = { textContent: '' };
  const map = Object.assign(Object.create(WorldMap.prototype), {
    view: { ...view, x: 0, y: 0, width: 800, height: 460 }, tooltip,
    tooltipName: name, tooltipKind: kind, tooltipDescription: description,
  }) as { showTooltip(poi: MapPOI, point: { x: number; y: number }): void; view: MapView };
  const poi = markerAt(100, 100);
  map.showTooltip(poi, { x: 798, y: 458 });
  assert.equal(tooltip.hidden, false);
  assert.equal(name.textContent, poi.name);
  assert.equal(description.textContent, poi.description);
  assert.ok(properties.has('--poi-color'));
  assert.ok(Number.parseFloat(tooltip.style.left) + tooltip.offsetWidth <= 788);
  assert.ok(Number.parseFloat(tooltip.style.top) + tooltip.offsetHeight <= 448);

  map.view.width = 260; map.view.height = 220;
  tooltip.offsetWidth = 238; tooltip.offsetHeight = 164;
  map.showTooltip(poi, { x: 258, y: 218 });
  assert.ok(Number.parseFloat(tooltip.style.left) >= 10);
  assert.ok(Number.parseFloat(tooltip.style.left) + tooltip.offsetWidth <= 248);
  assert.ok(Number.parseFloat(tooltip.style.top) + tooltip.offsetHeight <= 208);
});
