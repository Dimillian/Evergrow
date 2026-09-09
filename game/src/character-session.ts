import { canUpgradeWorld, upgradeWorldSave, type UpgradeWorldFactory } from './world-save-upgrade.ts';
import { progressForRecord } from './chronicle.ts';
import { isWorldSeed } from './world-seed.ts';
import { type CharacterRepositoryPort, type SaveResult } from './character-storage.ts';
import { CHARACTER_SAVE_VERSION, type CharacterCheckpoint, type CharacterSave } from './character-save.ts';

/** A single active writer; every save is checked against the version this session loaded. */
export class CharacterSession {
  active: { index: number; record: CharacterSave; token: string | null } | null = null;
  error = '';
  readonly repository: CharacterRepositoryPort;
  private worldVersion: number;
  private createWorld?:UpgradeWorldFactory;
  constructor(repository: CharacterRepositoryPort, worldVersion: number, createWorld?:UpgradeWorldFactory) {
    this.repository = repository; this.worldVersion = worldVersion;this.createWorld=createWorld;
  }
  async load(index: number): Promise<CharacterSave | null> {
    await this.pending;
    const slot = await this.repository.read(index);
    if (!slot.record) { this.error = 'This character could not be loaded. The slot has been preserved.'; return null; }
    if (slot.record.worldVersion !== this.worldVersion) {
      if(!canUpgradeWorld(slot.record.worldVersion,this.worldVersion)){
        this.error = 'This character belongs to a different world version. Its save has been preserved.'; return null;
      }
      try{
        if(!this.createWorld)throw new Error('World upgrade is unavailable. The previous save is untouched.');
        const upgraded=upgradeWorldSave(slot.record,this.worldVersion,this.createWorld);
        const result=await this.repository.write(index,upgraded,slot.token);
        if(!this.accept(result))return null;
        slot.record=upgraded;slot.token=(result as {ok:true;token:string}).token;
      }catch(error){this.error=(error as Error).message;return null;}
    }
    slot.record.checkpoint.chronicle = progressForRecord(slot.record);
    this.active = { index, record: slot.record, token: slot.token }; this.error = '';
    return slot.record;
  }
  async create(index: number, name: string, worldSeed: number, checkpoint: CharacterCheckpoint, id: string, now: number): Promise<boolean> {
    await this.pending;
    if (!isWorldSeed(worldSeed)) { this.error = 'Enter a whole world seed from 0 to 4294967295.'; return false; }
    const slot = await this.repository.read(index);
    if (slot.state !== 'empty') { this.error = 'Choose an empty character slot.'; return false; }
    const record: CharacterSave = { version: CHARACTER_SAVE_VERSION, id, name: name.trim(), createdAt: now, updatedAt: now,
      worldSeed, worldVersion: this.worldVersion, checkpoint };
    record.checkpoint.chronicle = progressForRecord(record);
    const result = await this.repository.write(index, record, slot.token);
    if (!this.accept(result)) return false;
    this.active = { index, record, token: (result as { ok: true; token: string }).token }; return true;
  }
  private pending: Promise<unknown> = Promise.resolve();
  save(checkpoint: CharacterCheckpoint, now: number): Promise<boolean> {
    const owner = this.active?.record.id;
    const operation = this.pending.then(async () => {
      if (!owner) return true;
      if (this.active?.record.id !== owner) { this.error = 'The active character changed before saving.'; return false; }
      const { index, record, token } = this.active;
      const next = { ...record, updatedAt: Math.max(record.updatedAt + 1, now), checkpoint };
      next.checkpoint.chronicle = progressForRecord(next);
      for(const old of record.checkpoint.chronicle?.sources??[]){const source=next.checkpoint.chronicle.sources.find(s=>s.id===old.id);if(source)for(const[k,at]of Object.entries(old.unlocked))source.unlocked[k]=Math.min(source.unlocked[k]??at,at);}
      const result = await this.repository.write(index, next, token);
      if (!this.accept(result)) return false;
      this.active = { index, record: next, token: (result as { ok: true; token: string }).token }; return true;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
  async flush() { await this.pending; }
  private accept(result: SaveResult): boolean { this.error = result.ok ? '' : result.message; return result.ok; }
}
