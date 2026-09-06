import { TerrainStream, type TerrainCoordinate } from './terrain-stream.ts';
import { TILE_SIZE, World } from './world.ts';

type CanvasFactory = () => HTMLCanvasElement;
const PREFETCH_LIMIT = 16;

/** Joins cached terrain before sampling it at the camera's fractional position. */
export class GroundLayer {
  private stream: TerrainStream | null = null;
  private background: boolean;
  private previews = new Map<string, HTMLCanvasElement>();
  private transitions = new Map<string, number>();
  private createCanvas: CanvasFactory;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private world: World | null = null;
  private minX = 0;
  private minY = 0;
  private maxX = -1;
  private maxY = -1;
  private lastLeft = 0;
  private lastTop = 0;
  private lastTime = 0;
  private prefetched = new Map<string, HTMLCanvasElement>();

  constructor(createCanvas: CanvasFactory = () => document.createElement('canvas'), background = false) {
    this.background = background; this.createCanvas = createCanvas;
    this.canvas = createCanvas();
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('A 2D canvas context is required for the ground layer.');
    this.context = context;
  }

  reset() { this.world = null; this.prefetched.clear(); this.previews.clear(); this.transitions.clear(); this.stream?.dispose(); this.stream = null; }

  private preview(world: World, x: number, y: number) {
    const key = `${x}:${y}`; let tile = this.previews.get(key);
    if (!tile) {
      tile = this.createCanvas(); tile.width = tile.height = 16;
      world.drawGroundPreview(tile.getContext('2d')!, x, y); this.previews.set(key, tile);
    }
    return tile;
  }

  /** The destination uses world coordinates, including the unsnapped camera transform. */
  draw(destination: CanvasRenderingContext2D, world: World,
    left: number, top: number, width: number, height: number) {
    const now = performance.now();
    const frameSeconds = Math.max(1 / 240, Math.min(.05, (now - this.lastTime) / 1000 || 1 / 60));
    this.lastTime = now;
    const minX = Math.floor((left - 2) / TILE_SIZE);
    const minY = Math.floor((top - 2) / TILE_SIZE);
    const maxX = minX + Math.ceil((width + 4) / TILE_SIZE);
    const maxY = minY + Math.ceil((height + 4) / TILE_SIZE);
    let changed = world !== this.world || minX !== this.minX || minY !== this.minY
      || maxX !== this.maxX || maxY !== this.maxY;
    const dx = left - this.lastLeft, dy = top - this.lastTop;
    if (world !== this.world) {
      this.reset();
      // Dungeon terrain and frozen art reviews retain their synchronous renderer.
      if (this.background && Object.getPrototypeOf(world) === World.prototype && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
        try { this.stream = new TerrainStream(); } catch { this.stream = null; }
      }
    }
    if (this.stream?.failed) { this.stream.dispose(); this.stream = null; this.world = null; changed = true; }
    if (this.stream) {
      const coordinates: TerrainCoordinate[] = [];
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) coordinates.push({ x, y });
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      coordinates.sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - (b.x - cx) ** 2 - (b.y - cy) ** 2);
      const aheadX = Math.sign(dx), aheadY = Math.sign(dy);
      for (let y = minY; y <= maxY; y++) if (aheadX) coordinates.push({ x: aheadX > 0 ? maxX + 1 : minX - 1, y });
      for (let x = minX; x <= maxX; x++) if (aheadY) coordinates.push({ x, y: aheadY > 0 ? maxY + 1 : minY - 1 });
      this.stream.update(world.seed, coordinates);
      const retained = new Set(coordinates.map(p => `${p.x}:${p.y}`));
      for (const key of this.previews.keys()) if (!retained.has(key)) { this.previews.delete(key); this.transitions.delete(key); }
    }
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
        const key = `${tx}:${ty}`;
        if (this.stream) {
          c.imageSmoothingEnabled = true;
          c.drawImage(this.preview(world, tx, ty), (tx - minX) * TILE_SIZE, (ty - minY) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          this.transitions.delete(key);
        } else {
          const tile = this.prefetched.get(key) ?? world.getGroundTile(tx, ty); this.prefetched.delete(key);
          c.drawImage(tile, (tx - minX) * TILE_SIZE, (ty - minY) * TILE_SIZE);
        }
      }
      this.world = world;
      this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
    }
    if (this.stream) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const tile = this.stream.get(x, y), key = `${x}:${y}`;
      if (!tile || this.transitions.get(key) === tile.ready) continue;
      const c = this.context, px = (x - minX) * TILE_SIZE, py = (y - minY) * TILE_SIZE;
      c.imageSmoothingEnabled = true;
      c.drawImage(this.preview(world, x, y), px, py, TILE_SIZE, TILE_SIZE);
      c.globalAlpha = Math.min(1, Math.max(0, (now - tile.ready) / 160)); c.drawImage(tile.bitmap, px, py); c.globalAlpha = 1;
      if (now - tile.ready >= 160) this.transitions.set(key, tile.ready);
    }
    destination.drawImage(this.canvas, minX * TILE_SIZE, minY * TILE_SIZE);
    // Spread upcoming full-quality tiles over ordinary movement frames, not the crossing frame.
    if (!this.stream && !changed && Math.hypot(dx, dy) > .01) this.prefetch(world, dx, dy, left, top, frameSeconds);
    this.lastLeft = left; this.lastTop = top;
  }

  private prefetch(world: World, dx: number, dy: number, left: number, top: number, frameSeconds: number): void {
    const length = Math.hypot(dx, dy), cx = (this.minX + this.maxX) / 2, cy = (this.minY + this.maxY) / 2;
    const candidates: Array<{ x: number; y: number; key: string; score: number }> = [];
    // Only prepare the strip predicted to enter soon, rather than an unused ring behind the player.
    const lead = (delta: number) => Math.max(-TILE_SIZE, Math.min(TILE_SIZE, delta * .8 / frameSeconds));
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
      const tile = world.getGroundTile(next.x, next.y, undefined, Math.min(2, frameSeconds * 120));
      if (tile) this.prefetched.set(next.key, tile);
    }
  }
}
