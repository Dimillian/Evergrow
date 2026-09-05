import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeUI, trapDialogFocus, uiIcon, type UIIconName } from '../src/ui-components.ts';
import { installUITheme, UI_THEME } from '../src/ui-theme.ts';

test('UI token installation is idempotent and shares exact colors with Canvas consumers', () => {
  const values = new Map<string, string>();
  let writes = 0;
  const root = { style: { setProperty(name: string, value: string) { writes++; values.set(name, value); } } };
  installUITheme(root as unknown as HTMLElement);
  const firstWrites = writes;
  installUITheme(root as unknown as HTMLElement);
  assert.equal(writes, firstWrites);
  for (const [name, value] of Object.entries(UI_THEME.palette)) {
    const key = name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    assert.equal(values.get(`--ui-${key}`), value);
  }
  assert.equal(values.get('--ui-control'), '44px');
  assert.ok(values.get('--ui-font')?.includes('Pixelify Sans'));
});

test('UI markup helpers preserve labels as text and only return fixed decorative icons', () => {
  assert.equal(escapeUI('Mournbridge & "Smith\'s" <shop>'), 'Mournbridge &amp; &quot;Smith&#39;s&quot; &lt;shop&gt;');
  assert.equal(escapeUI(120), '120');
  for (const name of ['close', 'plus', 'minus', 'center', 'map', 'leaf', 'sword', 'skull'] as const) {
    const markup = uiIcon(name);
    assert.match(markup, /^<svg /);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /focusable="false"/);
    assert.doesNotMatch(markup, /<text|<image|<script|\bon\w+=/);
  }
  assert.equal(uiIcon('__proto__' as UIIconName), '');
  assert.equal(uiIcon('close" onload="alert(1)' as UIIconName), '');
});

class FocusDocument extends EventTarget {
  activeElement: FocusElement | null = null;
  defaultView = { getComputedStyle: (element: FocusElement) => ({ visibility: element.visible ? 'visible' : 'hidden' }) };
}

class FocusElement extends EventTarget {
  ownerDocument: FocusDocument;
  children: FocusElement[] = [];
  parent: FocusElement | null = null;
  disabled = false;
  hidden = false;
  inert = false;
  visible = true;
  isConnected = true;
  private attributes = new Set<string>();
  private index: number;
  constructor(doc: FocusDocument, interactive = true) {
    super(); this.ownerDocument = doc; this.index = interactive ? 0 : -1;
  }
  get tabIndex() { return this.index; }
  set tabIndex(value: number) { this.index = value; this.attributes.add('tabindex'); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  removeAttribute(name: string) { this.attributes.delete(name); if (name === 'tabindex') this.index = -1; }
  append(...children: FocusElement[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
  querySelectorAll(): FocusElement[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
  matches(selector: string) { return selector === ':disabled' && this.disabled; }
  closest(): FocusElement | null { return this.hidden || this.inert ? this : this.parent?.closest() ?? null; }
  getClientRects() { return this.visible && !this.closest() ? [{}] : []; }
  contains(element: FocusElement | null): boolean { return element === this || this.children.some(child => child.contains(element)); }
  focus() {
    if (this.disabled) return;
    this.ownerDocument.activeElement = this;
    const event = new Event('focusin');
    Object.defineProperty(event, 'target', { value: this });
    this.ownerDocument.dispatchEvent(event);
  }
}

function press(container: FocusElement, key: string, shiftKey = false): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key, shiftKey });
  container.dispatchEvent(event);
  return event;
}

test('dialog focus loops through visible enabled controls, leaves application keys alone, and releases on abort', () => {
  const doc = new FocusDocument(), previous = new FocusElement(doc), dialog = new FocusElement(doc, false);
  const disabled = new FocusElement(doc), first = new FocusElement(doc), hidden = new FocusElement(doc), last = new FocusElement(doc);
  disabled.disabled = true; hidden.hidden = true;
  dialog.append(disabled, first, hidden, last);
  previous.focus();
  const abort = new AbortController();
  const handle = trapDialogFocus(dialog as unknown as HTMLElement, {
    initialFocus: last as unknown as HTMLElement, signal: abort.signal, restoreFocus: false,
  });
  assert.equal(doc.activeElement, last);
  assert.equal(press(dialog, 'Tab').defaultPrevented, true);
  assert.equal(doc.activeElement, first);
  assert.equal(press(dialog, 'Tab', true).defaultPrevented, true);
  assert.equal(doc.activeElement, last);
  assert.equal(press(dialog, 'Escape').defaultPrevented, false);
  previous.focus();
  assert.equal(doc.activeElement, last, 'focus outside the dialog returns to the requested control');
  abort.abort(); handle.dispose();
  assert.equal(dialog.hasAttribute('tabindex'), false);
  previous.focus();
  assert.equal(doc.activeElement, previous, 'the disposed dialog cannot reclaim focus');
});

test('empty dialogs remain keyboard-contained and optional restoration returns focus to their opener', () => {
  const doc = new FocusDocument(), previous = new FocusElement(doc), dialog = new FocusElement(doc, false);
  const disabled = new FocusElement(doc); disabled.disabled = true; dialog.append(disabled);
  dialog.tabIndex = -1;
  previous.focus();
  const handle = trapDialogFocus(dialog as unknown as HTMLElement, { initialFocus: disabled as unknown as HTMLElement });
  assert.equal(doc.activeElement, dialog);
  assert.equal(press(dialog, 'Tab').defaultPrevented, true);
  handle.dispose(); handle.dispose();
  assert.equal(doc.activeElement, previous);
  assert.equal(dialog.hasAttribute('tabindex'), true, 'an existing tabindex belongs to the caller');
});

test('an already-aborted dialog lifetime never takes focus or mutates its container', () => {
  const doc = new FocusDocument(), previous = new FocusElement(doc), dialog = new FocusElement(doc, false);
  previous.focus();
  const abort = new AbortController(); abort.abort();
  trapDialogFocus(dialog as unknown as HTMLElement, { signal: abort.signal }).dispose();
  assert.equal(doc.activeElement, previous);
  assert.equal(dialog.hasAttribute('tabindex'), false);
});
