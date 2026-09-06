import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { cloudAPI, type CloudEnv } from '../server/worker.ts';
import { openCloudCache, type CloudRow } from '../src/cloud-cache.ts';
import { makeSaveBundle, decodeSaveBundle, bundleChart, chartKey } from '../src/save-bundle.ts';
import { openSaveDatabase } from '../src/save-database.ts';
import { Simulation } from '../src/simulation.ts';
import type { CharacterSave } from '../src/character-save.ts';
import type { SaveResult, SaveSlot } from '../src/character-storage.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
function fixture() {
  const sim = new Simulation(world, { spawn: false });
  const record: CharacterSave = { version: 3, id: 'cloud-test', name: 'Rowan', createdAt: 1, updatedAt: 1,
    worldSeed: 7319, worldVersion: WORLD_GENERATION_VERSION, checkpoint: sim.captureCheckpoint() };
  return makeSaveBundle(record, { chunks: [{ x: 0, y: 0, revision: 1, words: Uint32Array.from({ length: 32 }, (_, i) => i === 0 ? 15 : 0) }], pois: [] });
}
function server() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../drizzle/0000_conscious_kingpin.sql', import.meta.url), 'utf8'));
  const blobs = new Map<string, string>(); let failPut = false, failCommit = false, uncertainCommit = false;
  const env: CloudEnv = {
    DB: { prepare(sql) {
      let values: unknown[] = [];
      return { bind(...v) { values = v; return this; },
        async first<T>() { return (db.prepare(sql).get(...values as never[]) ?? null) as T | null; },
        async all<T>() { return { results: db.prepare(sql).all(...values as never[]) as T[] }; },
        async run() { if (failCommit) throw new Error('D1 unavailable'); const changes = Number(db.prepare(sql).run(...values as never[]).changes); if (uncertainCommit) throw new Error('Response lost'); return { meta: { changes } }; },
      };
    } },
    SAVES: { async get(key) { const value = blobs.get(key); return value === undefined ? null : { text: async () => value }; },
      async put(key, value) { if (failPut) throw new Error('R2 unavailable'); blobs.set(key, value); }, async delete(key) { blobs.delete(key); } },
    ASSETS: { fetch: async () => new Response('game') },
  };
  const request = (owner: string | null, path = 'characters/0', body?: unknown, headers: Record<string, string> = {}) => cloudAPI(new Request('https://evergrow.test/api/cloud/' + path, {
    method: body === undefined ? 'GET' : 'PUT', headers: { ...(owner ? { 'oai-authenticated-user-id': owner, 'X-Evergrow-Account': owner } : {}), Origin: 'https://evergrow.test', 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { db, blobs, request, uncertainCommit: () => { uncertainCommit = true; }, failPut: (v: boolean) => { failPut = v; }, failCommit: (v: boolean) => { failCommit = v; } };
}
const write = (bundle: ReturnType<typeof fixture> | null, expected = 0, operation = crypto.randomUUID()) => ({ bundle, expected, operation });

test('portable saves retain the character and exact chart, rejecting corruption and mismatched worlds', () => {
  const bundle = fixture(), loaded = decodeSaveBundle(JSON.stringify(bundle)); assert(loaded);
  assert.equal(bundleChart(loaded).chunks[0].words[0], 15);
  assert.equal(decodeSaveBundle(JSON.stringify({ ...bundle, chart: bundle.chart.replace('7319', '7320') })), null);
  bundle.character.checkpoint.character.gold = -1; assert.equal(decodeSaveBundle(JSON.stringify(bundle)), null);
});
test('public capabilities are optional, private saves require identity and matching account', async t => {
  const s = server(); t.after(() => s.db.close());
  assert.deepEqual(await (await s.request(null, 'session')).json(), { supported: true, user: null });
  assert.equal((await s.request(null)).status, 401);
  assert.equal((await s.request('A', 'characters', undefined, { 'X-Evergrow-Account': 'B' })).status, 401);
  assert.equal((await s.request('A', 'characters/0', write(fixture()), { Origin: 'https://evil.test' })).status, 403);
});
test('two users have independent eight-slot rosters and owned blobs', async t => {
  const s = server(); t.after(() => s.db.close());
  assert.equal((await s.request('A', 'characters/0', write(fixture()))).status, 200);
  const a = await (await s.request('A')).json(), b = await (await s.request('B')).json();
  assert.equal(a.bundle.character.name, 'Rowan'); assert.equal(b.bundle, null);
  const roster = await (await s.request('A', 'characters')).json(); assert.equal(roster.slots.length, 8); assert.equal(roster.slots[0].summary.level, 1); assert.equal(roster.slots[0].bundle, undefined);
  assert.equal((await s.request('A', 'characters/8', write(fixture()))).status, 404);
});
test('concurrent device writes commit once; retries are idempotent and stale saves cannot resurrect deletes', async t => {
  const s = server(); t.after(() => s.db.close()); const initial = write(fixture());
  const results = await Promise.all([s.request('A', 'characters/0', initial), s.request('A', 'characters/0', write(fixture()))]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await s.request('A', 'characters/0', initial)).status, 200); assert.equal(s.blobs.size, 1);
  assert.equal((await s.request('A', 'characters/0', { ...initial, bundle: null })).status, 409);
  assert.equal((await s.request('A', 'characters/0', write(null, 1))).status, 200);
  assert.equal((await s.request('A', 'characters/0', write(fixture(), 1))).status, 409);
  assert.deepEqual(await (await s.request('A')).json(), { revision: 2, bundle: null });
});
test('failed blob and pointer commits preserve the last acknowledged checkpoint', async t => {
  const s = server(); t.after(() => s.db.close()); await s.request('A', 'characters/0', write(fixture()));
  s.failPut(true); await assert.rejects(s.request('A', 'characters/0', write(fixture(), 1))); s.failPut(false);
  s.failCommit(true); await assert.rejects(s.request('A', 'characters/0', write(fixture(), 1))); s.failCommit(false);
  assert.equal((await (await s.request('A')).json()).revision, 1); assert.equal(s.blobs.size, 1);
});
test('server rejects invalid points and chart identities without publishing', async t => {
  const s = server(); t.after(() => s.db.close()); const bundle = fixture(); bundle.character.checkpoint.character.skillPoints = 99;
  assert.equal((await s.request('A', 'characters/0', write(bundle))).status, 422);
  assert.equal(s.blobs.size, 0);
});
test('durable outbox retains an in-flight operation across new saves and browser restarts', async t => {
  const f = new IDBFactory(), cache = openCloudCache(f, 'A'); t.after(() => cache.close());
  const a = await cache.execute({ kind: 'write', index: 0, expected: null, bundle: fixture(), operation: 'operation-A' }) as CloudRow;
  await cache.execute({ kind: 'upload', index: 0 });
  const newer = fixture(); newer.character.updatedAt = 2;
  const b = await cache.execute({ kind: 'write', index: 0, expected: a.token, bundle: newer, operation: 'operation-B' }) as CloudRow;
  assert.equal(b.upload?.operation, 'operation-A'); assert.equal(b.upload?.bundle?.character.updatedAt, 1);
  const reopened = openCloudCache(f, 'A'); t.after(() => reopened.close());
  const retained = await reopened.execute({ kind: 'read', index: 0 }) as CloudRow; assert.equal(retained.upload?.operation, 'operation-A');
  const ack = await reopened.execute({ kind: 'ack', index: 0, base: 0, operation: 'operation-A', revision: 1 }) as CloudRow;
  assert.equal(ack.base, 1); assert.equal(ack.dirty, true); assert.equal(ack.bundle?.character.updatedAt, 2); assert.equal(ack.token, b.token);
  const next = await cache.execute({ kind: 'upload', index: 0 }) as CloudRow; assert.equal(next.upload?.base, 1); assert.equal(next.upload?.operation, 'operation-B');
});
test('outbox refuses stale tabs, preserves conflicts and only explicitly replaces a matching recovery', async t => {
  const f = new IDBFactory(), a = openCloudCache(f, 'A'), b = openCloudCache(f, 'A'), other = openCloudCache(f, 'B');
  t.after(async () => { await a.close(); await b.close(); await other.close(); });
  const saved = await a.execute({ kind: 'write', index: 0, expected: null, bundle: fixture(), operation: 'first' }) as CloudRow;
  assert.equal(await b.execute({ kind: 'write', index: 0, expected: null, bundle: fixture(), operation: 'stale' }), null);
  assert.deepEqual(await other.execute({ kind: 'list' }), []);
  await a.execute({ kind: 'conflict', index: 0, base: 0 });
  assert.equal(await a.execute({ kind: 'adopt', index: 0, expected: saved.token, bundle: null, base: 2 }), null);
  assert.equal(await a.execute({ kind: 'resolve', index: 0, expected: 'wrong', bundle: null, base: 2 }), null);
  const resolved = await a.execute({ kind: 'resolve', index: 0, expected: saved.token, bundle: null, base: 2 }) as CloudRow;
  assert.equal(resolved.dirty, false); assert.equal(resolved.conflict, false); assert.equal(resolved.bundle, null);
});
test('local import commits chart and character together into an empty slot and round-trips export', async t => {
  const db = openSaveDatabase(new IDBFactory()); t.after(() => db.close());
  const raw = JSON.stringify(fixture());
  const imported = await db.execute({ id: 1, method: 'import', index: 0, expected: null, raw }) as SaveResult; assert(imported.ok);
  const slot = await db.execute({ id: 1, method: 'read', index: 0 }) as SaveSlot; assert(slot.record); assert.notEqual(slot.record.id, 'cloud-test');
  const exported = decodeSaveBundle(await db.execute({ id: 1, method: 'export', index: 0 }) as string); assert(exported);
  assert.equal(bundleChart(exported).chunks[0].words[0], 15); assert.equal(chartKey(exported.character), chartKey(slot.record));
  const overwrite = await db.execute({ id: 1, method: 'import', index: 0, expected: slot.token, raw }) as SaveResult; assert.equal(overwrite.ok, false);
  const bad = fixture(); bad.chart = '{}';
  assert.equal((await db.execute({ id: 1, method: 'import', index: 1, expected: null, raw: JSON.stringify(bad) }) as SaveResult).ok, false);
  assert.equal((await db.execute({ id: 1, method: 'read', index: 1 }) as SaveSlot).state, 'empty');
});

test('an uncertain acknowledgement cannot delete a blob already published by D1', async t => {
  const s = server(); t.after(() => s.db.close()); s.uncertainCommit();
  const response = await s.request('A', 'characters/0', write(fixture()));
  assert.equal(response.status, 200); assert.equal(s.blobs.size, 1);
  assert.equal((await (await s.request('A')).json()).bundle.character.name, 'Rowan');
});
