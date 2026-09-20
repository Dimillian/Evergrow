import type { Attribute } from './character-types.ts';
import type { Player } from './model.ts';
import { characterStatDetails, type StatDetail } from './character-stat-details.ts';
import { characterStatTooltip } from './character-stat-tooltip.ts';
import { RetainedTooltip } from './retained-tooltip.ts';
import { escapeUI, uiIcon } from './ui-components.ts';
import './inventory-stats.css';

/** Compact live projection of the same stats as Character; spending remains command-owned. */
export class InventoryStats {
  readonly element: HTMLElement;
  private readonly tooltip: RetainedTooltip;
  private readonly life = new AbortController();
  private readonly details = new Map<string, StatDetail>();
  private signature = '';
  private player: Player | null = null;

  constructor(mount: HTMLElement, tooltipMount: HTMLElement, allocate?: (attribute: Attribute, amount: number) => void, inspecting?: () => void) {
    this.element = document.createElement('section');
    this.element.className = 'inventory-stats'; this.element.id = 'inventory-stats';
    this.element.dataset.section = '2'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Attributes and combat stats');
    this.element.innerHTML = '<header><h3>Attributes</h3><span data-stat-points></span></header><div class="inventory-stats-attributes"></div><div class="inventory-stats-details ui-scroll-area"></div>';
    mount.prepend(this.element);
    this.tooltip = new RetainedTooltip(tooltipMount, 'inventory-stat-tooltip', 'character-stat-tooltip');
    const options = { signal: this.life.signal };
    const show = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest<HTMLElement>('[data-inventory-stat]') : null;
      const detail = anchor && this.details.get(anchor.dataset.inventoryStat!);
      if (anchor && detail) { inspecting?.(); this.tooltip.show(characterStatTooltip(detail), anchor); }
    };
    this.element.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') show(event.target); }, options);
    this.element.addEventListener('focusin', event => show(event.target), options);
    this.element.addEventListener('pointerout', () => this.tooltip.defer(), options);
    this.element.addEventListener('focusout', () => this.tooltip.defer(), options);
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-inventory-allocate]');
      if (button && !button.disabled) allocate?.(button.dataset.inventoryAllocate as Attribute, event.shiftKey ? 10 : 1);
      else if (document.documentElement.classList.contains('touch-mode')) show(event.target);
    }, options);
    this.element.addEventListener('scroll', () => this.hideTooltip(), { ...options, capture: true });
    this.element.dataset.canAllocate = String(!!allocate);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible; this.hideTooltip();
    if (visible && this.player) this.refresh(this.player);
  }

  refresh(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    this.hideTooltip();
    const groups = characterStatDetails(player);
    this.details.clear();
    for (const group of groups) for (const row of group.rows) this.details.set(row.id, row);
    const signature = JSON.stringify(groups.map(group => [group.tone, group.title, group.rows.map(row => [row.id, row.label])]));
    if (signature !== this.signature) {
      this.hideTooltip(); this.signature = signature;
      const row = (detail: StatDetail) => `<div class="inventory-stat-row" tabindex="0" data-inventory-stat="${escapeUI(detail.id)}"><span>${escapeUI(detail.label)}</span><strong data-stat-value></strong></div>`;
      this.element.querySelector('.inventory-stats-attributes')!.innerHTML = groups.filter(group => group.tone === 'attributes').flatMap(group => group.rows).map(detail => `<div class="inventory-stat-attribute">${row(detail)}${this.element.dataset.canAllocate === 'true' ? `<button type="button" class="ui-button ui-button--icon" data-inventory-allocate="${detail.id}" aria-label="Increase ${escapeUI(detail.label)}" data-tooltip="Spend 1 point · Shift-click: spend up to 10">${uiIcon('plus')}</button>` : ''}</div>`).join('');
      this.element.querySelector('.inventory-stats-details')!.innerHTML = groups.filter(group => group.tone !== 'attributes').map(group => `<section><h4>${escapeUI(group.title)}</h4>${group.rows.map(row).join('')}</section>`).join('');
    }
    this.element.querySelector('[data-stat-points]')!.textContent = player.character.statPoints > 0 ? `${player.character.statPoints.toLocaleString('en-US')} available` : 'All assigned';
    for (const anchor of this.element.querySelectorAll<HTMLElement>('[data-inventory-stat]')) {
      const value = this.details.get(anchor.dataset.inventoryStat!)!.value;
      const output = anchor.querySelector('[data-stat-value]')!;
      if (output.textContent !== value) { output.textContent = value; this.hideTooltip(); }
    }
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-inventory-allocate]')) {
      if (player.character.statPoints <= 0 && document.activeElement === button)
        button.parentElement!.querySelector<HTMLElement>('[data-inventory-stat]')!.focus({ preventScroll: true });
      button.disabled = player.character.statPoints <= 0;
    }
  }

  hideTooltip(): void { this.tooltip.hide(); }
  dispose(): void { this.life.abort(); this.tooltip.dispose(); this.element.remove(); this.player = null; }
}
