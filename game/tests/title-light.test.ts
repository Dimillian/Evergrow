import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTitleLight } from '../src/title-light.ts';
import { gameEmblemSVG, gameIdentityMarkup } from '../src/game-emblem.ts';

test('title light coalesces mouse motion, respects reduced motion and cleans up on exit/abort', t => {
  const keys = ['window','document','matchMedia','requestAnimationFrame','cancelAnimationFrame'];
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
  } });
  const callbacks = new Map<number, FrameRequestCallback>(); let next = 0;
  const motion = Object.assign(new EventTarget(), { matches: false });
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget(), matchMedia: () => motion,
    requestAnimationFrame: (fn: FrameRequestCallback) => { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame: (id: number) => callbacks.delete(id) });
  const props = new Map<string,string>(), attributes = new Map<string,string>(), classes = new Set<string>();
  const box = { left: 100, top: 40, width: 240, height: 40 };
  const name = { getBoundingClientRect: () => ({ ...box, left: 144, width: 196 }) };
  const emblem = { getBoundingClientRect: () => ({ ...box, width: 32 }) };
  const gradient = { setAttribute: (key: string, value: string) => attributes.set(key, value) };
  const root = Object.assign(new EventTarget(), { isConnected: true,
    querySelector: (s: string) => s === '.game-name' ? name : s === '.game-emblem svg' ? emblem : gradient,
    getBoundingClientRect: () => box, style: { setProperty: (k: string, v: string) => props.set(k, v) },
    classList: { add: (key: string) => classes.add(key), remove: (key: string) => classes.delete(key) },
  });
  const abort = new AbortController();
  const reset = bindTitleLight(root as unknown as HTMLElement, abort.signal);
  const move = (x: number, pointerType = 'mouse') => root.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: 60, pointerType }));
  const flush = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(0)); };
  move(116, 'touch'); assert.equal(callbacks.size, 0);
  move(110); move(116); assert.equal(callbacks.size, 1); flush();
  assert.equal(props.get('--brand-light-x'), '16px'); assert.equal(attributes.get('cx'), '32'); assert.equal(attributes.get('cy'), '32');
  assert.ok(classes.has('is-lit')); assert.equal(callbacks.size, 0, 'no idle animation loop');
  motion.matches = true; move(300); flush();
  assert.equal(props.get('--brand-light-x'), '120px'); assert.equal(attributes.get('cx'), '32');
  root.dispatchEvent(new Event('pointerleave')); assert.ok(!classes.has('is-lit'));
  move(140); reset(); assert.equal(callbacks.size, 0);
  move(170); abort.abort(); assert.equal(callbacks.size, 0); move(190); assert.equal(callbacks.size, 0);
});

test('brand backlight paints stay local and static icons omit hover geometry', () => {
  const first = gameEmblemSVG(42, true), second = gameEmblemSVG(42, true);
  const ids = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  for (const svg of [first, second]) for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids(svg).includes(id));
  assert.ok(ids(first).every(id => !ids(second).includes(id)));
  assert.doesNotMatch(gameEmblemSVG(), /data-emblem-light/);
  assert.match(gameIdentityMarkup(true, true), /<h1 class="game-name">EVERGROW<\/h1>/);
  assert.doesNotMatch(first, /<filter|<image|<script/);
});
