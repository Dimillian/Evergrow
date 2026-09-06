import type { ChartResult, ExplorationPersistence } from './exploration.ts';
import type { DecodedExploration } from './exploration-save.ts';
import type { CharacterSave } from './character-save.ts';
import type { CharacterRepositoryPort, SaveSlot, SaveResult } from './character-storage.ts';

/** Coalesced session writes; the worker owns JSON and durable IndexedDB transactions. */
export class SaveClient implements CharacterRepositoryPort, ExplorationPersistence {
  private worker: Worker | null = null;
  private serial = 0;
  private pending = new Map<number, { resolve(value: unknown): void; reject(reason: Error): void }>();
  private closing = false;
  constructor() {
    try {
      this.worker = new Worker(new URL('./save-worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const request = this.pending.get(data.id); if (!request) return;
        this.pending.delete(data.id);
        if (data.error) request.reject(new Error(data.error)); else request.resolve(data.result);
        if (this.closing && !this.pending.size) this.stop();
      };
      this.worker.onerror = () => this.stop();
      this.worker.onmessageerror = () => this.stop();
    } catch { this.worker = null; }
  }
  private request<T>(method: string, args: object = {}): Promise<T> {
    if (!this.worker || this.closing) return Promise.reject(new Error('Local saving is unavailable.'));
    const id = ++this.serial;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      try { this.worker!.postMessage({ id, method, ...args }); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  async read(index: number): Promise<SaveSlot> {
    try { return await this.request('read', { index }); }
    catch { return { index, state: 'unavailable', record: null, token: null }; }
  }
  async list(): Promise<SaveSlot[]> {
    try { return await this.request('list'); }
    catch { return Array.from({ length: 8 }, (_, index) => ({ index, state: 'unavailable', record: null, token: null })); }
  }
  async write(index: number, record: CharacterSave, expected: string | null): Promise<SaveResult> {
    try { return await this.request('write', { index, record, expected }); }
    catch (error) { return { ok: false, message: String((error as Error).message) }; }
  }
  async remove(index: number, expected: string | null): Promise<SaveResult> {
    try { return await this.request('remove', { index, expected }); }
    catch (error) { return { ok: false, message: String((error as Error).message) }; }
  }
  async readChart(key: string, seed: number, generation: string): Promise<ChartResult> {
    try { return await this.request('chart-read', { key, seed, generation }); }
    catch { return { status: 'session' }; }
  }
  async writeChart(key: string, seed: number, generation: string, data: DecodedExploration): Promise<ChartResult> {
    try { return await this.request('chart-write', { key, seed, generation, data }); }
    catch { return { status: 'session' }; }
  }
  async removeChart(key: string, seed: number, generation: string): Promise<void> {
    try { await this.request('chart-remove', { key, seed, generation }); } catch { /* Character deletion is already durable. */ }
  }
  dispose() { this.closing = true; if (!this.pending.size) this.stop(); }
  private stop() {
    this.worker?.terminate(); this.worker = null;
    for (const request of this.pending.values()) request.reject(new Error('Local saving is unavailable. Keep this tab open and retry.'));
    this.pending.clear();
  }
}
