import test from 'node:test';
import assert from 'node:assert/strict';
import { ForestLife, FOREST_LIFE_LIMITS } from '../src/forest-life.ts';
import { forestWind } from '../src/forest-wind.ts';
import type { Prop } from '../src/world.ts';

const prop = (id: number, kind: Prop['kind'] = 'rock'): Prop => Object.freeze({ id: String(id), seed: id * 173,
  kind, biome: 'verdant', x: id * 3, y: 20, radius: 9, scale: 1 });
const subject = (x: number, vx = 45) => Object.freeze({ x, y: 30, vx, vy: 0 });

test('nearby foliage shares continuous wind fronts and reduced motion removes wind', () => {
  for (let t = 0; t < 20; t += .1) {
    const a = forestWind(-4500, 2800, t), b = forestWind(-4499, 2800, t);
    assert.ok(Math.abs(a.x - b.x) < .08);
    assert.ok(a.gust >= 0 && a.gust <= 1);
    assert.deepEqual(forestWind(-4500, 2800, t, true), { x: 0, y: 0, gust: 0 });
  }
});

test('footsteps disturb nearby grass, settle naturally and never bridge teleports', () => {
  const life = new ForestLife();
  life.update(.05, 0, [], subject(0), false, true);
  life.update(.05, .05, [], subject(20), false, true);
  assert.equal(life.footsteps.length, 1);
  assert.equal(life.leaves.length, 3);
  assert.notEqual(life.bend(24, 30), 0);
  assert.equal(life.bend(150, 30), 0);
  const leaves = life.leaves.length;
  life.update(.05, .1, [], subject(3000), false, true);
  assert.equal(life.trails.length, 0); assert.equal(life.footsteps.length, 0);
  assert.equal(life.leaves.length, leaves);
  for (let i = 0; i < 100; i++) life.update(.05, .15 + i * .05, [], subject(3000, 0), false, true);
  assert.equal(life.leaves.length, 0); assert.equal(life.bend(24, 30), 0);
});

test('crows startle on approach, keep their home and land again once it is clear', () => {
  const life = new ForestLife(), props = Object.freeze([prop(1)]);
  life.update(.05, 0, props, subject(-150, 0), false, true);
  const bird = life.birds[0], home = { x: bird.homeX, y: bird.homeY, z: bird.homeZ };
  assert.equal(bird.state, 'perched');
  life.update(.05, .05, props, subject(-30), false, true);
  assert.equal(bird.state, 'fleeing');
  for (let i = 0; i < 400; i++) life.update(.05, .1 + i * .05, props, subject(-220, 0), false, true);
  assert.equal(bird.state, 'perched'); assert.deepEqual({ x: bird.x, y: bird.y, z: bird.z }, home);
});

test('forest effects stay bounded, repeatable and separate from immutable subjects and world props', () => {
  const props = Object.freeze(Array.from({ length: 180 }, (_, i) => prop(i, ['rock', 'flowers', 'canopy'][i % 3] as Prop['kind'])));
  const a = new ForestLife(), b = new ForestLife();
  for (let i = 0; i < 1800; i++) {
    const p = subject(Math.sin(i * .02) * 220);
    a.update(1 / 30, i / 30, props, p, false, true); b.update(1 / 30, i / 30, props, p, false, true);
    for (const key of ['trails', 'footsteps', 'leaves', 'birds', 'butterflies'] as const) assert.ok(a[key].length <= FOREST_LIFE_LIMITS[key]);
  }
  assert.deepEqual(a, b);
  const frozen = JSON.stringify([a.trails, a.footsteps, a.leaves, a.birds, a.butterflies]);
  a.update(1, 1000, props, subject(500), true, true);
  assert.equal(JSON.stringify([a.trails, a.footsteps, a.leaves, a.birds, a.butterflies]), frozen);
  a.reset(); for (const key of ['trails', 'footsteps', 'leaves', 'birds', 'butterflies'] as const) assert.equal(a[key].length, 0);
});

test('nonforest walking emits no forest footsteps and reduced-motion initialization keeps wildlife visible', () => {
  const life = new ForestLife();
  for (let i = 0; i < 20; i++) life.update(.05, i * .05, [], subject(i * 20), false, false);
  assert.equal(life.footsteps.length, 0); assert.equal(life.leaves.length, 0);
  life.reset(); life.update(.05, 0, [prop(1)], subject(-150), true, true);
  assert.equal(life.birds.length, 1); assert.equal(life.birds[0].age, 1);
});
