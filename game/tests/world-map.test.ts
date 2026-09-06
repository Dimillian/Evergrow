import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldMap, mapTileBlend, mapTerrainSize, isMapSampleRevealed, selectMapPOIs, mapRegionLabels, MAP_TERRAIN_RULES, mapRoadPaths, pickMapPOI, chartedMapArea, getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt } from '../src/world-map.ts';
import type { MapView } from '../src/world-map.ts';
import { fitMapBounds, MAP_ZOOM } from '../src/map-view.ts';
import type { WorldPOI } from '../src/world-pois.ts';
import { World } from '../src/world.ts';
import { biomeMapColor } from '../src/biomes.ts';
import { roadPaths, pathDistance } from '../src/road-shape.ts';
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('area inspection reveals level only in charted terrain and respects sanctuaries', () => {
  let samples = 0;
  const world = { sampleBiome() { samples++; return { id: 'deadwood', name: 'Deadwood' }; }, isSanctuary: (x: number) => x === 0 };
  const hidden = { isRevealed: () => false }, revealed = { isRevealed: () => true };
  assert.equal(chartedMapArea(world, hidden, 6400, 0), null);
  assert.equal(chartedMapArea(world, revealed, NaN, 0), null);
  assert.equal(samples, 0, 'unknown cells do not query underlying biome or danger metadata');
  assert.match(chartedMapArea(world, revealed, 6400, 0)!.label, /^Area Lv [1-9]/);
  assert.match(chartedMapArea(world, revealed, -6400, 0)!.label, /^Area Lv [1-9]/);
  assert.equal(chartedMapArea(world, revealed, 0, 0)?.label, 'Sanctuary');
  assert.match(chartedMapArea(world, revealed, 1, 0)!.name, /Briar March/);
});

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
  assert.equal(zoomMapAt(view, 740, 120, .00001).zoom, .025);
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


test('overview fitting keeps the requested world rectangle inside the chart while respecting zoom bounds', () => {
  const view: MapView = { x: 0, y: 0, width: 1100, height: 650, centerX: 0, centerY: 0, zoom: .17 };
  const region = { x: -10000, y: -7500, width: 20000, height: 15000 };
  const fitted = fitMapBounds(view, region, 30);
  assert.ok(fitted.zoom >= MAP_ZOOM.min && fitted.zoom < .065);
  const top = projectMapPoint(region.x, region.y, fitted), bottom = projectMapPoint(region.x + region.width, region.y + region.height, fitted);
  assert.ok(top.x >= 30 && top.y >= 30 && bottom.x <= 1070 && bottom.y <= 620);
  assert.deepEqual(fitMapBounds(view, { ...region, width: NaN }), view);
});

test('overview sampling keeps the visible tile set below cache capacity even at broad zoom', () => {
  for (const zoom of [.025, .03, .055, .08, .17, .7]) for (const [width, height] of [[1100, 650], [390, 700], [3840, 2160]]) {
    const size = mapTerrainSize(zoom, width, height);
    const count = (Math.ceil(width / zoom / size) + 2) * (Math.ceil(height / zoom / size) + 2);
    assert.ok(count <= MAP_TERRAIN_RULES.maximumVisibleTiles);
    assert.ok(count < MAP_TERRAIN_RULES.cacheLimit);
    assert.equal(size % 768, 0);
  }
  assert.equal(mapTerrainSize(.025, 1100, 650), 3072);
  assert.equal(mapTerrainSize(.08, 160, 107), 768, 'the minimap retains its detailed terrain samples');
  assert.equal(mapTerrainSize(NaN, 1100, 650), 768);
});

test('minimap chart keeps detailed terrain when its display size grows', () => {
  const sizes = new Set<number>();
  const map = Object.assign(Object.create(WorldMap.prototype), {
    tile(_x: number, _y: number, size: number) { sizes.add(size); return null; },
    world: { getBuildings: () => [] },
    previewTile: () => null,
  }) as unknown as { chart(context: unknown, view: MapView, mini: boolean, features: unknown): void };
  const context = { save() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, restore() {},
    getTransform: () => ({ a: 1, b: 0 }) };
  const view: MapView = { x: 0, y: 0, width: 320, height: 210, centerX: -380, centerY: 770, zoom: .08 };
  map.chart(context, view, true, { pois: [], labels: [] });
  assert.deepEqual([...sizes], [768]);
  sizes.clear(); map.chart(context, view, false, { pois: [], labels: [] });
  assert.deepEqual([...sizes], [1536], 'only the full atlas uses overview sampling at the same scale');
});

