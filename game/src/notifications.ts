import { itemDisplayName } from './items.ts';
import { formatGold } from './currency-format.ts';
import { NotificationQueue, type GameNotice, type NoticeEntry } from './notification-queue.ts';
import { itemIconSVG } from './item-art.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { POI_DEFINITIONS } from './world-pois.ts';
import { escapeUI, uiIcon } from './ui-components.ts';
import './notifications.css';

/** Native-resolution passive notices. Never intercepts input or changes game state. */
export class GameNotifications {
  private element: HTMLElement;
  private feed = new NotificationQueue(2);
  private cards = new Map<number, { element: HTMLElement; notice: GameNotice }>();
  private frame = 0;
  private last = 0;
  private disposed = false;
  private autoAdvance: boolean;
  private announcements = new Map<number, string>();
  private announceScheduled = false;
  constructor(mount: HTMLElement, options: { autoAdvance?: boolean } = {}) {
    this.autoAdvance = options.autoAdvance ?? true;
    this.element = document.createElement('div'); this.element.className = 'game-notifications';
    this.element.innerHTML = '<div class="notification-feed"></div><div class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>';
    mount.append(this.element);
  }
  push(notice: GameNotice): void {
    if (this.disposed) return;
    this.feed.push(notice);
    this.render();
    if (this.autoAdvance && !this.frame) { this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
  }
  info(message: string): void { this.push({ kind: 'info', message }); }
  clear(): void {
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.announcements.clear();
    this.feed.clear(); this.render();
    this.element.querySelector('[role="status"]')!.textContent = '';
  }
  dispose(): void { this.clear(); this.disposed = true; this.element.remove(); }
  private tick = (now: number): void => {
    const dt = Math.min(.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.feed.advance(dt); this.render();
    this.frame = this.feed.idle ? 0 : requestAnimationFrame(this.tick);
  };
  private render(): void {
    const announced = new Map<number, string>();
    const lane = (selector: string, entries: readonly NoticeEntry[], cards: typeof this.cards) => {
      const parent = this.element.querySelector(selector)!;
      for (const [id, card] of cards) if (!entries.some(entry => entry.id === id)) { card.element.remove(); cards.delete(id); }
      for (const entry of entries) {
        let card = cards.get(entry.id);
        const fresh = !card;
        if (!card) {
          const element = document.createElement('article'); element.className = 'notification-card'; element.setAttribute('aria-hidden', 'true');
          card = { element, notice: entry.notice }; cards.set(entry.id, card); parent.append(element);
        }
        if (fresh || card.notice !== entry.notice) {
          const notice = entry.notice; card.notice = notice;
          let title: string, detail: string, icon: string, color: string;
          if (notice.kind === 'loot') {
            title = itemDisplayName(notice.item); detail = `${TIER_NAMES[notice.item.tier]} · Item level ${notice.item.itemLevel}`;
            icon = itemIconSVG(notice.item, 46); color = TIER_COLORS[notice.item.tier];

          } else if (notice.kind === 'rewards') {
            title = [notice.gold ? `+${formatGold(notice.gold)} Gold` : '', notice.xp ? `+${formatGold(notice.xp)} XP` : ''].filter(Boolean).join(' · ');
            detail = ''; icon = uiIcon('diamond'); color = notice.gold ? '#e3c880' : '#c7aff0';
          } else if (notice.kind === 'level') {
            title = `Level ${notice.level}`;
            detail = `+${notice.skillPoints} skill ${notice.skillPoints === 1 ? 'point' : 'points'}  ·  +${notice.statPoints} stat ${notice.statPoints === 1 ? 'point' : 'points'}`;
            icon = uiIcon('star'); color = '#c7aff0';
          } else if (notice.kind === 'discovery') {
            title = notice.poi.name; detail = `${POI_DEFINITIONS[notice.poi.kind].label} discovered`;
            icon = uiIcon(notice.poi.kind === 'camp' ? 'sword' : notice.poi.kind === 'town' ? 'map' : 'lantern');
            color = POI_DEFINITIONS[notice.poi.kind].color;
          } else if (notice.kind === 'area') {
            title = notice.name; detail = `Area level ${notice.level}`; icon = uiIcon('leaf'); color = '#a8cbb5';
          } else { title = notice.message; detail = ''; icon = uiIcon('diamond'); color = '#d8b780'; }
          card.element.dataset.kind = notice.kind;
          card.element.style.setProperty('--notice-accent', color);
          const heading = notice.kind === 'rewards'
            ? `<span class="notification-reward-totals">${notice.gold ? `<b class="notification-reward-gold">+${escapeUI(formatGold(notice.gold))} Gold</b>` : ''}${notice.xp ? `<b class="notification-reward-xp">+${escapeUI(formatGold(notice.xp))} XP</b>` : ''}</span>`
            : notice.kind === 'level' ? `Level <b class="notification-number">${escapeUI(notice.level)}</b>` : escapeUI(title);
          card.element.innerHTML = `<span class="notification-icon">${icon}</span><div class="notification-copy"><strong>${heading}</strong>${detail ? `<span>${escapeUI(detail)}</span>` : ''}</div><i class="notification-flourish" aria-hidden="true"></i>`;
          announced.set(entry.id, `${title}${detail ? `. ${detail}` : ''}`);
        }
        card.element.classList.toggle('is-leaving', entry.age >= entry.duration);
      }
    };
    lane('.notification-feed', this.feed.visible, this.cards);
    if (announced.size) {
      for (const [id, message] of announced) this.announcements.set(id, message);
      if (!this.announceScheduled) {
        this.announceScheduled = true;
        queueMicrotask(() => {
          this.announceScheduled = false;
          if (!this.disposed && this.announcements.size)
            this.element.querySelector('[role="status"]')!.textContent = [...this.announcements.values()].join('. ');
          this.announcements.clear();
        });
      }
    }
  }
}
