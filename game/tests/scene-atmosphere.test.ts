import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { SceneShadows } from '../src/scene-shadows.ts';
import { AtmosphereArt } from '../src/atmosphere-art.ts';
import { cameraView } from '../src/camera.ts';
import type { Sprite } from '../src/art-types.ts';
import type { World, Prop } from '../src/world.ts';
import { sampleBiome } from '../src/biomes.ts';

function fixture(t: TestContext) {
  let allocations = 0;
  const transforms: number[][] = [], draws: number[][] = [];
  const context = { globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {},
    transform(...args: number[]) { transforms.push(args); }, fillRect() {},
    drawImage(_image: unknown, ...args: number[]) { draws.push(args); },
    createRadialGradient() { return { addColorStop() {} }; },
  } as unknown as CanvasRenderingContext2D;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable:true, value:{ createElement() {
    allocations++; return { width:144, height:144, getContext() { return context; } };
  } } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'document', descriptor) : Reflect.deleteProperty(globalThis, 'document'));
  return { context, transforms, draws, allocations: () => allocations };
}
const prop: Prop = { id:'tree', kind:'canopy', x:0, y:0, scale:1, radius:12, seed:123, biome:'verdant' };
const view = cameraView(640, 480, 0, 0, 1);
test('canopy shadows reuse silhouettes, move with wind, and freeze with reduced motion', t => {
  const f = fixture(t), shadows = new SceneShadows();
  const sprite: Sprite = { image:document.createElement('canvas'), foliage:[document.createElement('canvas')], width:144, height:144, anchorX:72, anchorY:140 };
  const render = (time: number, reduced: boolean) => {
    f.transforms.length = 0; shadows.drawProps(f.context, [prop], view, () => sprite, time, reduced);
    return f.transforms.map(a => [...a]);
  };
  const frozen = render(0, true), allocations = f.allocations();
  assert.deepEqual(render(15, true), frozen);
  assert.equal(f.allocations(), allocations);
  assert.notDeepEqual(render(0, false), render(15, false));
  assert.equal(f.allocations(), allocations);
});
test('atmosphere freezes world anchors, avoids interiors and never touches simulation', t => {
  const f = fixture(t), atmosphere = new AtmosphereArt();
  const world = { sampleBiome:(x:number,y:number) => sampleBiome(x,y,7319), getBuildingAt:() => null, blocked:() => false } as unknown as World;
  const render = (time: number, indoor = 0) => {
    f.draws.length = 0; atmosphere.drawLayer(f.context, world, view, time, true, 0, 0, false, false, indoor);
    return f.draws.map(a => [...a]);
  };
  // Warm the procedural cookie cache so only scene draw calls remain in both samples.
  render(0);
  const frozen = render(0), count = f.allocations();
  assert.ok(frozen.length > 0 && frozen.length <= 96);
  assert.deepEqual(render(50), frozen);
  assert.equal(f.allocations(), count);
  assert.equal(render(0, 1).length, 0);
  f.draws.length = 0;
  atmosphere.drawLayer(f.context, { ...world, blocked:() => true } as unknown as World, view, 0, false, 0, 0, false, true, 0);
  assert.equal(f.draws.length, 0, 'no fog is painted on solid dungeon walls');
});
