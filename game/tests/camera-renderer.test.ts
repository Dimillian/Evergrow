import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Renderer, type RenderSettings } from '../src/renderer.ts';
import { Simulation } from '../src/simulation.ts';
import { World, TILE_SIZE, type Prop } from '../src/world.ts';
import type { Building, Settlement } from '../src/settlements.ts';
import { getHUDLayout } from '../src/hud.ts';
import { cameraView, MIN_CAMERA_ZOOM } from '../src/camera.ts';

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
type Rect = { left: number; top: number; width: number; height: number };
const identity = (): Matrix => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

/** Only projections, buffer sizing and text rasterization are under test here. */
class RecordingContext {
  matrix = identity();
  font = '10px monospace';
  globalAlpha = 1;
  imageSmoothingEnabled = true;
  images: Array<{ matrix: Matrix; args: number[] }> = [];
  texts: Array<{ value: string; font: string; matrix: Matrix }> = [];
  private saved: Array<{ matrix: Matrix; font: string; alpha: number }> = [];
  save() { this.saved.push({ matrix: { ...this.matrix }, font: this.font, alpha: this.globalAlpha }); }
  restore() {
    const state = this.saved.pop()!;
    this.matrix = state.matrix; this.font = state.font; this.globalAlpha = state.alpha;
  }
  getTransform() { return { ...this.matrix }; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.matrix = { a, b, c, d, e, f }; }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    const m = this.matrix;
    this.setTransform(m.a * a + m.c * b, m.b * a + m.d * b, m.a * c + m.c * d,
      m.b * c + m.d * d, m.a * e + m.c * f + m.e, m.b * e + m.d * f + m.f);
  }
  translate(x: number, y: number) { this.transform(1, 0, 0, 1, x, y); }
  scale(x: number, y: number) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(angle: number) { this.transform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0); }
  drawImage(_image: unknown, ...args: number[]) { this.images.push({ matrix: { ...this.matrix }, args }); }
  measureText(value: string) {
    const pixels = Number(this.font.match(/([\d.]+)px/)![1]);
    return { width: value.length * pixels * .6, actualBoundingBoxAscent: pixels * .7 };
  }
  fillText(value: string) { this.texts.push({ value, font: this.font, matrix: { ...this.matrix } }); }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  clearRect() {} fillRect() {} strokeRect() {} rect() {} beginPath() {} closePath() {}
  moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} arc() {} ellipse() {}
  fill() {} stroke() {} clip() {} setLineDash() {}
}

class RecordingCanvas {
  private w = 0;
  private h = 0;
  resizeCount = 0;
  context = new RecordingContext();
  get width() { return this.w; }
  set width(value: number) { this.w = value; this.resizeCount++; }
  get height() { return this.h; }
  set height(value: number) { this.h = value; this.resizeCount++; }
  getContext() { return this.context; }
}

class EmptyWorld extends World {
  override getDungeonEntrances() { return []; }
  override getEventSites() { return []; }
  propQueries: Rect[] = [];
  buildingQueries: Rect[] = [];
  override getProps(left: number, top: number, width: number, height: number): Prop[] {
    this.propQueries.push({ left, top, width, height }); return [];
  }
  override getBuildings(left: number, top: number, width: number, height: number): Building[] {
    this.buildingQueries.push({ left, top, width, height }); return [];
  }
  override getBuildingAt(): Building | null { return null; }
  override getSettlements(): Settlement[] { return []; }
  override getGroundTile(): HTMLCanvasElement { return { width: TILE_SIZE, height: TILE_SIZE } as HTMLCanvasElement; }
}

function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => new RecordingCanvas(),
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const renderer = new Renderer(), world = new EmptyWorld();
  const sim = new Simulation(world, { spawn: false, startX: -123.25, startY: 67.125 });
  renderer.cameraX = sim.player.x; renderer.cameraY = sim.player.y - 15;
  const canvas = renderer.canvas as unknown as RecordingCanvas;
  const settings: RenderSettings = { phase: 'playing', reducedMotion: true, fps: 60, debug: false };
  const render = (dt = 1 / 60) => {
    canvas.context.images = [];
    renderer.render(sim, world, dt, settings);
    return canvas.context.images[0].matrix; // The first blit is the composed terrain.
  };
  return { renderer, sim, world, canvas, settings, render };
}

test('zooming out while stationary refreshes scene coverage without resizing the world buffer', t => {
  const { renderer, world, canvas, render } = fixture(t);
  render(); render();
  assert.equal(world.propQueries.length, 1);
  assert.equal(world.buildingQueries.length, 1);
  const dimensions = [renderer.width, renderer.height, canvas.width, canvas.height, canvas.resizeCount];
  renderer.zoomByWheel(300, 0, 900); renderer.zoomByWheel(300, 0, 900);
  const matrix = render();
  assert.equal(world.propQueries.length, 2);
  assert.equal(world.buildingQueries.length, 2);
  for (const query of [world.propQueries.at(-1)!, world.buildingQueries.at(-1)!]) {
    const near = renderer.screenToWorld(0, 0), far = renderer.screenToWorld(renderer.width, renderer.height);
    assert.ok(query.left < near.x && query.top < near.y);
    assert.ok(query.left + query.width > far.x && query.top + query.height > far.y);
  }
  assert.ok(matrix.a < 1 && renderer.worldHeight > renderer.height);
  render();
  assert.equal(world.propQueries.length, 2, 'unchanged coverage must be reused');
  assert.deepEqual([renderer.width, renderer.height, canvas.width, canvas.height, canvas.resizeCount], dimensions);
});

