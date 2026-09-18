/** Presentation-only area announcements. No combat, exploration or save mutations. */
export interface AreaBannerNotice { id: string; name: string; level: number; maxLevel?: number; }
export const AREA_BANNER_TIMING = Object.freeze({ enter: .8, hold: 2.8, exit: 1.2, duration: 4.8 });
export function areaThreat(area: Pick<AreaBannerNotice, 'level' | 'maxLevel'>, playerLevel: number) {
  if (playerLevel > (area.maxLevel ?? area.level)) return { color: '#b9c5c5', label: 'Outgrown' };
  if (playerLevel >= area.level) return { color: '#b9d7a3', label: 'Within range' };
  return area.level - playerLevel <= 4 ? { color: '#f0ca85', label: 'Challenging' } : { color: '#efa097', label: 'Dangerous' };
}
export function areaLevelLabel(area: Pick<AreaBannerNotice, 'level' | 'maxLevel'>): string {
  return area.maxLevel && area.maxLevel !== area.level ? `Mobs Lv ${area.level}–${area.maxLevel}` : `Mobs Lv ${area.level}`;
}
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function areaBannerOpacity(age: number): number {
  return smooth(age / AREA_BANNER_TIMING.enter) * (1 - smooth((age - AREA_BANNER_TIMING.enter - AREA_BANNER_TIMING.hold) / AREA_BANNER_TIMING.exit));
}
export function areaBannerLayout(width: number, height: number) {
  const vertical = Math.max(.38, Math.min(1, (height * .125 - 6) / 72));
  return { x: width / 2, y: height * .125, radius: Math.min(270, width * .44), vertical,
    titleSize: Math.min(34, Math.max(20, 34 * vertical), Math.max(20, width * .066)),
    smallSize: vertical < .7 ? 12 : 15 };
}
/** Stable district entry; brief crossings and blended borders cannot spam banners. */
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
/** One latest destination, never a backlog of places the player has already left. */
export class AreaBanner {
  notice: Readonly<AreaBannerNotice> | null = null;
  age = 0;
  show(notice: AreaBannerNotice): void { this.notice = { ...notice }; this.age = 0; }
  retain(id: string): void { if (this.notice?.id !== id) this.clear(); }
  clear(): void { this.notice = null; this.age = 0; }
  update(dt: number, celebration: boolean): void {
    if (!this.notice) return;
    if (celebration) { this.age = 0; return; }
    this.age += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.age >= AREA_BANNER_TIMING.duration) this.clear();
  }
}
