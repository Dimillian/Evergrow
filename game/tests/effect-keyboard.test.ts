import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the actual DOM event owners without launching or driving gameplay.
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { UITooltipStack } = await import('../src/ui-tooltip-stack.ts');
const { BuffBar } = await import('../src/buff-bar.ts');
css.deregister();

class Surface extends EventTarget {
  setAttribute() {}
  append() {}
  remove() {}
  matches() { return false; }
  contains(node: unknown) { return node === this; }
}
test('focused buff icons and explanation links own gameplay keys but preserve native activation and Escape', () => {
  const doc = new Surface(), win = new Surface();
  Object.assign(doc, { createElement: () => new Surface() });
  const originals = new Map(['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  const mount = new Surface();
  const stack = new UITooltipStack(mount as unknown as HTMLElement, () => undefined);
  const bar = new BuffBar(mount as unknown as HTMLElement);
  try {
    for (const target of [mount, bar.element]) {
      for (const key of [' ', 'Enter', 'Tab', 'f', '1', 'Escape']) {
        const event = new Event('keydown', { bubbles: true, cancelable: true });
        Object.defineProperties(event, { key: { value: key }, target: { value: { closest: () => ({}) } } });
        let stopped = false;
        target.addEventListener('keydown', e => { stopped = e.cancelBubble; }, { once: true });
        target.dispatchEvent(event);
        assert.equal(stopped, key !== 'Escape', key);
        assert.equal(event.defaultPrevented, false, 'native button activation/focus must remain available');
      }
    }
  } finally {
    stack.dispose(); bar.dispose();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
