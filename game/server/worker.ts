import { canLoadWorld } from '../src/world-save-upgrade.ts';
import { leaderboardAPI } from './leaderboard.ts';
import { equippedGearPower } from '../src/leaderboard.ts';
import { parseChronicleLedger, mergeChronicles, recordChronicle } from '../src/chronicle.ts';
import { decodeSaveBundle, SAVE_BUNDLE_LIMIT } from '../src/save-bundle.ts';
import { characterPower, previewCharacter } from '../src/character-summary.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
interface Row { chronicle?: string | null; owner: string; slot: number; revision: number; object: string | null; previous: string | null; summary: string | null; operation: string; digest: string; }
interface Statement { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }>; }
export interface CloudEnv {
  DB: { prepare(sql: string): Statement };
  SAVES: { get(key: string): Promise<{ text(): Promise<string> } | null>; put(key: string, body: string): Promise<unknown>; delete(key: string): Promise<unknown> };
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
class BackendFailure extends Error {
  stage: string;
  constructor(stage: string) { super('Cloud backend request failed.'); this.stage = stage; }
}
async function backend<T>(stage: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch { throw new BackendFailure(stage); }
}
async function boundedBody(request: Request): Promise<string> {
  if (Number(request.headers.get('Content-Length')) > SAVE_BUNDLE_LIMIT) throw new Error('large');
  const reader = request.body?.getReader(); if (!reader) throw new Error('body');
  const parts: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > SAVE_BUNDLE_LIMIT) { await reader.cancel(); throw new Error('large'); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
/** Only the Sites dispatcher may supply identity. Never expose this Worker outside that boundary. */
export async function cloudAPI(request: Request, env: CloudEnv): Promise<Response> {
  const url = new URL(request.url), user = request.headers.get('oai-authenticated-user-id');
  if (url.pathname === '/api/cloud/session' && request.method === 'GET') return json({ supported: true, user: user || null });
  if (url.pathname === '/api/cloud/leaderboard') {
    if (!env.DB) return json({error:'Leaderboard unavailable.'},503);
    if (user && (user.length > 512 || request.headers.get('X-Evergrow-Account') !== user)) return json({error:'Account changed. Reopen the leaderboard.'},401);
    return leaderboardAPI(request,env,user);
  }
  if (!user || user.length > 512) return json({ error: 'Sign in to use cloud saves.' }, 401);
  if (request.headers.get('X-Evergrow-Account') !== user) return json({ error: 'Account changed. Return to the character screen.' }, 401);
  if (!env.DB || !env.SAVES) return json({ error: 'Cloud saves are unavailable.' }, 503);
  if (request.method !== 'GET' && (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site'
    || !request.headers.get('Content-Type')?.startsWith('application/json'))) return json({ error: 'Invalid request origin.' }, 403);
  const owner = user;
  if (url.pathname === '/api/cloud/chronicle' && request.method === 'GET') {
    const {results}=await env.DB.prepare('SELECT chronicle, object FROM characters WHERE owner = ?').bind(owner).all<Row>();
    const histories=await Promise.all(results.map(async r=>{let history=parseChronicleLedger(r.chronicle);if(!r.chronicle&&r.object){const object=await env.SAVES.get(r.object);if(!object)throw new Error('History unavailable');const bundle=decodeSaveBundle(await object.text());if(!bundle)throw new Error('Invalid history');history=recordChronicle(history,bundle.character);}return history;}));
    return json(mergeChronicles(...histories));
  }
  if (url.pathname === '/api/cloud/characters' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT slot, revision, summary FROM characters WHERE owner = ?').bind(owner).all<Row>();
    return json({ slots: Array.from({ length: 8 }, (_, index) => {
      const row = results.find(r => r.slot === index); return { index, revision: row?.revision ?? 0, summary: row?.summary ? JSON.parse(row.summary) : null };
    }) });
  }
  const match = /^\/api\/cloud\/characters\/([0-7])$/.exec(url.pathname);
  if (!match) return json({ error: 'Not found.' }, 404);
  const slot = Number(match[1]);
  const current = () => backend('character-row-read', () => env.DB.prepare('SELECT * FROM characters WHERE owner = ? AND slot = ?').bind(owner, slot).first<Row>());
  const row = await current();
  if (request.method === 'GET') {
    if (!row?.object) return json({ revision: row?.revision ?? 0, bundle: null });
    const object = await backend('checkpoint-read', () => env.SAVES.get(row.object!));
    if (!object) return json({ code: 'checkpoint_missing', error: 'This checkpoint is unavailable. Please retry.' }, 503);
    return json({ revision: row.revision, bundle: JSON.parse(await object.text()) });
  }
  if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
  let input: { expected: number; operation: string; bundle: unknown };
  try { input = JSON.parse(await boundedBody(request)); }
  catch (error) { return json({ error: (error as Error).message === 'large' ? 'Save file is too large.' : 'Invalid save file.' }, 413); }
  if (!input || !Number.isSafeInteger(input.expected) || input.expected < 0 || !/^[a-zA-Z0-9-]{16,80}$/.test(input.operation)) return json({ error: 'Invalid save request.' }, 400);
  const raw = JSON.stringify(input.bundle), digest = await hash(raw);
  if (row?.operation === input.operation) return row.digest === digest ? json({ revision: row.revision }) : json({ error: 'Save request changed.' }, 409);
  if ((row?.revision ?? 0) !== input.expected) return json({ error: 'Cloud save changed on another device.' }, 409);
  const bundle = input.bundle === null ? null : decodeSaveBundle(raw);
  if (input.bundle !== null && (!bundle || !canLoadWorld(bundle.character.worldVersion, WORLD_GENERATION_VERSION))) return json({ code: 'save_incompatible', error: 'This character save is incompatible with the current game. Its recovery copy is preserved.' }, 422);
  const r = bundle?.character;
  const summary = r ? JSON.stringify({ name: r.name, level: r.checkpoint.level, power: characterPower(previewCharacter(r)).power, gearPower: equippedGearPower(r.checkpoint.character), updatedAt: r.updatedAt }) : null;
  let history=parseChronicleLedger(row?.chronicle);
  // Every modern publication already stores its full validated Chronicle in D1.
  // A changed gameplay validator must not block replacing/deleting that checkpoint.
  if(row?.object && !row.chronicle){
    const previous=await backend('previous-checkpoint-read', () => env.SAVES.get(row.object!));
    if(!previous) return json({code:'previous_checkpoint_missing',error:'Previous checkpoint unavailable.'},503);
    const old=decodeSaveBundle(await previous.text());
    if(!old)return json({code:'previous_checkpoint_incompatible',error:'The previous character needs recovery before it can be replaced. Its save is preserved.'},422);
    history=recordChronicle(history,old.character);
  }
  if (!bundle) for (const character of Object.values(history.characters)) character.deleted = true;
  if(bundle)history=recordChronicle(history,bundle.character);
  const historyRaw=JSON.stringify(history);parseChronicleLedger(historyRaw);
  const key = bundle ? `${await hash(owner)}/${slot}/${crypto.randomUUID()}.json` : null;
  if (key) await backend('checkpoint-write', () => env.SAVES.put(key, raw));
  let committed = false, safeToDelete = false;
  try {
    const result = await env.DB.prepare(`INSERT INTO characters (owner, slot, revision, object, previous, summary, operation, digest, updated_at, chronicle, rank_name, rank_level, rank_gear )
      VALUES (?, ?, 1, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner, slot) DO UPDATE SET revision = characters.revision + 1, previous = characters.object,
      object = excluded.object, summary = excluded.summary, chronicle = excluded.chronicle, operation = excluded.operation, digest = excluded.digest, updated_at = excluded.updated_at,
      rank_name = excluded.rank_name, rank_level = excluded.rank_level, rank_gear = excluded.rank_gear
      WHERE characters.revision = ?`).bind(owner, slot, key, summary, input.operation, digest, Date.now(), historyRaw, r?.name??null, r?.checkpoint.level??null, r?equippedGearPower(r.checkpoint.character):null, input.expected).run();
    committed = result.meta.changes === 1; safeToDelete = !committed;
    if (!committed) {
      const winner = await current();
      return winner?.operation === input.operation && winner.digest === digest ? json({ revision: winner.revision }) : json({ error: 'Cloud save changed on another device.' }, 409);
    }
    // Keep the immediate predecessor; older versions are no longer referenced by either pointer.
    if (row?.previous) try { await env.SAVES.delete(row.previous); } catch { /* A leaked backup never invalidates a committed save. */ }
    return json({ revision: input.expected + 1 });
  } catch (error) {
    // A transport failure may occur after D1 committed. Never remove a possibly published object.
    try {
      const observed = await current();
      if (observed?.operation === input.operation && observed.digest === digest) { committed = true; return json({ revision: observed.revision }); }
      safeToDelete = !!observed && observed.object !== key && observed.previous !== key;
    } catch { safeToDelete = false; }
    throw error instanceof BackendFailure ? error : new BackendFailure('character-row-publish');
  } finally { if (!committed && safeToDelete && key) try { await env.SAVES.delete(key); } catch { /* Unreferenced upload; old pointer remains intact. */ } }
}
export default { async fetch(request: Request, env: CloudEnv): Promise<Response> {
  if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const context = { event: 'cloud-request-failed', method: request.method, path: new URL(request.url).pathname, requestId: request.headers.get('cf-ray') };
  try {
    const response = await cloudAPI(request, env);
    if (response.status >= 400) {
      const body = await response.clone().json() as { code?: string };
      console.error({ ...context, status: response.status, code: body.code ?? 'request_rejected' });
    }
    return response;
  } catch (error) {
    // No identity, checkpoint content, object keys, SQL or credentials in diagnostics.
    console.error({ ...context, status: 503, code: 'backend_failure', stage: error instanceof BackendFailure ? error.stage : 'request-processing' });
    return json({ code: 'backend_failure', error: 'Cloud saves are temporarily unavailable. Try again shortly.' }, 503);
  }
} };
