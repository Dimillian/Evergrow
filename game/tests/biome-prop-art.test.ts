import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentArt, ENVIRONMENT_ART_RULES } from '../src/environment-art.ts';
import { BIOME_PROP_BOUNDS } from '../src/biome-prop-art.ts';
import { PROP_KINDS, type PropKind } from '../src/biome-props.ts';
import { BIOME_IDS, type BiomeWeights } from '../src/biomes.ts';
import type { Prop } from '../src/world.ts';

class GeometryContext {
  globalAlpha = .6;
  fillStyle = '#000000'; strokeStyle = '#ffffff'; lineWidth = 1; lineJoin = 'round'; lineCap = 'round';
  offsetX = 0; offsetY = 0;
  points: Array<[number, number]> = [];
  commands: unknown[] = [];
  private stack: Array<[number, number, number]> = [];
  save() { this.stack.push([this.offsetX, this.offsetY, this.globalAlpha]); }
  restore() { [this.offsetX, this.offsetY, this.globalAlpha] = this.stack.pop()!; }
  translate(x: number, y: number) { this.offsetX += x; this.offsetY += y; }
  rotate(n: number) { assert.ok(Number.isFinite(n)); this.commands.push(['rotate', n]); }
  beginPath() {} closePath() {} fill() { this.commands.push(['fill', this.fillStyle]); }
  stroke() { assert.ok(Number.isFinite(this.lineWidth)); this.commands.push(['stroke', this.strokeStyle]); }
  point(x: number, y: number) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'all procedural points must be finite');
    this.points.push([x + this.offsetX, y + this.offsetY]); this.commands.push([x, y]);
  }
  moveTo(x: number, y: number) { this.point(x, y); }
  lineTo(x: number, y: number) { this.point(x, y); }
  quadraticCurveTo(x: number, y: number, xx: number, yy: number) { this.point(x, y); this.point(xx, yy); }
  fillRect(x: number, y: number, w: number, h: number) { this.point(x, y); this.point(x + w, y + h); this.commands.push(this.fillStyle); }
  ellipse(x: number, y: number, rx: number, ry: number) { this.point(x - rx, y - ry); this.point(x + rx, y + ry); }
}
const prop = (kind: PropKind, seed = 7319): Prop => ({ id: `${kind}:${seed}`, kind, seed, x: 0, y: 0, radius: 0, scale: 1 });

test('all biome sprite families emit finite unclipped geometry from reproducible seeds', () => {
  const contexts: Array<{ width: number; height: number; context: GeometryContext }> = [];
  const art = new EnvironmentArt((width, height) => {
    const context = new GeometryContext(); contexts.push({ width, height, context });
    return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  });
  const biomeKinds = PROP_KINDS.filter(kind => !['tree', 'deadTree', 'rock', 'shrine'].includes(kind));
  for (const kind of biomeKinds) for (let seed = 0; seed < 80; seed++) {
    const sprite = art.getSprite(prop(kind, seed));
    assert.ok(sprite, `there is actual artwork for ${kind}`);
    const calls = contexts.length;
    assert.equal(art.getSprite(prop(kind, seed)), sprite, 'a cache hit reuses the actual procedural sprite');
    assert.equal(contexts.length, calls);
    assert.ok(art.cacheStats.sprites <= ENVIRONMENT_ART_RULES.cacheLimit);
    assert.ok(art.cacheStats.pixels * 4 <= ENVIRONMENT_ART_RULES.cacheLimit * 186 * 178 * 4);
  }
  for (const { width, height, context } of contexts) for (const [x, y] of context.points) {
    assert.ok(x >= -.01 && x <= width + .01 && y >= -.01 && y <= height + .01,
      `sprite point ${x.toFixed(2)},${y.toFixed(2)} stays within ${width}×${height}`);
  }
  for (const kind of ['tree', 'deadTree', 'rock', 'shrine'] as const) assert.equal(art.getSprite(prop(kind)), null, 'base atlas owns this family');
  art.reset(); assert.deepEqual(art.cacheStats, { sprites: 0, pixels: 0 });
  assert.equal(Object.keys(BIOME_PROP_BOUNDS).length, 14);
});

test('ambient families sample their own world cells, respect reduced motion, and bound oversized views', () => {
  const art = new EnvironmentArt();
  const samples: Array<[number, number]> = [];
  const weights = (x: number, y: number): BiomeWeights => {
    samples.push([x, y]);
    return Object.fromEntries(BIOME_IDS.map(id => [id, id === (x < 0 ? 'frostpine' : 'emberfall') ? 1 : 0])) as BiomeWeights;
  };
  const view = { x: -400, y: -300, width: 800, height: 600 };
  const first = new GeometryContext(), second = new GeometryContext();
  art.drawAmbient(first as unknown as CanvasRenderingContext2D, weights, view, 0, true);
  assert.ok(samples.some(([x]) => x < 0) && samples.some(([x]) => x > 0), 'snow and embers use different sampled cells in one viewport');
  assert.ok(first.commands.includes('#dbe9e6') && first.commands.includes('#e9aa70'));
  art.drawAmbient(second as unknown as CanvasRenderingContext2D, weights, view, 980, true);
  assert.deepEqual(first.commands, second.commands, 'reduced-motion presentation does not advance with time');
  assert.equal(first.globalAlpha, .6, 'ambient art restores the caller alpha');
  samples.length = 0;
  art.drawAmbient(new GeometryContext() as unknown as CanvasRenderingContext2D, weights,
    { x: -500_000, y: -500_000, width: 1_000_000, height: 1_000_000 }, 5, false);
  assert.ok(samples.length <= ENVIRONMENT_ART_RULES.ambientCells, 'even huge review bounds have a fixed sampling ceiling');
});
