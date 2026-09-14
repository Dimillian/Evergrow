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
    world: { isSanctuary: () => true }, encounterLevelReader: () => null, eventStateReader: () => null,
    tooltipName: name, tooltipKind: kind, tooltipDescription: description,
  }) as { showTooltip(poi: MapPOI, point: { x: number; y: number }): void; view: MapView };
  const poi = markerAt(100, 100);
  map.showTooltip(poi, { x: 798, y: 458 });
  assert.equal(tooltip.hidden, false);
  assert.equal(name.textContent, poi.name);
  assert.equal(description.textContent, poi.description);
  assert.equal(kind.textContent, 'Settlement · Sanctuary');
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

function hoverMap() {
  return Object.assign(Object.create(WorldMap.prototype), {
    view: { ...view, x: 0, y: 0, width: 800, height: 460, centerX: 0, centerY: 0, zoom: 1 },
    pointer: { x: 410, y: 230 }, drag: null, explorationMode: false,
    hovered: null, visiblePOIs: [], journeyMarker: null,
    world: { sampleBiome: () => ({ id: 'deadwood', name: 'Deadwood' }), isSanctuary: () => true },
    exploration: { isRevealed: (x: number) => x >= 0 },
    encounterLevelReader: () => null, eventStateReader: () => null,
    areaInfo: { hidden: true }, areaName: { textContent: '' }, areaBiome: { textContent: '' },
    areaLevel: { textContent: '' }, areaCoordinates: { textContent: '' },
    tooltip: { hidden: true, offsetWidth: 270, offsetHeight: 126,
      style: { left: '', top: '', setProperty() {} } },
    tooltipName: { textContent: '' }, tooltipKind: { textContent: '' }, tooltipDescription: { textContent: '' },
  });
}

test('discovered terrain updates anchored area details without opening a cursor tooltip', () => {
  const map = hoverMap();
  map.drawHover();
  assert.equal(map.areaInfo.hidden, false);
  assert.ok(map.areaName.textContent);
  assert.equal(map.areaBiome.textContent, 'Deadwood');
  assert.equal(map.areaLevel.textContent, 'Sanctuary');
  assert.equal(map.areaCoordinates.textContent, 'X 10 · Y 0');
  assert.equal(map.tooltip.hidden, true);
  map.pointer = { x: 430, y: 250 };
  map.drawHover();
  assert.equal(map.areaCoordinates.textContent, 'X 30 · Y 20');
  assert.equal(map.tooltip.style.left, '', 'terrain never positions the cursor tooltip');
  map.pointer = { x: 390, y: 230 };
  map.drawHover();
  assert.equal(map.areaInfo.hidden, true, 'unknown terrain hides area details');
});

test('area inspection hides on pointer exit, dragging and held-Tab without querying terrain', () => {
  for (const state of [{ pointer: null }, { pointer: { x: 801, y: 230 } },
    { drag: { id: 1 } }, { explorationMode: true }]) {
    const map = hoverMap();
    map.drawHover();
    Object.assign(map, state);
    map.world.sampleBiome = () => { throw new Error('must not inspect terrain'); };
    map.drawHover();
    assert.equal(map.areaInfo.hidden, true);
    assert.equal(map.tooltip.hidden, true);
  }
  const map = hoverMap();
  map.drawHover();
  map.tooltip.hidden = false;
  map.hideTooltip();
  assert.equal(map.areaInfo.hidden, true, 'closing and recentering clear both surfaces');
  assert.equal(map.tooltip.hidden, true);
});

test('POI and Journey icon tooltips follow the cursor independently of area inspection', () => {
  const map = hoverMap();
  const poi = markerAt(410, 230, 'Settlement', map.view);
  map.visiblePOIs = [poi]; map.hovered = poi; // The marker highlight is already painted.
  map.drawHover();
  assert.equal(map.areaInfo.hidden, false);
  assert.equal(map.tooltip.hidden, false);
  assert.equal(map.tooltipName.textContent, 'Settlement');
  assert.equal(map.tooltip.style.left, '428px');
  map.pointer.x += 5;
  map.drawHover();
  assert.equal(map.tooltip.style.left, '433px');
  map.explorationMode = true;
  map.drawHover();
  assert.equal(map.areaInfo.hidden, true);
  assert.equal(map.tooltip.hidden, false, 'held-Tab retains icon inspection');
  map.explorationMode = false;
  map.journeyMarker = { x: 15, y: 0, name: 'Tracked journey', known: false };
  map.exploration.isRevealed = () => false;
  map.drawHover();
  assert.equal(map.areaInfo.hidden, true, 'a Journey marker never reveals unknown area information');
  assert.equal(map.tooltipKind.textContent, 'Journey');
  assert.equal(map.tooltipDescription.textContent, 'Explore this area to find the activity');
});
