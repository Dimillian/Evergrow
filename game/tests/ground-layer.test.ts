import assert from 'node:assert/strict';
import test from 'node:test';
import { GroundLayer } from '../src/ground-layer.ts';
import { World, TILE_SIZE } from '../src/world.ts';

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
type Tile = HTMLCanvasElement & { tileX: number; tileY: number };
interface Blit { image: HTMLCanvasElement; args: number[]; transform: Matrix; }

class RecordingContext {
  imageSmoothingEnabled = true;
  transform: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  draws: Blit[] = [];
  private saved: Matrix[] = [];
  drawImage(image: HTMLCanvasElement, ...args: number[]) {
    if ((image as unknown as RecordingCanvas).context === this && args.length === 8) {
      const [sx,sy,w,h,dx,dy] = args;
      this.draws = this.draws.filter(draw => draw.args[0] >= sx && draw.args[1] >= sy
        && draw.args[0] + TILE_SIZE <= sx+w && draw.args[1]+TILE_SIZE <= sy+h)
        .map(draw => ({ ...draw, args: [draw.args[0]+dx-sx, draw.args[1]+dy-sy] }));
    } else this.draws.push({ image, args, transform: { ...this.transform } });
  }
  clearRect() { this.draws = []; }
  save() { this.saved.push({ ...this.transform }); }
  restore() { this.transform = this.saved.pop()!; }
  getTransform() { return { ...this.transform }; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.transform = { a, b, c, d, e, f }; }
}

class RecordingCanvas {
  width = 0;
  height = 0;
  context = new RecordingContext();
  opaque = false;
  getContext(_kind: string, options?: CanvasRenderingContext2DSettings) {
    this.opaque = options?.alpha === false;
    return this.context;
  }
}

class TileWorld extends World {
  requests = 0;
  override getGroundTile(tileX: number, tileY: number): HTMLCanvasElement {
    this.requests++;
    return { width: TILE_SIZE, height: TILE_SIZE, tileX, tileY } as Tile;
  }
}

function fixture() {
  const canvases: RecordingCanvas[] = [];
  const layer = new GroundLayer(() => {
    const canvas = new RecordingCanvas();
    canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });
  const world = new TileWorld();
  const draw = (left: number, top: number, width: number, height: number, source = world) => {
    const ctx = new RecordingContext();
    ctx.setTransform(1, 0, 0, 1, -left, -top);
    layer.draw(ctx as unknown as CanvasRenderingContext2D, source, left, top, width, height);
    return ctx;
  };
  return { layer, world, canvases, draw };
}

test('fractional cameras sample one complete terrain surface across positive and negative tile boundaries', () => {
  const { draw, canvases } = fixture();
  for (const [left, top] of [[.25, .75], [-.25, -.75], [-256.25, -512.625], [255.875, 511.5]]) {
    const width = 540, height = 450;
    const target = draw(left, top, width, height);
    assert.equal(target.draws.length, 1, 'the camera must not filter independent tile images');
    const final = target.draws[0];
    const canvas = canvases[0];
    assert.equal(final.image, canvas);
    assert.equal(final.args.length, 2, 'the stitched source is drawn at its native world scale');
    const [x, y] = final.args;
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    assert.deepEqual(final.transform, { a: 1, b: 0, c: 0, d: 1, e: -left, f: -top });
    assert.deepEqual(target.getTransform(), final.transform, 'fractional camera translation is preserved');
    assert.equal(target.imageSmoothingEnabled, true);
    assert.equal(canvas.opaque, true);
    assert.ok(x <= left - 1 && y <= top - 1);
    assert.ok(x + canvas.width >= left + width + 1 && y + canvas.height >= top + height + 1,
      'outer sampling edges stay outside the visible viewport');

    const occupied = new Set<string>();
    for (const tile of canvas.context.draws) {
      const [tileX, tileY] = tile.args;
      const image = tile.image as Tile;
      assert.equal(tileX + x, image.tileX * TILE_SIZE);
      assert.equal(tileY + y, image.tileY * TILE_SIZE);
      assert.ok(tileX >= 0 && tileY >= 0 && tileX + TILE_SIZE <= canvas.width && tileY + TILE_SIZE <= canvas.height);
      occupied.add(`${tileX},${tileY}`);
    }
    assert.equal(occupied.size, canvas.context.draws.length, 'no tile is accidentally overwritten');
    assert.equal(occupied.size * TILE_SIZE ** 2, canvas.width * canvas.height, 'every source pixel has terrain, including internal tile joins');
  }
});