test('coarse terrain samples disclose nothing when any fine exploration cell is unknown', () => {
  const revealed = new Set(['-2:-2', '-1:-2', '-2:-1']);
  const chart = { isCellRevealed: (x: number, y: number) => revealed.has(`${x}:${y}`) };
  assert.equal(isMapSampleRevealed(chart, -96, -96, 96), false);
  revealed.add('-1:-1'); assert.equal(isMapSampleRevealed(chart, -96, -96, 96), true);
  assert.equal(isMapSampleRevealed(chart, -72, -72, 24), true, 'detailed samples use their containing fine cell');
  assert.equal(isMapSampleRevealed(chart, -96, -96, Infinity), false);
  assert.equal(isMapSampleRevealed(chart, 0, 0, 96), false);
});

test('overview POI decluttering is stable and hover selects only actually drawn markers', () => {
  const poi = (id: string, kind: WorldPOI['kind'], x: number, y: number): WorldPOI => ({ id, kind, x, y, name: id, description: id });
  const pois = [poi('smith', 'blacksmith', 20, 0), poi('town', 'town', 0, 0), poi('camp', 'camp', 1100, 0),
    poi('shrine', 'shrine', 1105, 0), poi('stones', 'standingStones', -1400, 700)];
  const view: MapView = { x: 0, y: 0, width: 1100, height: 650, centerX: 0, centerY: 0, zoom: .04 };
  const selected = selectMapPOIs(pois, view);
  assert.deepEqual(selected.map(poi => poi.id), ['town', 'camp', 'stones']);
  assert.deepEqual(selectMapPOIs([...pois].reverse(), view), selected);
  const marker = projectMapPoint(1105, 0, view);
  assert.equal(pickMapPOI(selected, view, marker, 14)?.id, 'camp');
});

test('biome region labels require revealed homogeneous land and avoid visible POIs', () => {
  let samples = 0;
  const world = { sampleBiome: (_x: number, _y: number) => { samples++; return { id: 'verdant', name: 'Verdant Forest' }; } };
  const view: MapView = { x: 0, y: 0, width: 1100, height: 650, centerX: 0, centerY: 0, zoom: .04 };
  assert.deepEqual(mapRegionLabels(world, { isRevealed: () => false }, view, []), []);
  assert.equal(samples, 0);
  const chart = { isRevealed: (x: number, y: number) => Math.hypot(x, y) < 7000 };
  const labels = mapRegionLabels(world, chart, view, []);
  assert.ok(labels.length > 0 && labels.length <= 12);
  for (const label of labels) assert.ok(chart.isRevealed(label.x, label.y));
  const first = labels[0], poi: WorldPOI = { id: 'town', kind: 'town', name: 'Town', description: 'Town', x: first.x, y: first.y };
  assert.ok(!mapRegionLabels(world, chart, view, [poi]).some(label => label.x === first.x && label.y === first.y));
});


test('large atlas detail is isolated from minimap tiles and stays clipped to revealed cells', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvas = () => {
    const context = { painted: 0, fillStyle: '', globalCompositeOperation: '',
      fillRect() {}, clearRect() { this.painted = 0; }, drawImage(...args: unknown[]) { this.painted += args.length === 9 ? Number(args[7]) * Number(args[8]) : 1; },
      setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, save() {}, restore() {},
    };
    return { width: 0, height: 0, getContext: () => context };
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: canvas } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : Reflect.deleteProperty(globalThis, 'document'));
  let miniSamples = 0, atlasSamples = 0, propQueries = 0, revision = 1, hole = false;
  const exploration = { getChunkRevision: () => revision,
    isCellRevealed: (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 16 && !(hole && x === 4 && y === 4) };
  const map = Object.assign(Object.create(WorldMap.prototype), { exploration, tiles: new Map(), world: {
    mapColor() { miniSamples++; return '#456754'; }, atlasColor() { atlasSamples++; return '#527461'; },
    getProps(x: number, y: number, width: number, height: number) {
      propQueries++; assert.deepEqual([x, y, width, height], [-160, -160, 1088, 1088]); return [];
    },
  } }) as unknown as { tile(x: number, y: number, size: number, detailed?: boolean): {
    base: { width: number }; charted: { getContext(): { painted: number } }; roads: unknown;
  } };
  const mini = map.tile(0, 0, 768);
  assert.equal(miniSamples, 1024); assert.equal(propQueries, 0); assert.equal(atlasSamples, 0);
  const atlas = map.tile(0, 0, 768, true);
  assert.notEqual(atlas, mini); assert.equal(mini.base.width, 32); assert.equal(atlas.base.width, 128);
  assert.equal(atlasSamples, 4096); assert.equal(propQueries, 1); assert.equal(atlas.roads, null, 'road ink is flattened into the masked atlas surface');
  assert.equal(atlas.charted.getContext().painted, 8192, 'unknown half stays completely hidden');
  hole = true; revision++;
  assert.equal(map.tile(0, 0, 768, true), atlas);
  assert.equal(atlas.charted.getContext().painted, 8192 - 64, 'even an internal unknown cell masks all eight-by-eight detail pixels');
  assert.equal(atlasSamples, 4096); assert.equal(propQueries, 1, 'fog revisions reuse stable world art');
  assert.equal(map.tile(0, 0, 768), mini); assert.equal(miniSamples, 1024);
});

