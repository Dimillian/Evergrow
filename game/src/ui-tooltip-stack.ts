import { placeExplanation } from './tooltip-stack-layout.ts';
import { UITooltip, tooltipTargetHeld } from './ui-tooltip.ts';
import './ui-tooltip-stack.css';

export type TooltipResolver = (term: string) => string | undefined;
/** One bounded branch of explanations. Pointer, focus and touch use the same cards. */
export class UITooltipStack {
  private readonly life = new AbortController();
  private readonly cards: { tip: UITooltip; anchor: HTMLElement; key: string }[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private readonly mount: HTMLElement;
  private readonly resolve: TooltipResolver;
  private restoringFocus = false;
  constructor(mount: HTMLElement, resolve: TooltipResolver, scope: HTMLElement = mount, accept: (anchor: HTMLElement) => boolean = () => true) {
    this.mount = mount; this.resolve = resolve;
    const options = { signal: this.life.signal };
    const open = (event: Event) => {
      if (this.restoringFocus) return;
      const anchor = (event.target as Element).closest<HTMLElement>('[data-ui-term]');
      if (anchor && ((scope.contains(anchor) && accept(anchor)) || this.contains(anchor))) this.term(anchor);
    };
    mount.addEventListener('pointerover', open, options);
    mount.addEventListener('focusin', open, options);
    mount.addEventListener('click', event => {
      if ((event.target as Element).closest('[data-ui-term]')) { event.preventDefault(); event.stopPropagation(); open(event); }
    }, options);
    mount.addEventListener('pointerout', () => this.defer(), options);
    mount.addEventListener('focusout', () => this.defer(), options);
    mount.addEventListener('keydown', event => {
      // Keep native focus/activation, but do not pass Space or other gameplay
      // bindings through an inspected explanation. Escape closes deepest first.
      if (event.key !== 'Escape' && ((event.target as Element).closest('[data-ui-term], .ui-explanation'))) event.stopPropagation();
    }, options);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !this.cards.length) return;
      event.preventDefault(); event.stopPropagation();
      const last = this.cards.at(-1)!; this.trim(this.cards.length - 1); this.restoringFocus = true; last.anchor.focus(); this.restoringFocus = false;
    }, { ...options, capture: true });
    document.addEventListener('pointerdown', event => {
      if (!this.cards.some(c => c.tip.element.contains(event.target as Node) || c.anchor.contains(event.target as Node))) this.hide();
    }, options);
    window.addEventListener('resize', () => this.hide(), options);
  }
  contains(node: Node): boolean { return this.cards.some(c => c.tip.element.contains(node)); }
  get held(): boolean {
    return this.cards.some(c => tooltipTargetHeld(c.tip.element));
  }
  show(markup: string, anchor: HTMLElement): void { this.open(markup, anchor, '', 0); }
  private term(anchor: HTMLElement): void {
    const key = anchor.dataset.uiTerm!, markup = this.resolve(key);
    if (!markup) return;
    const parent = this.cards.findIndex(c => c.tip.element.contains(anchor));
    const depth = parent + 1;
    if (depth >= 3 || this.cards.slice(0, depth).some(c => c.key === key)) return;
    this.open(markup, anchor, key, depth);
  }
  private open(markup: string, anchor: HTMLElement, key: string, depth: number): void {
    clearTimeout(this.timer);
    if (this.cards[depth]?.anchor === anchor) return;
    this.trim(depth);
    const tip = new UITooltip(this.mount, `explanation-${++serial}`, 'ui-explanation');
    tip.element.setAttribute('role', 'group'); tip.element.setAttribute('aria-label', 'Effect details');
    tip.show(markup, anchor);
    // Stack beside the parent card, leaving its underlined text accessible.
    const parent = depth ? this.cards[depth - 1].tip.element : anchor.closest('.ui-tooltip');
    if (parent) {
      const position = placeExplanation(parent.getBoundingClientRect(), tip.element.offsetWidth, tip.element.offsetHeight,
        { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }, [...this.cards.map(c => c.tip.element.getBoundingClientRect()), ...((this.cards[0]?.anchor ?? anchor).closest('.ui-tooltip') ? [(this.cards[0]?.anchor ?? anchor).closest('.ui-tooltip')!.getBoundingClientRect()] : [])]);
      tip.element.style.left = `${position.left}px`; tip.element.style.top = `${position.top}px`;
    }
    else if (!key) {
      const bounds = anchor.getBoundingClientRect(), width = tip.element.offsetWidth, height = tip.element.offsetHeight;
      tip.element.style.left = `${Math.max(8, Math.min(document.documentElement.clientWidth - width - 8, (bounds.left + bounds.right - width) / 2))}px`;
      const above = bounds.top - height - 12;
      tip.element.style.top = `${above >= 8 ? above : Math.min(document.documentElement.clientHeight - height - 8, bounds.bottom + 12)}px`;
    }
    anchor.setAttribute('aria-expanded', 'true'); anchor.setAttribute('aria-controls', tip.element.id);
    this.cards.push({ tip, anchor, key });
  }
  hideBuff(id: string): void { if (this.cards[0]?.anchor.dataset.buff === id) this.hide(); }
  refreshSummary(id: string, summary: string): void {
    const root = this.cards[0];
    if (root?.anchor.dataset.buff === id) {
      const text = root.tip.element.querySelector('[data-buff-summary]');
      if (text && text.textContent !== summary) text.textContent = summary;
    }
  }
  defer(onExit?: () => void): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.held || this.cards.some(c => tooltipTargetHeld(c.anchor))) return;
      this.hide(); onExit?.();
    }, 260);
  }
  private trim(length: number): void {
    for (const card of this.cards.splice(length)) {
      card.anchor.setAttribute('aria-expanded', 'false'); card.anchor.removeAttribute('aria-controls'); card.tip.dispose();
    }
  }
  hide(): void { clearTimeout(this.timer); this.trim(0); }
  dispose(): void { this.hide(); this.life.abort(); }
}
let serial = 0;
