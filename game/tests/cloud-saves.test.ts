import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { cloudAPI, type CloudEnv } from '../server/worker.ts';
import { backfillGearPower, savedGearPower } from '../server/leaderboard-backfill.ts';
import { equippedGearPower } from '../src/leaderboard.ts';
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
  const record: CharacterSave = { version: 4, id: 'cloud-test', name: 'Rowan', createdAt: 1, updatedAt: 1,
    worldSeed: 7319, worldVersion: WORLD_GENERATION_VERSION, checkpoint: sim.captureCheckpoint() };
  return makeSaveBundle(record, { chunks: [{ x: 0, y: 0, revision: 1, words: Uint32Array.from({ length: 32 }, (_, i) => i === 0 ? 15 : 0) }], pois: [] });
}
function server() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../drizzle/0000_conscious_kingpin.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../../drizzle/0001_worthless_slipstream.sql', import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../../drizzle/0002_amazing_old_lace.sql', import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../../drizzle/0003_blue_mercury.sql', import.meta.url),'utf8'));
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
  return { db, blobs, env, request, uncertainCommit: () => { uncertainCommit = true; }, failPut: (v: boolean) => { failPut = v; }, failCommit: (v: boolean) => { failCommit = v; } };
}
const write = (bundle: ReturnType<typeof fixture> | null, expected = 0, operation = crypto.randomUUID()) => ({ bundle, expected, operation });

function legacy(s:ReturnType<typeof server>,owner:string,bundle=fixture()) {
  const key=`${owner}/old.json`, raw=JSON.stringify(bundle);
  s.blobs.set(key,raw);
  s.db.prepare(`INSERT INTO characters(owner,slot,revision,object,summary,operation,digest,updated_at,rank_name,rank_level)
    VALUES(?,0,7,?,?,'old-operation','old-digest',42,?,?)`).run(owner,key,JSON.stringify({name:bundle.character.name,power:999}),bundle.character.name,bundle.character.checkpoint.level);
  return {key,raw};
}
test('existing gear is backfilled in bounded batches without rewriting saves or requiring their owner',async t=>{
  const s=server();t.after(()=>s.db.close());const bundle=fixture();
  const expected=equippedGearPower(bundle.character.checkpoint.character);
  for(let i=0;i<11;i++)legacy(s,`owner-${i}`,bundle);
  const before=s.db.prepare('SELECT revision,object,summary,operation,digest,updated_at FROM characters ORDER BY owner').all();
  const blobs=[...s.blobs];
  const first=await(await s.request(null,'leaderboard')).json();
  assert.equal(first.updating,true);assert.equal(first.entries.filter((r:any)=>r.gearPower!==null).length,8);
  const second=await(await s.request(null,'leaderboard?order=gear')).json();
  assert.equal(second.updating,false);assert(second.entries.every((r:any)=>r.gearPower===expected));
  assert.deepEqual(s.db.prepare('SELECT revision,object,summary,operation,digest,updated_at FROM characters ORDER BY owner').all(),before);
  assert.deepEqual([...s.blobs],blobs);
  s.env.SAVES.get=async()=>{assert.fail('Completed scores must not read save objects again');};
  assert.equal((await s.request(null,'leaderboard')).status,200);
});
test('gear projection tolerates historical world/chart data but rejects damaged equipment',()=>{
  const bundle=fixture();bundle.character.worldVersion=-1;bundle.chart='historical chart';
  assert.equal(savedGearPower(JSON.stringify(bundle)),equippedGearPower(bundle.character.checkpoint.character));
  delete (bundle.character.checkpoint.character.equipped as any).weapon;
  assert.equal(savedGearPower(JSON.stringify(bundle)),null);
  assert.equal(savedGearPower('{bad json'),null);
});
test('unavailable backfill objects retry later without blocking other characters',async t=>{
  const s=server();t.after(()=>s.db.close());const old=legacy(s,'A');legacy(s,'B');s.blobs.delete(old.key);
  assert.equal(await backfillGearPower(s.env,1000000),false);
  assert.equal(s.db.prepare('SELECT rank_gear FROM characters WHERE owner=?').get('A')!.rank_gear,null);
  s.blobs.set(old.key,old.raw);
  await backfillGearPower(s.env,1000001);
  assert.equal(s.db.prepare('SELECT rank_gear FROM characters WHERE owner=?').get('A')!.rank_gear,null);
  await backfillGearPower(s.env,1300001);
  assert.equal(s.db.prepare('SELECT rank_gear FROM characters WHERE owner=?').get('A')!.rank_gear,savedGearPower(old.raw));
});
test('backfill cannot overwrite a newer save or resurrect a deleted ranking',async t=>{
  const s=server();t.after(()=>s.db.close());legacy(s,'A');legacy(s,'B');
  const get=s.env.SAVES.get;
  s.env.SAVES.get=async key=>{
    if(key.startsWith('A/'))s.db.prepare("UPDATE characters SET revision=8,object='new',rank_gear=999 WHERE owner='A'").run();
    else s.db.prepare("UPDATE characters SET revision=8,object=NULL,rank_gear=NULL,rank_name=NULL WHERE owner='B'").run();
    return get(key);
  };
  await backfillGearPower(s.env);
  const result=await(await s.request(null,'leaderboard')).json();
  assert.equal(result.total,1);assert.equal(result.entries[0].gearPower,999);
});

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
  const s = server(); t.after(() => s.db.close()); const candidates = [write(fixture()),write(fixture())];
  const results = await Promise.all(candidates.map(candidate=>s.request('A','characters/0',candidate)));
  const initial=candidates[results.findIndex(r=>r.status===200)];
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

