import type { ControlStorage } from './control-bindings.ts';

/** Coordinates are CSS pixels relative to the exact aim point; shared by SVG and Canvas. */
export const CURSOR_STYLES = [
  { id: 'crosshair', name: 'Crosshair', description: 'Bold ivory sight', color: '#fff3c4',
    path: 'M-15 0H-6M6 0H15M0-15V-6M0 6V15' },
  { id: 'halo', name: 'Halo', description: 'Cyan target ring', color: '#81f5ff',
    path: 'M12 0A12 12 0 1 1-12 0A12 12 0 1 1 12 0M-17 0H-12M12 0H17M0-17V-12M0 12V17' },
  { id: 'diamond', name: 'Diamond', description: 'Golden open center', color: '#ffdb69',
    path: 'M0-16L16 0L0 16L-16 0Z' },
  { id: 'arrow', name: 'Arrow', description: 'Ivory pointer · aim at tip', color: '#ffffff',
    path: 'M0 0L3 28L10 21L17 32L23 28L16 17L26 15Z' },
] as const;
export type CursorStyle = typeof CURSOR_STYLES[number]['id'];
export const DEFAULT_CURSOR: CursorStyle = 'crosshair';
export const CURSOR_STORAGE_KEY = 'evergrow-cursor-v1';
export const CURSOR_SIZE_STORAGE_KEY = 'evergrow-cursor-size-v1';
export const CURSOR_SIZE = Object.freeze({ min: 50, max: 250, step: 10, default: 100 });
export function validCursorSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= CURSOR_SIZE.min
    && value <= CURSOR_SIZE.max && value % CURSOR_SIZE.step === 0;
}
export function isCursorStyle(value: unknown): value is CursorStyle {
  return CURSOR_STYLES.some(style => style.id === value);
}

/** Device-only presentation preference; unavailable storage must not prevent selection. */
export class CursorPreference {
  private value: CursorStyle = DEFAULT_CURSOR;
  private sizeValue: number = CURSOR_SIZE.default;
  private readonly storage?: ControlStorage;
  constructor(storage?: ControlStorage) {
    this.storage = storage;
    try {
      const saved = storage?.getItem(CURSOR_STORAGE_KEY);
      if (isCursorStyle(saved)) this.value = saved;
    } catch { /* Keep the default when storage is blocked. */ }
    try {
      const saved = Number(storage?.getItem(CURSOR_SIZE_STORAGE_KEY));
      if (validCursorSize(saved)) this.sizeValue = saved;
    } catch { /* Size falls back independently of style. */ }
  }
  get style(): CursorStyle { return this.value; }
  get size(): number { return this.sizeValue; }
  select(value: unknown): 'saved' | 'session' | 'invalid' {
    if (!isCursorStyle(value)) return 'invalid';
    this.value = value;
    return this.persist(CURSOR_STORAGE_KEY, value);
  }
  setSize(value: unknown): 'saved' | 'session' | 'invalid' {
    if (!validCursorSize(value)) return 'invalid';
    this.sizeValue = value;
    return this.persist(CURSOR_SIZE_STORAGE_KEY, String(value));
  }
  reset(): 'saved' | 'session' {
    const style = this.select(DEFAULT_CURSOR), size = this.setSize(CURSOR_SIZE.default);
    return style === 'saved' && size === 'saved' ? 'saved' : 'session';
  }
  private persist(key: string, value: string): 'saved' | 'session' {
    try {
      if (this.storage) { this.storage.setItem(key, value); return 'saved'; }
    } catch { /* The live preference still applies. */ }
    return 'session';
  }
}
