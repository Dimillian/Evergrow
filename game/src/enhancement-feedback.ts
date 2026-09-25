import type { ServiceResult } from './commerce.ts';
export const ENHANCEMENT_CHARGE_MS = 1600;
export const ENHANCEMENT_SKIP_KEY = 'evergrow-enhancement-skip-v1';

interface PreferenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
/** Device-only preference; reviews can supply an instance without storage. */
export class EnhancementPreference {
  skip = false;
  private storage?: PreferenceStorage;
  constructor(storage?: PreferenceStorage) {
    this.storage = storage;
    try { this.skip = storage?.getItem(ENHANCEMENT_SKIP_KEY) === 'true'; } catch { /* Session preference still works. */ }
  }
  setSkip(value: boolean): boolean {
    this.skip = value;
    try { if (this.storage) { this.storage.setItem(ENHANCEMENT_SKIP_KEY, String(value)); return true; } } catch { /* Keep the session choice. */ }
    return false;
  }
}

export type EnhancementResult = ServiceResult;
export type EnhancementPhase = 'charging' | 'saving';
type Schedule = (done: () => void, milliseconds: number) => () => void;

/** The charge is cancellable. Only its final tick may start the saved transaction. */
export class EnhancementSequence {
  private version = 0;
  private active = false;
  private finishCharge: ((complete: boolean) => void) | null = null;
  private schedule: Schedule;
  constructor(schedule: Schedule = (done, ms) => {
    const timer = setTimeout(done, ms);
    return () => clearTimeout(timer);
  }) { this.schedule = schedule; }

  skip(): void { this.finishCharge?.(true); }
  cancel(): boolean {
    if (!this.finishCharge) return false;
    this.finishCharge(false);
    return true;
  }
  dispose(): void { this.version++; this.cancel(); this.active = false; }

  async run(commit: () => Promise<EnhancementResult>, animate: boolean, phase: (value: EnhancementPhase) => void, duration = ENHANCEMENT_CHARGE_MS): Promise<EnhancementResult | null> {
    if (this.active) return null;
    this.active = true;
    const version = ++this.version;
    if (animate) {
      phase('charging');
      const completed = await new Promise<boolean>(resolve => {
        const cancel = this.schedule(() => { if (version === this.version) this.skip(); }, duration);
        this.finishCharge = complete => {
          cancel(); this.finishCharge = null; resolve(complete);
        };
      });
      if (version !== this.version) return null;
      if (!completed) { this.active = false; return null; }
    }
    phase('saving');
    let result: EnhancementResult;
    try { result = await commit(); }
    catch { result = { ok: false, message: 'Could not complete the save. No purchase was committed.' }; }
    if (version !== this.version) return null;
    this.active = false;
    return result;
  }
}
