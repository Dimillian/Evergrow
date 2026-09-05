export type Point = readonly [number, number];

export type Affine = readonly [number, number, number, number, number, number];

export function compose(a: Affine, b: Affine): Affine {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

export function transformPoint(matrix: Affine, point: Point): Point {
  return [matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
    matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]];
}

export type Random = () => number;

export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export type Color = (value: string) => string;

export const TAU = Math.PI * 2;

export function clamp(value: number, low = 0, high = 1): number {
  return Math.max(low, Math.min(high, value));
}

export function smooth(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function hash(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

export function randomFromSeed(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(random: Random, min: number, max: number): number {
  return min + (max - min) * random();
}

export function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  color: string,
  width: number,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'bevel';
  ctx.lineCap = 'butt';
  ctx.stroke();
}

export function taper(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fromWidth: number,
  toWidth: number,
  fill: string,
): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length / 2;
  const ny = dx / length / 2;
  polygon(ctx, [
    [from[0] + nx * fromWidth, from[1] + ny * fromWidth],
    [to[0] + nx * toWidth, to[1] + ny * toWidth],
    [to[0] - nx * toWidth, to[1] - ny * toWidth],
    [from[0] - nx * fromWidth, from[1] - ny * fromWidth],
  ], fill);
}

export function mixColor(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const red = Math.round(((a >>> 16) & 255) * (1 - amount) + ((b >>> 16) & 255) * amount);
  const green = Math.round(((a >>> 8) & 255) * (1 - amount) + ((b >>> 8) & 255) * amount);
  const blue = Math.round((a & 255) * (1 - amount) + (b & 255) * amount);
  return `rgb(${red},${green},${blue})`;
}
