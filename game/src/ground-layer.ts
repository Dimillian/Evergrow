import { TILE_SIZE } from './world.ts';
import type { World } from './world.ts';

type CanvasFactory = () => HTMLCanvasElement;

/** Joins cached terrain before sampling it at the camera's fractional position. */
export class GroundLayer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private world: World | null = null;
  private minX = 0;
  private minY = 0;
  private maxX = -1;
  private maxY = -1;

  constructor(createCanvas: CanvasFactory = () => document.createElement('canvas')) {
    this.canvas = createCanvas();
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('A 2D canvas context is required for the ground layer.');
    this.context = context;
  }

  reset() { this.world = null; }

  /** The destination uses world coordinates, including the unsnapped camera transform. */
  draw(destination: CanvasRenderingContext2D, world: World,
    left: number, top: number, width: number, height: number) {
    // Keep sampling edges outside the viewport, with stable storage while the camera moves.
    const minX = Math.floor((left - 2) / TILE_SIZE);
    const minY = Math.floor((top - 2) / TILE_SIZE);
    const maxX = minX + Math.ceil((width + 4) / TILE_SIZE);
    const maxY = minY + Math.ceil((height + 4) / TILE_SIZE);
    if (world !== this.world || minX !== this.minX || minY !== this.minY
      || maxX !== this.maxX || maxY !== this.maxY) {
      const bufferWidth = (maxX - minX + 1) * TILE_SIZE;
      const bufferHeight = (maxY - minY + 1) * TILE_SIZE;
      if (this.canvas.width !== bufferWidth) this.canvas.width = bufferWidth;
      if (this.canvas.height !== bufferHeight) this.canvas.height = bufferHeight;
      const c = this.context;
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, bufferWidth, bufferHeight);
      for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          c.drawImage(world.getGroundTile(tx, ty), (tx - minX) * TILE_SIZE, (ty - minY) * TILE_SIZE);
        }
      }
      this.world = world;
      this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
    }
    // Filtering now spans real neighboring pixels instead of separate tile edges.
    destination.drawImage(this.canvas, minX * TILE_SIZE, minY * TILE_SIZE);
  }
}
