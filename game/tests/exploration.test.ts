import test from 'node:test';
import assert from 'node:assert/strict';
import { Exploration, EXPLORATION_CELL_SIZE, EXPLORATION_CHUNK_SIZE } from '../src/exploration.ts';
import type { ExplorationStorage, ExplorationWorld, MapPOI } from '../src/exploration.ts';

class MemoryStorage implements ExplorationStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
}
function world(pois: MapPOI[] = [], seed = 7319, generationVersion = 2): ExplorationWorld {
  return { seed, generationVersion, getPOIs: (x, y, width, height) => pois.filter(p => p.x >= x && p.y >= y && p.x <= x + width && p.y <= y + height) };
}
const shrine: MapPOI = { id: 'shrine:near', kind: 'shrine', name: 'The Watchfire', x: 250, y: 0, description: 'A flame among the roots.' };

test('discovery reveals travelled circles and visible POIs, without connecting teleports', t => {
  const far = { ...shrine, id: 'shrine:far', x: 350 };
  const e = new Exploration(world([shrine, far]), { storage: null }); t.after(() => e.dispose());
  e.reveal(0, 0);
  assert.equal(e.isRevealed(0, 0), true);
  assert.equal(e.isRevealed(600, 0), false);
  assert.equal(e.isDiscovered(shrine.id), true, 'a POI inside radius reveals its boundary cell');
  assert.equal(e.isDiscovered(far.id), false);
  assert.deepEqual(e.getDiscoveredPOIs().map(p => p.name), ['The Watchfire']);
  e.reveal(10_000, 0);
  assert.equal(e.isRevealed(10_000, 0), true);
  assert.equal(e.isRevealed(5000, 0), false, 'untravelled space between positions stays fogged');
  assert.equal(e.isDiscovered(far.id), false, 'enumerating/map panning cannot discover a POI');
});

test('negative cells, bit31, and chunk borders round-trip without changing cell count', t => {
  const e = new Exploration(world(), { storage: null }), restored = new Exploration(world(), { storage: null });
  t.after(() => { e.dispose(); restored.dispose(); });
  const points = [[0, 0], [-1, -1], [31 * EXPLORATION_CELL_SIZE + 1, 0],
    [EXPLORATION_CHUNK_SIZE, 0], [-EXPLORATION_CHUNK_SIZE - 1, 5]];
  for (const [x, y] of points) e.reveal(x, y, 0);
  assert.equal(e.exploredCellCount, points.length);
  assert.ok(restored.restore(e.serialize()));
  for (const [x, y] of points) assert.equal(restored.isRevealed(x, y), true, `${x},${y}`);
  assert.equal(restored.exploredCellCount, e.exploredCellCount);
  assert.ok(restored.restore(e.serialize()));
  assert.equal(restored.exploredCellCount, e.exploredCellCount, 'merging identical bitsets is idempotent');
  assert.equal(restored.serialize(), e.serialize());
});

test('saved exploration is isolated by world seed and generation version', t => {
  const storage = new MemoryStorage();
  const a = new Exploration(world([shrine]), { storage }); a.reveal(0, 0); a.save();
  const same = new Exploration(world([shrine]), { storage });
  const otherSeed = new Exploration(world([], 44), { storage });
  const otherVersion = new Exploration(world([], 7319, 3), { storage });
  t.after(() => { a.dispose(); same.dispose(); otherSeed.dispose(); otherVersion.dispose(); });
  assert.ok(same.isDiscovered(shrine.id)); assert.ok(same.isRevealed(0, 0));
  assert.equal(otherSeed.isRevealed(0, 0), false); assert.equal(otherVersion.isRevealed(0, 0), false);
  assert.equal(otherSeed.restore(a.serialize()), false); assert.equal(otherVersion.restore(a.serialize()), false);
});

test('writes are batched and merge discoveries made by another session', t => {
  const storage = new MemoryStorage(), a = new Exploration(world(), { storage }), b = new Exploration(world(), { storage });
  t.after(() => { a.dispose(); b.dispose(); });
  for (let i = 0; i < 15; i++) a.reveal(i * 20, 0);
  assert.equal(storage.writes, 0, 'reveals do not synchronously write every frame');
  assert.ok(a.save()); assert.equal(storage.writes, 1);
  b.reveal(8000, 0); assert.ok(b.save());
  a.reveal(0, 8000); assert.ok(a.save());
  const loaded = new Exploration(world(), { storage }); t.after(() => loaded.dispose());
  for (const [x, y] of [[0, 0], [8000, 0], [0, 8000]]) assert.ok(loaded.isRevealed(x, y));
  assert.equal(a.save(), false, 'unchanged state does not write again');
});

