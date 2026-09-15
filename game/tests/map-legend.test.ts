import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_LEGEND_GROUPS, MAP_SERVICES, MapIconVisibility, enemyMapIconId, nearestMapService } from '../src/map-legend-content.ts';
import { POI_DEFINITIONS, type WorldPOI } from '../src/world-pois.ts';
import { WorldMap, selectMapPOIs, pickMapPOI, type MapView } from '../src/world-map.ts';
import { drawJourneyMapMarker } from '../src/journey-marker.ts';

const service = (id: string, x: number, kind: WorldPOI['kind'] = 'blacksmith'): WorldPOI => ({ id, x, y: 0, kind, name: id, description: '' });
const view: MapView = { x: 0, y: 0, width: 800, height: 500, centerX: 0, centerY: 0, zoom: .17 };

test('legend covers every registered POI once and only real service types offer pings', () => {
  const entries = MAP_LEGEND_GROUPS.flatMap(g => g.entries);
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  for (const id of Object.keys(POI_DEFINITIONS)) assert.equal(entries.filter(e => e.id === id).length, 1, id);
  assert.deepEqual(entries.filter(e => e.service).map(e => e.service), MAP_SERVICES);
  for (const kind of ['entry', 'chest', 'boss', 'reliquary', 'ward', 'champion']) assert.ok(entries.some(e => e.id === `dungeon:${kind}`));
});

test('nearest service uses character distance, ignores other types and unvisited sightings, and breaks ties consistently', () => {
  const close = service('close', 10), far = service('far', 500), other = service('other', 0, 'jeweler');
  const sighted = { ...service('sighted', 1), sighted: true };
  assert.equal(nearestMapService([far, other, close, sighted], 'blacksmith', { x: 0, y: 0 }), close);
  assert.equal(nearestMapService([close, far], 'blacksmith', { x: 490, y: 0 }), far);
  const a = service('a', -10), b = service('b', 10);
  for (const list of [[a, b], [b, a]]) assert.equal(nearestMapService(list, 'blacksmith', { x: 0, y: 0 }), a);
  assert.equal(nearestMapService([other, sighted], 'blacksmith', { x: 0, y: 0 }), null);
  assert.equal(nearestMapService([close], 'blacksmith', { x: NaN, y: 0 }), null);
});

test('category toggles notify shared maps once and do not mutate discoveries or other categories', () => {
  const visibility = new MapIconVisibility(); let notifications = 0;
  const unsubscribe = visibility.subscribe(() => notifications++);
  visibility.set(MAP_SERVICES, false);
  assert.equal(notifications, 1); assert.ok(MAP_SERVICES.every(id => !visibility.isVisible(id)));
  assert.equal(visibility.isVisible('camp'), true);
  visibility.set(['blacksmith'], true);
  assert.equal(notifications, 2); assert.equal(visibility.isVisible('jeweler'), false);
  visibility.set(['blacksmith'], true); assert.equal(notifications, 2);
  unsubscribe(); visibility.set(MAP_SERVICES, true); assert.equal(notifications, 2);
});

test('hidden services release collision priority and cannot be hovered; a ping temporarily reveals only its target', () => {
  const smith = service('smith', 0), jeweler = service('jeweler', 5, 'jeweler');
  const visibility = new MapIconVisibility(); visibility.set(['blacksmith'], false);
  const map = Object.assign(Object.create(WorldMap.prototype), {
    iconVisibility: visibility, focusPOI: null, player: { x: 0, y: 0 }, zoneLevels: false,
    exploration: { getDiscoveredPOIs: () => [smith, jeweler], isRevealed: () => true }, portalMarkers: () => [],
    world: { sampleBiome: () => ({ id: 'verdant', name: 'Verdant' }) },
  });
  let pois = map.features(view, false).pois as WorldPOI[];
  assert.deepEqual(pois.map(p => p.id), ['jeweler']);
  assert.equal(pickMapPOI(pois, view, { x: 400, y: 250 }, 10)?.id, 'jeweler');
  map.focusPOI = smith;
  pois = map.features(view, false).pois;
  assert.equal(pois[0].id, 'smith');
  assert.equal(map.features(view, true).pois.some((p: WorldPOI) => p.id === 'smith'), false, 'temporary focus stays on full map');
  map.focusPOI = null;
  assert.equal(map.features(view, false).pois.some((p: WorldPOI) => p.id === 'smith'), false);
  assert.equal(visibility.isVisible('blacksmith'), false, 'ping never changes the filter');
});

test('overview zoom can show the focused NPC despite ordinary service suppression and overlapping town icons', () => {
  const town = service('town', 0, 'town'), smith = service('smith', 1);
  for (const zoom of [.025, .05, .17]) {
    const chart = { ...view, zoom };
    assert.equal(selectMapPOIs([town, smith], chart, false, smith.id)[0], smith);
    assert.equal(selectMapPOIs([town, smith], chart)[0], town);
  }
});

test('Ping nearest closes the compact drawer and uses the shared focus action without revealing or changing filters', () => {
  const near = service('near', 25), far = service('far', 2000), unknown = service('unknown', 1);
  const visibility = new MapIconVisibility(); visibility.set(['blacksmith'], false);
  const order: string[] = [];
  const map = Object.assign(Object.create(WorldMap.prototype), {
    iconVisibility: visibility, player: { x: 0, y: 0 }, view: { ...view, centerX: 2000 },
    exploration: { getDiscoveredPOIs: () => [unknown, far, near], isRevealed: (x: number) => x !== unknown.x },
    legend: { closeCompact: () => order.push('close'), announce: () => order.push('announce') },
    focusLabel: { textContent: '', hidden: true }, focusPOI: null,
    focusLocation(target: WorldPOI) { assert.equal(target, near); order.push('focus'); },
  });
  map.pingNearest('blacksmith');
  assert.deepEqual(order, ['close', 'focus', 'announce']);
  assert.equal(map.focusPOI, near); assert.equal(map.focusLabel.hidden, false);
  assert.match(map.focusLabel.textContent, /Blacksmith/);
  assert.equal(map.view.centerX, 2000, 'the shared animation owns camera movement');
  assert.equal(visibility.isVisible('blacksmith'), false);
});

test('rank filters follow the same override order as the enemy renderer', () => {
  assert.equal(enemyMapIconId({ kind: 'brute', rank: 'elite' }), 'enemy:elite');
  assert.equal(enemyMapIconId({ kind: 'caster', rank: 'veteran' }), 'enemy:veteran');
  assert.equal(enemyMapIconId({ kind: 'brute' }), 'enemy:brute');
  assert.equal(enemyMapIconId({ kind: 'caster' }), 'enemy:caster');
  assert.equal(enemyMapIconId({ kind: 'hound' }), 'enemy:normal');
});

test('hidden Journey filters suppress both destination/search marks and their offscreen direction arrows', () => {
  const visibility = new MapIconVisibility(); visibility.set(['journey:destination', 'journey:search'], false);
  const context = new Proxy({}, { get() { throw new Error('Hidden marker attempted to paint'); } }) as CanvasRenderingContext2D;
  for (const known of [true, false]) for (const edge of [true, false])
    drawJourneyMapMarker(context, view, { x: 10000, y: 0, name: 'Hidden', known }, edge, visibility);
});
