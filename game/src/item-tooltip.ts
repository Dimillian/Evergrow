import type { Item } from './character-types.ts';
import { itemHoverCards, type ItemPresentation } from './item-ui.ts';
import { UITooltip } from './ui-tooltip.ts';
import './item-ui.css';

/** Equipment content uses the shared tooltip surface, positioning and focus association. */
export class ItemTooltip {
  readonly element: HTMLDivElement;
  private readonly surface: UITooltip;
  constructor(mount: HTMLElement, id: string) {
    this.surface = new UITooltip(mount, id, 'ui-item-tooltip-group');
    this.element = this.surface.element;
  }
  show(item: Item, view: ItemPresentation, anchor: HTMLElement, bounds = anchor.getBoundingClientRect() as Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    const cards = itemHoverCards(item, view);
    this.element.style.setProperty('--tooltip-columns', String(cards.length));
    this.surface.show(cards.join(''), anchor, bounds);
    this.orderCards(bounds);
  }
  position(bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    this.surface.position(bounds);
    this.orderCards(bounds);
  }
  private orderCards(bounds: Pick<DOMRect, 'left' | 'right'>): void {
    const cards = [...this.element.children] as HTMLElement[];
    if (cards.length < 2) return;
    // Choose the visual column nearest the hovered slot after viewport clamping.
    // This also handles three-card hand comparisons and below-anchor placement.
    const centers = cards.map(card => {
      const rect = card.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }).sort((a, b) => a - b);
    const anchor = (bounds.left + bounds.right) / 2;
    const nearest = centers.reduce((best, center, index) =>
      Math.abs(center - anchor) < Math.abs(centers[best] - anchor) ? index : best, 0);
    // Keep candidate-first DOM semantics and styling; reorder only the visual grid.
    // Stacked mobile cards share a column, so the candidate remains first.
    cards.forEach((card, index) => {
      card.style.order = String(index === 0 ? nearest : index <= nearest ? index - 1 : index);
    });
  }
  hide(): void { this.surface.hide(); }
  dispose(): void { this.surface.dispose(); }
}
