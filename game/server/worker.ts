import { decodeSaveBundle, SAVE_BUNDLE_LIMIT } from '../src/save-bundle.ts';
import { characterPower, previewCharacter } from '../src/character-summary.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
interface Row { owner: string; slot: number; revision: number; object: string | null; previous: string | null; summary: string | null; operation: string; digest: string; }
interface Statement { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }>; }
export interface CloudEnv {
  DB: { prepare(sql: string): Statement };
  SAVES: { get(key: string): Promise<{ text(): Promise<string> } | null>; put(key: string, body: string): Promise<unknown>; delete(key: string): Promise<unknown> };
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
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
  if (!user || user.length > 512) return json({ error: 'Sign in to use cloud saves.' }, 401);
  if (request.headers.get('X-Evergrow-Account') !== user) return json({ error: 'Account changed. Return to the character screen.' }, 401);
  if (!env.DB || !env.SAVES) return json({ error: 'Cloud saves are unavailable.' }, 503);
  if (request.method !== 'GET' && (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site'
    || !request.headers.get('Content-Type')?.startsWith('application/json'))) return json({ error: 'Invalid request origin.' }, 403);
  const owner = user;
  if (url.pathname === '/api/cloud/characters' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT slot, revision, summary FROM characters WHERE owner = ?').bind(owner).all<Row>();
    return json({ slots: Array.from({ length: 8 }, (_, index) => {
      const row = results.find(r => r.slot === index); return { index, revision: row?.revision ?? 0, summary: row?.summary ? JSON.parse(row.summary) : null };
    }) });
  }
  const match = /^\/api\/cloud\/characters\/([0-7])$/.exec(url.pathname);
  if (!match) return json({ error: 'Not found.' }, 404);
  const slot = Number(match[1]);
  const current = () => env.DB.prepare('SELECT * FROM characters WHERE owner = ? AND slot = ?').bind(owner, slot).first<Row>();
  const row = await current();
  if (request.method === 'GET') {
    if (!row?.object) return json({ revision: row?.revision ?? 0, bundle: null });
    const object = await env.SAVES.get(row.object);
    if (!object) return json({ error: 'This checkpoint is unavailable. Please retry.' }, 503);
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
  if (input.bundle !== null && (!bundle || bundle.character.worldVersion !== WORLD_GENERATION_VERSION)) return json({ error: 'Invalid or incompatible save file.' }, 422);
  const r = bundle?.character;
  const summary = r ? JSON.stringify({ name: r.name, level: r.checkpoint.level, power: characterPower(previewCharacter(r)).power, updatedAt: r.updatedAt }) : null;
  const key = bundle ? `${await hash(owner)}/${slot}/${crypto.randomUUID()}.json` : null;
  if (key) await env.SAVES.put(key, raw);
  let committed = false, safeToDelete = false;
  try {
    const result = await env.DB.prepare(`INSERT INTO characters (owner, slot, revision, object, previous, summary, operation, digest, updated_at)
      VALUES (?, ?, 1, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(owner, slot) DO UPDATE SET revision = characters.revision + 1, previous = characters.object,
      object = excluded.object, summary = excluded.summary, operation = excluded.operation, digest = excluded.digest, updated_at = excluded.updated_at
      WHERE characters.revision = ?`).bind(owner, slot, key, summary, input.operation, digest, Date.now(), input.expected).run();
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
    throw error;
  } finally { if (!committed && safeToDelete && key) try { await env.SAVES.delete(key); } catch { /* Unreferenced upload; old pointer remains intact. */ } }
}
export default { async fetch(request: Request, env: CloudEnv): Promise<Response> {
  if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try { return await cloudAPI(request, env); } catch { return json({ error: 'Cloud saves are temporarily unavailable.' }, 503); }
} };
