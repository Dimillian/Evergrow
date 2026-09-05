import type { Item } from './character-types.ts';
import { TIER_COLORS } from './items.ts';
import { itemTooltipMarkup, type ItemPresentation } from './item-ui.ts';
import './item-ui.css';

/** Shared item tooltip mounting, placement and accessibility; motion comes from ui-tooltip. */
export class ItemTooltip {
  readonly element: HTMLDivElement;
  private anchor: HTMLElement | null = null;
  constructor(mount: HTMLElement, id: string) {
    this.element = document.createElement('div'); this.element.className = 'ui-tooltip ui-item-tooltip';
    this.element.id = id; this.element.setAttribute('role', 'tooltip'); this.element.hidden = true; mount.append(this.element);
  }
  show(item: Item, view: ItemPresentation, anchor: HTMLElement): void {
    if (this.anchor !== anchor) this.detach();
    this.anchor = anchor;
    this.element.innerHTML = itemTooltipMarkup(item, view);
    this.element.style.setProperty('--item-color', TIER_COLORS[item.tier]); this.element.dataset.tier = item.tier;
    this.element.hidden = false;
    const descriptions = new Set((anchor.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
    descriptions.add(this.element.id); anchor.setAttribute('aria-describedby', [...descriptions].join(' '));
    const bounds = anchor.getBoundingClientRect(), viewportWidth = document.documentElement.clientWidth, viewportHeight = document.documentElement.clientHeight;
    const width = this.element.offsetWidth, height = this.element.offsetHeight;
    let left = bounds.right + 12;
    if (left + width > viewportWidth - 12) left = bounds.left - width - 12;
    this.element.style.left = `${Math.max(8, Math.min(viewportWidth - width - 8, left))}px`;
    this.element.style.top = `${Math.max(8, Math.min(viewportHeight - height - 8, bounds.top - 12))}px`;
  }
  private detach(): void {
    if (!this.anchor) return;
    const remaining = (this.anchor.getAttribute('aria-describedby') ?? '').split(' ').filter(id => id && id !== this.element.id);
    if (remaining.length) this.anchor.setAttribute('aria-describedby', remaining.join(' ')); else this.anchor.removeAttribute('aria-describedby');
    this.anchor = null;
  }
  hide(): void { this.detach(); this.element.hidden = true; }
  dispose(): void { this.hide(); this.element.remove(); }
}
