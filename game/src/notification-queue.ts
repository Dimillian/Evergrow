import type { Item } from './character-types.ts';
import type { WorldPOI } from './world-pois.ts';

export type GameNotice =
  | { kind: 'loot'; item: Item }
  | { kind: 'level'; level: number; skillPoints: number; statPoints: number }
  | { kind: 'discovery'; poi: WorldPOI }
  | { kind: 'area'; id: string; name: string; level: number }
  | { kind: 'info'; message: string };
export interface NoticeEntry { id: number; notice: GameNotice; age: number; duration: number; }
export const NOTICE_EXIT_SECONDS = .22;
const key = (notice: GameNotice): string => notice.kind === 'loot' ? `loot:${notice.item.id}`
  : notice.kind === 'discovery' ? `poi:${notice.poi.id}` : notice.kind === 'area' ? `area:${notice.id}`
    : notice.kind === 'info' ? `info:${notice.message}` : notice.kind;
const duration = (notice: GameNotice) => notice.kind === 'level' ? 3.5 : notice.kind === 'loot' ? 3.6 : 2.8;

/** Bounded feed with individual item pickups and priority for level rewards. */
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
    const merge = (previous: GameNotice): GameNotice => notice.kind === 'level' && previous.kind === 'level'
      ? { kind: 'level', level: Math.max(previous.level, notice.level),
        skillPoints: previous.skillPoints + notice.skillPoints, statPoints: previous.statPoints + notice.statPoints } : notice;
    if (active) { active.notice = merge(active.notice); active.age = 0; active.duration = duration(active.notice); return; }
    if (waiting >= 0) { this.pending[waiting] = merge(this.pending[waiting]); return; }
    if (notice.kind === 'level') this.pending.unshift(notice); else this.pending.push(notice);
    // Keep the newest events during exceptional bursts; a queued level-up is protected.
    if (this.pending.length > 24) {
      const index = this.pending.findIndex(value => value.kind !== 'level');
      this.pending.splice(index < 0 ? this.pending.length - 1 : index, 1);
    }
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
      this.visible.push({ id: this.nextId++, notice, age: 0, duration: duration(notice) });
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
