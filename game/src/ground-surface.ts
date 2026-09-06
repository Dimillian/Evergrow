type Color = readonly number[];

/** Interpolate a shared world grid into opaque pixels before adding fine artwork. */
export function drawGroundSurface(c: CanvasRenderingContext2D, originX: number, originY: number,
  size: number, sample: (x: number, y: number) => Color): void {
  for (const _ of groundSurfaceSteps(c, originX, originY, size, sample)) { /* synchronous callers finish the same work */ }
}

/** Cooperative work units preserve the exact sampler and final pixels. */
export function* groundSurfaceSteps(c: CanvasRenderingContext2D, originX: number, originY: number,
  size: number, sample: (x: number, y: number) => Color): Generator<void> {
  const step = 4;
  const cells = Math.ceil(size / step), stride = cells + 1;
  const colors = new Float32Array(stride * stride * 3);
  for (let y = 0; y <= cells; y++) {
    for (let x = 0; x <= cells; x++) {
      const color = sample(originX + x * step, originY + y * step);
      const index = (y * stride + x) * 3;
      colors[index] = color[0]; colors[index + 1] = color[1]; colors[index + 2] = color[2];
    }
    if (y % 4 === 3) yield;
  }
  const image = c.createImageData(size, size), pixels = image.data;
  let pixel = 0;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / step) * stride * 3;
    const ty = ((y % step) + .5) / step;
    for (let cell = 0; cell < cells; cell++) {
      const a = row + cell * 3, b = a + stride * 3;
      const red = colors[a] + (colors[b] - colors[a]) * ty;
      const green = colors[a + 1] + (colors[b + 1] - colors[a + 1]) * ty;
      const blue = colors[a + 2] + (colors[b + 2] - colors[a + 2]) * ty;
      const dr = colors[a + 3] + (colors[b + 3] - colors[a + 3]) * ty - red;
      const dg = colors[a + 4] + (colors[b + 4] - colors[a + 4]) * ty - green;
      const db = colors[a + 5] + (colors[b + 5] - colors[a + 5]) * ty - blue;
      for (let x = 0; x < step && cell * step + x < size; x++) {
        const tx = (x + .5) / step;
        pixels[pixel++] = red + dr * tx;
        pixels[pixel++] = green + dg * tx;
        pixels[pixel++] = blue + db * tx;
        pixels[pixel++] = 255;
      }
    }
    if (y % 32 === 31) yield;
  }
  c.putImageData(image, 0, 0);
}