test('coarse tile cache notices discoveries in every covered chunk without regenerating terrain colors', t => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let colors = 0;
  const contexts: Array<{ painted: number; maskSource: unknown }> = [];
  const canvas = () => {
    const context = { fillStyle: '', globalCompositeOperation: '', painted: 0, maskSource: null as unknown,
      fillRect() {}, clearRect() { this.painted = 0; }, drawImage(source: unknown, ...args: number[]) {
        this.painted += args.length === 8 ? args[6] * args[7] : 1; if (this.globalCompositeOperation === 'destination-in') this.maskSource = source;
      }, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    };
    contexts.push(context); return { width: 0, height: 0, getContext: () => context };
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: canvas } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  let revision = 1, revealSecond = false;
  const exploration = { getChunkRevision: (x: number, y: number) => x >= 1536 && y >= 1536 ? revision : 1,
    isCellRevealed: (x: number, y: number) => x < 32 && y < 32 || revealSecond && x >= 32 && y >= 32 };
  const map = Object.assign(Object.create(WorldMap.prototype), { exploration, tiles: new Map(), world: {
    mapColor(_x: number, _y: number, sampleSize: number) { assert.equal(sampleSize, 96); colors++; return '#456754'; },
  } }) as unknown as { tile(tx: number, ty: number, size: number): unknown };
  const tile = map.tile(0, 0, 3072) as { charted: unknown };
  assert.ok(tile); assert.equal(colors, 1024); assert.equal(contexts[1].painted, 256);
  map.tile(0, 0, 3072); assert.equal(colors, 1024); assert.equal(contexts[1].painted, 256);
  revealSecond = true; revision = 2;
  assert.equal(map.tile(0, 0, 3072), tile); assert.equal(colors, 1024); assert.equal(contexts[1].painted, 512);
  assert.equal(contexts[3].maskSource, tile.charted, 'fine vector roads use the exact same conservative fog mask as terrain');
});


test('overview colors omit tiny raster roads while detailed maps retain their actual surface', () => {
  const world = new World();
  for (const [x,y] of roadPaths(-6000,-6000,12000,12000)[0].points.filter((_,i)=>i%30===0)) {
    const expected = biomeMapColor(world.sampleBiome(x, y).weights).map(Math.round);
    assert.equal(world.mapColor(x, y, 96), `rgb(${expected.join(',')})`);
    assert.notEqual(world.mapColor(x, y, 24), world.mapColor(x, y, 96));
    assert.equal(world.mapColor(x, y), world.mapColor(x, y, 24));
  }
});

test('overview roads use the same seeded polylines as ground clearance', () => {
  for (const seed of [7319,18427]) for (const [x,y] of [[-3072,-3072],[0,0],[-768,3072]]) {
    const paths=mapRoadPaths(x,y,3072,seed);
    assert.deepEqual(paths,roadPaths(x,y,3072,3072,seed));
    for(const path of paths){assert.ok(path.points.length<800);assert.ok(path.points.flat().every(Number.isFinite));
      for(const [px,py] of path.points.filter((_,i)=>i%11===0))assert.ok(pathDistance(px,py,seed)<1e-6);}
  }
  assert.deepEqual(mapRoadPaths(Infinity,0,3072),[]); assert.deepEqual(mapRoadPaths(0,0,12289),[]);
});


test('map pointer bursts coalesce into one frame and keep hover off the chart draw path', t => {
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const cancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  let callback: FrameRequestCallback | undefined, scheduled = 0, charts = 0, hovers = 0;
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (fn: FrameRequestCallback) => { callback = fn; return ++scheduled; } });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => { callback = undefined; } });
  t.after(() => {
    for (const [key, descriptor] of [['requestAnimationFrame', raf], ['cancelAnimationFrame', cancel]] as const)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  });
  const map = Object.assign(Object.create(WorldMap.prototype), {
    opened: true, disposed: false, frame: 0, chartDirty: false,
    render() { charts++; this.chartDirty = false; }, drawHover() { hovers++; },
  }) as { invalidate(chart?: boolean): void; opened: boolean };
  for (let i = 0; i < 100; i++) map.invalidate(false);
  assert.equal(scheduled, 1); callback!(0); assert.equal(hovers, 1); assert.equal(charts, 0);
  map.invalidate(false); map.invalidate(true); map.invalidate(false);
  assert.equal(scheduled, 2); callback!(0); assert.equal(charts, 1, 'a camera change upgrades an already pending hover frame');
  map.opened = false; map.invalidate(); assert.equal(scheduled, 2);
});

