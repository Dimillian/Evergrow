import assert from 'node:assert/strict';
import test from 'node:test';
import { GroundDressing, GROUND_DRESSING_LIMIT, drawGroundPatches } from '../src/ground-art.ts';
import { createTreeSprite, TREE_BOUNDS, type TreeKind } from '../src/tree-art.ts';
import { BIOME_IDS } from '../src/biomes.ts';
import { PROP_KINDS } from '../src/biome-props.ts';
import type { Prop } from '../src/world.ts';

class Context {
  globalAlpha = 1; fillStyle: unknown = ''; strokeStyle = ''; lineWidth = 1;
  commands: unknown[] = [];
  record(...values: number[]) { assert.ok(values.every(Number.isFinite)); this.commands.push(values); }
  save() {} restore() {} clip() {} beginPath() {} closePath() {}
  translate(...n: number[]) { this.record(...n); } scale(...n: number[]) { this.record(...n); }
  moveTo(...n: number[]) { this.record(...n); } lineTo(...n: number[]) { this.record(...n); }
  ellipse(...n: number[]) { this.record(...n); } fillRect(...n: number[]) { this.record(...n); }
  fill() { this.commands.push(typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient'); } stroke() { this.commands.push(this.strokeStyle); }
  createRadialGradient(...n: number[]) { this.record(...n); return { addColorStop: (offset: number, color: string) => this.commands.push([offset, color]) }; }
  drawImage() {}
}
const prop = (seed: number): Prop => ({ id: String(seed), kind: 'tree', biome: 'verdant', seed,
  x: 120, y: -50, scale: 1, radius: 9 });
const factory = (contexts: Context[]) => (width: number, height: number) => {
  const context = new Context(); contexts.push(context);
  return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
};

test('cached ground dressing regenerates identically regardless of the first matching prop position, size or radius', () => {
  const contexts: Context[] = [], art = new GroundDressing(factory(contexts)), target = new Context();
  art.draw(target as unknown as CanvasRenderingContext2D, [prop(73)]);
  const original = contexts[0].commands;
  art.reset();
  art.draw(target as unknown as CanvasRenderingContext2D, [{ ...prop(73), x: -1700, y: 430, radius: 14, scale: 1.2 }]);
  assert.deepEqual(contexts[1].commands, original);
  art.draw(target as unknown as CanvasRenderingContext2D, [prop(73)]);
  assert.equal(contexts.length, 2, 'a cache hit never redraws its ground geometry');
  for (let seed = 0; seed < 1200; seed++) art.draw(target as unknown as CanvasRenderingContext2D,
    [{ ...prop(seed), kind: PROP_KINDS[seed % PROP_KINDS.length], biome: BIOME_IDS[seed % BIOME_IDS.length] }]);
  assert.equal(art.cacheSize, GROUND_DRESSING_LIMIT);
  art.reset(); assert.equal(art.cacheSize, 0);
});

test('ground deposits honor protected ground before drawing or sampling a biome', () => {
  const c = new Context(); let samples = 0;
  drawGroundPatches(c as unknown as CanvasRenderingContext2D, -256, -256, 256, 7319,
    () => { samples++; return 'verdant'; }, () => false);
  assert.equal(samples, 0);
  assert.equal(c.commands.length, 1, 'only the tile translation is emitted when every anchor is protected');
});

test('every tree family regenerates finite rooted and foliage layers without seed history', () => {
  for (const kind of Object.keys(TREE_BOUNDS) as TreeKind[]) {
    const a: Context[] = [], b: Context[] = [];
    const first = createTreeSprite(factory(a), kind, 17319);
    createTreeSprite(factory([]), kind, 982);
    const second = createTreeSprite(factory(b), kind, 17319);
    assert.deepEqual(a.map(c => c.commands), b.map(c => c.commands));
    assert.deepEqual([first.width, first.height], TREE_BOUNDS[kind]);
    assert.equal(first.foliage?.length ?? 0, ['deadTree', 'charredTree'].includes(kind) ? 0 : 2);
    assert.notEqual(first.image, second.image);
    assert.ok(a.every(c => c.commands.length > 10));
  }
});