test('camera movement reuses composition until its tile anchor changes', () => {
  const { draw, world, canvases } = fixture();
  draw(50.25, 60.5, 540, 450);
  const firstRequests = world.requests;
  draw(50.75, 60.75, 540, 450);
  assert.equal(world.requests, firstRequests);
  draw(50.75 + TILE_SIZE, 60.75, 540, 450);
  assert.ok(world.requests > firstRequests, 'crossing a tile anchor refreshes terrain');
  assert.equal(canvases.length, 1, 'travelling reuses one composition canvas');
});

test('viewport growth, world replacement and reset invalidate the composed terrain', () => {
  const { layer, draw, world } = fixture();
  draw(20, 30, 540, 450);
  const beforeResize = world.requests;
  draw(20, 30, 540 + TILE_SIZE, 450 + TILE_SIZE);
  assert.ok(world.requests > beforeResize);
  const replacement = new TileWorld(22);
  draw(20, 30, 540 + TILE_SIZE, 450 + TILE_SIZE, replacement);
  assert.ok(replacement.requests > 0);
  const beforeReset = replacement.requests;
  layer.reset();
  draw(20, 30, 540 + TILE_SIZE, 450 + TILE_SIZE, replacement);
  assert.ok(replacement.requests > beforeReset);
});

test('long travel and viewport changes keep terrain storage bounded to the current view', () => {
  const { draw, canvases } = fixture();
  for (const [width, height] of [[1600, 900], [641, 479], [80, 60]]) {
    for (const coordinate of [-100000.375, -256.25, 0.625, 100000.875]) {
      draw(coordinate, -coordinate, width, height);
      const canvas = canvases[0];
      assert.ok(canvas.width <= width + TILE_SIZE * 2 + 4);
      assert.ok(canvas.height <= height + TILE_SIZE * 2 + 4);
    }
  }
  assert.equal(canvases.length, 1);
});


test('crossing a tile boundary requests only the exposed strip, preserving overlapping pixels', () => {
  const { draw, world, canvases } = fixture();
  draw(50,60,960,600); const first=world.requests;
  draw(306,60,960,600);
  assert.equal(world.requests-first,4,'only four new edge tiles, not the complete twenty-tile buffer');
  const tiles=canvases[0].context.draws;
  assert.equal(tiles.length,20);
  const second=world.requests;
  draw(562,316,960,600);
  assert.equal(world.requests-second,8,'a diagonal crossing adds one row and column with the corner counted once');
});

test('movement prepares at most one offscreen tile per frame and reuses it at the next crossing', () => {
  const { layer, draw, world }=fixture();
  draw(120,30,960,600);
  for(let i=1;i<40;i++) {
    const before=world.requests; draw(120+i*3,30,960,600);
    assert.ok(world.requests-before<=1);
  }
  assert.ok((layer as unknown as { prefetched: Map<string,unknown> }).prefetched.size<=16);
  const before=world.requests;
  draw(270,30,960,600);
  assert.equal(world.requests,before,'the next column is already fully drawn offscreen');
  layer.reset();
  assert.equal((layer as unknown as { prefetched: Map<string,unknown> }).prefetched.size,0);
});

test('subpixel travel at 240 Hz prepares the next terrain column before crossing', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let time = 0;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => time } });
  t.after(() => Object.defineProperty(globalThis, 'performance', original!));
  const { draw, world } = fixture();
  draw(120, 30, 960, 600);
  for (let frame = 1; frame <= 270; frame++) { time += 1000 / 240; draw(120 + frame * .5, 30, 960, 600); }
  const before = world.requests;
  time += 1000 / 240; draw(258, 30, 960, 600);
  assert.equal(world.requests, before, 'small high-refresh camera steps must not disable prefetch');
});
