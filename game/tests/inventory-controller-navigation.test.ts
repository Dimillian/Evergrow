import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { GamepadInput, PAD, type PadSnapshot } from '../src/gamepad-input.ts';
import { GamepadMenu } from '../src/gamepad-menu.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { InventoryPanel } = await import('../src/inventory-panel.ts');
css.deregister();

// Exercise the real inventory navigation and gamepad adapter on a small DOM boundary.
const doc = { activeElement: null as Surface | null };
class Surface extends EventTarget {
  tabIndex = 0; hidden = false; disabled = false; clicks = 0;
  dataset: Record<string, string> = {};
  parent: Surface | null = null;
  children: Surface[] = [];
  classes = new Set<string>();
  classList = { contains: (name: string) => this.classes.has(name), add: (name: string) => this.classes.add(name),
    toggle: (name: string, enabled: boolean) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  readonly button: boolean; readonly x: number; readonly y: number;
  constructor(button = false, x = 0, y = 0) { super(); this.button = button; this.x = x; this.y = y; }
  append(child: Surface) { child.parent = this; this.children.push(child); return child; }
  matches(selector: string): boolean {
    return selector.split(',').some(part => {
      const s = part.trim();
      if (s === ':disabled') return this.disabled;
      if (s === '[hidden]') return this.hidden;
      if (s === '[inert]') return false;
      if (s === '.character-header-right' || s === '.character-footer') return this.classes.has('character-header-right');
      if (s === '[data-section]') return this.dataset.section !== undefined;
      if (s === '[data-mini]') return this.dataset.mini !== undefined;
      const section = s.match(/^\[data-section="(\d)"\]$/);
      return section ? this.dataset.section === section[1] : s.startsWith('button') && this.button && !this.disabled;
    });
  }
  closest(selector: string): Surface | null { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelectorAll(selector: string): Surface[] { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(node: Surface): boolean { return node === this || this.children.some(child => child.contains(node)); }
  hasAttribute(name: string) { return name === 'data-mini' && this.dataset.mini !== undefined; }
  setAttribute() {}
  getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
  getBoundingClientRect() { return { left: this.x, top: this.y, width: 44, height: 44 }; }
  focus() { doc.activeElement = this; }
  scrollIntoView() {}
  scrollBy() {}
  click() { this.clicks++; }
}
class NonButton extends Surface {}
class Key extends Event {
  readonly key: string;
  constructor(type: string, options: KeyboardEventInit = {}) { super(type, options); this.key = options.key ?? ''; }
}
const globals = { document: doc, Element: Surface, HTMLElement: Surface, HTMLInputElement: NonButton,
  HTMLSelectElement: NonButton, HTMLCanvasElement: NonButton, KeyboardEvent: Key };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, globals);
after(() => { for (const [key, descriptor] of previous) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
} });

function setup(section: number, statsVisible = false) {
  const root = new Surface(); root.classes.add('is-controller');
  const header = root.append(new Surface()); header.classes.add('character-header-right');
  const palette = header.append(new Surface(true, 1000, 0)), close = header.append(new Surface(true, 1060, 0));
  const sections = (statsVisible ? [0, 1, 2] : [0, 1]).map(index => {
    const owner = root.append(new Surface()); owner.dataset.section = String(index);
    return owner.append(new Surface(true, 100 + index * 300, 100));
  });
  const panel = Object.assign(Object.create(InventoryPanel.prototype), {
    element: root, window: root, hud: null, popup: null, section, statsVisible, controller: new GamepadMenu(), sectionFocus: new Map(),
  }) as { updateGamepad: InstanceType<typeof InventoryPanel>['updateGamepad']; navigate(key: string, target: HTMLElement): boolean };
  for (const button of [palette, close, ...sections]) button.addEventListener('keydown', raw => {
    if (panel.navigate((raw as Key).key, button as unknown as HTMLElement)) raw.preventDefault();
  });
  const pad = new GamepadInput();
  let now = 0;
  const update = (buttons: number[]) => {
    const snapshot: PadSnapshot = { index: 0, id: 'inventory-test', mapping: 'standard', connected: true, axes: [],
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i), value: 0 })) };
    pad.poll([snapshot], true); panel.updateGamepad(pad, now += 400);
  };
  update([]);
  sections[section].focus();
  return { panel, root, palette, close, sections, update };
}

test('every inventory section reaches both header actions and returns without leaking into other sections', () => {
  for (const index of [0, 1]) {
    const s = setup(index);
    s.update([PAD.up]); assert.equal(doc.activeElement, s.palette);
    s.update([]); assert.equal(doc.activeElement, s.palette, 'header focus survives the next controller update');
    s.update([PAD.interact]); s.update([PAD.interact]); assert.equal(s.palette.clicks, 1);
    s.update([PAD.skill3]); assert.equal(s.palette.clicks, 1, 'X does not activate a header action');
    s.update([PAD.right]); assert.equal(doc.activeElement, s.close);
    s.update([PAD.left]); assert.equal(doc.activeElement, s.palette);
    s.update([PAD.down]); assert.equal(doc.activeElement, s.sections[index]);
    assert.equal(s.sections.reduce((sum, item) => sum + item.clicks, 0), 0);
  }
});

test('shoulders switch sections from the header while popup navigation remains isolated', () => {
  const s = setup(0);
  s.update([PAD.up]); s.update([PAD.skill2, PAD.interact]);
  assert.equal(doc.activeElement, s.sections[1]); assert.equal(s.palette.clicks, 0);
  s.update([PAD.up]); s.update([PAD.potion]); assert.equal(doc.activeElement, s.sections[0]);
  const popup = s.root.append(new Surface()); popup.dataset.mini = 'sort';
  const filter = popup.append(new Surface(true, 1000, 100));
  filter.focus();
  assert.equal(s.panel.navigate('ArrowUp', filter as unknown as HTMLElement), true);
  assert.equal(doc.activeElement, filter, 'popup directions cannot reach the header');
});

test('expanded stats participate in shoulder navigation beside equipment and inventory', () => {
  const s = setup(1, true);
  s.update([PAD.skill2]); assert.equal(doc.activeElement, s.sections[2]);
  s.update([]); s.update([PAD.skill2]); assert.equal(doc.activeElement, s.sections[0]);
  s.update([]); s.update([PAD.potion]); assert.equal(doc.activeElement, s.sections[2]);
});
