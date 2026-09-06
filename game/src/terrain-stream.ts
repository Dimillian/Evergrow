export interface TerrainCoordinate { x: number; y: number; }
interface Tile { bitmap: ImageBitmap; ready: number; }
interface Port { postMessage(value: unknown): void; terminate(): void; onmessage: ((event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: boolean }>) => void) | null; onerror: ((event: ErrorEvent) => void) | null; }
/** One in-flight job, nearest visible tiles first, bounded ownership of transferable bitmaps. */
export class TerrainStream {
  private port: Port;
  private tiles = new Map<string, Tile>();
  private wanted = new Map<string, TerrainCoordinate>();
  private pending: { id: number; key: string } | null = null;
  private serial = 0;
  private seed = 0;
  failed = false;
  constructor(create: () => Port = () => new Worker(new URL('./terrain-worker.ts', import.meta.url), { type: 'module' })) {
    this.port = create();
    this.port.onmessage = ({ data }) => {
      if (!this.pending || data.id !== this.pending.id) { data.bitmap?.close(); return; }
      const { key } = this.pending; this.pending = null;
      if (data.error || !data.bitmap) { this.failed = true; this.dispose(); return; }
      if (this.wanted.has(key)) {
        this.tiles.get(key)?.bitmap.close(); this.tiles.set(key, { bitmap: data.bitmap, ready: performance.now() });
      } else data.bitmap.close();
      this.pump();
    };
    this.port.onerror = () => { this.failed = true; this.dispose(); };
  }
  get size() { return this.tiles.size; }
  get queued() { return this.wanted.size - this.tiles.size; }
  update(seed: number, coordinates: readonly TerrainCoordinate[]) {
    this.seed = seed;
    this.wanted.clear();
    for (const p of coordinates.slice(0, 256)) this.wanted.set(`${seed}:${p.x}:${p.y}`, p);
    for (const [key, tile] of this.tiles) if (!this.wanted.has(key)) { tile.bitmap.close(); this.tiles.delete(key); }
    this.pump();
  }
  get(x: number, y: number) { return this.tiles.get(`${this.seed}:${x}:${y}`); }
  private pump() {
    if (this.failed || this.pending) return;
    for (const [key, p] of this.wanted) if (!this.tiles.has(key)) {
      this.pending = { id: ++this.serial, key }; this.port.postMessage({ id: this.serial, seed: this.seed, ...p }); return;
    }
  }
  dispose() { this.port.terminate(); for (const tile of this.tiles.values()) tile.bitmap.close(); this.tiles.clear(); this.wanted.clear(); this.pending = null; }
}
