/** Keyboard ownership boundary. Native shortcuts must never latch a gameplay key. */
export interface GameKeyboardHandlers {
  press(event: KeyboardEvent): void;
  shortcut?(event: KeyboardEvent): boolean;
  intercept?(event: KeyboardEvent): boolean;
  release(code: string): void;
  clear(): void;
}
function nativeShortcut(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.isComposing
    || /^(Meta|Control|Alt)(Left|Right)$/.test(event.code);
}

export function bindGameKeyboard(target: EventTarget, handlers: GameKeyboardHandlers, signal: AbortSignal): void {
  // Capture gameplay on the live map before focused controls pan or trap Tab.
  target.addEventListener('keydown', raw => {
    const event = raw as KeyboardEvent;
    if (nativeShortcut(event)) handlers.clear();
    if (!event.defaultPrevented && !event.isComposing && handlers.shortcut?.(event)) {
      event.preventDefault(); event.stopImmediatePropagation();
    } else if (!nativeShortcut(event) && handlers.intercept?.(event)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, { signal, capture: true });
  target.addEventListener('keydown', raw => {
    const event = raw as KeyboardEvent;
    // OS/browser shortcuts can swallow the letter's eventual keyup without a
    // window blur. Clear on both edges of the modifier; leave native behavior intact.
    if (nativeShortcut(event)) return;
    handlers.press(event);
  }, { signal });
  target.addEventListener('keyup', raw => {
    const event = raw as KeyboardEvent;
    handlers.release(event.code);
    if (nativeShortcut(event)) handlers.clear();
  }, { signal, capture: true });
  target.addEventListener('compositionstart', () => handlers.clear(), { signal, capture: true });
}
