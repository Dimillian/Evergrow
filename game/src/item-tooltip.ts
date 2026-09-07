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
  }
  position(bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void { this.surface.position(bounds); }
  hide(): void { this.surface.hide(); }
  dispose(): void { this.surface.dispose(); }
}
