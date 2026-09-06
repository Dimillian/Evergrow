import { CHARACTER_SLOT_COUNT, decodeCharacterSave, type CharacterSave } from './character-save.ts';
export interface CharacterStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface SaveSlot { index: number; record: CharacterSave | null; token: string | null; state: 'empty' | 'saved' | 'recovered' | 'invalid' | 'unavailable'; }
export type SaveResult = { ok: true; token: string } | { ok: false; message: string };
export interface CharacterRepositoryPort {
  read(index: number): SaveSlot | Promise<SaveSlot>;
  list(): SaveSlot[] | Promise<SaveSlot[]>;
  write(index: number, record: CharacterSave, expected: string | null): SaveResult | Promise<SaveResult>;
  remove(index: number, expected: string | null): SaveResult | Promise<SaveResult>;
}
export const characterSlotKey = (index: number) => `evergrow:character:1:${index}`;
const TOMBSTONE = '{"deleted":true}';

/** Headless record validation used inside the worker transaction and memory-only reviews. */
export class CharacterRepository {
  private storage: CharacterStorage | null;
  constructor(storage: CharacterStorage | null) { this.storage = storage; }
  read(index: number): SaveSlot {
    if (!Number.isInteger(index) || index < 0 || index >= CHARACTER_SLOT_COUNT) throw new RangeError('Invalid character slot.');
    if (!this.storage) return { index, record: null, token: null, state: 'unavailable' };
    try {
      const raw = this.storage.getItem(characterSlotKey(index));
      if (raw === TOMBSTONE) return { index, record: null, token: raw, state: 'empty' };
      const record = raw && decodeCharacterSave(raw);
      if (record) return { index, record, token: raw, state: 'saved' };
      const backup = this.storage.getItem(characterSlotKey(index) + ':backup');
      const recovered = backup && decodeCharacterSave(backup);
      if (recovered) return { index, record: recovered, token: raw, state: 'recovered' };
      return { index, record: null, token: raw, state: raw !== null || backup !== null ? 'invalid' : 'empty' };
    } catch { return { index, record: null, token: null, state: 'unavailable' }; }
  }
  list(): SaveSlot[] { return Array.from({ length: CHARACTER_SLOT_COUNT }, (_, i) => this.read(i)); }
  write(index: number, record: CharacterSave, expected: string | null): SaveResult {
    const raw = JSON.stringify(record);
    if (!decodeCharacterSave(raw)) return { ok: false, message: 'This character checkpoint is invalid. The previous save is untouched.' };
    return this.commit(index, raw, expected);
  }
  remove(index: number, expected: string | null): SaveResult {
    const result = this.commit(index, TOMBSTONE, expected);
    if (result.ok) try { this.storage?.setItem(characterSlotKey(index) + ':backup', TOMBSTONE); } catch { /* The primary tombstone already prevents recovery. */ }
    return result;
  }
  private commit(index: number, raw: string, expected: string | null): SaveResult {
    if (!this.storage) return { ok: false, message: 'Local saving is unavailable. Enable browser storage to create or continue a character.' };
    const slot = this.read(index);
    if (slot.state === 'unavailable') return { ok: false, message: 'Character storage could not be read. Your previous save is untouched.' };
    if (slot.token !== expected) return { ok: false, message: 'This character changed in another tab. Return to the character hall and reload it before saving.' };
    try {
      if (slot.record) this.storage.setItem(characterSlotKey(index) + ':backup', JSON.stringify(slot.record));
      this.storage.setItem(characterSlotKey(index), raw);
      return { ok: true, token: raw };
    } catch { return { ok: false, message: 'Could not save: browser storage is full or unavailable. Keep this tab open and free storage before retrying.' }; }
  }
}
