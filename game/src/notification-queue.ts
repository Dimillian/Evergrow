import type { Item } from './character-types.ts';
import type { WorldPOI } from './world-pois.ts';

export type GameNotice =
  | { kind: 'loot'; item: Item }
  | { kind: 'discovery'; poi: WorldPOI }
  | { kind: 'area'; id: string; name: string; level: number; maxLevel?: number }
  | { kind: 'info'; message: string };
export interface NoticeEntry { id: number; notice: GameNotice; age: number; duration: number; }
export const NOTICE_EXIT_SECONDS = .22;
const key = (notice: GameNotice): string => notice.kind === 'loot' ? `loot:${notice.item.id}`
  : notice.kind === 'discovery' ? `poi:${notice.poi.id}` : notice.kind === 'area' ? `area:${notice.id}`
    : `info:${notice.message}`;
const duration = (notice: GameNotice) => notice.kind === 'loot' ? 3.6 : 2.8;

/** Bounded feed with queued pickups and immediate action feedback. */
export class NotificationQueue {
  readonly visible: NoticeEntry[] = [];
  private pending: GameNotice[] = [];
  private nextId = 1;
  private capacity: number;
  constructor(capacity: number) { this.capacity = Math.max(1, Math.floor(capacity)); }
  get idle(): boolean { return !this.visible.length && !this.pending.length; }
  get pendingCount(): number { return this.pending.length; }
  push(notice: GameNotice): void {
    const active = this.visible.find(entry => key(entry.notice) === key(notice));
    const waiting = this.pending.findIndex(value => key(value) === key(notice));
    if (active) {
      active.notice = notice; active.age = 0; active.duration = duration(notice);
      // The compact mobile feed shows its last card, so renewed feedback belongs there.
      if (notice.kind === 'info') { this.visible.splice(this.visible.indexOf(active), 1); this.visible.push(active); }
      return;
    }
    if (notice.kind === 'info') {
      // A click result must not wait behind a burst of loot. Keep displaced pickups queued.
      const previous = this.visible.findIndex(entry => entry.notice.kind === 'info');
      if (previous >= 0) this.visible.splice(previous, 1);
      else if (this.visible.length >= this.capacity) this.pending.unshift(this.visible.pop()!.notice);
      this.visible.push({ id: this.nextId++, notice, age: 0, duration: duration(notice) });
      if (this.pending.length > 24) this.pending.pop();
      return;
    }
    if (waiting >= 0) { this.pending[waiting] = notice; return; }
    this.pending.push(notice);
    if (this.pending.length > 24) this.pending.shift();
    this.promote();
  }
  advance(dt: number): void {
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    for (const entry of this.visible) entry.age += elapsed;
    for (let i = this.visible.length - 1; i >= 0; i--)
      if (this.visible[i].age >= this.visible[i].duration + NOTICE_EXIT_SECONDS) this.visible.splice(i, 1);
    this.promote();
  }
  clear(): void { this.visible.length = 0; this.pending = []; }
  private promote(): void {
    while (this.visible.length < this.capacity && this.pending.length) {
      const notice = this.pending.shift()!;
      const feedback = this.visible.findIndex(entry => entry.notice.kind === 'info');
      this.visible.splice(feedback < 0 ? this.visible.length : feedback, 0,
        { id: this.nextId++, notice, age: 0, duration: duration(notice) });
    }
  }
}

/** Stable biome entry, with hysteresis so a blended border cannot spam banners. */
export class AreaNoticeTracker {
  private current = '';
  private candidate = '';
  private time = 0;
  private cooldown = 0;
  reset(id: string): void { this.current = this.candidate = id; this.time = this.cooldown = 0; }
  update(id: string, dt: number): boolean {
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.cooldown = Math.max(0, this.cooldown - elapsed);
    if (id === this.current) { this.candidate = id; this.time = 0; return false; }
    if (id !== this.candidate) { this.candidate = id; this.time = 0; }
    this.time += elapsed;
    if (this.time < 1.6 || this.cooldown > 0) return false;
    this.current = id; this.time = 0; this.cooldown = 6; return true;
  }
}
