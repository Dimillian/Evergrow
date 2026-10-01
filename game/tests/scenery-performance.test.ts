import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { SceneryCache, sceneryZoom, SCENERY_SURFACE_RESERVE } from '../src/scenery-cache.ts';
import { EnvironmentArt, ENVIRONMENT_ART_RULES } from '../src/environment-art.ts';
import { World, type Prop } from '../src/world.ts';
import { SceneVisibility } from '../src/scene-visibility.ts';
import { cameraView } from '../src/camera.ts';
import { propDefinition } from '../src/biome-props.ts';
import { PropSurfaceLight } from '../src/prop-surface-light.ts';
import { skyAtHour } from '../src/world-time.ts';
import { propIntersectsView, enemyIntersectsView } from '../src/render-bounds.ts';
import { ENEMY_BODY_BOUNDS } from '../src/enemy-body.ts';
import type { EnemyKind } from '../src/model.ts';
import type { Sprite } from '../src/art-types.ts';

function canvasFixture(t: TestContext) {
  let allocations = 0, draws = 0;
  const canvas = (width = 1, height = 1) => {
    allocations++;
    const context = new Proxy({ globalAlpha: 1, drawImage() { draws++; } }, {
      get: (object, key) => key in object ? Reflect.get(object, key) : () => ({ addColorStop() {} }),
      set: (object, key, value) => Reflect.set(object, key, value),
    });
    return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas() } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'document', previous) : Reflect.deleteProperty(globalThis, 'document'));
  return { canvas, allocations: () => allocations, draws: () => draws };
}
const sprite = (): Sprite => ({ image: { width: 10, height: 10 } as HTMLCanvasElement, width: 10, height: 10, anchorX: 5, anchorY: 9 });

test('raster budget evicts offscreen entries before the active working set, and bounds oversized scenes', () => {
  const cost = 100 * 4 * SCENERY_SURFACE_RESERVE, cache = new SceneryCache(cost * 2);
  cache.beginFrame(['a']); const a = sprite(); cache.set('a', a); cache.set('b', sprite());
  cache.beginFrame(['a', 'c']); cache.get('b'); cache.set('c', sprite());
  assert.equal(cache.get('a'), a); assert.equal(cache.get('b'), undefined);
  assert.equal(cache.stats.evictions, 1);
  cache.beginFrame(['a', 'c', 'd']); cache.set('d', sprite());
  assert.ok(cache.stats.reservedBytes <= cost * 2, 'hard budget still applies if the whole scene exceeds it');
  cache.set('huge', { ...sprite(), image: { width: 1000, height: 1000 } as HTMLCanvasElement });
  assert.equal(cache.get('huge'), undefined);
  cache.clear(); assert.equal(cache.stats.reservedBytes, 0);
});

test('the reported forest zoom-out no longer regenerates warmed scene sprites across passes', t => {
  const f = canvasFixture(t), world = new World(18427), art = new EnvironmentArt(f.canvas);
  t.after(() => world.dispose());
  const view = cameraView(1209, 680, 5000, 5000, .8), visibility = new SceneVisibility(); visibility.update(world, view);
  const props = visibility.props;
  const canopy = props.filter(p => propDefinition(p.kind).canopy).slice(0, 80);
  const shadows = props.filter(p => p.radius > 0 && p.x >= view.left - 220 && p.x <= view.left + view.width + 220
    && p.y >= view.top - 140 && p.y <= view.top + view.height + 100).slice(0, 100);
  // Use the preceding renderer's broad admission, isolating cache retention from
  // the separate bounds optimisation (which removes additional hidden sprites).
  const visible = props.filter(p => !(p.x + 115 < view.left || p.x - 115 > view.left + view.width
    || p.y + 10 < view.top || p.y - 230 > view.top + view.height)).sort((a, b) => a.y - b.y);
  for (let frame = 0; frame < 15; frame++) {
    art.beginFrame(props, .8);
    if (frame % 6 === 0) canopy.forEach(p => art.getSprite(p));
    shadows.forEach(p => art.getSprite(p)); visible.forEach(p => art.getSprite(p));
    if (frame > 0) assert.equal(art.cacheStats.misses, 0, `no stationary regeneration on frame ${frame}`);
    assert.ok(art.cacheStats.reservedBytes <= ENVIRONMENT_ART_RULES.cacheBytes);
  }
  assert.ok(art.cacheStats.sprites > 96, 'fixture exceeds the old entry limit');
});

