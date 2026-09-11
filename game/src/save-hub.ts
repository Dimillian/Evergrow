import { canLoadWorld } from './world-save-upgrade.ts';
import type { LeaderboardOrder, LeaderboardSnapshot } from './leaderboard.ts';
import type { ChronicleLedger } from './chronicle.ts';
import { decodeSaveBundle } from './save-bundle.ts';
import { WORLD_GENERATION_VERSION } from './world.ts';
import { SaveClient } from './save-client.ts';
import { CloudClient } from './cloud-client.ts';
import type { CharacterSave } from './character-save.ts';
import type { CharacterRepositoryPort, SaveResult } from './character-storage.ts';
import type { ChartResult, ExplorationPersistence } from './exploration.ts';
import type { DecodedExploration } from './exploration-save.ts';
export type SaveMode = 'cloud' | 'local';
export interface SaveSourceUI { supported: boolean; mode: SaveMode; signedIn: boolean; status: string; message?: string; }
/** Explicit storage selection. Android/local builds never contact cloud endpoints. */
export class SaveHub implements CharacterRepositoryPort, ExplorationPersistence {
  private local = new SaveClient();
  private cloud: CloudClient | null = null;
  private disposed = false;
  mode: SaveMode = 'local';
  supported = false;
  status = '';
  onChange = (_state: SaveSourceUI) => {};
  chart: (record: CharacterSave) => DecodedExploration | undefined = () => undefined;
  get state(): SaveSourceUI { return { supported: this.supported, mode: this.mode, signedIn: !!this.cloud, status: this.mode === 'local' ? 'Local' : this.cloud?.status ?? this.status, message: this.mode === 'cloud' ? this.cloud?.message : undefined }; }
  get repository() { if (this.mode === 'local') return this.local; if (!this.cloud) throw new Error('Sign in to use cloud saves.'); return this.cloud; }
  async initialize() {
    if (!import.meta.env.VITE_SITE_CLOUD || window.EvergrowAndroid) return;
    this.supported = true; this.mode = 'cloud';
    try {
      const response = await fetch('/api/cloud/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (this.disposed) return;
      if (data.supported !== true) throw new Error();
      if (typeof data.user === 'string' && data.user) {
        this.cloud = new CloudClient(data.user); this.cloud.chart = r => this.chart(r);
        this.cloud.onStatus = () => this.onChange(this.state);
      } else this.status = 'Sign in';
    } catch { this.status = 'Unavailable'; }
    this.onChange(this.state);
  }
  async select(mode: SaveMode) { if (mode === 'cloud' && !this.supported) return; this.mode = mode; this.onChange(this.state); }
  async retry() {
    if (this.mode !== 'cloud') return;
    if (!this.cloud) await this.initialize();
    else { await this.cloud.retryStorage(); await this.cloud.flush(); }
  }
  async list() {
    if (this.mode === 'cloud' && !this.cloud) return [];
    return this.repository.list();
  }
  async leaderboard(order: LeaderboardOrder): Promise<LeaderboardSnapshot> {
    if (!this.supported) throw new Error('The leaderboard is available in the online game.');
    if (this.cloud) return this.cloud.leaderboard(order);
    const response = await fetch(`/api/cloud/leaderboard?order=${order}`, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Leaderboard unavailable. Try again shortly.');
    return response.json();
  }
  async chronicle(onCached?:(ledger:ChronicleLedger)=>void) {
    const repository=this.repository;
    return repository instanceof CloudClient ? repository.chronicle(onCached) : repository.chronicle();
  }
  async inspect(index: number) { return this.mode === 'cloud' && this.cloud ? this.cloud.inspect(index) : this.repository.read(index); }
  async read(index: number) { return this.repository.read(index); }
  async write(index: number, record: CharacterSave, expected: string | null) { return this.repository.write(index, record, expected); }
  async remove(index: number, expected: string | null) { return this.repository.remove(index, expected); }
  async readChart(key: string, seed: number, generation: string): Promise<ChartResult> { return this.repository.readChart(key, seed, generation); }
  async writeChart(key: string, seed: number, generation: string, data: DecodedExploration) { return this.repository.writeChart(key, seed, generation, data); }
  async removeChart(key: string, seed: number, generation: string) { if (this.mode === 'local') await this.local.removeChart(key, seed, generation); }
  async export(index: number) {
    if (this.mode !== 'local') throw new Error('File transfers are only available for local saves.');
    return this.local.export(index);
  }
  async import(index: number, raw: string): Promise<SaveResult> {
    if (this.mode !== 'local') return { ok: false, message: 'File transfers are only available for local saves.' };
    const bundle = decodeSaveBundle(raw);
    if (!bundle || !canLoadWorld(bundle.character.worldVersion, WORLD_GENERATION_VERSION)) return { ok: false, message: 'Invalid or incompatible save file.' };
    return this.local.import(index, raw);
  }
  async useCloud(index: number, expected: string | null) { if (this.mode === 'cloud') await this.cloud?.useCloud(index, expected); }
  async flush() { if (this.mode === 'cloud') await this.cloud?.flush(); }
  dispose() { this.disposed = true; this.local.dispose(); this.cloud?.dispose(); }
}
