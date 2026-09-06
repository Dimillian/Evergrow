import { isWorldSeed } from './world-seed.ts';
import { CharacterRepository, type SaveResult } from './character-storage.ts';
import { CHARACTER_SAVE_VERSION, type CharacterCheckpoint, type CharacterSave } from './character-save.ts';

/** A single active writer; every save is checked against the version this session loaded. */
export class CharacterSession {
  active: { index: number; record: CharacterSave; token: string | null } | null = null;
  error = '';
  readonly repository: CharacterRepository;
  private worldVersion: number;
  constructor(repository: CharacterRepository, worldVersion: number) {
    this.repository = repository; this.worldVersion = worldVersion;
  }
  load(index: number): CharacterSave | null {
    const slot = this.repository.read(index);
    if (!slot.record) { this.error = 'This character could not be loaded. The slot has been preserved.'; return null; }
    if (slot.record.worldVersion !== this.worldVersion) {
      this.error = 'This character belongs to a different world version. Its save has been preserved.'; return null;
    }
    this.active = { index, record: slot.record, token: slot.token }; this.error = '';
    return slot.record;
  }
  create(index: number, name: string, worldSeed: number, checkpoint: CharacterCheckpoint, id: string, now: number): boolean {
    if (!isWorldSeed(worldSeed)) { this.error = 'Enter a whole world seed from 0 to 4294967295.'; return false; }
    const slot = this.repository.read(index);
    if (slot.state !== 'empty') { this.error = 'Choose an empty character slot.'; return false; }
    const record: CharacterSave = { version: CHARACTER_SAVE_VERSION, id, name: name.trim(), createdAt: now, updatedAt: now,
      worldSeed, worldVersion: this.worldVersion, checkpoint };
    const result = this.repository.write(index, record, slot.token);
    if (!this.accept(result)) return false;
    this.active = { index, record, token: (result as { ok: true; token: string }).token }; return true;
  }
  save(checkpoint: CharacterCheckpoint, now: number): boolean {
    if (!this.active) return true;
    const { index, record, token } = this.active;
    const next = { ...record, updatedAt: Math.max(record.updatedAt + 1, now), checkpoint };
    const result = this.repository.write(index, next, token);
    if (!this.accept(result)) return false;
    this.active = { index, record: next, token: (result as { ok: true; token: string }).token }; return true;
  }
  private accept(result: SaveResult): boolean { this.error = result.ok ? '' : result.message; return result.ok; }
}