test('progressive atlas tiles yield, finish each terrain sample once, and keep applying discovery masks', t => {
  const doc = Object.getOwnPropertyDescriptor(globalThis, 'document'), clock = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let now = 0, samples = 0, props = 0, revision = 1, revealed = true;
  const canvas = () => {
    const context = { painted: 0, fillRect() {}, clearRect() { this.painted = 0; },
      drawImage(...args: unknown[]) { this.painted += args.length === 9 ? Number(args[7])*Number(args[8]) : 1; },
      save() {}, restore() {}, setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    };
    return { width: 0, height: 0, getContext: () => context };
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: canvas } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  t.after(() => {
    for (const [key, descriptor] of [['document', doc], ['performance', clock]] as const)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  });
  const map = Object.assign(Object.create(WorldMap.prototype), {
    tiles: new Map(), buildBudget: 0, pendingTerrain: false,
    exploration: { getChunkRevision: () => revision, isCellRevealed: () => revealed },
    world: { seed: 7319, mapColor: () => '#445544',
      atlasColor() { samples++; now++; return '#557755'; }, getProps() { props++; return []; } },
  });
  assert.equal(map.tile(0,0,768,true), null); assert.equal(samples,0); assert.equal(map.pendingTerrain,true);
  map.buildBudget = 128;
  let tile = map.tile(0,0,768,true);
  assert.equal(tile.nextRow, 2); assert.equal(tile.decorated,false); assert.equal(samples,128);
  assert.equal(tile.charted.getContext().painted,0, "partial detailed rows are never presented");
  // Fog changes are applied even while geometry is still being built.
  revealed = false; revision++; map.buildBudget = 128;
  map.tile(0,0,768,true); assert.equal(tile.charted.getContext().painted,0);
  revealed = true; revision++;
  let frames = 0;
  while (!tile.decorated && frames++ < 100) { map.buildBudget = 128; tile = map.tile(0,0,768,true); }
  assert.ok(tile.decorated); assert.equal(samples,4096); assert.equal(props,1);
  assert.equal(tile.charted.getContext().painted,16384);
  map.tile(0,0,768,true); assert.equal(samples,4096); assert.equal(props,1);
});


test('detail crossfade is bounded, eases both ends, and respects reduced motion', () => {
  assert.equal(mapTileBlend(100, 50),0); assert.equal(mapTileBlend(100,100),0);
  assert.equal(mapTileBlend(100,220),.5); assert.equal(mapTileBlend(100,340),1);
  assert.equal(mapTileBlend(100,10000),1); assert.equal(mapTileBlend(100,100,true),1);
  assert.ok(mapTileBlend(100,110) < 10/240);
});

test('a zero detail budget still paints every revealed preview and refreshes its fog mask', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis,'document');
  const makeCanvas = () => {
    const context = { painted: 0, fillRect() {}, clearRect() { this.painted=0; },
      drawImage(...args: unknown[]) { this.painted += args.length === 9 ? Number(args[7])*Number(args[8]) : 1; } };
    return { width:0,height:0,getContext:()=>context };
  };
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:makeCanvas}});
  t.after(()=>original ? Object.defineProperty(globalThis,'document',original) : Reflect.deleteProperty(globalThis,'document'));
  let samples=0, revision=1, revealed=true, copies=0;
  const map=Object.assign(Object.create(WorldMap.prototype),{tiles:new Map(),buildBudget:0,pendingTerrain:false,
    exploration:{getChunkRevision:()=>revision,isCellRevealed:()=>revealed},
    world:{mapColor(){samples++;return '#445544';},getBuildings:()=>[]},
  });
  const c={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},getTransform:()=>({a:1,b:0}),drawImage(){copies++;}};
  const view={x:0,y:0,width:128,height:128,centerX:0,centerY:0,zoom:.25};
  map.chart(c,view,false,{pois:[],labels:[],zones:[]});
  assert.equal(map.tiles.size,0); assert.equal(copies,4,'all four tiles have an immediate preview even with no detailed tiles');
  assert.equal(samples,400,'preview uses only a ten-by-ten padded color grid per tile');
  const preview=map.previewTile(0,0,768); assert.equal(preview.getContext().painted,1024);
  revealed=false;revision++;
  assert.equal(map.previewTile(0,0,768),preview);assert.equal(preview.getContext().painted,0);
  assert.equal(samples,400,'discovery changes reuse preview colors');
});
