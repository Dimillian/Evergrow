import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { RetainedTooltip } = await import('../src/retained-tooltip.ts');
css.deregister();

class Surface extends EventTarget {
  hidden = false; isConnected = true; hover = false; focused = false; keyboardFocus = false;
  focusedChild: Surface | null = null;
  innerHTML = ''; className = ''; id = ''; offsetWidth = 180; offsetHeight = 160;
  style = { left: '', top: '' };
  attributes = new Map<string, string>();
  children: Surface[] = [];
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  append(node: Surface) { this.children.push(node); node.isConnected = true; }
  remove() { this.isConnected = false; }
  contains(node: unknown): boolean { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector: string) {
    return selector.includes(':hover') && this.hover || selector.includes(':focus-visible') && this.keyboardFocus
      || selector.includes(':focus-within') && this.focused;
  }
  querySelector() { return this.focusedChild?.keyboardFocus ? this.focusedChild : null; }
  getBoundingClientRect() { return { left: 100, right: 140, top: 100, bottom: 140 }; }
}

test('item hover dismissal ignores click focus and cannot be postponed by unrelated pointer exits', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = Object.assign(new Surface(), {
    createElement: () => new Surface(), documentElement: { clientWidth: 1200, clientHeight: 800 },
  });
  for (const [key, value] of Object.entries({ document: doc, window: new Surface() })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  const mount = new Surface(), source = new Surface();
  const tip = new RetainedTooltip(mount as unknown as HTMLElement, 'test-item');
  const card = tip.element as unknown as Surface;
  t.after(() => tip.dispose());
  const show = () => tip.show('Item', source as unknown as HTMLElement);

  source.focused = true; // Selecting a vendor inventory cell leaves DOM focus behind.
  show(); tip.defer();
  t.mock.timers.tick(200); tip.defer();
  t.mock.timers.tick(79); assert.equal(card.hidden, false, 'brief crossing grace remains');
  t.mock.timers.tick(1); assert.equal(card.hidden, true, 'mouse focus and repeated exits cannot pin the card');
  assert.equal(source.getAttribute('aria-describedby'), null);

  source.keyboardFocus = true; show(); tip.defer(); t.mock.timers.tick(280);
  assert.equal(card.hidden, false, 'keyboard inspection remains open');
  source.keyboardFocus = false; t.mock.timers.tick(280);
  assert.equal(card.hidden, true, 'leaving keyboard focus dismisses inspection');

  show(); tip.defer(); t.mock.timers.tick(100); card.hover = true;
  t.mock.timers.tick(180); assert.equal(card.hidden, false, 'crossing onto the card preserves scrolling');
  card.hover = false; card.focused = true; tip.defer(); t.mock.timers.tick(280);
  assert.equal(card.hidden, true, 'click focus on the card does not keep it stuck either');

  show(); card.focusedChild = Object.assign(new Surface(), { keyboardFocus: true });
  tip.defer(); t.mock.timers.tick(280); assert.equal(card.hidden, false, 'keyboard-focused explanation links retain their parent');
  source.isConnected = false; t.mock.timers.tick(280);
  assert.equal(card.hidden, true, 'removed source items always dismiss');
});
