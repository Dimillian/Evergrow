import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { FrameProfiler } from '../src/frame-profiler.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { ItemTooltip, ITEM_TOOLTIP_DWELL } = await import('../src/item-tooltip.ts');
css.deregister();

class Surface extends EventTarget {
  hidden = false; isConnected = true; className = ''; id = ''; writes = 0;
  offsetWidth = 500; offsetHeight = 400; hover = false; visible = true; boundsReads = 0;
  parent: Surface | null = null;
  children: Surface[] = [];
  attributes = new Map<string, string>();
  style = { left: '', top: '', order: '', setProperty() {} };
  private markup = '';
  get innerHTML() { return this.markup; }
  set innerHTML(value: string) {
    this.markup = value; this.writes++;
    this.children = Array.from({length: (value.match(/<section class="ui-item-hover-card"/g) ?? []).length}, () => new Surface());
  }
  append(node: Surface) { node.remove(); this.children.push(node); node.parent = this; node.isConnected = true; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; this.isConnected = false; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  getClientRects() { return this.visible ? [{}] : []; }
  getBoundingClientRect() { this.boundsReads++; return { left: 100, right: 140, top: 100, bottom: 140, width: 40, height: 40 }; }
  contains(node: unknown): boolean { return node === this || this.children.some(c => c.contains(node)); }
  matches(selector: string) { return selector.includes(':hover') && this.hover; }
  querySelector(selector: string) { return selector === '.ui-item-alt-toggle' && this.markup.includes('ui-item-alt-toggle') ? this : null; }
}

function environment(t: TestContext) {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: () => new Surface(), documentElement: { clientWidth: 1200, clientHeight: 900 } });
  for (const [key, value] of Object.entries({ window, document })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  return { window, document };
}

test('repeated item inspection retains one host and never rebuilds the old Alt comparison on switch/hide', t => {
  const { window } = environment(t);
  const p = initialPlayer(0, 0), mount = new Surface(), anchor = new Surface(), nextAnchor = new Surface();
  p.character.equipped.weapon = generateItem(20, 1, 'weapon', 'longsword', 'common');
  p.character.equipped.offhand = generateItem(21, 1, 'shield', undefined, 'common');
  let clock = 0; const profiler = new FrameProfiler(true, () => ++clock);
  const tip = new ItemTooltip(mount as unknown as HTMLElement, 'item-test', profiler);
  const host = tip.element as unknown as Surface;
  const show = (seed: number, target = anchor) => tip.show(generateItem(seed, 1, 'weapon', 'ember-staff', 'rare'),
    { sheet: p.character, level: p.level }, target as unknown as HTMLElement);
  const alt = () => window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'AltLeft', key: 'Alt' }));
  t.after(() => tip.dispose());
  const before = structuredClone(p);
  for (let i = 0; i < 100; i++) {
    show(1000 + i); alt();
    assert.match(host.innerHTML, /Equipped · Off hand/);
    const writes = host.writes;
    show(2000 + i, nextAnchor);
    assert.equal(host.writes, writes + 1, 'switch renders only the new item');
    assert.match(host.innerHTML, /Equipped · Main hand/);
    alt(); const beforeHide = host.writes; tip.hide();
    assert.equal(host.writes, beforeHide, 'dismissal does not render a hidden comparison');
    assert.equal(mount.children.length, 1); assert.equal(host.children.length, 2);
    assert.equal(anchor.getAttribute('aria-describedby'), null);
    assert.equal(nextAnchor.getAttribute('aria-describedby'), null);
  }
  assert.deepEqual(p, before, 'hovering never mutates equipment or character stats');
  profiler.begin(0, 'character'); profiler.finish();
  assert.ok(profiler.snapshot().metrics.panels.max > 0, 'pointer-triggered tooltip CPU is captured');
  tip.dispose(); assert.equal(mount.children.length, 0);
});


test('rapid pointer sweeps construct only the final settled tooltip with no layout reads for skipped items', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); environment(t);
  const p = initialPlayer(0, 0), mount = new Surface();
  const item = generateItem(999, 1, 'weapon', 'ember-staff', 'rare');
  const view = { sheet: p.character, level: p.level };
  const tip = new ItemTooltip(mount as unknown as HTMLElement, 'hover-test');
  t.after(() => tip.dispose());
  const host = tip.element as unknown as Surface;
  const anchors = Array.from({ length: 100 }, () => Object.assign(new Surface(), { hover: true }));
  for (const anchor of anchors) {
    tip.hover(item, view, anchor as unknown as HTMLElement);
    t.mock.timers.tick(20);
  }
  assert.equal(host.writes, 0);
  assert.equal(anchors.reduce((n, a) => n + a.boundsReads, 0), 0);
  t.mock.timers.tick(ITEM_TOOLTIP_DWELL - 21); assert.equal(host.writes, 0);
  t.mock.timers.tick(1); assert.equal(host.writes, 1);
  assert.equal(anchors.at(-1)!.getAttribute('aria-describedby'), 'hover-test');
  assert.equal(anchors.slice(0, -1).reduce((n, a) => n + a.boundsReads, 0), 0);

  // Re-entering a displayed source cancels its pending exit without rebuilding.
  tip.defer(); t.mock.timers.tick(100);
  tip.hover(item, view, anchors.at(-1)! as unknown as HTMLElement);
  t.mock.timers.tick(500); assert.equal(host.hidden, false); assert.equal(host.writes, 1);

  // Explicit keyboard/click/controller selection supersedes pending mouse intent.
  tip.hover(item, view, anchors[0] as unknown as HTMLElement);
  tip.show(item, view, anchors[1] as unknown as HTMLElement);
  const writes = host.writes;
  t.mock.timers.tick(ITEM_TOOLTIP_DWELL + 1);
  assert.equal(host.writes, writes);
  assert.equal(anchors[1].getAttribute('aria-describedby'), 'hover-test');
});

test('hover intent cancels on exit, owner close, resize, disposal and invalid targets', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const { window, document } = environment(t);
  const p = initialPlayer(0, 0), item = generateItem(998, 1, 'ring'), view = { sheet: p.character, level: p.level };
  for (const mode of ['exit', 'close', 'resize', 'dispose', 'detached', 'not-hovered', 'invisible', 'background']) {
    const mount = new Surface(), anchor = Object.assign(new Surface(), { hover: true });
    const tip = new ItemTooltip(mount as unknown as HTMLElement, 'cancel-test');
    const host = tip.element as unknown as Surface;
    tip.hover(item, view, anchor as unknown as HTMLElement);
    t.mock.timers.tick(50);
    if (mode === 'exit') tip.defer();
    if (mode === 'close') tip.hide();
    if (mode === 'resize') window.dispatchEvent(new Event('resize'));
    if (mode === 'dispose') tip.dispose();
    if (mode === 'detached') anchor.isConnected = false;
    if (mode === 'not-hovered') anchor.hover = false;
    if (mode === 'invisible') anchor.visible = false;
    if (mode === 'background') document.hidden = true;
    t.mock.timers.tick(1000);
    assert.equal(host.writes, 0, mode); assert.equal(host.hidden, true, mode);
    tip.dispose(); document.hidden = false;
  }
});
