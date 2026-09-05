export { uiIcon, type UIIconName } from './ui-icons.ts';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Safe text/attribute interpolation for the small, code-owned UI templates. */
export function escapeUI(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character => ESCAPES[character]);
}

export interface DialogFocusOptions {
  signal?: AbortSignal;
  initialFocus?: HTMLElement | (() => HTMLElement | null);
  restoreFocus?: boolean;
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]';

/** Keyboard focus stays in the active dialog without handling its application keys. */
export function trapDialogFocus(container: HTMLElement, options: DialogFocusOptions = {}): { dispose(): void } {
  if (options.signal?.aborted) return { dispose() {} };
  const doc = container.ownerDocument;
  const previous = doc.activeElement as HTMLElement | null;
  const ownTabIndex = !container.hasAttribute('tabindex');
  if (ownTabIndex) container.tabIndex = -1;
  let disposed = false, redirecting = false;
  const available = (element: HTMLElement) => element.tabIndex >= 0 && !element.matches(':disabled')
    && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && element.getClientRects().length > 0
    && doc.defaultView?.getComputedStyle(element).visibility !== 'hidden';
  const controls = () => [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(available);
  const focusInside = () => {
    const requested = typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus;
    const target = requested && container.contains(requested) && available(requested)
      ? requested : controls()[0] ?? container;
    redirecting = true;
    target.focus({ preventScroll: true });
    redirecting = false;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const elements = controls(), current = doc.activeElement;
    if (!elements.length) { event.preventDefault(); container.focus({ preventScroll: true }); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (current === first || !elements.includes(current as HTMLElement))) {
      event.preventDefault(); last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (current === last || !elements.includes(current as HTMLElement))) {
      event.preventDefault(); first.focus({ preventScroll: true });
    }
  };
  const onFocus = (event: FocusEvent) => {
    if (!disposed && !redirecting && !container.contains(event.target as Node)
      && container.isConnected && container.getClientRects().length > 0) focusInside();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    container.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('focusin', onFocus);
    options.signal?.removeEventListener('abort', dispose);
    if (ownTabIndex) container.removeAttribute('tabindex');
    if (options.restoreFocus !== false && previous?.isConnected) previous.focus({ preventScroll: true });
  };
  container.addEventListener('keydown', onKeyDown);
  doc.addEventListener('focusin', onFocus);
  options.signal?.addEventListener('abort', dispose, { once: true });
  focusInside();
  return { dispose };
}
