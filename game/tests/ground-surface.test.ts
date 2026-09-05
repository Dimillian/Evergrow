import assert from 'node:assert/strict';
import test from 'node:test';
import { drawGroundSurface } from '../src/ground-surface.ts';

interface Pixels { width: number; height: number; data: Uint8ClampedArray; }
type Sample = (x: number, y: number) => readonly number[];

class RecordingContext {
  allocations: Pixels[] = [];
  writes: Array<{ image: Pixels; x: number; y: number }> = [];
  createImageData(width: number, height: number): Pixels {
    const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
    this.allocations.push(image); return image;
  }
  putImageData(image: Pixels, x: number, y: number) { this.writes.push({ image, x, y }); }
}

function render(originX: number, originY: number, size: number, sample: Sample) {
  const context = new RecordingContext(), calls: Array<[number, number]> = [];
  drawGroundSurface(context as unknown as CanvasRenderingContext2D, originX, originY, size, (x, y) => {
    calls.push([x, y]); return sample(x, y);
  });
  assert.equal(context.writes.length, 1);
  return { context, calls, image: context.writes[0].image };
}

test('linear color fields vary smoothly at every pixel center instead of repeating 4×4 blocks', () => {
  const originX = 20, originY = -12, size = 12;
  const field: Sample = (x, y) => [32 + (x - originX) * 3 + (y - originY),
    60 + (x - originX) + (y - originY) * 2, 120 + (x - originX) * 2 - (y - originY)];
  const { image } = render(originX, originY, size, field);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const expected = new Uint8ClampedArray([...field(originX + x + .5, originY + y + .5), 255]);
    assert.deepEqual(image.data.subarray(index, index + 4), expected, `color at pixel ${x},${y}`);
  }
  assert.equal(new Set([0, 1, 2, 3].map(x => image.data[x * 4])).size, 4,
    'neighboring pixels within one sample cell must carry a gradient');
});

test('adjacent 256px tiles reproduce a single 512px surface including joins across zero', () => {
  const field: Sample = (x, y) => [
    90 + Math.sin(x / 79 + y / 113) * 35,
    115 + Math.cos(x / 97) * 28 + Math.sin(y / 61) * 19,
    105 + Math.sin(x / 53) * Math.cos(y / 89) * 42,
  ];
  // Tile origins share the four-pixel world grid; cover positive, negative and mixed quadrants.
  for (const [originX, originY] of [[0, 0], [-512, -512], [-256, -256], [256, -256]]) {
    const whole = render(originX, originY, 512, field).image;
    for (let tileY = 0; tileY < 2; tileY++) for (let tileX = 0; tileX < 2; tileX++) {
      const tile = render(originX + tileX * 256, originY + tileY * 256, 256, field).image;
      for (let y = 0; y < 256; y++) {
        const wholeStart = ((tileY * 256 + y) * 512 + tileX * 256) * 4;
        assert.deepEqual(tile.data.subarray(y * 256 * 4, (y + 1) * 256 * 4),
          whole.data.subarray(wholeStart, wholeStart + 256 * 4),
          `surface ${originX},${originY}; tile ${tileX},${tileY}; row ${y}, including both edge pixels`);
      }
    }
  }
});

test('surface allocation is opaque and sampling stays bounded to the shared coarse grid', () => {
  for (const size of [1, 7, 256]) {
    const originX = -256, originY = 512;
    const { context, image, calls } = render(originX, originY, size, () => [28, 54, 76]);
    assert.equal(context.allocations.length, 1);
    assert.equal(context.writes[0].image, context.allocations[0]);
    assert.deepEqual([context.writes[0].x, context.writes[0].y], [0, 0]);
    assert.deepEqual([image.width, image.height, image.data.length], [size, size, size * size * 4]);
    for (let index = 0; index < image.data.length; index += 4) {
      assert.equal(image.data[index], 28); assert.equal(image.data[index + 1], 54);
      assert.equal(image.data[index + 2], 76); assert.equal(image.data[index + 3], 255);
    }
    const cells = Math.ceil(size / 4);
    assert.equal(calls.length, (cells + 1) ** 2);
    assert.equal(new Set(calls.map(([x, y]) => `${x},${y}`)).size, calls.length, 'sample each grid point only once');
    for (const [x, y] of calls) {
      assert.ok(x >= originX && x <= originX + cells * 4 && y >= originY && y <= originY + cells * 4);
      assert.equal((x - originX) % 4, 0); assert.equal((y - originY) % 4, 0);
    }
    if (size === 256) assert.equal(calls.length, 4225, 'a tile must not query its material independently for every pixel');
  }
});
