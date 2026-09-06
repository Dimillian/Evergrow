import { TILE_SIZE } from './world.ts';
import type { World } from './world.ts';

type CanvasFactory = () => HTMLCanvasElement;
const PREFETCH_LIMIT = 16;

/** Joins cached terrain before sampling it at the camera's fractional position. */
export class GroundLayer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private world: World | null = null;
  private minX = 0;
  private minY = 0;
  private maxX = -1;
  private maxY = -1;
  private lastLeft = 0;
  private lastTop = 0;
  private prefetched = new Map<string, HTMLCanvasElement>();

  constructor(createCanvas: CanvasFactory = () => document.createElement('canvas')) {
    this.canvas = createCanvas();
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('A 2D canvas context is required for the ground layer.');
    this.context = context;
  }

  reset() { this.world = null; this.prefetched.clear(); }

  /** The destination uses world coordinates, including the unsnapped camera transform. */
  draw(destination: CanvasRenderingContext2D, world: World,
    left: number, top: number, width: number, height: number) {
    const minX = Math.floor((left - 2) / TILE_SIZE);
    const minY = Math.floor((top - 2) / TILE_SIZE);
    const maxX = minX + Math.ceil((width + 4) / TILE_SIZE);
    const maxY = minY + Math.ceil((height + 4) / TILE_SIZE);
    const changed = world !== this.world || minX !== this.minX || minY !== this.minY
      || maxX !== this.maxX || maxY !== this.maxY;
    const dx = left - this.lastLeft, dy = top - this.lastTop;
    if (world !== this.world) this.prefetched.clear();
    if (changed) {
      const bufferWidth = (maxX - minX + 1) * TILE_SIZE;
      const bufferHeight = (maxY - minY + 1) * TILE_SIZE;
      const overlapX = Math.max(minX, this.minX), overlapY = Math.max(minY, this.minY);
      const overlapRight = Math.min(maxX, this.maxX), overlapBottom = Math.min(maxY, this.maxY);
      const reuse = world === this.world && this.canvas.width === bufferWidth && this.canvas.height === bufferHeight
        && overlapX <= overlapRight && overlapY <= overlapBottom;
      if (this.canvas.width !== bufferWidth) this.canvas.width = bufferWidth;
      if (this.canvas.height !== bufferHeight) this.canvas.height = bufferHeight;
      const c = this.context;
      c.imageSmoothingEnabled = false;
      if (reuse) {
        // Canvas self-copy snapshots the source, including when source/destination overlap.
        const w = (overlapRight - overlapX + 1) * TILE_SIZE, h = (overlapBottom - overlapY + 1) * TILE_SIZE;
        c.drawImage(this.canvas, (overlapX - this.minX) * TILE_SIZE, (overlapY - this.minY) * TILE_SIZE, w, h,
          (overlapX - minX) * TILE_SIZE, (overlapY - minY) * TILE_SIZE, w, h);
      } else c.clearRect(0, 0, bufferWidth, bufferHeight);
      for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
        if (reuse && tx >= overlapX && tx <= overlapRight && ty >= overlapY && ty <= overlapBottom) continue;
        const key = `${tx}:${ty}`, tile = this.prefetched.get(key) ?? world.getGroundTile(tx, ty);
        this.prefetched.delete(key);
        c.drawImage(tile, (tx - minX) * TILE_SIZE, (ty - minY) * TILE_SIZE);
      }
      this.world = world;
      this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
    }
    destination.drawImage(this.canvas, minX * TILE_SIZE, minY * TILE_SIZE);
    // Spread upcoming full-quality tiles over ordinary movement frames, not the crossing frame.
    if (!changed && Math.hypot(dx, dy) > .75) this.prefetch(world, dx, dy, left, top);
    this.lastLeft = left; this.lastTop = top;
  }

  private prefetch(world: World, dx: number, dy: number, left: number, top: number): void {
    const length = Math.hypot(dx, dy), cx = (this.minX + this.maxX) / 2, cy = (this.minY + this.maxY) / 2;
    const candidates: Array<{ x: number; y: number; key: string; score: number }> = [];
    // Only prepare the strip predicted to enter soon, rather than an unused ring behind the player.
    const lead = (delta: number) => Math.max(-TILE_SIZE, Math.min(TILE_SIZE, delta * 48));
    const firstX = Math.floor((left + lead(dx) - 2) / TILE_SIZE), firstY = Math.floor((top + lead(dy) - 2) / TILE_SIZE);
    const lastX = firstX + this.maxX - this.minX, lastY = firstY + this.maxY - this.minY;
    for (let y = firstY; y <= lastY; y++) for (let x = firstX; x <= lastX; x++) {
      if (x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY) continue;
      candidates.push({ x, y, key: `${x}:${y}`, score: Math.hypot(x - cx, y - cy) - 2 * ((x - cx) * dx + (y - cy) * dy) / length });
    }
    candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    const ahead = candidates.slice(0, PREFETCH_LIMIT), keys = new Set(ahead.map(p => p.key));
    for (const key of this.prefetched.keys()) if (!keys.has(key)) this.prefetched.delete(key);
    const next = ahead.find(p => !this.prefetched.has(p.key));
    if (next) {
      const tile = world.getGroundTile(next.x, next.y, undefined, 2);
      if (tile) this.prefetched.set(next.key, tile);
    }
  }
}
