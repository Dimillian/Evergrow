import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { FrameProfiler } from '../src/frame-profiler.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { ItemTooltip } = await import('../src/item-tooltip.ts');
css.deregister();

class Surface extends EventTarget {
  hidden = false; isConnected = true; className = ''; id = ''; writes = 0;
  offsetWidth = 500; offsetHeight = 400;
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
  getBoundingClientRect() { return { left: 100, right: 140, top: 100, bottom: 140, width: 40, height: 40 }; }
  contains(node: unknown): boolean { return node === this || this.children.some(c => c.contains(node)); }
  matches() { return false; }
  querySelector(selector: string) { return selector === '.ui-item-alt-toggle' && this.markup.includes('ui-item-alt-toggle') ? this : null; }
}

test('repeated item inspection retains one host and never rebuilds the old Alt comparison on switch/hide', t => {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { createElement: () => new Surface(), documentElement: { clientWidth: 1200, clientHeight: 900 } });
  for (const [key, value] of Object.entries({ window, document })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
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
