import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { GamepadInput, PAD, type PadSnapshot } from '../src/gamepad-input.ts';
import { GamepadMenu } from '../src/gamepad-menu.ts';

// Minimal event/focus boundary, without launching a browser or a gameplay session.
const doc = { activeElement: null as Element | null };
class Element extends EventTarget {
  tabIndex = 0; visible = true; disabled = false; location = false; clicks = 0;
  children: Element[] = []; bag = false;
  querySelectorAll() { return this.children; }
  querySelector() { return this.bag ? this : null; }
  getClientRects() { return this.visible ? [1] : []; }
  closest() { return null; }
  matches(selector: string) { return selector === ':disabled' ? this.disabled : this.location; }
  contains(el: Element | null) { return !!el && this.children.includes(el); }
  focus() { doc.activeElement = this; }
  scrollIntoView() {}
  click() { this.clicks++; }
}
class Select extends Element { selectedIndex = 0; options = [{ disabled: false }, { disabled: true }, { disabled: false }]; }
class Canvas extends Element {}
class Key extends Event {
  key: string; shiftKey: boolean;
  constructor(type: string, options: KeyboardEventInit = {}) {
    super(type, options); this.key = options.key ?? ''; this.shiftKey = options.shiftKey ?? false;
  }
}
const globals = { document: doc, HTMLElement: Element, HTMLSelectElement: Select, HTMLCanvasElement: Canvas, KeyboardEvent: Key, MouseEvent: Key };
const descriptors = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, globals);
after(() => { for (const key of Object.keys(globals)) {
  const descriptor = descriptors[key];
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else Reflect.deleteProperty(globalThis, key);
} });

function setup(children: Element[]) {
  const root = new Element(); root.children = children;
  const pad = new GamepadInput(), menu = new GamepadMenu();
  const poll = (buttons: number[]) => {
    const snapshot: PadSnapshot = { index: 0, id: 'pad', mapping: 'standard', connected: true, axes: [],
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i), value: 0 })) };
    pad.poll([snapshot], true);
  };
  poll([]); doc.activeElement = children[0];
  const update = (buttons: number[], now = 0) => { poll(buttons); menu.update(root as unknown as HTMLElement, pad, now); };
  return { root, update };
}

test('menu focus traversal skips disabled/hidden controls and activation runs once per press', () => {
  const a = new Element(), disabled = new Element(), hidden = new Element(), b = new Element();
  disabled.disabled = true; hidden.visible = false;
  const { update } = setup([a, disabled, hidden, b]);
  update([PAD.skill2]); assert.equal(doc.activeElement, b);
  update([PAD.interact]); update([PAD.interact], 1000); assert.equal(b.clicks, 1);
  update([]); update([PAD.interact]); assert.equal(b.clicks, 2);
  update([PAD.skill2]); assert.equal(doc.activeElement, a);
});

test('custom canvas navigation consumes directions, repeats at bounded intervals and supports zoom', () => {
  const canvas = new Canvas(), button = new Element(), keys: string[] = [];
  canvas.addEventListener('keydown', raw => { const e = raw as Key; keys.push(e.key); e.preventDefault(); });
  const { update } = setup([canvas, button]);
  update([PAD.right], 0); update([PAD.right], 100); update([PAD.right], 349); update([PAD.right], 350);
  assert.deepEqual(keys, ['ArrowRight', 'ArrowRight']); assert.equal(doc.activeElement, canvas);
  update([PAD.attack], 400); update([PAD.interact], 500);
  assert.deepEqual(keys, ['ArrowRight', 'ArrowRight', '+', 'Enter']);
});

test('select navigation changes enabled options and X only equips explicit inventory item cells', () => {
  const select = new Select(), cell = new Element(); cell.location = true;
  let changes = 0, shifts = 0;
  select.addEventListener('change', () => changes++);
  cell.addEventListener('click', e => { if ((e as Key).shiftKey) shifts++; });
  const { root, update } = setup([select, cell]);
  update([PAD.right]); assert.equal(select.selectedIndex, 2); assert.equal(changes, 1);
  update([PAD.skill2]); update([PAD.skill3]); assert.equal(shifts, 0, 'no direct shop trades');
  root.bag = true; update([]); update([PAD.skill3]); assert.equal(shifts, 1);
  cell.location = false; update([]); update([PAD.skill3]); assert.equal(shifts, 1);
});
