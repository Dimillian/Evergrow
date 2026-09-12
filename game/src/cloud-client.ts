import { CloudError, CloudStorageError, CloudSaveError, cloudFailureStatus, type CloudStatus } from './cloud-errors.ts';
import type { LeaderboardOrder, LeaderboardSnapshot } from './leaderboard.ts';
import type { ChronicleLedger } from './chronicle.ts';
import type { CharacterSave } from './character-save.ts';
import type { CharacterRepositoryPort, SaveResult, SaveSlot, SaveSummary } from './character-storage.ts';
import type { ChartResult, ExplorationPersistence } from './exploration.ts';
import type { DecodedExploration } from './exploration-save.ts';
import { bundleChart, type SaveBundle } from './save-bundle.ts';
import type { CacheCommand, CloudRow } from './cloud-cache.ts';
interface CloudInfo { index: number; token: string; base: number; dirty: boolean; conflict: boolean; invalid?: boolean; summary?: SaveSummary; }
export class CloudClient implements CharacterRepositoryPort, ExplorationPersistence {
  readonly account: string;
  status: CloudStatus = 'Synced';
  onStatus = (_status: CloudStatus) => {};
  message = '';
  private uploadFailure: { error: unknown; index: number } | undefined;
  private deleting = new Set<number>();
  private slotInfo = new Map<number, CloudInfo>();
  private slotFailures = new Map<number, unknown>();
  private writeFailures = new Map<number, unknown>();
  private remoteFailure: unknown;
  chart: (record: CharacterSave) => DecodedExploration | undefined = () => undefined;
  private worker: Worker | null = null;
  private requests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private serial = 0;
  private ready: Promise<unknown>;
  private syncing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private storageError: CloudStorageError | null = null;
  constructor(account: string) {
    this.account = account;
    this.ready = this.startStorage();
    this.timer = setInterval(() => { void this.flush(); }, 30000);
  }
  private async startStorage(): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      this.worker = new Worker(new URL('./cloud-worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const r = this.requests.get(data.id); if (!r) return;
        this.requests.delete(data.id);
        if (data.error) r.reject(data.errorKind === 'save' ? new CloudSaveError(data.error) : new CloudStorageError(data.error));
        else r.resolve(data.result);
      };
      this.worker.onerror = this.worker.onmessageerror = () => this.stopStorage(new CloudStorageError('Game storage could not start. Reload the game to load the latest files. Saved progress is kept.', true));
      timeout = setTimeout(() => this.stopStorage(new CloudStorageError('Game storage did not respond. Reload the game. Saved progress is kept.', true)), 10000);
      await this.dispatch('init', { account: this.account });
    } catch (error) {
      this.stopStorage(error instanceof CloudStorageError ? error : new CloudStorageError('Game storage could not start. Reload the game. Saved progress is kept.', true));
    } finally { clearTimeout(timeout); }
  }
  private stopStorage(error: CloudStorageError) {
    this.storageError = error; this.worker?.terminate(); this.worker = null;
    for (const r of this.requests.values()) r.reject(error);
    this.requests.clear();
    if (!this.disposed) this.failed(error);
  }
  /** Explicit hall retry only. Reopen the same account database without discarding any rows. */
  async retryStorage() {
    await this.ready;
    if (this.storageError && !this.disposed) { this.storageError = null; this.ready = this.startStorage(); }
    await this.ready;
  }
  private dispatch<T>(method: string, data: object = {}): Promise<T> {
    if (this.disposed || !this.worker) return Promise.reject(this.storageError ?? new CloudStorageError('Save storage closed.'));
    return new Promise((resolve, reject) => { const id = ++this.serial; this.requests.set(id, { resolve: value => resolve(value as T), reject }); try { this.worker!.postMessage({ id, method, ...data }); } catch (error) { this.requests.delete(id); reject(new CloudStorageError(error instanceof Error ? error.message : 'Save storage unavailable.')); } });
  }
  private async rpc<T>(method: string, data: object = {}): Promise<T> {
    await this.ready;
    if (this.storageError) throw this.storageError;
    const result = await this.dispatch<T>(method, data);
    if (method === 'list-info') this.slotInfo = new Map((result as CloudInfo[]).map(row => [row.index, row]));
    return result;
  }
  private async cache<T>(command: CacheCommand): Promise<T> {
    const result = await this.rpc<T>('cache', { command });
    if (result && (command.kind === 'ack' || command.kind === 'resolve' || command.kind === 'delete')) {
      this.slotFailures.delete(command.index);
      if (command.kind !== 'ack') this.writeFailures.delete(command.index);
      this.rememberSlot(result as unknown as CloudRow);
    }
    return result;
  }
  private rememberSlot(row: CloudRow) {
    const { index, token, base, dirty, conflict } = row;
    this.slotInfo.set(index, { index, token, base, dirty, conflict });
    if (!dirty && !conflict) this.slotFailures.delete(index);
  }
  /** Gameplay reports its own checkpoint; the hall keeps the account-wide status. */
  statusForSlot(index: number): { status: CloudStatus; message: string } {
    if (this.storageError) return { status: cloudFailureStatus(this.storageError), message: this.storageError.message };
    const writeFailure = this.writeFailures.get(index);
    if (writeFailure) return { status: cloudFailureStatus(writeFailure), message: `This character could not be saved on this device. ${writeFailure instanceof Error ? writeFailure.message : 'Retry from the hall.'}` };
    const row = this.slotInfo.get(index);
    if (!row) return { status: this.status, message: this.message };
    if (row.conflict) return { status: 'Conflict', message: 'Saved on this device. Resolve this character’s cloud conflict in the hall.' };
    if (row.invalid) return { status: 'Save needs attention', message: 'This character’s recovery needs attention in the hall.' };
    const failure = this.slotFailures.get(index);
    if (failure) return { status: cloudFailureStatus(failure), message: `Cloud upload failed for this character. ${failure instanceof Error ? failure.message : 'Retry from the hall.'}` };
    return { status: row.dirty ? 'Saving…' : 'Synced', message: row.dirty ? 'Saved on this device. Awaiting cloud upload.' : '' };
  }
  private async api<T>(path: string, body?: object): Promise<T> {
    // Serialization failures belong to local storage, before attempting the network.
    const encoded = body ? await this.rpc<string>('encode-request', { body }) : undefined;
    try {
      const response = await fetch('/api/cloud/' + path, { method: body ? 'PUT' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { 'X-Evergrow-Account': this.account, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: encoded,
        signal: AbortSignal.timeout(20000) });
      // Gateways can return HTML. Preserve the HTTP failure instead of calling it offline.
      const value = await response.json().catch(() => null);
      if (!response.ok) throw new CloudError(typeof value?.error === 'string' ? value.error : 'Cloud saves are temporarily unavailable. Try again shortly.', response.status);
      if (!value) throw new CloudError('Cloud returned an unreadable response. Try again shortly.', 502);
      this.remoteFailure = undefined;
      return value as T;
    } catch (error) { this.remoteFailure = error; throw error; }
  }
  private setStatus(status: CloudStatus, message = '') { this.status = status; this.message = message; this.onStatus(status); }
  private failed(error: unknown, index?: number) { const status = cloudFailureStatus(error); const message = status === 'Offline' ? 'Could not reach cloud saves. Check your connection and retry.' : error instanceof Error ? error.message : 'Cloud saves unavailable.'; this.setStatus(status, index === undefined ? message : `Slot ${index + 1}: ${message}`); }
  private slot(row: CloudRow): SaveSlot {
    this.rememberSlot(row);
    const r = row.bundle?.character;
    return { index: row.index, record: r ?? null, token: row.token, state: r ? 'saved' : 'empty', pending: row.dirty, conflict: row.conflict };
  }
  async list(): Promise<SaveSlot[]> {
    // Browsing must not wait for a failing upload in another slot.
    let local: CloudInfo[] = [];
    try {
      local = await this.rpc<CloudInfo[]>('list-info');
      const remote = await this.api<{ slots: { index: number; revision: number; summary: SaveSummary | null }[] }>('characters');
      local = await this.rpc<CloudInfo[]>('list-info');
      if (this.uploadFailure) this.failed(this.uploadFailure.error, this.uploadFailure.index);
      else this.setStatus(local.some(r => r.invalid) ? 'Save needs attention' : local.some(r => r.conflict) ? 'Conflict' : local.some(r => r.dirty) ? 'Saving…' : 'Synced');
      return remote.slots.map(r => {
        const cached = local.find(c => c.index === r.index);
        if (cached?.dirty && cached.base >= r.revision && !cached.conflict) return { cloudState: 'pending', index: cached.index, token: cached.token, summary: cached.summary, record: null, state: cached.invalid ? 'invalid' : cached.summary ? 'saved' : 'empty', pending: true, conflict: cached.conflict };
        return { cloudState: 'cloud', conflict: !!cached?.dirty && (cached.conflict || cached.base < r.revision), index: r.index, record: null, token: cached?.token ?? null, summary: r.summary ?? undefined, state: r.summary ? 'saved' : 'empty' };
      });
    } catch (error) { this.failed(error); return Array.from({ length: 8 }, (_, index) => {
      const cached = local.find(c => c.index === index); return cached ? { cloudState: 'offline', index, token: cached.token, record: null, summary: cached.summary, state: cached.invalid ? 'invalid' : cached.summary ? 'saved' : 'empty', pending: cached.dirty, conflict: cached.conflict } : { index, record: null, token: null, state: 'unavailable' };
    }); }
  }
  async leaderboard(order: LeaderboardOrder): Promise<LeaderboardSnapshot> {
    return this.api(`leaderboard?order=${order}`);
  }
  async chronicle(onCached?:(ledger:ChronicleLedger)=>void):Promise<ChronicleLedger> {
    // A read must not flush the save outbox or wait for a network round trip to display.
    const cached=await this.cache<ChronicleLedger>({kind:'chronicle'});
    onCached?.(cached);
    try {
      const remote=await this.api<ChronicleLedger>('chronicle');
      await this.cache({kind:'history',ledger:remote});
      // Read again so a concurrent upload/conflict decision is respected.
      return await this.cache<ChronicleLedger>({kind:'chronicle'});
    } catch(error){this.failed(error);return cached;}
  }
  /** Hall inspection shows the server branch without adopting over unsent progress. */
  async inspect(index: number): Promise<SaveSlot> { return this.read(index, true); }
  async read(index: number, inspect = false): Promise<SaveSlot> {
    let cached: CloudRow | null = null;
    try {
      // Inspect raw metadata first: an incompatible recovery must not hide a valid cloud save.
      cached = await this.cache<CloudRow | null>({ kind: 'inspect', index });
      if (cached?.conflict && !inspect) return this.slot(await this.cache<CloudRow>({ kind: 'read', index }));
      const value = await this.api<{ revision: number; operation?: string | null; bundle: SaveBundle | null }>(`characters/${index}`);
      const bundle = value.bundle ? await this.rpc<SaveBundle | null>('decode-bundle', { bundle: value.bundle }) : null;
      if (value.bundle && !bundle) throw new CloudSaveError('The cloud character cannot be read by this version. Reload the game.');
      // Re-read after the network wait; a checkpoint or upload may have committed meanwhile.
      cached = await this.cache<CloudRow | null>({ kind: 'inspect', index });
      // Recover a lost upload acknowledgement without treating our own commit as a competing device.
      if (cached?.upload && cached.upload.operation === value.operation && cached.base < value.revision) {
        await this.cache({ kind: 'ack', index, operation: cached.upload.operation, base: cached.upload.base, revision: value.revision });
        cached = await this.cache<CloudRow | null>({ kind: 'inspect', index });
        const current = await this.rpc<CloudInfo[]>('list-info');
        this.setStatus(current.some(r => r.invalid) ? 'Save needs attention' : current.some(r => r.conflict) ? 'Conflict' : current.some(r => r.dirty) ? 'Saving…' : 'Synced');
      }
      if (cached?.dirty) {
        if (cached.conflict || cached.base < value.revision) {
          await this.cache({ kind: 'conflict', index, base: cached.base });
          const recovery = cached.bundle ? await this.rpc<SaveBundle | null>('decode-bundle', { bundle: cached.bundle }) : null;
          this.setStatus('Conflict');
          if (inspect) return { index, token: cached.token, record: bundle?.character ?? null,
            state: bundle ? 'saved' : 'empty', conflict: true, cloudState: 'cloud',
            recovery: { record: recovery?.character ?? null, invalid: !!cached.bundle && !recovery } };
          return this.slot(await this.cache<CloudRow>({ kind: 'read', index }));
        }
        this.setStatus('Saving…');
        return { ...this.slot(await this.cache<CloudRow>({ kind: 'read', index })), cloudState: 'pending' };
      }
      // Never roll a cache back when an upload completed after this GET's snapshot.
      if (cached && cached.base >= value.revision) return { ...this.slot(await this.cache<CloudRow>({ kind: 'read', index })), cloudState: 'cloud' };
      const row = await this.cache<CloudRow | null>({ kind: 'adopt', index, expected: cached?.token ?? null, bundle, base: value.revision });
      if (!row) throw new CloudSaveError('This save changed in another tab. Select it again.');
      return { ...this.slot(row), cloudState: 'cloud' };
    } catch (error) {
      this.failed(error);
      if (error instanceof CloudSaveError || error instanceof CloudError && error.status === 422) {
        const info = (await this.rpc<CloudInfo[]>('list-info')).find(r => r.index === index);
        return { index, token: info?.token ?? null, record: null, state: 'invalid', pending: info?.dirty, conflict: info?.conflict };
      }
      if (!cached) return { index, token: null, record: null, state: 'unavailable' };
      const fallback = this.slot(await this.cache<CloudRow>({ kind: 'read', index }));
      return inspect && fallback.conflict
        ? { ...fallback, record: null, state: 'unavailable', cloudState: 'offline', recovery: { record: fallback.record } }
        : { ...fallback, cloudState: 'offline' };
    }
  }
  async write(index: number, record: CharacterSave, expected: string | null): Promise<SaveResult> {
    try {
      let chart = this.chart(record);
      if (!chart) { const old = await this.cache<CloudRow | null>({ kind: 'read', index }); chart = old?.bundle?.character.id === record.id ? bundleChart(old.bundle) : undefined; }
      const row = await this.rpc<{ token: string; conflict: boolean } | null>('write-bundle', { index, record, chart, expected, operation: crypto.randomUUID() });
      if (!row) throw new CloudSaveError('This character or slot changed. Resolve its cloud save in the hall before saving.');
      this.writeFailures.delete(index);
      this.slotInfo.set(index, { index, token: row.token, base: this.slotInfo.get(index)?.base ?? 0, dirty: true, conflict: row.conflict });
      this.setStatus(row.conflict ? 'Conflict' : 'Saving…');
      // Durable local writes coalesce until the next 30-second upload window.
      return { ok: true, token: row.token };
    } catch (error) { this.writeFailures.set(index, error); this.failed(error, index); return { ok: false, message: (error as Error).message }; }
  }
  async remove(index: number, expected: string | null): Promise<SaveResult> {
    if (this.deleting.has(index)) return { ok: false, message: 'Deletion is already pending. Wait for confirmation.' };
    this.deleting.add(index);
    let deleted = false;
    try {
      // Finish an existing upload, but do not publish queued recovery just to delete it.
      await this.syncing;
      const row = await this.cache<CloudRow | null>({ kind: 'inspect', index });
      if ((row?.token ?? null) !== expected) return { ok: false, message: 'Recovery changed. Select it again before deleting.' };
      const remote = await this.api<{ revision: number }>(`characters/${index}?metadata=1`);
      const current = await this.cache<CloudRow | null>({ kind: 'inspect', index });
      if ((current?.token ?? null) !== expected) return { ok: false, message: 'Recovery changed. Select it again before deleting.' };
      const result = await this.api<{ revision: number }>(`characters/${index}`, { expected: remote.revision, operation: crypto.randomUUID(), bundle: null });
      // No local tombstone until the server acknowledges. The token guard keeps any
      // concurrent recovery edit, including when the response arrives after a new save.
      const resolved = await this.cache<CloudRow | null>({ kind: 'delete', index, expected, base: result.revision });
      if (!resolved) return { ok: false, message: 'Cloud save deleted, but recovery changed in another tab. Select it again before deleting that copy.' };
      if (this.uploadFailure?.index === index) this.uploadFailure = undefined;
      deleted = true;
      return { ok: true, token: resolved.token };
    } catch (error) {
      this.failed(error, index);
      return { ok: false, message: error instanceof CloudError && error.status === 409
        ? 'Cloud save changed during deletion. Your recovery is still available. Select the character and try again.'
        : `Deletion was not confirmed. Your recovery is still available. ${error instanceof Error ? error.message : 'Retry from the character hall.'}` };
    } finally {
      this.deleting.delete(index);
      // Refresh the aggregate status; failures remain actionable and other slots may sync.
      if (deleted) await this.flush();
    }
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
        let failure: { error: unknown; index: number } | undefined;
        for (const row of rows) {
          if (!row.dirty || row.conflict || this.deleting.has(row.index)) continue;
          this.setStatus('Saving…');
          try {
            const staged = await this.cache<CloudRow>({ kind: 'upload', index: row.index });
            if (staged.conflict || !staged.upload) continue;
            const upload = staged.upload;
            const result = await this.api<{ revision: number }>(`characters/${row.index}`, { expected: upload.base, operation: upload.operation, bundle: upload.bundle });
            await this.cache({ kind: 'ack', index: row.index, operation: upload.operation, base: upload.base, revision: result.revision });
          } catch (error) {
            this.slotFailures.set(row.index, error);
            if (error instanceof CloudError && error.status === 409) await this.cache({ kind: 'conflict', index: row.index, base: row.base });
            failure ??= { error, index: row.index };
            // Account or network failures affect every slot; save-specific failures do not.
            if (!(error instanceof CloudError) && !(error instanceof CloudSaveError) || error instanceof CloudError && error.status === 401) break;
          }
        }
        const current = await this.rpc<CloudInfo[]>('list-info');
        this.uploadFailure = failure;
        if (failure) this.failed(failure.error, failure.index);
        else if (this.remoteFailure) this.failed(this.remoteFailure);
        else this.setStatus(current.some(r => r.invalid) ? 'Save needs attention' : current.some(r => r.conflict) ? 'Conflict' : current.some(r => r.dirty) ? 'Saving…' : 'Synced');
      } catch (error) { this.failed(error); }
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  /** Explicit discard only, after the hall confirms replacing the recovery branch. */
  async useCloud(index: number, expected: string | null): Promise<void> {
    await this.flush();
    const remote = await this.api<{ revision: number; bundle: SaveBundle | null }>(`characters/${index}`);
    const row = await this.cache<CloudRow | null>({ kind: 'inspect', index });
    if (!row?.conflict) throw new Error('The save changed. Select the character again.');
    if (row.token !== expected) throw new Error('Recovery changed. Select it again before resolving.');
    const resolved = await this.cache({ kind: 'resolve', index, expected: row.token, bundle: remote.bundle, base: remote.revision });
    if (!resolved) throw new Error('Recovery changed in another tab. Reopen it before resolving.');
    this.setStatus('Synced');
  }
  dispose() { this.disposed = true; clearInterval(this.timer); this.worker?.terminate(); for (const r of this.requests.values()) r.reject(new Error('Save storage closed.')); this.requests.clear(); }
}