test('Chronicle follows accepted cloud checkpoints, retains deletion and isolates accounts',async t=>{
 const s=server();t.after(()=>s.db.close());const bundle=fixture();bundle.character.checkpoint.chronicle!.sources[0].values.kills=100;
 const first=write(bundle);assert.equal((await s.request('A','characters/0',first)).status,200);
 const chronicle=await(await s.request('A','chronicle')).json();assert.equal(Object.values(chronicle.sources).reduce((n:number,r:any)=>n+(r.values.kills??0),0),100);
 bundle.character.checkpoint.chronicle!.sources[0].values.kills=1000;
 assert.equal((await s.request('A','characters/0',write(bundle,0))).status,409);
 assert.equal((await s.request('A','characters/0',write(null,1))).status,200);
 const deleted=await(await s.request('A','chronicle')).json();assert.equal(deleted.characters['cloud-test'].deleted,true);assert.equal(Object.values(deleted.sources).reduce((n:number,r:any)=>n+(r.values.kills??0),0),100);
 assert.deepEqual((await(await s.request('B','chronicle')).json()).sources,{});
});

test('leaderboard includes every cloud character and exposes no account identity or save data', async t => {
  const s=server();t.after(()=>s.db.close());
  for(const [owner,slot,name] of [['private-A',0,'Rowan'],['private-A',1,'Isolde'],['private-B',0,'Ash']] as const){
    const bundle=fixture();bundle.character.name=name;
    assert.equal((await s.request(owner,`characters/${slot}`,write(bundle))).status,200);
  }
  const publicRanks=await(await s.request(null,'leaderboard')).json();
  assert.equal(publicRanks.total,3);assert.equal(publicRanks.entries.length,3);assert.deepEqual(publicRanks.own,[]);
  assert.deepEqual(publicRanks.entries.map((r:any)=>r.name).sort(),['Ash','Isolde','Rowan']);
  for(const r of publicRanks.entries)assert.deepEqual(Object.keys(r).sort(),['gearPower','level','mine','name','rank','updatedAt']);
  assert(!JSON.stringify(publicRanks).includes('private-'));
  const mine=await(await s.request('private-A','leaderboard')).json();assert.equal(mine.own.length,2);assert.equal(mine.entries.filter((r:any)=>r.mine).length,2);
  assert.equal((await s.request('private-A','leaderboard',undefined,{'X-Evergrow-Account':'private-B'})).status,401);
  assert.equal((await s.request(null,'leaderboard?order=invalid')).status,400);
  assert.equal((await s.request('private-A','characters/1',write(null,1))).status,200);
  assert.equal((await(await s.request(null,'leaderboard')).json()).total,2);
});
test('rankings sort characters by level or gear and retain every owned character beyond top 100', async t=>{
  const s=server();t.after(()=>s.db.close());
  for(let i=0;i<105;i++)s.db.prepare("INSERT INTO characters(owner,slot,revision,object,rank_name,rank_level,rank_gear,updated_at,operation,digest) VALUES(?,0,1,?,?,?,?,1,'test','test')").run('account-'+i,'blob-'+i,'Hero '+i,105-i,i);
  s.db.prepare("INSERT INTO characters(owner,slot,revision,object,rank_name,rank_level,rank_gear,updated_at,operation,digest) VALUES(?,1,1,?,?,?,?,1,'test','test')").run('account-104','blob-extra','Another hero',1,1);
  const level=await(await s.request('account-104','leaderboard')).json();
  assert.equal(level.total,106);assert.equal(level.entries.length,100);assert.equal(level.own.length,2);assert(level.own.every((r:any)=>r.rank>100));
  assert.equal(level.entries[0].name,'Hero 0');
  const gear=await(await s.request(null,'leaderboard?order=gear')).json();assert.equal(gear.entries[0].name,'Hero 104');
});
test('failed or stale writes cannot publish leaderboard changes', async t=>{
  const s=server();t.after(()=>s.db.close());await s.request('A','characters/0',write(fixture()));
  const changed=fixture();changed.character.name='Changed';s.failPut(true);
  await assert.rejects(s.request('A','characters/0',write(changed,1)));s.failPut(false);
  assert.equal((await s.request('A','characters/0',write(changed,0))).status,409);
  assert.equal((await(await s.request(null,'leaderboard')).json()).entries[0].name,'Rowan');
});
test('ranking migration includes existing cloud character names and levels without confusing build power with gear power',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec(readFileSync(new URL('../../drizzle/0000_conscious_kingpin.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO characters(owner,slot,revision,object,summary,updated_at,operation,digest) VALUES ('private',0,1,'blob','{\"name\":\"Rowan\",\"level\":12,\"power\":999}',1,'test','test')");
 db.exec(readFileSync(new URL('../../drizzle/0002_amazing_old_lace.sql',import.meta.url),'utf8'));
 const row=db.prepare('SELECT rank_name,rank_level,rank_gear FROM characters').get()!;assert.equal(row.rank_name,'Rowan');assert.equal(row.rank_level,12);assert.equal(row.rank_gear,null);
 }finally{db.close();}
});

test('generation-9 uploads can finish across deployment before the same character upgrades to generation 10',async t=>{
 const s=server();t.after(()=>s.db.close());const bundle=fixture();bundle.character.worldVersion=9;
 const oldChart=bundleChart(fixture());const old=makeSaveBundle(bundle.character,oldChart);
 assert.equal((await s.request('upgrade-owner','characters/0',write(old))).status,200);
 const {upgradeWorldSave,upgradeWorldChart}=await import('../src/world-save-upgrade.ts');
 const {World}=await import('../src/world.ts');
 const next=makeSaveBundle(upgradeWorldSave(old.character,10,seed=>new World(seed)),upgradeWorldChart(oldChart,old.character.worldSeed));
 assert.equal((await s.request('upgrade-owner','characters/0',write(next,1))).status,200);
 const saved=await (await s.request('upgrade-owner')).json() as {bundle:typeof next};assert.equal(saved.bundle.character.worldVersion,10);
 assert.deepEqual(bundleChart(saved.bundle).chunks,bundleChart(old).chunks);
 const unsupported=fixture();unsupported.character.worldVersion=8;const bad=makeSaveBundle(unsupported.character,oldChart);
 assert.equal((await s.request('unsupported-owner','characters/0',write(bad))).status,422);
});
