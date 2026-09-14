import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { GroundLootHighlight } = await import('../src/ground-loot-highlight.ts');
css.deregister();
class Surface extends EventTarget {
  hidden = false; hover = false; innerHTML = ''; className = ''; children: Surface[] = [];
  style = { cursor: '', setProperty() {} };
  setAttribute() {} append(...nodes: Surface[]) { this.children.push(...nodes); } remove() {}
  matches() { return this.hover; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 700 }; }
}
test('ground inspection retains scroll access, switches a stationary comparison, and closes with its owner', t => {
  let now = 0; t.mock.method(performance, 'now', () => now);
  const win = new EventTarget();
  for (const [key, value] of Object.entries({ window: win, document: { createElement: () => new Surface() } })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  const mount = new Surface(), canvas = new Surface();
  const highlight = new GroundLootHighlight(mount as unknown as HTMLElement, canvas as unknown as HTMLCanvasElement);
  const tooltip = mount.children[1];
  const player = initialPlayer(0, 0);
  player.character.equipped.ring1 = generateItem(5000, 1, 'ring');
  player.character.equipped.ring2 = null;
  const drops = [{ id: 1, x: 0, y: 0, item: generateItem(5001, 1, 'ring') }];
  const labels = [{ id: 1, x: 10, y: 10, width: 100, height: 25, anchorX: 50, anchorY: 50 }];
  const update = (pointer: { x: number; y: number } | null, enabled = true) => highlight.update(player, drops, labels, 1000, 700, pointer, 0, null, enabled);
  update({ x: 20, y: 20 }); assert.equal(tooltip.hidden, false);
  assert.doesNotMatch(tooltip.innerHTML, /Replaces ring 1/);
  now = 300; update(null); assert.equal(tooltip.hidden, false, 'crossing the gap retains inspection');
  tooltip.hover = true; now = 2000; update(null); assert.equal(tooltip.hidden, false, 'reading and scrolling retain the card');
  win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'ShiftLeft', shiftKey: true }));
  update(null); assert.match(tooltip.innerHTML, /Replaces ring 1/, 'Shift compares the occupied other ring without moving the mouse');
  win.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Alt', altKey: true }));
  update(null); assert.match(tooltip.innerHTML, /ground-loot-details/, 'Alt expands a stationary tooltip');
  win.dispatchEvent(Object.assign(new Event('keyup'), { key: 'Alt', altKey: false }));
  update(null); assert.doesNotMatch(tooltip.innerHTML, /ground-loot-details/, 'release collapses the detail panel');
  win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'ShiftLeft', shiftKey: false }));
  update(null); assert.doesNotMatch(tooltip.innerHTML, /Replaces ring 1/);
  update(null, false); assert.equal(tooltip.hidden, true, 'pausing closes even a hovered card');
  tooltip.hover = false; update({ x: 20, y: 20 }); now += 601; update(null); assert.equal(tooltip.hidden, true);
  update({ x: 20, y: 20 }); drops.length = 0; update(null); assert.equal(tooltip.hidden, true, 'removed drops cannot leave stale inspection');
  highlight.dispose();
});
