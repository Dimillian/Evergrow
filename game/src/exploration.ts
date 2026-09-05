export const EXPLORATION_CELL_SIZE = 48;
export const EXPLORATION_CHUNK_CELLS = 32;
export const EXPLORATION_CHUNK_SIZE = EXPLORATION_CELL_SIZE * EXPLORATION_CHUNK_CELLS;
const MAX_CHUNKS = 8192;
const MAX_POIS = 4096;
const MAX_COORDINATE = 48_000_000;
const MAX_SAVE_LENGTH = 3_500_000;
const POI_KINDS = ['town', 'blacksmith', 'merchant', 'inn', 'chapel', 'shrine', 'landmark'] as const;
export interface MapPOI {
  id: string; name: string; kind: typeof POI_KINDS[number]; x: number; y: number; description: string;
}
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
interface Chunk { x: number; y: number; words: Uint32Array; revision: number; }
interface Decoded { chunks: Chunk[]; pois: MapPOI[]; }

const coordinate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MAX_COORDINATE;
const boundedString = (s: unknown, length: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= length;
const key = (x: number, y: number) => `${x}:${y}`;
function population(value: number) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
function validPOI(value: unknown): value is MapPOI {
  if (!value || typeof value !== 'object') return false;
  const p = value as MapPOI;
  return boundedString(p.id, 120) && boundedString(p.name, 100) && boundedString(p.description, 600)
    && POI_KINDS.includes(p.kind) && coordinate(p.x) && coordinate(p.y);
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
    this.saveDelay = Math.max(100, Math.min(10_000, options.saveDelayMs ?? 1800));
    this.storageStatus = this.storage ? 'saved' : 'session';
    try {
      const saved = this.storage?.getItem(this.storageKey);
      if (saved && !this.restore(saved)) { this.protectSave = true; this.storageStatus = 'invalid'; }
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
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
    const chunk = this.chunks.get(key(cx, cy));
    if (!chunk) return false;
    const lx = x - cx * 32, ly = y - cy * 32;
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
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32), id = key(cx, cy);
    let chunk = this.chunks.get(id);
    if (!chunk) {
      if (this.chunks.size >= MAX_CHUNKS) { this.capacityReached = true; return false; }
      chunk = { x: cx, y: cy, words: new Uint32Array(32), revision: 0 };
      this.chunks.set(id, chunk);
    }
    const lx = x - cx * 32, ly = y - cy * 32, bit = 1 << lx;
    if ((chunk.words[ly] & bit) !== 0) return false;
    chunk.words[ly] = (chunk.words[ly] | bit) >>> 0;
    chunk.revision = ++this.revision;
    this.exploredCellCount++;
    return true;
  }

  /** Reveal the current view only; teleporting never reveals an untravelled connecting path. */
  reveal(x: number, y: number, radius = 260) {
    if (this.disposed || !coordinate(x) || !coordinate(y) || !Number.isFinite(radius) || radius < 0) return false;
    radius = Math.min(720, radius);
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
      if (this.pois.size >= MAX_POIS) { this.capacityReached = true; break; }
      this.pois.set(poi.id, { id: poi.id, name: poi.name, kind: poi.kind, x: poi.x, y: poi.y, description: poi.description });
      this.revision++; changed = true;
    }
    if (changed) this.markDirty();
    return changed;
  }

  getDiscoveredPOIs(bounds?: MapRect): MapPOI[] {
    const found: MapPOI[] = [];
    for (const p of this.pois.values()) if (!bounds || (p.x >= bounds.x && p.y >= bounds.y
      && p.x <= bounds.x + bounds.width && p.y <= bounds.y + bounds.height)) found.push(p);
    return found;
  }

  private markDirty() {
    this.dirty = true;
    if (this.storage && !this.protectSave && !this.capacityReached) this.storageStatus = 'pending';
    if (this.storage && this.timer === null) this.timer = setTimeout(() => { this.timer = null; this.save(); }, this.saveDelay);
  }

  serialize() {
    const chunks = [...this.chunks.values()].sort((a, b) => a.y - b.y || a.x - b.x)
      .map(c => [c.x, c.y, [...c.words].map(word => word.toString(36)).join('.')]);
    const pois = [...this.pois.values()].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ schema: 1, seed: this.world.seed, generation: this.generationVersion,
      cell: EXPLORATION_CELL_SIZE, chunks, pois });
  }

  private decode(raw: string): Decoded | null {
    if (raw.length > MAX_SAVE_LENGTH) return null;
    try {
      const data = JSON.parse(raw);
      if (!data || data.schema !== 1 || data.seed !== this.world.seed || data.generation !== this.generationVersion
        || data.cell !== EXPLORATION_CELL_SIZE || !Array.isArray(data.chunks) || data.chunks.length > MAX_CHUNKS
        || !Array.isArray(data.pois) || data.pois.length > MAX_POIS) return null;
      const chunks: Chunk[] = [], pois: MapPOI[] = [], ids = new Set<string>();
      for (const item of data.chunks) {
        if (!Array.isArray(item) || item.length !== 3 || !Number.isSafeInteger(item[0]) || !Number.isSafeInteger(item[1])
          || Math.abs(item[0]) > Math.ceil(MAX_COORDINATE / EXPLORATION_CHUNK_SIZE)
          || Math.abs(item[1]) > Math.ceil(MAX_COORDINATE / EXPLORATION_CHUNK_SIZE)
          || typeof item[2] !== 'string' || item[2].length > 255) return null;
        const id = key(item[0], item[1]); if (ids.has(id)) return null; ids.add(id);
        const words = item[2].split('.');
        if (words.length !== 32 || words.some((w: string) => !/^[0-9a-z]{1,7}$/.test(w) || parseInt(w, 36) > 0xffffffff)) return null;
        const bits = Uint32Array.from(words, (w: string) => parseInt(w, 36));
        if (!bits.some(n => n !== 0)) return null;
        chunks.push({ x: item[0], y: item[1], words: bits, revision: 0 });
      }
      ids.clear();
      for (const p of data.pois) {
        if (!validPOI(p) || ids.has(p.id)) return null;
        ids.add(p.id); pois.push({ id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y, description: p.description });
      }
      return { chunks, pois };
    } catch { return null; }
  }

  /** Validate the whole payload before merging; malformed saves cannot erase old regions. */
  restore(raw: string) {
    const decoded = this.decode(raw);
    if (!decoded) return false;
    const newChunks = decoded.chunks.filter(c => !this.chunks.has(key(c.x, c.y))).length;
    const newPOIs = decoded.pois.filter(p => !this.pois.has(p.id)).length;
    if (this.chunks.size + newChunks > MAX_CHUNKS || this.pois.size + newPOIs > MAX_POIS) return false;
    for (const incoming of decoded.chunks) {
      const id = key(incoming.x, incoming.y), existing = this.chunks.get(id);
      if (!existing) {
        incoming.revision = ++this.revision; this.chunks.set(id, incoming);
        for (const word of incoming.words) this.exploredCellCount += population(word);
      } else {
        let changed = false;
        for (let i = 0; i < 32; i++) {
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
    if (!this.dirty || !this.storage || this.protectSave) return false;
    try {
      // Preserve discoveries made by another local tab since this session loaded.
      const existing = this.storage.getItem(this.storageKey);
      if (existing && !this.restore(existing)) { this.protectSave = true; this.storageStatus = 'invalid'; return false; }
      const raw = this.serialize();
      if (raw.length > MAX_SAVE_LENGTH) { this.storageStatus = 'full'; return false; }
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
