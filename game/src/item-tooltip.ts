import { bestRingSlot, comparisonSlot, ItemComparisonInput } from './item-comparison.ts';
import type { Item } from './character-types.ts';
import { itemHoverCards, type ItemPresentation } from './item-ui.ts';
import { RetainedTooltip } from './retained-tooltip.ts';
import './item-ui.css';

/** Equipment content uses the shared tooltip surface, positioning and focus association. */
export class ItemTooltip {
  readonly element: HTMLDivElement;
  private readonly surface: RetainedTooltip;
  private readonly life = new AbortController();
  private readonly comparison: ItemComparisonInput;
  private current?: { item: Item; view: ItemPresentation; anchor: HTMLElement; bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> };

  constructor(mount: HTMLElement, id: string) {
    this.surface = new RetainedTooltip(mount, id, 'ui-item-tooltip-group');
    this.element = this.surface.element;
    this.comparison = new ItemComparisonInput(window, () => {
      const current = this.current;
      if (current && !this.element.hidden && current.anchor.isConnected) this.show(current.item, current.view, current.anchor, current.bounds);
    }, this.life.signal);
  }
  show(item: Item, view: ItemPresentation, anchor: HTMLElement, bounds = anchor.getBoundingClientRect() as Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    this.current = { item, view, anchor, bounds };
    const isDualRing = item.kind === 'ring' && !view.targetSlot && Boolean(view.sheet.equipped.ring1 && view.sheet.equipped.ring2);
    const bestSlot = isDualRing ? bestRingSlot(view.sheet, item, view.level) : undefined;
    const targetSlot = view.targetSlot ?? (isDualRing
      ? (this.comparison.focused
          ? (this.comparison.alternate ? (bestSlot === 'ring1' ? 'ring2' : 'ring1') : bestSlot)
          : (this.comparison.alternate ? comparisonSlot(view.sheet, item, true) : undefined))
      : comparisonSlot(view.sheet, item, this.comparison.alternate));
    const cards = itemHoverCards(item, { ...view, targetSlot });
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
  defer(): void { this.surface.defer(); }
  hide(): void { this.current = undefined; this.comparison.reset(); this.surface.hide(); }
  dispose(): void { this.life.abort(); this.current = undefined; this.comparison.reset(); this.surface.dispose(); }
}
