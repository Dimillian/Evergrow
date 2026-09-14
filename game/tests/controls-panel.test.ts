import assert from 'node:assert/strict';
import test from 'node:test';
import { controls, cursorPreference } from '../src/control-preferences.ts';
import { CURSOR_STYLES, DEFAULT_CURSOR } from '../src/cursor-content.ts';
import { ControlsPanel, controlsMarkup } from '../src/controls-panel.ts';

/** Minimal event surface: exercise capture ownership without launching a browser/game. */
class ElementStub extends EventTarget {
  hidden = false;
  textContent = '';
  innerHTML = '';
  value = '';
  focused = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  classList = { toggle() {} };
  children: ElementStub[] = [];
  one = new Map<string, ElementStub>();
  many = new Map<string, ElementStub[]>();
  querySelector(selector: string) { return this.one.get(selector)!; }
  querySelectorAll(selector: string) { return this.many.get(selector) ?? []; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  focus() { this.focused = true; }
  contains(target: unknown): boolean { return target === this || this.children.includes(target as ElementStub); }
  click() { this.dispatchEvent(new Event('click')); }
}
function setup() {
  const win = new EventTarget(), root = new ElementStub(), host = new ElementStub(), abort = new AbortController();
  host.one.set('#pause-controls', root);
  const select = (selector: string) => { const node = new ElementStub(); root.one.set(selector, node); return node; };
  const capture = select('.controls-capture');
  const cancel = select('[data-capture-cancel]'), clear = select('[data-capture-clear]'), replace = select('[data-capture-replace]');
  capture.children = [cancel, clear, replace];
  select('[data-capture-message]'); select('[data-controls-status]'); select('[data-controls-reset]');
  const size = select('[data-cursor-size]'), preview = select('[data-cursor-preview]');
  select('[data-cursor-size-label]');
  const binding = new ElementStub(); binding.dataset = { binding: 'skill0', bindingIndex: '0' };
  root.many.set('[data-binding]', [binding]);
  const cursors = CURSOR_STYLES.map(style => { const button = new ElementStub(); button.dataset.cursorStyle = style.id; return button; });
  root.many.set('[data-cursor-style]', cursors);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  controls.reset();
  cursorPreference.reset();
  const panel = new ControlsPanel(host as unknown as HTMLElement, abort.signal);
  const key = (code: string, extra = {}) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false, ...extra });
    win.dispatchEvent(event); return event;
  };
  const dispose = () => { abort.abort(); controls.reset(); cursorPreference.reset(); if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); };
  return { win, root, panel, binding, cursors, size, preview, cancel, clear, replace, capture, key, dispose };
}

test('capture consumes the key before game shortcuts, persists it, and restores row focus', () => {
  const s = setup();
  try {
    let forwarded = 0; s.win.addEventListener('keydown', () => forwarded++);
    s.binding.click(); assert.equal(s.capture.hidden, false);
    assert.equal(s.key('KeyF').defaultPrevented, true);
    assert.equal(forwarded, 0); assert.equal(controls.action('KeyF'), 'skill0');
    assert.equal(s.capture.hidden, true); assert.equal(s.binding.focused, true);
    s.key('KeyG'); assert.equal(forwarded, 1);
  } finally { s.dispose(); }
});

test('Escape, blur and repeated keydown never accidentally assign or activate gameplay', () => {
  const s = setup();
  try {
    s.binding.click(); s.key('KeyF', { repeat: true }); assert.equal(controls.action('KeyF'), undefined);
    s.key('Escape'); assert.equal(s.capture.hidden, true); assert.equal(controls.action('Mouse2'), 'skill0');
    s.binding.click(); s.key('F5'); assert.equal(s.capture.hidden, false);
    s.win.dispatchEvent(new Event('blur')); assert.equal(s.capture.hidden, true);
  } finally { s.dispose(); }
});

test('conflict capture requires replacement; cancelling preserves both bindings', () => {
  const s = setup();
  try {
    s.binding.click(); s.key('KeyQ');
    assert.equal(s.replace.hidden, false); assert.equal(controls.action('KeyQ'), 'heal');
    s.cancel.click(); assert.equal(controls.action('Mouse2'), 'skill0');
    s.binding.click(); s.key('KeyQ');
    assert.equal(s.key('Tab').defaultPrevented, false, 'conflict choices retain native focus navigation');
    s.replace.click(); assert.equal(controls.action('KeyQ'), 'skill0'); assert.deepEqual(controls.get('heal'), [null, null]);
  } finally { s.dispose(); }
});

test('mouse capture suppresses its follow-up click and unbinding is explicit', () => {
  const s = setup();
  try {
    s.binding.click();
    const down = Object.assign(new Event('mousedown', { cancelable: true }), { button: 4 });
    s.win.dispatchEvent(down); assert.equal(down.defaultPrevented, true);
    assert.equal(controls.action('Mouse4'), 'skill0');
    const click = new Event('auxclick', { cancelable: true }); s.win.dispatchEvent(click); assert.equal(click.defaultPrevented, true);
    s.binding.click(); s.clear.click(); assert.deepEqual(controls.get('skill0'), [null, null]);
  } finally { s.dispose(); }
});

test('controls markup exposes full combat and alternate bindings with a separate controller reference', () => {
  const markup = controlsMarkup();
  assert.equal((markup.match(/data-binding="skill[0-4]"/g) ?? []).length, 10);
  assert.match(markup, /data-controls-reset/); assert.match(markup, /data-controls-controller hidden/);
  assert.match(markup, /role="status" aria-live="polite"/);
});

test('cursor selection applies immediately, reports blocked storage, and resets with controls', () => {
  const s = setup();
  try {
    s.cursors[1].click();
    assert.equal(cursorPreference.style, 'halo');
    assert.deepEqual(s.cursors.map(button => button.attributes.get('aria-pressed')), ['false', 'true', 'false', 'false']);
    assert.match(s.root.querySelector('[data-controls-status]').textContent, /session only/);
    assert.equal(controls.action('Mouse0'), 'attack');
    s.root.querySelector('[data-controls-reset]').click();
    assert.equal(cursorPreference.style, DEFAULT_CURSOR);
    assert.equal(s.cursors[0].attributes.get('aria-pressed'), 'true');
  } finally { s.dispose(); }
});

test('size slider updates actual-size preview immediately and retains size when switching shapes', () => {
  const s = setup();
  try {
    s.size.value = '200'; s.size.dispatchEvent(new Event('input'));
    assert.equal(cursorPreference.size, 200);
    assert.match(s.preview.innerHTML, /width="96" height="96"/);
    assert.equal(s.size.attributes.get('aria-valuetext'), '200%');
    s.cursors[2].click();
    assert.equal(cursorPreference.size, 200);
    assert.match(s.preview.attributes.get('aria-label')!, /Diamond cursor at 200%/);
    assert.match(s.preview.innerHTML, /width="96" height="96"/);
    s.cursors[3].click();
    assert.equal(cursorPreference.style, 'arrow');
    assert.equal(cursorPreference.size, 200);
    assert.match(s.preview.attributes.get('aria-label')!, /Arrow cursor at 200%/);
    assert.match(s.preview.innerHTML, /width="96" height="96"/);
    s.root.querySelector('[data-controls-reset]').click();
    assert.equal(s.size.value, '100');
    assert.match(s.preview.innerHTML, /width="48" height="48"/);
  } finally { s.dispose(); }
});
