import { UITooltip } from './ui-tooltip.ts';
import { potionTooltipMarkup, type PotionPresentation } from './potion-presentation.ts';
import type { HUDRect } from './hud-layout.ts';
import './potion-tooltip.css';

let serial = 0;
/** Accessible explanation anchor over Canvas art; owns no gameplay input or state. */
export class PotionTooltip {
  readonly anchor: HTMLDivElement;
  private readonly tip: UITooltip;
  private readonly life = new AbortController();
  private view?: PotionPresentation;
  private binding = 'Q';
  private hovered = false;
  private markup = '';
  constructor(mount: HTMLElement) {
    this.anchor = document.createElement('div'); this.anchor.className = 'potion-tooltip-anchor';
    this.anchor.tabIndex = 0; this.anchor.setAttribute('role', 'img'); this.anchor.setAttribute('aria-label', 'Potion details');
    this.anchor.hidden = true; mount.append(this.anchor);
    this.tip = new UITooltip(mount, `potion-tooltip-${++serial}`, 'potion-tooltip');
    const options = { signal: this.life.signal };
    this.anchor.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      this.hovered = true; this.show();
    }, options);
    this.anchor.addEventListener('pointerleave', () => {
      this.hovered = false;
      if (!this.anchor.matches(':focus-visible')) this.hide();
    }, options);
    this.anchor.addEventListener('focusin', () => this.show(), options);
    this.anchor.addEventListener('focusout', () => { if (!this.hovered) this.hide(); }, options);
    // Preserve native focus navigation without sending inspection keys to gameplay.
    this.anchor.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); }, options);
    window.addEventListener('scroll', () => this.dismiss(), { ...options, capture: true });
    window.addEventListener('resize', () => this.dismiss(), options);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') this.dismiss(); }, options);
  }
  update(view: PotionPresentation, binding: string, visible: boolean): void {
    const changed = !this.view || this.binding !== binding || (Object.keys(view) as (keyof PotionPresentation)[]).some(key => this.view![key] !== view[key]);
    this.view = view; this.binding = binding; this.anchor.hidden = !visible;
    if (!visible) { this.dismiss(); return; }
    if (changed) {
      this.anchor.setAttribute('aria-label', `Potion details: ${view.charges} ${view.charges === 1 ? 'charge' : 'charges'} available`);
      if (!this.tip.element.hidden) this.show();
    }
  }
  place(rect: HUDRect, width: number, height: number): void {
    const a = this.anchor.style;
    a.left = `${rect.x / width * 100}%`; a.top = `${rect.y / height * 100}%`;
    a.width = `${rect.width / width * 100}%`; a.height = `${rect.height / height * 100}%`;
  }
  private show(): void {
    if (!this.view || this.anchor.hidden) return;
    const markup = potionTooltipMarkup(this.view, this.binding);
    if (markup !== this.markup || this.tip.element.hidden) {
      this.markup = markup; this.tip.show(markup, this.anchor);
    }
  }
  private hide(): void { this.tip.hide(); }
  dismiss(): void { this.hovered = false; this.hide(); }
  dispose(): void { this.life.abort(); this.tip.dispose(); this.anchor.remove(); }
}
