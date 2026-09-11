/** Keyboard ownership boundary. Native shortcuts must never latch a gameplay key. */
export interface GameKeyboardHandlers {
  press(event: KeyboardEvent): void;
  release(code: string): void;
  clear(): void;
  revealLoot?(held: boolean): void;
}
function nativeShortcut(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.isComposing
    || /^(Meta|Control|Alt)(Left|Right)$/.test(event.code);
}

export function bindGameKeyboard(target: EventTarget, handlers: GameKeyboardHandlers, signal: AbortSignal): void {
  // Ctrl alone is a presentation hold, not a combat/pickup cancellation. Modified
  // letter shortcuts still clear gameplay input before the browser handles them.
  const lootControl = (event: KeyboardEvent) => !!handlers.revealLoot && /^Control(Left|Right)$/.test(event.code)
    && !event.metaKey && !event.altKey && !event.isComposing;
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
    if (nativeShortcut(event) && !lootControl(event)) handlers.clear();
    handlers.revealLoot?.(event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing);
  }, { signal, capture: true });
  // Capture shortcut interruption before a focused control can consume keydown.
  target.addEventListener('keydown', raw => {
    const event = raw as KeyboardEvent;
    if (nativeShortcut(event) && !lootControl(event)) handlers.clear();
    handlers.revealLoot?.(event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing);
  }, { signal, capture: true });
  target.addEventListener('compositionstart', () => handlers.clear(), { signal, capture: true });
}
