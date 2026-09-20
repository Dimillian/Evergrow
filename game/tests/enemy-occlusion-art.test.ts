import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyOcclusionArt, type OccludedEnemy, type OcclusionLayer } from '../src/enemy-occlusion-art.ts';

/** Small alpha-only raster fixture for Porter–Duff coverage, not browser gameplay. */
class AlphaCanvas {
  width = 0; height = 0;
  context = new AlphaContext(this);
  getContext() { return this.context; }
  asCanvas() { return this as unknown as HTMLCanvasElement; }
}
class AlphaContext {
  private canvas: AlphaCanvas;
  private pixels = new Float64Array();
  private sx = 1; private sy = 1; private tx = 0; private ty = 0;
  globalAlpha = 1; globalCompositeOperation = 'source-over'; fillStyle = '';
  private stack: number[][] = [];
  private operations: string[] = [];
  constructor(canvas: AlphaCanvas) { this.canvas = canvas; }
  asContext() { return this as unknown as CanvasRenderingContext2D; }
  private data() {
    const size = this.canvas.width * this.canvas.height;
    if (this.pixels.length !== size) this.pixels = new Float64Array(size);
    return this.pixels;
  }
  at(x: number, y: number) { return this.data()[y * this.canvas.width + x] ?? 0; }
  save() { this.stack.push([this.sx, this.sy, this.tx, this.ty, this.globalAlpha]); this.operations.push(this.globalCompositeOperation); }
  restore() {
    [this.sx, this.sy, this.tx, this.ty, this.globalAlpha] = this.stack.pop()!;
    this.globalCompositeOperation = this.operations.pop()!;
  }
  scale(x: number, y: number) { this.sx *= x; this.sy *= y; }
  translate(x: number, y: number) { this.tx += x * this.sx; this.ty += y * this.sy; }
  private raster(sample: (x: number, y: number) => number, clear = false) {
    const data = this.data();
    for (let y = 0; y < this.canvas.height; y++) for (let x = 0; x < this.canvas.width; x++) {
      const source = sample((x + .5 - this.tx) / this.sx, (y + .5 - this.ty) / this.sy) * this.globalAlpha;
      const i = y * this.canvas.width + x, dest = data[i];
      if (clear) { if (source) data[i] = 0; continue; }
      data[i] = this.globalCompositeOperation === 'source-in' ? source * dest
        : this.globalCompositeOperation === 'destination-in' ? dest * source
        : this.globalCompositeOperation === 'destination-out' ? dest * (1 - source)
        : source + dest * (1 - source);
    }
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.raster((px, py) => +(px >= x && py >= y && px < x + w && py < y + h));
  }
  clearRect(x: number, y: number, w: number, h: number) {
    this.raster((px, py) => +(px >= x && py >= y && px < x + w && py < y + h), true);
  }
  drawImage(image: AlphaCanvas, ...args: number[]) {
    const [sx, sy, sw, sh, dx, dy, dw, dh] = args.length === 2
      ? [0, 0, image.width, image.height, ...args, image.width, image.height] : args;
    this.raster((x, y) => x < dx || y < dy || x >= dx + dw || y >= dy + dh ? 0
      : image.context.at(Math.floor(sx + (x - dx) * sw / dw), Math.floor(sy + (y - dy) * sh / dh)));
  }
}
const actor: OccludedEnemy = { id: 1, depth: 10, strength: 1,
  bounds: { left: 0, top: 0, width: 16, height: 16 }, paint: c => c.fillRect(3, 3, 7, 9) };
const full: OcclusionLayer = { depth: 20, bounds: actor.bounds, paint: c => c.fillRect(0, 0, 16, 16) };
function fixture() {
  let allocations = 0;
  const art = new EnemyOcclusionArt(() => { allocations++; return new AlphaCanvas().asCanvas(); });
  const output = new AlphaCanvas(); output.width = output.height = 16;
  return { art, output, allocations: () => allocations };
}

test('reveals only covered pixels and leaf holes stay clear; edge is stronger than fill', () => {
  const { art, output } = fixture();
  art.draw(output.context.asContext(), actor, [{ ...full, paint: c => {
    c.fillRect(5, 0, 11, 16); c.clearRect(6, 6, 2, 2);
  } }], [], 1);
  assert.equal(output.context.at(4, 5), 0, 'uncovered body stays untouched');
  assert.equal(output.context.at(6, 6), 0, 'leaf gap does not highlight the body');
  assert.ok(output.context.at(8, 6) > 0, 'hidden body is visible');
  assert.ok(output.context.at(10, 6) > output.context.at(8, 6), 'silhouette edge is distinct');
  assert.equal(output.context.at(14, 6), 0, 'no rectangular mask background');
});

test('opaque foreground wall/body masks win over foliage, while background masks do not', () => {
  const { art, output } = fixture();
  art.draw(output.context.asContext(), actor, [full], [
    { depth: 15, paint: c => c.fillRect(3, 0, 3, 16) },
    { depth: 5, paint: c => c.fillRect(7, 0, 3, 16) },
  ], 1);
  assert.equal(output.context.at(4, 6), 0, 'wall behind tree still blocks the reveal');
  assert.ok(output.context.at(8, 6) > 0, 'background wall cannot hide foreground enemy');
});

test('faded foliage attenuates reveal and multiple trees cannot multiply brightness', () => {
  const draw = (props: OcclusionLayer[]) => {
    const { art, output } = fixture(); art.draw(output.context.asContext(), actor, props, [], 1);
    return output.context.at(6, 6);
  };
  const opaque = draw([full]);
  const faded = draw([{ ...full, paint: c => { c.globalAlpha = .24; full.paint(c); } }]);
  assert.ok(Math.abs(faded - opaque * .24) < 1e-9);
  assert.equal(draw([full, full]), opaque);
  assert.equal(draw([{ ...full, depth: 9 }]), 0);
  assert.equal(draw([{ ...full, depth: 10 }]), 0, 'equal-depth props precede actors');
});

test('the hero and later actors at the same depth still block the silhouette', () => {
  const { art, output } = fixture();
  art.draw(output.context.asContext(), { ...actor, order: 1 }, [full], [
    { ...full, depth: actor.depth, order: 2 },
  ], 1);
  assert.equal(output.context.at(6, 6), 0);
});

test('scratch surfaces are reused, cleared between enemies and skipped without cover', () => {
  const { art, output, allocations } = fixture();
  art.draw(output.context.asContext(), actor, [], [], 1); assert.equal(allocations(), 0);
  art.draw(output.context.asContext(), actor, [full], [], 0); assert.equal(allocations(), 0);
  art.draw(output.context.asContext(), actor, [full], [], 1); assert.equal(allocations(), 3);
  output.context.clearRect(0, 0, 16, 16);
  art.draw(output.context.asContext(), { ...actor, id: 2, paint: () => {} }, [full], [], 1);
  assert.equal(output.context.at(6, 6), 0);
  assert.equal(allocations(), 3);
  assert.equal(output.context.globalAlpha, 1);
  assert.equal(output.context.globalCompositeOperation, 'source-over');
});
