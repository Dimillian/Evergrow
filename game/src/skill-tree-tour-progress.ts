export const SKILL_TOUR_STORAGE_KEY = 'evergrow-skill-atlas-guide-v1';
interface TourStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** A device preference, independent of characters, cloud saves and progression. */
export class SkillTourProgress {
  private dismissed = false;
  private readonly storage?: TourStorage;
  constructor(storage?: TourStorage) {
    this.storage = storage;
    try { this.dismissed = storage?.getItem(SKILL_TOUR_STORAGE_KEY) === 'seen'; } catch { /* Session-only preference. */ }
  }
  get shouldOffer(): boolean { return !this.dismissed; }
  dismiss(): void {
    this.dismissed = true;
    try { this.storage?.setItem(SKILL_TOUR_STORAGE_KEY, 'seen'); } catch { /* Keep dismissal for this session. */ }
  }
}
