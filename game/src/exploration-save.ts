import { isPOIKind, type WorldPOI } from './world-pois.ts';

export const EXPLORATION_CELL_SIZE = 48;
export const EXPLORATION_CHUNK_CELLS = 32;
export const EXPLORATION_CHUNK_SIZE = EXPLORATION_CELL_SIZE * EXPLORATION_CHUNK_CELLS;
export const EXPLORATION_LIMITS = Object.freeze({
  chunks: 8192, pois: 4096, coordinate: 48_000_000, saveLength: 3_500_000, revealRadius: 1000,
});
export interface ExplorationIdentity { seed: number; generation: string; }
export interface ExplorationChunk { x: number; y: number; words: Uint32Array; revision: number; }
export interface DecodedExploration { chunks: ExplorationChunk[]; pois: WorldPOI[]; }

export const validExplorationCoordinate = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= EXPLORATION_LIMITS.coordinate;
const boundedString = (s: unknown, length: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= length;
export const explorationChunkKey = (x: number, y: number) => `${x}:${y}`;

export function validExplorationPOI(value: unknown): value is WorldPOI {
  if (!value || typeof value !== 'object') return false;
  const p = value as WorldPOI;
  return (p.sighted === undefined || typeof p.sighted === 'boolean') && boundedString(p.id, 120) && boundedString(p.name, 100) && boundedString(p.description, 600)
    && isPOIKind(p.kind) && validExplorationCoordinate(p.x) && validExplorationCoordinate(p.y);
}

/** Decode transactionally. Nothing in the live chart changes until every record passes. */
export function decodeExploration(raw: string, identity: ExplorationIdentity): DecodedExploration | null {
  if (typeof raw !== 'string' || raw.length > EXPLORATION_LIMITS.saveLength) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.schema !== 1 || data.seed !== identity.seed || data.generation !== identity.generation
      || data.cell !== EXPLORATION_CELL_SIZE || !Array.isArray(data.chunks) || data.chunks.length > EXPLORATION_LIMITS.chunks
      || !Array.isArray(data.pois) || data.pois.length > EXPLORATION_LIMITS.pois) return null;
    const chunks: ExplorationChunk[] = [], pois: WorldPOI[] = [], ids = new Set<string>();
    const maxChunk = Math.ceil(EXPLORATION_LIMITS.coordinate / EXPLORATION_CHUNK_SIZE);
    for (const item of data.chunks) {
      if (!Array.isArray(item) || item.length !== 3 || !Number.isSafeInteger(item[0]) || !Number.isSafeInteger(item[1])
        || Math.abs(item[0]) > maxChunk || Math.abs(item[1]) > maxChunk
        || typeof item[2] !== 'string' || item[2].length > 255) return null;
      const id = explorationChunkKey(item[0], item[1]); if (ids.has(id)) return null; ids.add(id);
      const words = item[2].split('.');
      if (words.length !== EXPLORATION_CHUNK_CELLS
        || words.some((w: string) => !/^[0-9a-z]{1,7}$/.test(w) || parseInt(w, 36) > 0xffffffff)) return null;
      const bits = Uint32Array.from(words, (w: string) => parseInt(w, 36));
      if (!bits.some(n => n !== 0)) return null;
      chunks.push({ x: item[0], y: item[1], words: bits, revision: 0 });
    }
    ids.clear();
    for (const p of data.pois) {
      if (!validExplorationPOI(p) || ids.has(p.id)) return null;
      ids.add(p.id); pois.push({ id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y, description: p.description });
    }
    return { chunks, pois };
  } catch { return null; }
}
