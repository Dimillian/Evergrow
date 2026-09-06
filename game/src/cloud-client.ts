import type { CharacterSave } from './character-save.ts';
import type { CharacterRepositoryPort, SaveResult, SaveSlot, SaveSummary } from './character-storage.ts';
import type { ChartResult, ExplorationPersistence } from './exploration.ts';
import type { DecodedExploration } from './exploration-save.ts';
import { bundleChart, type SaveBundle } from './save-bundle.ts';
import type { CacheCommand, CloudRow } from './cloud-cache.ts';
interface CloudInfo { index: number; token: string; base: number; dirty: boolean; conflict: boolean; summary?: SaveSummary; }
export type CloudStatus = 'Synced' | 'Saving…' | 'Offline' | 'Conflict' | 'Sign in again';
class CloudError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
export class CloudClient implements CharacterRepositoryPort, ExplorationPersistence {
  readonly account: string;
  status: CloudStatus = 'Synced';
  onStatus = (_status: CloudStatus) => {};
  chart: (record: CharacterSave) => DecodedExploration | undefined = () => undefined;
  private worker = new Worker(new URL('./cloud-worker.ts', import.meta.url), { type: 'module' });
  private requests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private serial = 0;
  private ready: Promise<unknown>;
  private syncing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private unavailable = false;
  constructor(account: string) {
    this.account = account;
    this.worker.onmessage = ({ data }) => { const r = this.requests.get(data.id); if (!r) return; this.requests.delete(data.id); if (data.error) r.reject(new Error(data.error)); else r.resolve(data.result); };
    this.worker.onerror = () => { this.unavailable = true; for (const r of this.requests.values()) r.reject(new Error('Local recovery storage unavailable.')); this.requests.clear(); };
    this.ready = this.rpc('init', { account });
    this.timer = setInterval(() => { void this.flush(); }, 15000);
  }
  private rpc<T>(method: string, data: object = {}): Promise<T> {
    if (this.disposed || this.unavailable) return Promise.reject(new Error('Save storage closed.'));
    return new Promise((resolve, reject) => { const id = ++this.serial; this.requests.set(id, { resolve: value => resolve(value as T), reject }); try { this.worker.postMessage({ id, method, ...data }); } catch (error) { this.requests.delete(id); reject(error); } });
  }
  private async cache<T>(command: CacheCommand): Promise<T> { await this.ready; return this.rpc('cache', { command }); }
  private async api<T>(path: string, body?: object): Promise<T> {
    const response = await fetch('/api/cloud/' + path, { method: body ? 'PUT' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Evergrow-Account': this.account, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? await this.rpc<string>('encode-request', { body }) : undefined,
      signal: AbortSignal.timeout(20000) });
    const value = await response.json();
    if (!response.ok) throw new CloudError(value.error ?? 'Cloud saves unavailable.', response.status);
    return value as T;
  }
  private setStatus(status: CloudStatus) { this.status = status; this.onStatus(status); }
  private failed(error: unknown) { this.setStatus(error instanceof CloudError && error.status === 401 ? 'Sign in again' : error instanceof CloudError && error.status === 409 ? 'Conflict' : 'Offline'); }
  private slot(row: CloudRow): SaveSlot {
    const r = row.bundle?.character;
    return { index: row.index, record: r ?? null, token: row.token, state: r ? 'saved' : 'empty', pending: row.dirty, conflict: row.conflict };
  }
  async list(): Promise<SaveSlot[]> {
    await this.flush();
    const local = await this.rpc<CloudInfo[]>('list-info');
    try {
      const remote = await this.api<{ slots: { index: number; revision: number; summary: SaveSummary | null }[] }>('characters');
      return remote.slots.map(r => {
        const cached = local.find(c => c.index === r.index);
        if (cached?.dirty) return { index: cached.index, token: cached.token, summary: cached.summary, record: null, state: cached.summary ? 'saved' : 'empty', pending: true, conflict: cached.conflict };
        return { index: r.index, record: null, token: cached?.token ?? null, summary: r.summary ?? undefined, state: r.summary ? 'saved' : 'empty' };
      });
    } catch (error) { this.failed(error); return Array.from({ length: 8 }, (_, index) => {
      const cached = local.find(c => c.index === index); return cached ? { index, token: cached.token, record: null, summary: cached.summary, state: cached.summary ? 'saved' : 'empty', pending: cached.dirty, conflict: cached.conflict } : { index, record: null, token: null, state: 'unavailable' };
    }); }
  }
  async read(index: number): Promise<SaveSlot> {
    const cached = await this.cache<CloudRow | null>({ kind: 'read', index });
    if (cached?.dirty) return this.slot(cached);
    try {
      const value = await this.api<{ revision: number; bundle: SaveBundle | null }>(`characters/${index}`);
      if (cached && cached.base === value.revision) return this.slot(cached);
      const row = await this.cache<CloudRow | null>({ kind: 'adopt', index, expected: cached?.token ?? null, bundle: value.bundle, base: value.revision });
      return this.slot(row ?? (await this.cache<CloudRow>({ kind: 'read', index })));
    } catch (error) { this.failed(error); return cached ? this.slot(cached) : { index, token: null, record: null, state: 'unavailable' }; }
  }
  async write(index: number, record: CharacterSave, expected: string | null): Promise<SaveResult> {
    try {
      let chart = this.chart(record);
      if (!chart) { const old = await this.cache<CloudRow | null>({ kind: 'read', index }); chart = old?.bundle?.character.id === record.id ? bundleChart(old.bundle) : undefined; }
      const row = await this.rpc<{ token: string; conflict: boolean } | null>('write-bundle', { index, record, chart, expected, operation: crypto.randomUUID() });
      if (!row) return { ok: false, message: 'Character changed in another tab. Reopen it before saving.' };
      this.setStatus(row.conflict ? 'Conflict' : 'Saving…'); queueMicrotask(() => { void this.flush(); });
      return { ok: true, token: row.token };
    } catch (error) { return { ok: false, message: (error as Error).message }; }
  }
  private async commit(index: number, expected: string | null, bundle: SaveBundle | null): Promise<SaveResult> {
    try {
      const row = await this.cache<CloudRow | null>({ kind: 'write', index, expected, bundle, operation: crypto.randomUUID() });
      if (!row) return { ok: false, message: 'Character changed in another tab. Reopen it before saving.' };
      this.setStatus(row.conflict ? 'Conflict' : 'Saving…');
      // Upload is asynchronous; the complete bundle is already durable before gameplay proceeds.
      queueMicrotask(() => { void this.flush(); });
      return { ok: true, token: row.token };
    } catch (error) { return { ok: false, message: (error as Error).message }; }
  }
  async remove(index: number, expected: string | null): Promise<SaveResult> {
    const row = await this.cache<CloudRow | null>({ kind: 'read', index });
    if (row?.conflict) return { ok: false, message: 'Download your recovery save before resolving this conflict.' };
    return this.commit(index, expected, null);
  }
  async export(index: number): Promise<string> {
    const row = await this.cache<CloudRow | null>({ kind: 'read', index });
    if (!row?.bundle) throw new Error('Select a character first.');
    return this.rpc('encode', { bundle: row.bundle });
  }
  async import(index: number, raw: string): Promise<SaveResult> {
    const bundle = await this.rpc<SaveBundle | null>('decode', { raw });
    if (!bundle) return { ok: false, message: 'Invalid or incompatible save file.' };
    const slot = await this.read(index); if (slot.state !== 'empty') return { ok: false, message: 'Choose an empty slot.' };
    bundle.character = { ...bundle.character, id: crypto.randomUUID(), updatedAt: Date.now() };
    return this.commit(index, slot.token, bundle);
  }
  async readChart(key: string, _seed: number, _generation: string): Promise<ChartResult> {
    return { status: 'saved', data: await this.rpc<DecodedExploration | undefined>('read-chart', { key }) };
  }
  async writeChart(key: string, _seed: number, _generation: string, data: DecodedExploration): Promise<ChartResult> {
    // Only acknowledge exploration already captured in the same durable checkpoint bundle.
    return this.rpc<ChartResult>('chart-status', { key, chart: data });
  }
  flush(): Promise<void> {
    if (this.syncing) return this.syncing;
    if (this.disposed) return Promise.resolve();
    this.syncing = (async () => {
      try {
        const rows = await this.rpc<CloudInfo[]>('list-info');
        for (const row of rows) {
          if (!row.dirty || row.conflict) continue;
          this.setStatus('Saving…');
          try {
            const staged = await this.cache<CloudRow>({ kind: 'upload', index: row.index });
            if (staged.conflict || !staged.upload) continue;
            const upload = staged.upload;
            const result = await this.api<{ revision: number }>(`characters/${row.index}`, { expected: upload.base, operation: upload.operation, bundle: upload.bundle });
            await this.cache({ kind: 'ack', index: row.index, operation: upload.operation, base: upload.base, revision: result.revision });
          } catch (error) {
            if (error instanceof CloudError && error.status === 409) await this.cache({ kind: 'conflict', index: row.index, base: row.base });
            this.failed(error); return;
          }
        }
        const current = await this.rpc<CloudInfo[]>('list-info');
        this.setStatus(current.some(r => r.conflict) ? 'Conflict' : current.some(r => r.dirty) ? 'Saving…' : 'Synced');
      } catch (error) { this.failed(error); }
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  /** Explicit discard only, after the hall's confirmation. Export keeps the alternative branch. */
  async useCloud(index: number, expected: string | null): Promise<void> {
    await this.flush();
    const remote = await this.api<{ revision: number; bundle: SaveBundle | null }>(`characters/${index}`);
    const row = await this.cache<CloudRow | null>({ kind: 'read', index });
    if (!row?.conflict) return;
    if (row.token !== expected) throw new Error('Recovery changed. Select it again before resolving.');
    const resolved = await this.cache({ kind: 'resolve', index, expected: row.token, bundle: remote.bundle, base: remote.revision });
    if (!resolved) throw new Error('Recovery changed in another tab. Reopen it before resolving.');
    this.setStatus('Synced');
  }
  dispose() { this.disposed = true; clearInterval(this.timer); this.worker.terminate(); for (const r of this.requests.values()) r.reject(new Error('Save storage closed.')); this.requests.clear(); }
}
