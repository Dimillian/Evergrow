import { UITooltip, tooltipTargetHeld } from './ui-tooltip.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import { effectExplanation } from './effect-terms.ts';

/** Rich primary card: crossing the gap retains it; closing its owner always clears the branch. */
export class RetainedTooltip extends UITooltip {
  private readonly explanations: UITooltipStack;
  private readonly life = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private source?: HTMLElement;
  private readonly mount: HTMLElement;
  private markup = '';
  constructor(mount: HTMLElement, id: string, className = '') {
    super(mount, id, `${className} ui-retained-tooltip`);
    this.mount = mount;
    this.explanations = new UITooltipStack(mount, effectExplanation, this.element);
    const options = { signal: this.life.signal };
    this.element.addEventListener('pointerleave', () => this.defer(), options);
    this.element.addEventListener('scroll', () => this.explanations.hide(), { ...options, capture: true });
    this.element.addEventListener('focusout', () => this.defer(), options);
    document.addEventListener('pointerdown', event => {
      if (!this.element.contains(event.target as Node) && !this.source?.contains(event.target as Node) && !this.explanations.contains(event.target as Node)) this.hide();
    }, options);
    window.addEventListener('resize', () => this.hide(), options);
  }
  override show(markup: string, anchor: HTMLElement, bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> = anchor.getBoundingClientRect()): void {
    clearTimeout(this.timer); this.timer = undefined;
    if (!this.element.isConnected) this.mount.append(this.element);
    if (this.source === anchor && this.markup === markup && !this.element.hidden) return;
    this.explanations.hide(); this.source = anchor; this.markup = markup;
    super.show(markup, anchor, bounds);
  }
  defer(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.source?.isConnected) { this.hide(); return; }
      if (tooltipTargetHeld(this.element) || tooltipTargetHeld(this.source) || this.explanations.held) this.defer();
      else this.hide();
    }, 280);
  }
  override hide(): void { clearTimeout(this.timer); this.timer = undefined; this.explanations?.hide(); this.source = undefined; super.hide(); }
  override dispose(): void { this.hide(); this.explanations.dispose(); this.life.abort(); super.dispose(); }
}