test('mouse aiming inverts the actual smoothed rendering transform, including camera impulses', t => {
  const { renderer, render, settings } = fixture(t);
  settings.reducedMotion = false;
  renderer.zoomByWheel(-300, 0, 900);
  renderer.handleEvents([{ type: 'hurt', remainingHp: 92, heavy: false, x: -123.25, y: 67.125, value: 8, angle: .7 }], false);
  let previousZoom = 1;
  for (let frame = 0; frame < 8; frame++) {
    const matrix = render();
    assert.ok(matrix.a > previousZoom, 'the view approaches the zoom target over successive frames');
    previousZoom = matrix.a;
    for (const point of [{ x: -223.375, y: 40.125 }, { x: 211.75, y: -102.25 }]) {
      const screen = { x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f };
      const aim = renderer.screenToWorld(screen.x, screen.y);
      assert.ok(Math.hypot(aim.x - point.x, aim.y - point.y) < 1e-9);
    }
  }
});

test('native HUD labels stay fixed and damage numbers project without scaling their font', t => {
  const { renderer, sim, world, render, settings } = fixture(t);
  const menuLabels: unknown[] = [], popupFonts: string[] = [];
  for (const [index, delta] of [0, 300, -300].entries()) {
    renderer.zoomByWheel(delta, 0, 900);
    const matrix = render();
    const value = 37 + index, x = sim.player.x + 80, y = sim.player.y;
    renderer.handleEvents([{ type: 'heal', x, y, value }], true);
    const ui = new RecordingContext();
    ui.scale(2, 2); // The native UI backing surface may have a different DPR from the world.
    renderer.renderUI(ui as unknown as CanvasRenderingContext2D, sim, world, settings);
    menuLabels.push(ui.texts.filter(call => ['C', 'I', 'T', 'J'].includes(call.value)));
    const popup = ui.texts.filter(call => call.value === `+${value}`).at(-1)!;
    assert.ok(popup, 'damage feedback is drawn in the separate native UI pass');
    popupFonts.push(popup.font);
    const pixels = Number(popup.font.match(/([\d.]+)px/)![1]);
    const screenX = matrix.a * x + matrix.e, screenY = matrix.d * (y - 61) + matrix.f;
    assert.equal(popup.matrix.e, Math.round(screenX * 2 - popup.value.length * pixels * .6 / 2));
    assert.equal(popup.matrix.f, Math.round(screenY * 2 + pixels * .7));
    assert.deepEqual({ ...popup.matrix, e: 0, f: 0 }, identity(), 'glyphs rasterize directly at physical pixel scale');
    assert.deepEqual(ui.getTransform(), { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
  }
  assert.equal((menuLabels[0] as unknown[]).length, 4);
  assert.deepEqual(menuLabels[1], menuLabels[0]); assert.deepEqual(menuLabels[2], menuLabels[0]);
  assert.equal(new Set(popupFonts).size, 1);
});

test('renderer wires hover and combat focus to a native enemy plate without HUD click-through or phase leakage', t => {
  const { renderer, sim, world, canvas, settings, render } = fixture(t);
  world.blocked = () => false; world.isSanctuary = () => false;
  const enemy = sim.spawnEnemy('stalker', sim.player.x + 80, sim.player.y + 20)!;
  assert.ok(enemy);
  const plateName = () => {
    const ui = new RecordingContext(); ui.scale(2, 2);
    renderer.renderUI(ui as unknown as CanvasRenderingContext2D, sim, world, settings);
    assert.deepEqual(ui.getTransform(), { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
    return ui.texts.find(call => call.value === 'HOLLOW STALKER');
  };
  const hoverTorso = (matrix: Matrix) => {
    renderer.pointerX = matrix.a * enemy.x + matrix.e;
    renderer.pointerY = matrix.d * (enemy.y - 22) + matrix.f;
  };
  const noteHit = () => renderer.handleEvents([{ type: 'hit', angle: 0, heavy: false, targetId: enemy.id,
    enemyKind: enemy.kind, x: enemy.x, y: enemy.y, value: 5, remainingHp: enemy.hp }], true);

  const firstMatrix = render();
  assert.equal(plateName(), undefined, 'an unhovered nearby enemy does not acquire focus');
  hoverTorso(firstMatrix); render();
  const initial = plateName();
  assert.ok(initial, 'hovering the rendered body displays its name on the next frame');
  assert.deepEqual({ ...initial.matrix, e: 0, f: 0 }, identity(), 'enemy glyphs render at native physical pixels');
  assert.ok(Number(initial.font.match(/([\d.]+)px/)![1]) > 20, 'the native font includes the UI backing DPR');
  assert.ok(!canvas.context.texts.some(call => call.value === 'HOLLOW STALKER'), 'the name is absent from the post-processed world surface');

  for (const delta of [300, -300]) {
    renderer.zoomByWheel(delta, 0, 900);
    hoverTorso(render()); render();
    assert.deepEqual(plateName(), initial, 'world zoom changes neither plate typography nor its screen position');
  }

  const hud = getHUDLayout(renderer.width, renderer.height);
  renderer.pointerX = hud.x + hud.width / 2; renderer.pointerY = hud.y + hud.height * .56;
  const behindHUD = renderer.screenToWorld(renderer.pointerX, renderer.pointerY);
  enemy.x = enemy.prevX = behindHUD.x; enemy.y = enemy.prevY = behindHUD.y + 22;
  render(.3);
  assert.equal(plateName(), undefined, 'a body directly beneath the HUD cannot refresh hover after its grace expires');

  renderer.pointerX = 20; renderer.pointerY = 100;
  noteHit(); render();
  assert.ok(plateName(), 'actual hit events acquire the native plate while the mouse is away');
  for (const phase of ['paused', 'map', 'dead'] as const) {
    settings.phase = phase; render();
    assert.equal(plateName(), undefined, `${phase} clears the plate immediately`);
    settings.phase = 'playing'; render();
    assert.equal(plateName(), undefined, 'resuming does not restore stale combat focus');
    noteHit(); render(); assert.ok(plateName(), 'a fresh hit can acquire focus again');
  }
  sim.player.dead = true; render();
  assert.equal(plateName(), undefined, 'player death clears focus even before the phase transition');
  sim.player.dead = false; noteHit(); render(); assert.ok(plateName());
  renderer.reset();
  assert.equal(plateName(), undefined, 'restarting the renderer clears the retained plate');
});

function containsBounds(outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number }, message: string) {
  assert.ok(outer.x <= inner.x && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height, message);
}

test('renderer supplies pending wheel coverage before drawing for smooth and reduced-motion cameras', t => {
  const { renderer, sim, settings, render } = fixture(t);
  for (const reducedMotion of [false, true]) {
    settings.reducedMotion = reducedMotion;
    renderer.reset(); render();
    const displayed = renderer.worldBounds;
    const aim = renderer.screenToWorld(83, 97);
    for (let index = 0; index < 5; index++) renderer.zoomByWheel(300, 0, 900);
    const guard = renderer.spawnExclusionBounds(sim.player);
    assert.deepEqual(renderer.worldBounds, displayed, 'guard query does not apply the pending zoom');
    assert.deepEqual(renderer.screenToWorld(83, 97), aim, 'pointer still targets the displayed frame');
    const wide = cameraView(renderer.width, renderer.height, renderer.cameraX, renderer.cameraY, MIN_CAMERA_ZOOM);
    containsBounds(guard, { x: wide.left, y: wide.top, width: wide.width, height: wide.height },
      'full pending screen is excluded, including the terrain behind the bottom HUD');
    render(.05);
    containsBounds(guard, renderer.worldBounds, 'next visible frame cannot reveal a freshly spawned enemy');
  }
});

test('renderer guard is valid immediately after reset and includes old/new views during resize', t => {
  const { renderer, sim, render } = fixture(t);
  renderer.reset();
  const fresh = renderer.spawnExclusionBounds(sim.player);
  containsBounds(fresh, renderer.worldBounds, 'a run has a valid guard before its first render');
  renderer.resize(1600, 500); render();
  const wideOld = renderer.worldBounds;
  renderer.resize(540, 900);
  const tall = renderer.spawnExclusionBounds(sim.player);
  containsBounds(tall, wideOld, 'the previous wide frame survives a resize until it is replaced');
  containsBounds(tall, renderer.worldBounds, 'the taller new frame is protected before render');
  render();
  containsBounds(tall, renderer.worldBounds, 'first resized frame is inside its advance guard');
});

test('renderer anticipates direct skill-dash travel even when player velocity is zero', t => {
  const { renderer, sim, render } = fixture(t);
  render();
  const player = sim.player;
  player.dash = { angle: Math.PI / 4, speed: 520, remaining: .24,
    damage: 1, radius: 23, skill: 'lunge', hitIds: new Set() };
  player.vx = player.vy = 0;
  const guard = renderer.spawnExclusionBounds(player);
  player.x += Math.cos(player.dash.angle) * 520 * .05;
  player.y += Math.sin(player.dash.angle) * 520 * .05;
  player.prevX = player.x; player.prevY = player.y;
  renderer.handleEvents([{ type: 'hurt', remainingHp: 92, heavy: false, x: player.x, y: player.y, value: 8, angle: .7 }], false);
  render(.05);
  containsBounds(guard, renderer.worldBounds, 'direct dash motion and impact still stay inside the prior guard');
});
