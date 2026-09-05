import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Lighting, type PointLight } from '../src/lighting.ts';
import type { Prop } from '../src/world.ts';

class RecordingContext {
  draws: { image: HTMLCanvasElement; args: number[] }[] = [];
  shadowPoints: number[][] = [];
  drawImage(image: HTMLCanvasElement, ...args: number[]) { this.draws.push({ image, args }); }
  clearRect() { this.draws = []; this.shadowPoints = []; }
  fillRect() { this.draws = []; }
  createRadialGradient() { return { addColorStop() {} }; }
  save() {}
  restore() {}
  setTransform() {}
  translate() {}
  scale() {}
  beginPath() {}
  moveTo(...point: number[]) { this.shadowPoints.push(point); }
  lineTo(...point: number[]) { this.shadowPoints.push(point); }
  closePath() {}
  fill() {}
}

class RecordingCanvas {
  private w = 0;
  private h = 0;
  resizes = 0;
  context = new RecordingContext();
  get width() { return this.w; }
  set width(value: number) { this.w = value; this.resizes++; }
  get height() { return this.h; }
  set height(value: number) { this.h = value; this.resizes++; }
  getContext() { return this.context; }
}

function fixture(t: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvases: RecordingCanvas[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement() {
      const canvas = new RecordingCanvas();
      canvases.push(canvas);
      return canvas;
    },
  } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const lighting = new Lighting();
  const target = new RecordingContext() as unknown as CanvasRenderingContext2D;
  return { lighting, target, canvases, map: canvases[0], scratch: canvases[1] };
}

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
const lightAt = (x: number, y: number): PointLight => ({ x, y, radius: 20, color: '#ffcc88', power: .8 });

test('light centers and radii follow the camera exactly after odd-sized light-map upscaling', t => {
  const { lighting, target, map } = fixture(t);
  const width = 641, height = 479, left = -322.25, top = 491.125;
  const light = { ...lightAt(left + 230, top + 177), radius: 37 };
  for (const zoom of [.65, 1, 1.8]) {
    lighting.apply(target, width, height, left, top, [light], [], undefined, zoom);
    assert.equal(map.context.draws.length, 1);
    const [x, y, w, h] = map.context.draws[0].args;
    near((x + w / 2) * width / map.width, (light.x - left) * zoom);
    near((y + h / 2) * height / map.height, (light.y - top) * zoom);
    near(w / 2 * width / map.width, light.radius * zoom);
    near(h / 2 * height / map.height, light.radius * zoom);
  }
});

test('zoomed-out lighting includes distant visible emitters and clips only beyond their radius', t => {
  const { lighting, target, map } = fixture(t);
  const lights = [lightAt(1100, 100), lightAt(1210, 100), lightAt(1250, 100), lightAt(100, 750), lightAt(100, 850)];
  lighting.apply(target, 600, 400, 0, 0, lights, [], undefined, .5);
  assert.equal(map.context.draws.length, 3, 'the expanded viewport includes horizontal and vertical edge lights');
  lighting.apply(target, 600, 400, 0, 0, lights, [], undefined, 1);
  assert.equal(map.context.draws.length, 0, 'the same lights are outside the normal viewport');
});

test('zoom reuses fixed light buffers and preserves world-space shadow wedges', t => {
  const { lighting, target, canvases, map, scratch } = fixture(t);
  const light: PointLight = { ...lightAt(100, 100), radius: 100, shadows: true };
  const prop: Prop = { id: 'rock', kind: 'rock', x: 135, y: 100, radius: 10, scale: 1, seed: 1 };
  lighting.apply(target, 640, 480, 0, 0, [light], [prop]);
  const canvasCount = canvases.length, mapResizes = map.resizes, scratchResizes = scratch.resizes;
  const points = scratch.context.shadowPoints.map(point => [...point]);
  assert.equal(points.length, 8, 'the source light contains both hard and soft shadow wedges');
  for (const zoom of [.65, .72, .91, 1.2, 1.8]) {
    lighting.apply(target, 640, 480, 0, 0, [light], [prop], undefined, zoom);
    assert.equal(canvases.length, canvasCount);
    assert.equal(map.resizes, mapResizes);
    assert.equal(scratch.resizes, scratchResizes);
    assert.deepEqual(scratch.context.shadowPoints, points);
  }
});