test('zoom raster tiers reuse geometry, bound memory and resist wheel jitter', t => {
  const f = canvasFixture(t), art = new EnvironmentArt(f.canvas);
  const prop: Prop = { id: 'tree', kind: 'canopy', seed: 52, x: 0, y: 0, radius: 12, scale: 1.35 };
  art.beginFrame([prop], 1); const near = art.getSprite(prop)!;
  art.beginFrame([prop], .8); const far = art.getSprite(prop)!;
  assert.equal(near.image.width, far.image.width * 2);
  assert.deepEqual([near.width, near.height, near.anchorX, near.anchorY], [far.width, far.height, far.anchorX, far.anchorY]);
  assert.equal(far.foliage?.length, near.foliage?.length);
  assert.equal(sceneryZoom(.91, .8), .8); assert.equal(sceneryZoom(.89, 1), 1);
  art.beginFrame([prop], 1); assert.equal(art.getSprite(prop), near);
});

test('compact shading reuses one image per layer, bounds rebakes and respects caller opacity', t => {
  const f = canvasFixture(t), light = new PropSurfaceLight(), destination = f.canvas().getContext('2d')!;
  const prop: Prop = { id: 'tree', kind: 'canopy', seed: 1, x: 0, y: 0, radius: 12, scale: 1 };
  const art = { ...sprite(), image: f.canvas(10, 10) }, day = skyAtHour(10);
  light.beginFrame(); assert.equal(light.drawCompact(destination, prop, art, art.image, day), true);
  const allocations = f.allocations(), draws = f.draws(); destination.globalAlpha = .24;
  light.beginFrame(); light.drawCompact(destination, prop, art, art.image, day);
  assert.equal(f.draws() - draws, 1); assert.equal(f.allocations(), allocations); assert.equal(destination.globalAlpha, .24);
  light.beginFrame();
  for (let i = 0; i < 5; i++) assert.equal(light.drawCompact(destination, prop, art, f.canvas(10, 10), day), i < 4);
  light.reset(); light.beginFrame(); light.drawCompact(destination, prop, art, art.image, day);
  assert.ok(f.allocations() > allocations);
});

test('render bounds retain scaled crowns and rank/weapon/status envelopes while rejecting distant rigs', () => {
  const view = { left: 0, top: 0, width: 100, height: 100 };
  const prop: Prop = { id: 'tree', kind: 'canopy', seed: 1, x: 50, y: 330, radius: 12, scale: 1.35 };
  assert.ok(propIntersectsView(prop, view), 'tall crown enters from below although its base is offscreen');
  assert.equal(propIntersectsView({ ...prop, y: 500 }, view), false);
  for (const kind of Object.keys(ENEMY_BODY_BOUNDS) as EnemyKind[]) for (const rank of ['normal', 'veteran', 'elite'] as const) {
    const enemy = { kind, rank };
    assert.ok(enemyIntersectsView(enemy, 50, 50, view));
    assert.ok(enemyIntersectsView(enemy, -40, 50, view), `${kind} weapon or status may enter at the left edge`);
    assert.equal(enemyIntersectsView(enemy, 1000, 1000, view), false);
  }
  assert.equal(enemyIntersectsView({ kind: 'stalker', rank: 'normal' }, -200, 50, view), false, 'old 256-unit padding admitted this rig');
});
