import test from 'node:test';
import assert from 'node:assert/strict';
import { AtlasSurvey, atlasSurveyBounds, ATLAS_SURVEYS, ATLAS_ZOOM } from '../src/tools/atlas-survey.ts';
import { EXPLORATION_LIMITS } from '../src/exploration-save.ts';
import { fitMapBounds, zoomMapAt, MAP_ZOOM } from '../src/map-view.ts';
import { mapTerrainSize, MAP_TERRAIN_RULES } from '../src/world-map.ts';

test('every atlas survey covers its edges without overflowing gameplay chart capacity', () => {
  for (const { id } of ATLAS_SURVEYS) {
    const region = atlasSurveyBounds(id);
    const chart = new AtlasSurvey({ seed: 1, getPOIs: () => [] }, region);
    assert.ok(chart.snapshot().chunks.length <= EXPLORATION_LIMITS.chunks);
    for (const x of [region.x, 0, region.x + region.width - 1])
      for (const y of [region.y, 0, region.y + region.height - 1]) assert.ok(chart.isRevealed(x, y));
    assert.equal(chart.isRevealed(region.x - 1, 0), false);
    assert.equal(chart.isRevealed(region.x + region.width, 0), false);
    chart.dispose();
  }
});

test('vast atlas fits a compact viewport while runtime zoom stays unchanged', () => {
  const view = { x: 0, y: 0, width: 700, height: 400, centerX: 0, centerY: 0, zoom: .17 };
  const region = atlasSurveyBounds('vast');
  const fitted = fitMapBounds(view, region, 24, ATLAS_ZOOM);
  assert.ok(fitted.zoom < MAP_ZOOM.min);
  assert.ok(region.width * fitted.zoom <= view.width - 48);
  assert.ok(region.height * fitted.zoom <= view.height - 48);
  assert.equal(fitMapBounds(view, region, 24).zoom, MAP_ZOOM.min);
  assert.equal(zoomMapAt(fitted, 350, 200, 0, ATLAS_ZOOM).zoom, ATLAS_ZOOM.min);
  for (const zoom of [.001, .002, fitted.zoom]) {
    const size = mapTerrainSize(zoom, view.width, view.height);
    assert.ok((Math.ceil(view.width / zoom / size) + 2) * (Math.ceil(view.height / zoom / size) + 2) <= MAP_TERRAIN_RULES.maximumVisibleTiles);
  }
});

test('survey retains all landmarks beyond the save cap and cancels pending spatial batches', async () => {
  const region = atlasSurveyBounds('vast'), controller = new AbortController();
  let queries = 0;
  const chart = new AtlasSurvey({ seed: 1, getPOIs(x, y) {
    queries++;
    return Array.from({ length: 20 }, (_, i) => ({ id: `${x}:${y}:${i}`, name: 'Town', kind: 'town' as const, description: '', x: x + i, y }));
  } }, region);
  await chart.survey(region, controller.signal, () => {}, async () => {});
  assert.equal(queries, 256);
  assert.equal(chart.discoveredPOICount, 5120);
  assert.equal(chart.getDiscoveredPOIs().length, 5120);
  assert.equal(chart.getDiscoveredPOIs({ x: region.x, y: region.y, width: 100, height: 100 }).length, 20);
  const before = queries;
  controller.abort();
  await chart.survey(region, controller.signal, () => assert.fail('cancelled'), async () => {});
  assert.equal(queries, before);
  chart.dispose();
});
