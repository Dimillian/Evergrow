import assert from 'node:assert/strict';
import test from 'node:test';
import { drawRoadDetails } from '../src/road-art.ts';

type Point = readonly [number, number];
interface Draw { points: Point[]; closed: boolean; style: string; alpha: number; lineWidth: number; }
interface ContextState {
  globalAlpha: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  clipRects: number[][];
}

class RecordingContext implements ContextState {
  globalAlpha = .37;
  fillStyle = '#112233';
  strokeStyle = '#445566';
  lineWidth = 3;
  clipRects: number[][] = [];
  appliedClips: number[][] = [];
  draws: Draw[] = [];
  private saved: ContextState[] = [];
  private points: Point[] = [];
  private closed = false;
  private rectangle: number[] = [];
  originX: number;
  originY: number;
  constructor(x: number, y: number) { this.originX = x; this.originY = y; }
  state(): ContextState {
    return { globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth, clipRects: this.clipRects.map(rect => [...rect]) };
  }
  get saveDepth() { return this.saved.length; }
  save() { this.saved.push(this.state()); }
  restore() { Object.assign(this, this.saved.pop()!); }
  beginPath() { this.points = []; this.closed = false; this.rectangle = []; }
  closePath() { this.closed = true; }
  rect(x: number, y: number, width: number, height: number) {
    this.rectangle = [x + this.originX, y + this.originY, width, height];
  }
  clip() { this.clipRects.push([...this.rectangle]); this.appliedClips.push([...this.rectangle]); }
  private addPoint(x: number, y: number) {
    // Compare the world geometry, allowing only floating-point roundoff from
    // subtracting and restoring different tile origins.
    this.points.push([+(x + this.originX).toFixed(8), +(y + this.originY).toFixed(8)]);
  }
  moveTo(x: number, y: number) { this.addPoint(x, y); }
  lineTo(x: number, y: number) { this.addPoint(x, y); }
  fill() { this.record(this.fillStyle, 0); }
  stroke() { this.record(this.strokeStyle, this.lineWidth); }
  private record(style: string, lineWidth: number) {
    this.draws.push({ points: [...this.points], closed: this.closed, style, alpha: this.globalAlpha, lineWidth });
  }
}

function capture(x: number, y: number, material: { road: number; paved: number }, tileSize = 256) {
  const c = new RecordingContext(x, y), before = c.state(), samples: Point[] = [];
  drawRoadDetails(c as unknown as CanvasRenderingContext2D, x, y, tileSize, 7319, (wx, wy) => {
    samples.push([wx, wy]); return material;
  });
  return { c, before, samples };
}

function crossing(c: RecordingContext, seam: number, axis: 0 | 1, spanStart: number): string[] {
  return c.draws.filter(draw => {
    const across = draw.points.map(point => point[axis]);
    const along = draw.points.map(point => point[1 - axis]);
    const edge = draw.lineWidth / 2;
    return Math.min(...across) - edge < seam && Math.max(...across) + edge > seam
      && Math.max(...along) + edge > spanStart && Math.min(...along) - edge < spanStart + 256;
  }).map(draw => JSON.stringify(draw)).sort();
}

test('neighbouring road tiles reproduce every shared border stroke in world coordinates', () => {
  const origins = [[0, 0], [-256, -256], [-512, 0], [256, -256], [9984, -10240]];
  for (const material of [{ road: 1, paved: 1 }, { road: 1, paved: 0 }]) {
    let sharedDraws = 0;
    for (const [x, y] of origins) for (const axis of [0, 1] as const) {
      const a = capture(x, y, material).c;
      const b = capture(x + (axis === 0 ? 256 : 0), y + (axis === 1 ? 256 : 0), material).c;
      const seam = (axis === 0 ? x : y) + 256, span = axis === 0 ? y : x;
      const first = crossing(a, seam, axis, span), second = crossing(b, seam, axis, span);
      assert.deepEqual(first, second, `all ${axis === 0 ? 'vertical' : 'horizontal'} joins match at ${x},${y}`);
      sharedDraws += first.length;
    }
    assert.ok(sharedDraws > 0, 'the cases actually exercise details crossing a tile join');
  }
});

test('zero road and paving material excludes all art without touching the surrounding Canvas state', () => {
  for (const [x, y] of [[0, 0], [-256, 256], [10240, -9984]]) {
    const { c, before, samples } = capture(x, y, { road: 0, paved: 0 });
    assert.ok(samples.length > 0);
    assert.equal(c.draws.length, 0);
    assert.deepEqual(c.state(), before);
    assert.equal(c.saveDepth, 0);
  }
});

test('dense paving uses bounded unique material queries and restores clipping and styles', () => {
  for (const [x, y] of [[0, 0], [-256, -256], [-512, 768], [2048, -4096], [2 ** 32, -(2 ** 32)]]) {
    const { c, before, samples } = capture(x, y, { road: 1, paved: 1 });
    assert.ok(c.draws.length > 0);
    assert.ok(samples.length <= 384, `${samples.length} exceeds the per-tile material query budget`);
    assert.equal(new Set(samples.map(point => point.join(','))).size, samples.length, 'each anchor is sampled once');
    assert.deepEqual(c.appliedClips, [[x, y, 256, 256]], 'details are cropped to the requested tile');
    assert.ok(c.draws.every(draw => draw.alpha >= 0 && draw.alpha <= before.globalAlpha));
    assert.deepEqual(c.state(), before);
    assert.equal(c.saveDepth, 0);
  }
});

test('an empty road detail surface performs no queries or drawing', () => {
  const { c, before, samples } = capture(0, 0, { road: 1, paved: 1 }, 0);
  assert.equal(samples.length, 0);
  assert.equal(c.draws.length, 0);
  assert.equal(c.appliedClips.length, 0);
  assert.deepEqual(c.state(), before);
});
