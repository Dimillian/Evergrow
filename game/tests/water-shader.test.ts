import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterShader } from '../src/water-shader.ts';
import { WaterSimulation } from '../src/water-simulation.ts';

test('water uploads only dirty field textures, reuses allocations and restores after context loss', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const uploads: Array<{ unit: number; allocate: boolean }> = [];
  const handlers = new Map<string, (event: { preventDefault(): void }) => void>();
  let unit = 0;
  const gl = new Proxy({
    TEXTURE0: 100, COMPILE_STATUS: 1, LINK_STATUS: 2,
    activeTexture: (value: number) => { unit = value - 100; },
    getShaderParameter: () => true, getProgramParameter: () => true,
    createShader: () => ({}), createProgram: () => ({}), createTexture: () => ({}), createBuffer: () => ({}),
    texImage2D: () => uploads.push({ unit, allocate: true }),
    texSubImage2D: () => uploads.push({ unit, allocate: false }),
  }, { get: (object, key) => key in object ? Reflect.get(object, key) : () => {} });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({
    width: 1, height: 1, getContext: () => gl,
    addEventListener: (name: string, callback: (event: { preventDefault(): void }) => void) => handlers.set(name, callback),
  }) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const shader = new WaterShader(), fluid = new WaterSimulation();
  const bounds = { x: -400, y: -300, width: 800, height: 600 };
  const wet = () => ({ coverage: 1, depth: 1, flowX: 0, flowY: 0, bank: 0, kind: 'lake' as const });
  fluid.fit(bounds, wet);
  const target = { canvas: { width: 800, height: 600 }, drawImage() {} } as unknown as CanvasRenderingContext2D;
  const reflection = { width: 1024, height: 796 } as HTMLCanvasElement;
  const view = { left: -400, top: -300, width: 800, height: 600 };
  const draw = () => { uploads.length = 0; assert(shader.draw(target, fluid, reflection, view, [], false)); return uploads.map(u => u.unit); };
  assert.deepEqual(draw(), [0, 1, 2, 3]); assert(uploads.every(u => u.allocate));
  fluid.update(1 / 60);
  assert.deepEqual(draw(), [0, 3]); assert(uploads.every(u => !u.allocate));
  fluid.disturb({ x: 0, y: 0, radius: 24, strength: 1 });
  assert.deepEqual(draw(), [0, 2, 3]); assert(uploads.every(u => !u.allocate));
  fluid.fit({ ...bounds, x: -368 }, wet);
  assert.deepEqual(draw(), [0, 1, 2, 3]); assert(uploads.every(u => !u.allocate));
  target.canvas.width = 1000;
  draw(); assert.deepEqual(uploads.filter(u => u.allocate).map(u => u.unit), [0]);
  handlers.get('webglcontextlost')!({ preventDefault() {} });
  assert.equal(shader.draw(target, fluid, reflection, view, [], false), false);
  handlers.get('webglcontextrestored')!({ preventDefault() {} });
  assert.deepEqual(draw(), [0, 1, 2, 3]); assert(uploads.every(u => u.allocate));
  shader.reset();
  assert.deepEqual(draw(), [0, 1, 2, 3]); assert(uploads.every(u => u.allocate));
});
