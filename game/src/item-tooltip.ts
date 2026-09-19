import { comparisonSlot, ItemComparisonInput } from './item-comparison.ts';
import type { Item } from './character-types.ts';
import { itemHoverCards, type ItemPresentation } from './item-ui.ts';
import { RetainedTooltip } from './retained-tooltip.ts';
import './item-ui.css';
import type { FrameProfiler } from './frame-profiler.ts';

/** Equipment content uses the shared tooltip surface, positioning and focus association. */
export class ItemTooltip {
  readonly element: HTMLDivElement;
  private readonly surface: RetainedTooltip;
  private readonly life = new AbortController();
  private readonly comparison: ItemComparisonInput;
  private readonly profiler?: FrameProfiler;
  private current?: { item: Item; view: ItemPresentation; anchor: HTMLElement; bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> };

  constructor(mount: HTMLElement, id: string, profiler?: FrameProfiler) {
    this.profiler = profiler;
    this.surface = new RetainedTooltip(mount, id, 'ui-item-tooltip-group');
    this.element = this.surface.element;
    this.surface.onHide = () => {
      this.current = undefined;
      this.comparison.resetFocus();
    };
    this.comparison = new ItemComparisonInput(window, () => {
      const current = this.current;
      if (current && !this.element.hidden && current.anchor.isConnected) this.show(current.item, current.view, current.anchor, current.bounds);
    }, this.life.signal, () => !this.element.hidden && Boolean(this.element.querySelector('.ui-item-alt-toggle')));
    this.element.addEventListener('click', (e) => {
      const toggle = (e.target as HTMLElement)?.closest('.ui-item-alt-toggle');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        this.comparison.toggleFocus();
      }
    });
  }
  show(item: Item, view: ItemPresentation, anchor: HTMLElement, bounds = anchor.getBoundingClientRect() as Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    if (this.profiler) this.profiler.panelWork(() => this.showContents(item, view, anchor, bounds));
    else this.showContents(item, view, anchor, bounds);
  }
  private showContents(item: Item, view: ItemPresentation, anchor: HTMLElement, bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    if (this.current?.anchor !== anchor || this.current?.item.id !== item.id) {
      // Resetting Alt comparison can notify synchronously; never rebuild the old item.
      this.current = undefined;
      this.comparison.resetFocus();
    }
    this.current = { item, view, anchor, bounds };
    const cards = itemHoverCards(item, {
      ...view,
      focusIndex: this.comparison.focusIndex,
      targetSlot: view.targetSlot ?? comparisonSlot(view.sheet, item, this.comparison.alternate),
    });
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
  hide(): void { this.current = undefined; this.comparison.resetFocus(); this.surface.hide(); }
  dispose(): void { this.life.abort(); this.current = undefined; this.surface.dispose(); }
}
