import { decodeExploration, explorationChunkKey as key, validExplorationCoordinate as coordinate,
  validExplorationPOI as validPOI, EXPLORATION_CELL_SIZE, EXPLORATION_CHUNK_CELLS, EXPLORATION_CHUNK_SIZE,
  EXPLORATION_LIMITS, type ExplorationChunk as Chunk, type DecodedExploration } from './exploration-save.ts';
import type { WorldPOI } from './world-pois.ts';
export { EXPLORATION_CELL_SIZE, EXPLORATION_CHUNK_CELLS, EXPLORATION_CHUNK_SIZE, EXPLORATION_LIMITS } from './exploration-save.ts';
export type MapPOI = WorldPOI;
export interface ExplorationWorld {
  readonly seed: number;
  readonly generationVersion?: number | string;
  getPOIs(x: number, y: number, width: number, height: number): MapPOI[];
}
export interface MapRect { x: number; y: number; width: number; height: number; }
export interface ExplorationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export type ExplorationStatus = 'saved' | 'pending' | 'session' | 'full' | 'invalid';
export interface ExplorationOptions {
  storage?: ExplorationStorage | null;
  generationVersion?: string | number;
  saveDelayMs?: number;
}
function population(value: number) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
function defaultStorage(): ExplorationStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Sparse bitsets retain every visited region; capacity never evicts older discoveries. */
export class Exploration {
  readonly world: ExplorationWorld;
  readonly storageKey: string;
  readonly generationVersion: string;
  private chunks = new Map<string, Chunk>();
  private pois = new Map<string, MapPOI>();
  private storage: ExplorationStorage | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saveDelay: number;
  private dirty = false;
  private disposed = false;
  private protectSave = false;
  private capacityReached = false;
  private lastX = Infinity;
  private lastY = Infinity;
  private lastRadius = 0;
  private onPageHide = () => this.save();
  revision = 0;
  exploredCellCount = 0;
  storageStatus: ExplorationStatus;

