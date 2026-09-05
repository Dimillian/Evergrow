import assert from 'node:assert/strict';
import test from 'node:test';
import { Exploration, EXPLORATION_CHUNK_SIZE, EXPLORATION_LIMITS } from '../src/exploration.ts';
import type { ExplorationStorage, ExplorationWorld, MapPOI } from '../src/exploration.ts';
import { decodeExploration } from '../src/exploration-save.ts';

class MemoryStorage implements ExplorationStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
}
const world = (pois: MapPOI[] = []): ExplorationWorld => ({ seed: 7319, generationVersion: 3, getPOIs: () => pois });

test('discovery at every supported coordinate boundary produces a reloadable chart', t => {
  const chart = new Exploration(world(), { storage: null });
  const restored = new Exploration(world(), { storage: null });
  t.after(() => { chart.dispose(); restored.dispose(); });
  const extent = EXPLORATION_LIMITS.coordinate;
  for (const [x, y] of [[-extent, -extent], [-extent, extent], [extent, -extent], [extent, extent]]) {
    chart.reveal(x, y, EXPLORATION_LIMITS.revealRadius);
    assert.equal(chart.isRevealed(x, y), true);
  }
  assert.ok(restored.restore(chart.serialize()), 'edge circles must not emit chunks beyond the save codec domain');
  assert.equal(restored.exploredCellCount, chart.exploredCellCount);
  assert.equal(restored.serialize(), chart.serialize());
  assert.equal(restored.isRevealed(-extent - 1, 0), false);
});

test('a valid cross-session chart that exceeds combined capacity is preserved and reported as full', t => {
  const storage = new MemoryStorage(), chart = new Exploration(world(), { storage });
  t.after(() => chart.dispose());
  const localX = 9000 * EXPLORATION_CHUNK_SIZE;
  chart.reveal(localX, 0, 0);
  const remote = JSON.parse(chart.serialize());
  remote.chunks = Array.from({ length: EXPLORATION_LIMITS.chunks }, (_, x) => [x, 0, '1.' + '0.'.repeat(30) + '0']);
  const raw = JSON.stringify(remote);
  assert.ok(decodeExploration(raw, { seed: 7319, generation: '3' }));
  storage.values.set(chart.storageKey, raw);
  const before = chart.serialize();
  assert.equal(chart.save(), false);
  assert.equal(chart.storageStatus, 'full');
  assert.match(chart.persistenceMessage, /full.*preserved/);
  assert.equal(storage.getItem(chart.storageKey), raw);
  assert.equal(chart.serialize(), before, 'an overflowing merge must remain atomic');
  assert.equal(chart.isRevealed(localX, 0), true);
  assert.equal(storage.writes, 0);
  // A capacity failure must not permanently mark the stored format as corrupt.
  remote.chunks = remote.chunks.slice(0, 1); storage.values.set(chart.storageKey, JSON.stringify(remote));
  assert.equal(chart.save(), true);
  assert.equal(chart.storageStatus, 'saved');
  assert.equal(chart.isRevealed(0, 0), true);
});

test('map consumers cannot mutate retained POI records or corrupt the next save', t => {
  const poi: MapPOI = { id: 'shrine:origin', kind: 'shrine', name: 'Wayfarer Shrine', description: 'A lantern.', x: 0, y: 0 };
  const chart = new Exploration(world([poi]), { storage: null }); t.after(() => chart.dispose());
  chart.reveal(0, 0);
  const before = chart.serialize(), result = chart.getDiscoveredPOIs();
  result[0].x = Infinity; result[0].name = ''; result.length = 0;
  poi.description = 'Changed by a world adapter';
  assert.equal(chart.serialize(), before);
  assert.equal(chart.getDiscoveredPOIs()[0].name, 'Wayfarer Shrine');
});

test('empty or newly corrupted stored charts are protected instead of treated as missing saves', t => {
  const storage = new MemoryStorage(), first = new Exploration(world(), { storage });
  storage.values.set(first.storageKey, '');
  const loaded = new Exploration(world(), { storage });
  t.after(() => { first.dispose(); loaded.dispose(); });
  assert.equal(loaded.storageStatus, 'invalid');
  loaded.reveal(0, 0); assert.equal(loaded.save(), false);
  first.reveal(3000, 0); assert.equal(first.save(), false);
  assert.equal(first.storageStatus, 'invalid', 'a corrupt write from another session must also be protected');
  assert.equal(storage.getItem(first.storageKey), ''); assert.equal(storage.writes, 0);
});

test('invalid debounce configuration falls back to a bounded delay and disposal flushes only once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new MemoryStorage(), chart = new Exploration(world(), { storage, saveDelayMs: NaN });
  t.after(() => chart.dispose());
  chart.reveal(0, 0, 0);
  t.mock.timers.tick(1799); assert.equal(storage.writes, 0);
  t.mock.timers.tick(1); assert.equal(storage.writes, 1);
  chart.reveal(3000, 0, 0); chart.dispose(); assert.equal(storage.writes, 2);
  t.mock.timers.tick(10_000); chart.dispose(); chart.save();
  assert.equal(storage.writes, 2);
  assert.equal(chart.reveal(6000, 0, 0), false);
  assert.equal(chart.restore(chart.serialize()), false, 'disposed discovery objects cannot acquire new state');
});
