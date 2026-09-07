import type { ItemTier } from './character-types.ts';
import type { InventoryFilter, InventorySort } from './inventory-tools.ts';
import { TIER_NAMES } from './items.ts';
import { uiIcon } from './ui-components.ts';
import './item-filter-controls.css';

/** The inventory and vendors share the same controls and multi-selection behavior. */
export class ItemFilterControls {
  readonly filters = new Set<InventoryFilter>();
  readonly rarities = new Set<ItemTier>();
  get active(): boolean { return !!(this.filters.size || this.rarities.size); }

  markup(titleId: string, recent = true): string {
    return `<header><h3 id="${titleId}">Sort &amp; filter</h3><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-popup-close aria-label="Close sort and filter">${uiIcon('close')}</button></header>
      <div class="item-filter-row" role="group" aria-label="Sort items"><span>Sort</span>${(['rarity', 'type', ...(recent ? ['recent'] : [])] as InventorySort[]).map(mode => `<button type="button" class="ui-button ui-button--quiet" data-sort="${mode}">${mode === 'rarity' ? 'Rarity' : mode === 'type' ? 'Type' : 'Recent pickup'}</button>`).join('')}</div>
      <div class="item-filter-row" role="group" aria-label="Filter item type"><span>Type</span>${(['all', 'weapons', 'armor', 'jewelry', 'offhand'] as const).map(filter => `<button type="button" class="ui-button ui-button--quiet" data-filter="${filter}">${filter === 'offhand' ? 'Off-hand' : filter[0].toUpperCase() + filter.slice(1)}</button>`).join('')}</div>
      <div class="item-filter-row" role="group" aria-label="Filter item rarity"><span>Rarity</span><button type="button" class="ui-button ui-button--quiet" data-rarity="all">All</button>${Object.entries(TIER_NAMES).map(([tier, name]) => `<button type="button" class="ui-button ui-button--quiet" data-rarity="${tier}">${name}</button>`).join('')}</div>
      <button type="button" class="ui-button ui-button--quiet" data-clear-filters>Clear filters</button>`;
  }

  refresh(root: HTMLElement): void {
    for (const button of root.querySelectorAll<HTMLElement>('[data-filter]'))
      button.setAttribute('aria-pressed', String(button.dataset.filter === 'all' ? !this.filters.size : this.filters.has(button.dataset.filter as InventoryFilter)));
    for (const button of root.querySelectorAll<HTMLElement>('[data-rarity]'))
      button.setAttribute('aria-pressed', String(button.dataset.rarity === 'all' ? !this.rarities.size : this.rarities.has(button.dataset.rarity as ItemTier)));
  }

  click(target: Element, sort: (mode: InventorySort) => void): boolean {
    if (target.closest('[data-clear-filters]')) { this.filters.clear(); this.rarities.clear(); return true; }
    const mode = target.closest<HTMLElement>('[data-sort]')?.dataset.sort as InventorySort | undefined;
    if (mode) { sort(mode); return true; }
    const filter = target.closest<HTMLElement>('[data-filter]')?.dataset.filter as InventoryFilter | 'all' | undefined;
    const rarity = target.closest<HTMLElement>('[data-rarity]')?.dataset.rarity as ItemTier | 'all' | undefined;
    if (filter === 'all') this.filters.clear();
    else if (filter) { if (this.filters.has(filter)) this.filters.delete(filter); else this.filters.add(filter); }
    if (rarity === 'all') this.rarities.clear();
    else if (rarity) { if (this.rarities.has(rarity)) this.rarities.delete(rarity); else this.rarities.add(rarity); }
    return !!(filter || rarity);
  }
}