  constructor(world: ExplorationWorld, options: ExplorationOptions = {}) {
    this.world = world;
    this.generationVersion = String(options.generationVersion ?? world.generationVersion ?? 1);
    this.storageKey = `evergrowing:exploration:1:${this.generationVersion}:${world.seed}`;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    const delay = options.saveDelayMs ?? 1800;
    this.saveDelay = Math.max(100, Math.min(10_000, Number.isFinite(delay) ? delay : 1800));
    this.storageStatus = this.storage ? 'saved' : 'session';
    try {
      const saved = this.storage?.getItem(this.storageKey);
      if (saved != null && !this.restore(saved)) { this.protectSave = true; this.storageStatus = 'invalid'; }
    } catch { this.storageStatus = 'session'; this.storage = null; }
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide);
  }

  get discoveredPOICount() { return this.pois.size; }
  get persistenceMessage() {
    if (this.capacityReached || this.storageStatus === 'full') return 'Exploration storage is full. Existing regions are preserved.';
    if (this.storageStatus === 'invalid') return 'The saved chart could not be read. New exploration stays in this session.';
    if (this.storageStatus === 'session') return 'Exploration is kept for this session; local storage is unavailable.';
    return '';
  }

  isCellRevealed(x: number, y: number) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return false;
    const cx = Math.floor(x / EXPLORATION_CHUNK_CELLS), cy = Math.floor(y / EXPLORATION_CHUNK_CELLS);
    const chunk = this.chunks.get(key(cx, cy));
    if (!chunk) return false;
    const lx = x - cx * EXPLORATION_CHUNK_CELLS, ly = y - cy * EXPLORATION_CHUNK_CELLS;
    return (chunk.words[ly] & (1 << lx)) !== 0;
  }
  isRevealed(x: number, y: number) {
    return coordinate(x) && coordinate(y) && this.isCellRevealed(Math.floor(x / EXPLORATION_CELL_SIZE), Math.floor(y / EXPLORATION_CELL_SIZE));
  }
  isDiscovered(id: string) { return this.pois.has(id); }
  getChunkRevision(x: number, y: number) {
    return this.chunks.get(key(Math.floor(x / EXPLORATION_CHUNK_SIZE), Math.floor(y / EXPLORATION_CHUNK_SIZE)))?.revision ?? 0;
  }

  private revealCell(x: number, y: number) {
    const minCell = Math.floor(-EXPLORATION_LIMITS.coordinate / EXPLORATION_CELL_SIZE);
    const maxCell = Math.floor(EXPLORATION_LIMITS.coordinate / EXPLORATION_CELL_SIZE);
    if (x < minCell || y < minCell || x > maxCell || y > maxCell) return false;
    const cx = Math.floor(x / EXPLORATION_CHUNK_CELLS), cy = Math.floor(y / EXPLORATION_CHUNK_CELLS), id = key(cx, cy);
    let chunk = this.chunks.get(id);
    if (!chunk) {
      if (this.chunks.size >= EXPLORATION_LIMITS.chunks) { this.capacityReached = true; return false; }
      chunk = { x: cx, y: cy, words: new Uint32Array(EXPLORATION_CHUNK_CELLS), revision: 0 };
      this.chunks.set(id, chunk);
    }
    const lx = x - cx * EXPLORATION_CHUNK_CELLS, ly = y - cy * EXPLORATION_CHUNK_CELLS, bit = 1 << lx;
    if ((chunk.words[ly] & bit) !== 0) return false;
    chunk.words[ly] = (chunk.words[ly] | bit) >>> 0;
    chunk.revision = ++this.revision;
    this.exploredCellCount++;
    return true;
  }

  /** Reveal the current view only; teleporting never reveals an untravelled connecting path. */
  reveal(x: number, y: number, radius = 260) {
    if (this.disposed || !coordinate(x) || !coordinate(y) || !Number.isFinite(radius) || radius < 0) return false;
    radius = Math.min(EXPLORATION_LIMITS.revealRadius, radius);
    if (radius === this.lastRadius && this.isRevealed(x, y) && Math.hypot(x - this.lastX, y - this.lastY) < 12) return false;
    this.lastX = x; this.lastY = y; this.lastRadius = radius;
    const cell = EXPLORATION_CELL_SIZE;
    let changed = this.revealCell(Math.floor(x / cell), Math.floor(y / cell));
    for (let cy = Math.floor((y - radius) / cell); cy <= Math.floor((y + radius) / cell); cy++) {
      for (let cx = Math.floor((x - radius) / cell); cx <= Math.floor((x + radius) / cell); cx++) {
        if (((cx + .5) * cell - x) ** 2 + ((cy + .5) * cell - y) ** 2 <= radius * radius)
          changed = this.revealCell(cx, cy) || changed;
      }
    }
    for (const poi of this.world.getPOIs(x - radius, y - radius, radius * 2 + 1, radius * 2 + 1)) {
      if (!validPOI(poi) || this.pois.has(poi.id) || Math.hypot(poi.x - x, poi.y - y) > radius) continue;
      changed = this.revealCell(Math.floor(poi.x / cell), Math.floor(poi.y / cell)) || changed;
      if (!this.isRevealed(poi.x, poi.y)) continue;
      if (this.pois.size >= EXPLORATION_LIMITS.pois) { this.capacityReached = true; break; }
      this.pois.set(poi.id, { id: poi.id, name: poi.name, kind: poi.kind, x: poi.x, y: poi.y, description: poi.description });
      this.revision++; changed = true;
    }
    if (changed) this.markDirty();
    return changed;
  }

  getDiscoveredPOIs(bounds?: MapRect): MapPOI[] {
    const found: MapPOI[] = [];
    for (const p of this.pois.values()) if (!bounds || (p.x >= bounds.x && p.y >= bounds.y
      && p.x <= bounds.x + bounds.width && p.y <= bounds.y + bounds.height)) found.push({ ...p });
    return found;
  }

  private markDirty() {
    this.dirty = true;
    if (this.storage && !this.protectSave && !this.capacityReached) this.storageStatus = 'pending';
    if (this.storage && !this.protectSave && this.timer === null) this.timer = setTimeout(() => { this.timer = null; this.save(); }, this.saveDelay);
  }

  serialize() {
    const chunks = [...this.chunks.values()].sort((a, b) => a.y - b.y || a.x - b.x)
      .map(c => [c.x, c.y, [...c.words].map(word => word.toString(36)).join('.')]);
    const pois = [...this.pois.values()].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ schema: 1, seed: this.world.seed, generation: this.generationVersion,
      cell: EXPLORATION_CELL_SIZE, chunks, pois });
  }

  /** Validate the whole payload before merging; malformed saves cannot erase old regions. */
  restore(raw: string) {
    if (this.disposed) return false;
    const decoded = decodeExploration(raw, { seed: this.world.seed, generation: this.generationVersion });
    if (!decoded) return false;
    return this.merge(decoded);
  }

  private merge(decoded: DecodedExploration): boolean {
    const newChunks = decoded.chunks.filter(c => !this.chunks.has(key(c.x, c.y))).length;
    const newPOIs = decoded.pois.filter(p => !this.pois.has(p.id)).length;
    if (this.chunks.size + newChunks > EXPLORATION_LIMITS.chunks || this.pois.size + newPOIs > EXPLORATION_LIMITS.pois) return false;
    for (const incoming of decoded.chunks) {
      const id = key(incoming.x, incoming.y), existing = this.chunks.get(id);
      if (!existing) {
        incoming.revision = ++this.revision; this.chunks.set(id, incoming);
        for (const word of incoming.words) this.exploredCellCount += population(word);
      } else {
        let changed = false;
        for (let i = 0; i < EXPLORATION_CHUNK_CELLS; i++) {
          const next = (existing.words[i] | incoming.words[i]) >>> 0;
          if (next !== existing.words[i]) { this.exploredCellCount += population(next) - population(existing.words[i]); existing.words[i] = next; changed = true; }
        }
        if (changed) existing.revision = ++this.revision;
      }
    }
    for (const poi of decoded.pois) if (!this.pois.has(poi.id) && this.isRevealed(poi.x, poi.y)) { this.pois.set(poi.id, poi); this.revision++; }
    return true;
  }

  save() {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (this.disposed || !this.dirty || !this.storage || this.protectSave) return false;
    try {
      // Preserve discoveries made by another local tab since this session loaded.
      const existing = this.storage.getItem(this.storageKey);
      if (existing !== null) {
        const decoded = decodeExploration(existing, { seed: this.world.seed, generation: this.generationVersion });
        if (!decoded) { this.protectSave = true; this.storageStatus = 'invalid'; return false; }
        // A valid chart that exceeds combined capacity is not a corrupt save.
        if (!this.merge(decoded)) { this.storageStatus = 'full'; return false; }
      }
      const raw = this.serialize();
      if (raw.length > EXPLORATION_LIMITS.saveLength) { this.storageStatus = 'full'; return false; }
      this.storage.setItem(this.storageKey, raw);
      this.dirty = false; this.storageStatus = this.capacityReached ? 'full' : 'saved';
      return true;
    } catch { this.storageStatus = 'session'; return false; }
  }

  dispose() {
    if (this.disposed) return;
    this.save(); this.disposed = true;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide);
  }
}
