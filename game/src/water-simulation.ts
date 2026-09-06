import type { WaterSample } from './hydrology.ts';

export const WATER_LIMITS = Object.freeze({ columns: 144, rows: 112, tick: 1 / 60, substeps: 4, impulses: 32, droplets: 96 });
export interface WaterImpulse { x: number; y: number; radius: number; strength: number; }
export interface WaterDroplet { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; }
export type WaterSampler = (x: number, y: number) => WaterSample;
/** Linearized shallow-water height/face-flux solver on a rolling, world-aligned grid.
 * Closed dry faces reflect waves. Depth controls propagation; edge sponges absorb the artificial viewport boundary.
 * Static bed/flow are generated geography, never changed by this presentation simulation. */
export class WaterSimulation {
  readonly columns = WATER_LIMITS.columns;
  readonly rows = WATER_LIMITS.rows;
  readonly height = new Float32Array(this.columns * this.rows);
  readonly u = new Float32Array(this.height.length);
  readonly v = new Float32Array(this.height.length);
  readonly depth = new Float32Array(this.height.length);
  readonly wet = new Float32Array(this.height.length);
  readonly flowX = new Float32Array(this.height.length);
  readonly flowY = new Float32Array(this.height.length);
  private scratch = new Float32Array(this.height.length);
  readonly droplets: WaterDroplet[] = [];
  cell = 8; left = Infinity; top = Infinity; time = 0;
  private remainder = 0; private emissions = 0; private serial = 0;
  get wetCells() { let count = 0; for (const w of this.wet) if (w > .05) count++; return count; }
  reset() { this.height.fill(0); this.u.fill(0); this.v.fill(0); this.wet.fill(0); this.depth.fill(0); this.flowX.fill(0); this.flowY.fill(0); this.left = this.top = Infinity; this.remainder = this.time = this.emissions = 0; this.droplets.length = 0; }
  fit(bounds: { x: number; y: number; width: number; height: number }, sample: WaterSampler) {
    const cell = 8 * 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(bounds.width / ((this.columns - 16) * 8), bounds.height / ((this.rows - 16) * 8)))));
    const left = Math.floor((bounds.x + bounds.width / 2) / (cell * 4)) * cell * 4 - this.columns / 2 * cell;
    const top = Math.floor((bounds.y + bounds.height / 2) / (cell * 4)) * cell * 4 - this.rows / 2 * cell;
    if (left === this.left && top === this.top && cell === this.cell) return;
    const dx = Math.round((left - this.left) / cell), dy = Math.round((top - this.top) / cell);
    const preserve = cell === this.cell && Math.abs(dx) < this.columns && Math.abs(dy) < this.rows;
    for (const buffer of [this.height, this.u, this.v, this.depth, this.wet, this.flowX, this.flowY]) {
      this.scratch.fill(0);
      if (preserve) for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.columns; x++) {
        const ox = x + dx, oy = y + dy;
        if (ox >= 0 && ox < this.columns && oy >= 0 && oy < this.rows) this.scratch[y * this.columns + x] = buffer[oy * this.columns + ox];
      }
      buffer.set(this.scratch);
    }
    if (!preserve) { this.droplets.length = 0; this.remainder = 0; }
    this.left = left; this.top = top; this.cell = cell;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.columns; x++) {
      if (preserve && x + dx >= 0 && x + dx < this.columns && y + dy >= 0 && y + dy < this.rows) continue;
      const i = y * this.columns + x, w = sample(left + (x + .5) * cell, top + (y + .5) * cell);
      this.wet[i] = w.coverage; this.depth[i] = w.depth; this.flowX[i] = w.flowX; this.flowY[i] = w.flowY;
    }
  }
  wetAt(x: number, y: number) { const i = this.index(x, y); return i < 0 ? 0 : this.wet[i]; }
  private index(x: number, y: number) {
    const ix = Math.floor((x - this.left) / this.cell), iy = Math.floor((y - this.top) / this.cell);
    return ix < 0 || ix >= this.columns || iy < 0 || iy >= this.rows ? -1 : iy * this.columns + ix;
  }
  disturb(impulse: WaterImpulse, splash = true) {
    if (![impulse.x, impulse.y, impulse.radius, impulse.strength].every(Number.isFinite) || impulse.radius <= 0 || this.emissions >= WATER_LIMITS.impulses) return false;
    const { x, y } = impulse, radius = Math.max(this.cell * 1.5, Math.min(160, impulse.radius));
    const strength = Math.max(-3, Math.min(3, impulse.strength));
    let touched = false;
    const minX = Math.max(1, Math.floor((x - radius - this.left) / this.cell)), maxX = Math.min(this.columns - 2, Math.ceil((x + radius - this.left) / this.cell));
    const minY = Math.max(1, Math.floor((y - radius - this.top) / this.cell)), maxY = Math.min(this.rows - 2, Math.ceil((y + radius - this.top) / this.cell));
    for (let iy = minY; iy <= maxY; iy++) for (let ix = minX; ix <= maxX; ix++) {
      const i = iy * this.columns + ix, d = Math.hypot(this.left + (ix + .5) * this.cell - x, this.top + (iy + .5) * this.cell - y) / radius;
      if (d >= 1 || this.wet[i] < .1) continue;
      // Zero-mean Mexican-hat displacement pushes water aside instead of accumulating volume.
      const shape = (1 - d * d) ** 2 * (1 - 4 * d * d);
      this.height[i] = Math.max(-4, Math.min(4, this.height[i] + shape * strength)); touched = true;
    }
    if (!touched) return false;
    this.emissions++;
    if (splash && this.wetAt(x, y) > .1) for (let i = 0; i < Math.min(12, 3 + Math.ceil(Math.abs(strength) * 3)) && this.droplets.length < WATER_LIMITS.droplets; i++) {
      const phase = ++this.serial * 2.399963, speed = 14 + (this.serial % 7) * 5;
      this.droplets.push({ x, y, z: 2, vx: Math.cos(phase) * speed, vy: Math.sin(phase) * speed * .65, vz: 30 + Math.abs(strength) * 18 + this.serial % 19, age: 0 });
    }
    return true;
  }
  update(dt: number, reducedMotion = false) {
    this.emissions = 0;
    if (reducedMotion) { this.height.fill(0); this.u.fill(0); this.v.fill(0); this.droplets.length = 0; this.remainder = 0; return; }
    if (!Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(WATER_LIMITS.tick * WATER_LIMITS.substeps, dt);
    this.time += step; this.remainder += step;
    for (let ticks = 0; this.remainder + 1e-9 >= WATER_LIMITS.tick && ticks < WATER_LIMITS.substeps; ticks++) {
      this.remainder = Math.max(0, this.remainder - WATER_LIMITS.tick); this.tick();
    }
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const p = this.droplets[i]; p.age += step; p.x += p.vx * step; p.y += p.vy * step; p.vz -= 180 * step; p.z += p.vz * step;
      if (p.z <= 0 || p.age > 1.2) { if (p.z <= 0) this.disturb({ x: p.x, y: p.y, radius: 12, strength: .16 }, false); this.droplets.splice(i, 1); }
    }
  }
  private tick() {
    const n = this.columns, rows = this.rows, dt = WATER_LIMITS.tick, invCell = 1 / this.cell;
    const h = this.height, u = this.u, v = this.v, wet = this.wet, depth = this.depth;
    for (let y = 0; y < rows; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      // Maximum wave speed 105 world units/s. At cell 8 and 60 Hz the 2D CFL number stays below .32.
      u[i] = x + 1 < n && wet[i] > .1 && wet[i + 1] > .1 ? (u[i] - 6200 * Math.min(1.8, depth[i], depth[i + 1]) * dt * invCell * (h[i + 1] - h[i])) * .987 : 0;
      v[i] = y + 1 < rows && wet[i] > .1 && wet[i + n] > .1 ? (v[i] - 6200 * Math.min(1.8, depth[i], depth[i + n]) * dt * invCell * (h[i + n] - h[i])) * .987 : 0;
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (wet[i] <= .1) { h[i] = 0; continue; }
      const edge = Math.min(x, y, n - x - 1, rows - y - 1);
      h[i] = (h[i] - dt * invCell * (u[i] - (x ? u[i - 1] : 0) + v[i] - (y ? v[i - n] : 0))) * (edge < 6 ? .86 + edge * .022 : .997);
    }
  }
}
