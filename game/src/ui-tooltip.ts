import './tooltip-material.css';

/** Shared rich-tooltip surface, placement, motion and accessible anchor ownership. */
export class UITooltip {
  readonly element: HTMLDivElement;
  private anchor: HTMLElement | null = null;
  constructor(mount: HTMLElement, id: string, className = '') {
    this.element = document.createElement('div'); this.element.className = `ui-tooltip ${className}`;
    this.element.id = id; this.element.setAttribute('role', 'tooltip'); this.element.hidden = true; mount.append(this.element);
  }
  show(markup: string, anchor: HTMLElement, bounds = anchor.getBoundingClientRect() as Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    if (this.anchor !== anchor) this.detach();
    this.anchor = anchor;
    this.element.innerHTML = markup;
    this.element.hidden = false;
    const descriptions = new Set((anchor.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
    descriptions.add(this.element.id); anchor.setAttribute('aria-describedby', [...descriptions].join(' '));
    this.position(bounds);
  }
  position(bounds: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
    const viewportWidth = document.documentElement.clientWidth, viewportHeight = document.documentElement.clientHeight;
    const width = this.element.offsetWidth, height = this.element.offsetHeight;
    let left = bounds.right + 12, top = bounds.top - 12;
    if (left + width > viewportWidth - 12) left = bounds.left - width - 12;
    // Wide comparisons sit below the anchor when neither side has room.
    if (left < 8) { left = bounds.left; top = bounds.bottom + 10; }
    this.element.style.left = `${Math.max(8, Math.min(viewportWidth - width - 8, left))}px`;
    this.element.style.top = `${Math.max(8, Math.min(viewportHeight - height - 8, top))}px`;
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