test('malformed and oversized payloads are rejected atomically and old saves are protected', t => {
  const e = new Exploration(world(), { storage: null }); t.after(() => e.dispose()); e.reveal(0, 0);
  const before = e.serialize(), invalid = JSON.parse(before);
  invalid.chunks.push([0, 1, 'z'.repeat(300)]);
  assert.equal(e.restore(JSON.stringify(invalid)), false); assert.equal(e.serialize(), before);
  invalid.chunks = [[Number.MAX_SAFE_INTEGER, 0, '1.' + '0.'.repeat(30) + '0']];
  assert.equal(e.restore(JSON.stringify(invalid)), false);
  assert.equal(e.restore(' '.repeat(3_500_001)), false);
  const storage = new MemoryStorage(), key = e.storageKey;
  storage.values.set(key, '{unreadable');
  const protectedChart = new Exploration(world(), { storage }); t.after(() => protectedChart.dispose());
  protectedChart.reveal(5000, 0); assert.equal(protectedChart.save(), false);
  assert.equal(storage.getItem(key), '{unreadable'); assert.equal(protectedChart.storageStatus, 'invalid');
  assert.ok(protectedChart.isRevealed(5000, 0), 'new session discoveries stay in memory');
});

test('quota failures preserve previously saved regions and expose session-only status', t => {
  const storage = new MemoryStorage(), original = new Exploration(world(), { storage });
  original.reveal(0, 0); original.save(); const saved = storage.getItem(original.storageKey);
  const failing: ExplorationStorage = { getItem: key => storage.getItem(key), setItem: () => { throw new Error('QuotaExceeded'); } };
  const current = new Exploration(world(), { storage: failing }); t.after(() => { original.dispose(); current.dispose(); });
  current.reveal(10_000, 0); assert.equal(current.save(), false);
  assert.equal(storage.getItem(original.storageKey), saved);
  assert.ok(current.isRevealed(0, 0)); assert.ok(current.isRevealed(10_000, 0));
  assert.equal(current.storageStatus, 'session'); assert.match(current.persistenceMessage, /session/);
});

test('invalid reveal coordinates and extreme radius cannot cause unbounded work', t => {
  const e = new Exploration(world(), { storage: null }); t.after(() => e.dispose());
  for (const [x, y, radius] of [[NaN, 0, 260], [Infinity, 0, 260], [1e20, 0, 260], [0, 0, -1], [0, 0, NaN]])
    assert.equal(e.reveal(x, y, radius), false);
  assert.equal(e.exploredCellCount, 0);
  e.reveal(0, 0, Number.MAX_VALUE);
  assert.ok(e.exploredCellCount > 0 && e.exploredCellCount < 1000);
  assert.equal(e.isRevealed(1000, 0), false);
});

test('reaching exploration capacity preserves old areas instead of silently evicting them', t => {
  const e = new Exploration(world(), { storage: null }); t.after(() => e.dispose());
  const payload = JSON.parse(e.serialize());
  payload.chunks = Array.from({ length: 8192 }, (_, x) => [x, 0, '1.' + '0.'.repeat(30) + '0']);
  assert.ok(e.restore(JSON.stringify(payload)));
  assert.ok(e.isRevealed(0, 0));
  e.reveal(EXPLORATION_CHUNK_SIZE * 9000, 0, 0);
  assert.ok(e.isRevealed(0, 0));
  assert.equal(e.isRevealed(EXPLORATION_CHUNK_SIZE * 9000, 0), false);
  assert.equal(JSON.parse(e.serialize()).chunks.length, 8192);
  assert.match(e.persistenceMessage, /full.*preserved/);
});

test('discovery notifications fire once on reveal, never on restoration or revisiting', t => {
  const storage = new MemoryStorage(), found: MapPOI[] = [];
  const first = new Exploration(world([shrine]), { storage, onDiscover: poi => { found.push(poi); poi.name = 'Changed by consumer'; } });
  t.after(() => first.dispose()); first.reveal(0, 0); first.reveal(100, 0); first.save();
  assert.equal(found.length, 1);
  assert.equal(first.getDiscoveredPOIs()[0].name, shrine.name, 'notification snapshots do not mutate the chart');
  const restored = new Exploration(world([shrine]), { storage, onDiscover: poi => found.push(poi) });
  t.after(() => restored.dispose()); restored.reveal(0, 0);
  assert.equal(found.length, 1, 'continuing the character does not replay discoveries');
  const other = new Exploration(world([shrine]), { storage, characterId: 'other', onDiscover: poi => found.push(poi) });
  t.after(() => other.dispose()); other.reveal(0, 0);
  assert.equal(found.length, 2, 'a different character discovers independently');
});
