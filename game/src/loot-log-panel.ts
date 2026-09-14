import type { CharacterSheet, GroundItem } from './character-types.ts';
import type { Expeditions } from './dungeon-state.ts';
import { itemIconSVG } from './item-art.ts';
import { itemTooltipMarkup } from './item-ui.ts';
import { itemDisplayName, TIER_COLORS, TIER_NAMES } from './items.ts';
import { LOOT_LOG_LIMIT, lootLogAge, lootLogLocation, type LootLogEntry } from './loot-log.ts';
import { escapeUI as e, trapDialogFocus, uiIcon } from './ui-components.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import { effectExplanation } from './effect-terms.ts';
import './item-ui.css';
import './loot-log-panel.css';

export interface LootLogView {
  entries: readonly LootLogEntry[]; sheet: CharacterSheet; level: number; time: number;
  ground: readonly GroundItem[]; expeditions?: Expeditions;
}

/** Read-only pickup snapshots in the shared window and item presentation. */
export class LootLogPanel {
  readonly element: HTMLElement;
  private readonly life = new AbortController();
  private readonly explanations: UITooltipStack;
  private focus?: ReturnType<typeof trapDialogFocus>;
  private view?: LootLogView;
  private selected = 0;
  private lastScroll = 0;

  constructor(mount: HTMLElement, close: () => void) {
    this.element = document.createElement('section');
    this.element.className = 'loot-log-panel'; this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window loot-log-window" role="dialog" aria-modal="true" aria-labelledby="loot-log-title">
      <header class="ui-window-header"><span class="loot-log-emblem">${uiIcon('journal')}</span><div><h2 class="ui-title" id="loot-log-title">Loot log</h2><p class="ui-muted">This character · Recent pickups</p></div><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close loot log">×</button></header>
      <div class="loot-log-columns"><nav class="loot-log-history ui-scroll-area" aria-label="Recent pickups"><div class="loot-log-list-heading"><span>Newest first</span><span data-count></span></div><div data-entries></div></nav><section class="loot-log-detail ui-scroll-area" aria-label="Selected pickup details" aria-live="polite"></section></div>
      <footer class="ui-window-footer"><span>Stats recorded at pickup · Last ${LOOT_LOG_LIMIT} items</span><span>Game paused</span></footer></section>`;
    mount.append(this.element);
    this.explanations = new UITooltipStack(this.element, effectExplanation);
    this.element.querySelector('[data-close]')!.addEventListener('click', close, { signal: this.life.signal });
    this.element.querySelector('[data-entries]')!.addEventListener('click', event => {
      const row = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-entry]');
      if (!row) return;
      this.select(Number(row.dataset.entry));
    }, { signal: this.life.signal });
    this.element.querySelector('[data-entries]')!.addEventListener('keydown', event => {
      const key = (event as KeyboardEvent).key;
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key) || !this.view?.entries.length) return;
      event.preventDefault();
      const max = this.view.entries.length - 1;
      this.select(key === 'Home' ? max : key === 'End' ? 0 : Math.max(0, Math.min(max, this.selected + (key === 'ArrowUp' ? 1 : -1))));
      this.element.querySelector<HTMLButtonElement>(`[data-entry="${this.selected}"]`)?.focus();
    }, { signal: this.life.signal });
  }

  open(view: LootLogView): void {
    this.close(); this.view = view; this.selected = Math.max(0, view.entries.length - 1);
    this.element.querySelector('[data-count]')!.textContent = `${view.entries.length} items`;
    this.element.querySelector('[data-entries]')!.innerHTML = view.entries.length ? view.entries.map((entry, index) => {
      const sold = lootLogLocation(entry, view.sheet, view.ground, view.expeditions) === 'Sold · Town merchant';
      return `<button type="button" class="loot-log-row" data-entry="${index}" aria-pressed="${index === this.selected}" style="--item-color:${TIER_COLORS[entry.item.tier]}"><span class="loot-log-item-icon">${itemIconSVG(entry.item, 44)}</span><span class="loot-log-row-copy"><strong>${e(itemDisplayName(entry.item))}</strong><span><span>${e(TIER_NAMES[entry.item.tier])} · Lv. ${entry.item.itemLevel}</span><span>${lootLogAge(entry.time, view.time)}</span></span>${sold ? '<span class="loot-log-sold">Sold</span>' : ''}</span></button>`;
    }).reverse().join('')
      : '<p class="loot-log-empty">No pickups yet.<br>Items you collect will appear here.</p>';
    this.select(this.selected);
    this.element.hidden = false;
    this.focus = trapDialogFocus(this.element, { signal: this.life.signal, restoreFocus: false,
      initialFocus: () => this.element.querySelector<HTMLButtonElement>(`[data-entry="${this.selected}"]`) ?? this.element.querySelector('[data-close]') });
  }

  close(): void { this.explanations.hide(); this.focus?.dispose(); this.focus = undefined; this.element.hidden = true; this.view = undefined; this.lastScroll = 0; }
  dispose(): void { this.close(); this.explanations.dispose(); this.life.abort(); this.element.remove(); }
  scrollDetails(axis: number, now: number): void {
    const dt = this.lastScroll ? Math.min(.05, (now - this.lastScroll) / 1000) : 0;
    this.lastScroll = now;
    if (Math.abs(axis) > .2) {
      const detail = this.element.querySelector<HTMLElement>('.loot-log-detail')!;
      const scroll = detail.scrollHeight > detail.clientHeight ? detail : this.element.querySelector('.loot-log-columns')!;
      scroll.scrollTop += axis * dt * 550;
    }
  }

  private select(index: number): void {
    this.selected = index; this.explanations.hide();
    this.element.querySelectorAll<HTMLButtonElement>('[data-entry]').forEach(row => row.setAttribute('aria-pressed', String(Number(row.dataset.entry) === index)));
    const view = this.view, entry = view?.entries[index];
    const detail = this.element.querySelector<HTMLElement>('.loot-log-detail')!;
    if (!view || !entry) { detail.innerHTML = '<p class="loot-log-empty">Select a pickup to review its details.</p>'; return; }
    const item = entry.item;
    detail.innerHTML = `<div class="loot-log-snapshot ui-item-tooltip" data-tier="${item.tier}" style="--item-color:${TIER_COLORS[item.tier]}">
      <div class="loot-log-detail-icon" aria-hidden="true">${itemIconSVG(item, 70)}</div>
      ${itemTooltipMarkup(item, { sheet: view.sheet, level: view.level, compare: false })}</div>
      <dl class="loot-log-receipt"><div><dt>Picked up</dt><dd>${lootLogAge(entry.time, view.time)}</dd></div><div><dt>Location</dt><dd>${e(entry.location)}</dd></div><div><dt>Now</dt><dd>${e(lootLogLocation(entry, view.sheet, view.ground, view.expeditions))}</dd></div></dl>`;
    detail.scrollTop = 0;
  }
}
