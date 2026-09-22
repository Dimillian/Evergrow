import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { FramePacer } from '../src/frame-pacer.ts';
import { initialPlayer } from '../src/simulation.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { InventoryPanel } = await import('../src/inventory-panel.ts');
const { ServicePanel } = await import('../src/service-panel.ts');
css.deregister();

test('inventory keeps its portrait between scheduled draws and invalidates reduced-motion changes', t => {
  let reduced = false, portraits = 0, hudDraws = 0;
  const old = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: reduced }) } });
  t.after(() => { if (old) Object.defineProperty(globalThis, 'window', old); else Reflect.deleteProperty(globalThis, 'window'); });
  const ctx = new Proxy({
    clearRect: () => { portraits++; },
    getTransform: () => ({ a: 4, b: 0, c: 0, d: 4 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  } as Record<string, unknown>, { get: (target, name) => target[String(name)] ?? (() => {}) });
  const panel = Object.assign(Object.create(InventoryPanel.prototype), {
    player: initialPlayer(0, 0), element: { classList: { contains: () => false } },
    canvas: { width: 560, height: 720, getContext: () => ctx }, hud: { draw: () => { hudDraws++; } },
    facing: Math.PI / 2, portraitDirty: true, portraitReduced: false, portraitPacer: new FramePacer(30),
  });
  for (let i = 0; i < 120; i++) panel.draw(i * 1000 / 120);
  assert.ok(portraits >= 30 && portraits <= 31, `draws=${portraits}`);
  assert.equal(hudDraws, 120, 'portrait pacing does not suppress HUD interaction');
  reduced = true; panel.draw(1100); const still = portraits;
  for (let i = 0; i < 120; i++) panel.draw(1200 + i * 1000 / 120);
  assert.equal(portraits, still);
  panel.facing += Math.PI / 4; panel.portraitDirty = true; panel.draw(2300);
  assert.equal(portraits, still + 1, 'turning remains visible in reduced motion');
  panel.portraitDirty = true; panel.draw(2400);
  assert.equal(portraits, still + 2, 'equipment refresh invalidates a still portrait');
});

test('closing a vendor releases generated stock and DOM on every visit', () => {
  let children: object[] = [], stopped = 0, hidden = 0, disposed = 0;
  const panel = Object.assign(Object.create(ServicePanel.prototype), {
    element: { hidden: false, classList: { remove() {} }, querySelectorAll: () => [], replaceChildren: () => { children = []; } },
    goldFeedback: { stop: () => { stopped++; } }, tooltip: { hide: () => { hidden++; } }, sales: new Map(),
    tradeDrag: null,
  });
  for (let i = 0; i < 20; i++) {
    children = [{ svg: i }, { gradients: i }]; panel.element.hidden = false;
    panel.stockCache = { available: [{}], all: [{}] }; panel.revealed = {}; panel.selected = {}; panel.quote = {};
    panel.sales.set('item', {}); panel.focus = { dispose: () => { disposed++; } };
    panel.close();
    assert.equal(children.length, 0); assert.equal(panel.element.hidden, true);
    assert.equal(panel.stockCache, null); assert.equal(panel.revealed, null);
    assert.equal(panel.selected, null); assert.equal(panel.quote, null); assert.equal(panel.sales.size, 0);
  }
  assert.deepEqual([stopped, hidden, disposed], [20, 20, 20]);
});
