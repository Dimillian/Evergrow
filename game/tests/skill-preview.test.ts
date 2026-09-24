import test from 'node:test';
import assert from 'node:assert/strict';
import { SkillPreview } from '../src/skill-preview.ts';

// Exercise the real canvas/lifecycle boundary without a browser or playable session.
test('sidebar canvas and source render at display density; resizing retains playback progress', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const display = { devicePixelRatio: 2 };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: display });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); });
  const bounds = { width: 280, height: 168 };
  const canvas = { width: 300, height: 150, getBoundingClientRect: () => bounds };
  const rendered: number[][] = [], draws: number[] = [];
  const preview = Object.assign(Object.create(SkillPreview.prototype), {
    disposed: false, canvas, renderer: { resize: (w: number, h: number) => rendered.push([w, h]) },
    study: { elapsed: 4.5 }, draw: (dt: number) => draws.push(dt),
  });
  preview.resize();
  assert.deepEqual([canvas.width, canvas.height], [560, 336]);
  assert.deepEqual(rendered, [[560, 336]]);
  preview.resize(); assert.equal(rendered.length, 1, 'unchanged sizing does not rebuild the render buffer');
  display.devicePixelRatio = 3; bounds.width = 320; bounds.height = 192;
  preview.resize(); assert.deepEqual([canvas.width, canvas.height], [960, 576]);
  assert.equal(preview.study.elapsed, 4.5); assert.deepEqual(draws, [0, 0]);
  bounds.width = 0; bounds.height = 0; preview.resize();
  assert.equal(rendered.length, 2, 'hidden sidebars cannot replace the buffer with zero dimensions');
});

test('inline preview uses matching camera density and actual hurt feedback rather than elapsed time', () => {
  const scene = {}, emission = {}, output = { textContent: '' }, post: unknown[][] = [];
  let settings: { fixedCamera?: boolean; fixedCameraZoom?: number } = {};
  const preview = Object.assign(Object.create(SkillPreview.prototype), {
    disposed: false, anchor: { x: 100, y: 50 }, canvas: { width: 600, height: 360 }, motion: { matches: true }, world: {},
    study: { elapsed: 8, duration: 12, resolved: { recipe: { kind: 'projectile' } }, input: { aimX: 240 }, simulation: {} },
    renderer: { canvas: scene, hurt: .2, emission, render: (_sim: unknown, _world: unknown, _dt: number, options: typeof settings) => { settings = options; } },
    fx: { render: (...args: unknown[]) => post.push(args) }, element: { querySelector: () => output },
  });
  preview.draw(0);
  assert.deepEqual(post, [[scene, .2, emission]]);
  assert.equal(settings.fixedCamera, true); assert.equal(settings.fixedCameraZoom, 1.25);
  assert.equal(preview.renderer.cameraX, 170); assert.equal(output.textContent, '8.0 / 12s');
});

test('closing an inline preview cancels animation and releases observers, graphics and world exactly once', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  const canceled: number[] = [], released: string[] = [];
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: (id: number) => canceled.push(id) });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'cancelAnimationFrame', original); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame'); });
  const preview = Object.assign(Object.create(SkillPreview.prototype), {
    disposed: false, playing: true, frame: 42,
    life: { abort: () => released.push('listeners') }, observer: { disconnect: () => released.push('size') },
    visibility: { disconnect: () => released.push('visibility') }, element: { remove: () => released.push('element') },
    renderer: { reset: () => released.push('renderer') }, fx: { dispose: () => released.push('fx') }, world: { dispose: () => released.push('world') },
  });
  preview.dispose(); preview.dispose();
  assert.deepEqual(canceled, [42]); assert.equal(preview.playing, false);
  assert.deepEqual(released, ['listeners', 'size', 'visibility', 'element', 'renderer', 'fx', 'world']);
});
