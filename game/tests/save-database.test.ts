import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openSaveDatabase } from '../src/save-database.ts';
import { CharacterRepository, type CharacterRepositoryPort, type SaveResult, type SaveSlot } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { Simulation } from '../src/simulation.ts';
import { Exploration, type ChartResult, type ExplorationPersistence } from '../src/exploration.ts';
import { executeEvent } from '../src/poi-command.ts';
import type { EventSite } from '../src/poi-content.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
function port(db: ReturnType<typeof openSaveDatabase>): CharacterRepositoryPort {
  return {
    read: async index => await db.execute({ id: 1, method: 'read', index }) as SaveSlot,
    list: async () => await db.execute({ id: 1, method: 'list' }) as SaveSlot[],
    write: async (index, record, expected) => await db.execute({ id: 1, method: 'write', index, record, expected }) as SaveResult,
    remove: async (index, expected) => await db.execute({ id: 1, method: 'remove', index, expected }) as SaveResult,
  };
}
function chartPort(db: ReturnType<typeof openSaveDatabase>): ExplorationPersistence {
  return {
    readChart: async (key, seed, generation) => await db.execute({ id: 1, method: 'chart-read', key, seed, generation }) as ChartResult,
    writeChart: async (key, seed, generation, data) => await db.execute({ id: 1, method: 'chart-write', key, seed, generation, data: structuredClone(data) }) as ChartResult,
  };
}

test('IndexedDB compare-and-write is atomic between independent tabs, including deletion', async t => {
  const factory = new IDBFactory(), db = openSaveDatabase(factory), other = openSaveDatabase(factory);
  t.after(async () => { await db.close(); await other.close(); });
  const a = new CharacterSession(port(db), 4), b = new CharacterSession(port(other), 4), sim = new Simulation(world, { spawn: false });
  assert(await a.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'async-character', 1));
  assert(await b.load(0));
  const results = await Promise.all([a.save(sim.captureCheckpoint(), 2), b.save(sim.captureCheckpoint(), 3)]);
  assert.equal(results.filter(Boolean).length, 1, 'exactly one transaction owns the expected token');
  const saved = await port(db).read(0);
  assert(saved.record); assert(await port(db).remove(0, saved.token));
  assert.equal((await port(other).read(0)).state, 'empty');
  assert.equal(await a.save(sim.captureCheckpoint(), 4), false);
  assert.equal(await b.save(sim.captureCheckpoint(), 4), false);
});

test('queued checkpoints use the preceding committed token and preserve each isolated snapshot', async () => {
  const data = new Map<string, string>(), repo = new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } });
  const releases: Array<() => void> = [];
  let delayed = false;
  const session = new CharacterSession({ read: i => repo.read(i), list: () => repo.list(), remove: (i, token) => repo.remove(i, token),
    write: async (i, record, token) => { if (delayed) await new Promise<void>(resolve => releases.push(resolve)); return repo.write(i, record, token); } }, 4);
  const sim = new Simulation(world, { spawn: false });
  assert(await session.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'queued', 1)); delayed = true;
  sim.player.x = 100; const a = session.save(sim.captureCheckpoint(), 2);
  sim.player.x = 200; const b = session.save(sim.captureCheckpoint(), 3);
  sim.player.x = 300;
  await Promise.resolve(); assert.equal(releases.length, 1); assert.equal(repo.read(0).record!.checkpoint.x, 0);
  releases.shift()!(); assert(await a);
  await Promise.resolve(); releases.shift()!(); assert(await b);
  assert.equal(repo.read(0).record!.checkpoint.x, 200);
});

test('asynchronous reward commitment waits for storage and leaves live loot untouched when rejected', async () => {
  const sim = new Simulation(world, { spawn: false });
  const site: EventSite = { id: 'site:7319:test-1', kind: 'caravan', name: 'Caravan', x: 0, y: 30, seed: 7319, biome: 'deadwood', level: 1 };
  let release!: (result: { ok: boolean; message: string }) => void;
  const pending = executeEvent(sim, site, 'goods', () => new Promise(resolve => { release = resolve; }));
  assert.equal(sim.groundItems.length, 0); assert.equal(Object.keys(sim.eventState.sites).length, 0);
  release({ ok: false, message: 'quota' }); assert.equal((await pending).ok, false);
  assert.equal(sim.groundItems.length, 0); assert.equal(Object.keys(sim.eventState.sites).length, 0);
});

test('worker chart transactions union concurrent discoveries and preserve new cells revealed during a save', async t => {
  const db = openSaveDatabase(new IDBFactory()); t.after(() => db.close());
  const a = new Exploration(world, { persistence: chartPort(db) }), b = new Exploration(world, { persistence: chartPort(db) });
  t.after(() => { a.dispose(); b.dispose(); });
  await Promise.all([a.ready, b.ready]);
  a.reveal(0, 0); b.reveal(8000, 0);
  await Promise.all([a.save(), b.save()]);
  const pending = a.save(); a.reveal(0, 8000); await pending; assert(await a.save());
  const loaded = new Exploration(world, { persistence: chartPort(db) }); await loaded.ready; t.after(() => loaded.dispose());
  for (const [x, y] of [[0, 0], [8000, 0], [0, 8000]]) assert(loaded.isRevealed(x, y));
  assert.equal(await loaded.save(), false);
});

test('pending chart saves stay dirty when exploration changes after the worker snapshot', async t => {
  let release!: (result: ChartResult) => void;
  const chart = new Exploration(world, { persistence: { readChart: async () => ({ status: 'saved' }),
    writeChart: () => new Promise(resolve => { release = resolve; }) } });
  t.after(() => chart.dispose()); await chart.ready;
  chart.reveal(0, 0); const pending = chart.save(); await Promise.resolve();
  chart.reveal(8000, 0); release({ status: 'saved' }); assert(await pending);
  assert.equal(chart.storageStatus, 'pending');
  const final = chart.save(); await Promise.resolve(); release({ status: 'saved' }); assert(await final);
  assert.equal(chart.storageStatus, 'saved');
});
