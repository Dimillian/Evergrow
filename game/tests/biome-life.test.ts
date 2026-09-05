import test from 'node:test';
import assert from 'node:assert/strict';
import { BiomeLife, BIOME_LIFE_LIMITS } from '../src/biome-life.ts';
import { biomeWind } from '../src/biome-wind.ts';
import { BIOME_IDS, type BiomeId, type BiomeWeights } from '../src/biomes.ts';
import { BIOME_LIFE, biomeForDebris } from '../src/biome-life-content.ts';
import { groundContact, type GroundContact } from '../src/ground-material.ts';
import type { Prop } from '../src/world.ts';

const prop = (id: number, kind: Prop['kind'] = 'rock'): Prop => Object.freeze({ id: String(id), seed: id * 173,
  kind, biome: 'verdant', x: id * 3, y: 20, radius: 9, scale: 1 });
const weights = (id: BiomeId): BiomeWeights => Object.fromEntries(BIOME_IDS.map(key => [key, key === id ? 1 : 0])) as BiomeWeights;
const forestGround = (): GroundContact => ({ weights: weights('verdant'), water: 0, natural: 1, indoors: false });
const indoorGround = (): GroundContact => ({ ...forestGround(), natural: 0, indoors: true });
const subject = (x: number, vx = 45) => Object.freeze({ x, y: 30, vx, vy: 0 });

test('nearby foliage shares continuous wind fronts and reduced motion removes wind', () => {
  for (let t = 0; t < 20; t += .1) {
    const a = biomeWind(-4500, 2800, t, 'verdant'), b = biomeWind(-4499, 2800, t, 'verdant');
    assert.ok(Math.abs(a.x - b.x) < .08);
    assert.ok(a.gust >= 0 && a.gust <= 1);
    assert.deepEqual(biomeWind(-4500, 2800, t, 'verdant', true), { x: 0, y: 0, gust: 0 });
  }
});

test('footsteps disturb nearby grass, settle naturally and never bridge teleports', () => {
  const life = new BiomeLife();
  life.update(.05, 0, [], subject(0), false, forestGround);
  life.update(.05, .05, [], subject(20), false, forestGround);
  assert.equal(life.footsteps.length, 1);
  assert.equal(life.particles.length, 3);
  assert.notEqual(life.bend(24, 30), 0);
  assert.equal(life.bend(150, 30), 0);
  const particles = life.particles.length;
  life.update(.05, .1, [], subject(3000), false, forestGround);
  assert.equal(life.trails.length, 0); assert.equal(life.footsteps.length, 0);
  assert.equal(life.particles.length, particles);
  for (let i = 0; i < 100; i++) life.update(.05, .15 + i * .05, [], subject(3000, 0), false, forestGround);
  assert.equal(life.particles.length, 0); assert.equal(life.bend(24, 30), 0);
});

test('crows startle on approach, keep their home and land again once it is clear', () => {
  const life = new BiomeLife(), props = Object.freeze([prop(1)]);
  life.update(.05, 0, props, subject(-150, 0), false, forestGround);
  const bird = life.birds[0], home = { x: bird.homeX, y: bird.homeY, z: bird.homeZ };
  assert.equal(bird.state, 'perched');
  life.update(.05, .05, props, subject(-30), false, forestGround);
  assert.equal(bird.state, 'fleeing');
  for (let i = 0; i < 400; i++) life.update(.05, .1 + i * .05, props, subject(-220, 0), false, forestGround);
  assert.equal(bird.state, 'perched'); assert.deepEqual({ x: bird.x, y: bird.y, z: bird.z }, home);
});

test('forest effects stay bounded, repeatable and separate from immutable subjects and world props', () => {
  const props = Object.freeze(Array.from({ length: 180 }, (_, i) => prop(i, ['rock', 'flowers', 'canopy'][i % 3] as Prop['kind'])));
  const a = new BiomeLife(), b = new BiomeLife();
  for (let i = 0; i < 1800; i++) {
    const p = subject(Math.sin(i * .02) * 220);
    a.update(1 / 30, i / 30, props, p, false, forestGround); b.update(1 / 30, i / 30, props, p, false, forestGround);
    for (const key of ['trails', 'footsteps', 'particles', 'birds', 'insects'] as const) assert.ok(a[key].length <= BIOME_LIFE_LIMITS[key]);
  }
  assert.deepEqual(a, b);
  const frozen = JSON.stringify([a.trails, a.footsteps, a.particles, a.birds, a.insects]);
  a.update(1, 1000, props, subject(500), true, forestGround);
  assert.equal(JSON.stringify([a.trails, a.footsteps, a.particles, a.birds, a.insects]), frozen);
  a.reset(); for (const key of ['trails', 'footsteps', 'particles', 'birds', 'insects'] as const) assert.equal(a[key].length, 0);
});

test('indoor walking emits no terrain footsteps and reduced-motion initialization keeps wildlife visible', () => {
  const life = new BiomeLife();
  for (let i = 0; i < 20; i++) life.update(.05, i * .05, [], subject(i * 20), false, indoorGround);
  assert.equal(life.footsteps.length, 0); assert.equal(life.particles.length, 0);
  life.reset(); life.update(.05, 0, [prop(1)], subject(-150), true, forestGround);
  assert.equal(life.birds.length, 1); assert.equal(life.birds[0].age, 1);
});

test('every climate has frozen material and wildlife recipes and emits its own footstep debris', () => {
  for (const id of BIOME_IDS) {
    const profile = BIOME_LIFE[id];
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.colors) && Object.isFrozen(profile.emitters));
    const contact = (): GroundContact => ({ weights: weights(id), natural: 1, water: 0, indoors: false });
    const life = new BiomeLife();
    life.update(.05, 0, [], subject(0), false, contact);
    life.update(.05, .05, [], subject(20), false, contact);
    assert.equal(life.footsteps.length, 1, id);
    assert.ok(life.particles.length > 0, id);
    assert.ok(life.particles.every(p => p.biome === id && p.kind === profile.debris), id);
    const props = [profile.perches[0], profile.insectAnchors[0]].filter(kind => kind !== undefined)
      .map((kind, i) => ({ ...prop(i + 10, kind), biome: id }));
    const wildlife = new BiomeLife(); wildlife.update(.05, 0, props, subject(-150, 0), false, contact);
    assert.equal(wildlife.birds[0]?.kind ?? null, profile.bird, id);
    assert.equal(wildlife.insects[0]?.kind ?? null, profile.insect, id);
  }
});

test('wet splashes follow actual pooled water, while paving and interiors suppress natural material', () => {
  const wet = groundContact(weights('swamp'), .9, 0, 0, false);
  assert.equal(wet.water, 1);
  assert.equal(groundContact(weights('swamp'), .3, 0, 0, false).water, 0, 'dry Mire ground is not water');
  for (const ground of [groundContact(weights('swamp'), .9, 1, 0, false), groundContact(weights('swamp'), .9, 0, 1, false),
    groundContact(weights('swamp'), .9, 0, 0, true)]) {
    assert.equal(ground.water, 0); assert.equal(ground.natural, 0);
  }
  const life = new BiomeLife();
  life.update(.05, 0, [], subject(0), false, () => wet);
  life.update(.05, .05, [], subject(20), false, () => wet);
  assert.equal(life.footsteps[0].material, 'droplet');
  assert.ok(life.particles.every(p => p.kind === 'droplet'));
  const road = groundContact(weights('frostpine'), .9, 1, 0, false);
  life.update(.05, .1, [], subject(40), false, () => road);
  assert.ok(life.particles.slice(-3).every(p => p.kind === 'dust'), 'paved snow-country footsteps lift dust, not snow');
});

test('climate borders blend wind and debris without recoloring earlier footprints or particles', () => {
  const mixed = { ...weights('frostpine'), frostpine: .5, autumn: .5 };
  assert.equal(biomeForDebris(mixed, .2), 'frostpine');
  assert.equal(biomeForDebris(mixed, .8), 'autumn');
  const a = biomeWind(0, 0, 2, 'frostpine'), b = biomeWind(0, 0, 2, 'autumn'), blend = biomeWind(0, 0, 2, mixed);
  assert.ok(Math.abs(blend.x - (a.x + b.x) / 2) < 1e-12); assert.equal(a.gust, b.gust);
  const life = new BiomeLife(), snowy = () => groundContact(weights('frostpine'), .8, 0, 0, false);
  life.update(.05, 0, [], subject(0), false, snowy); life.update(.05, .05, [], subject(20), false, snowy);
  const first = life.particles[0], color = first.color, footColor = life.footsteps[0].color;
  life.update(.05, .1, [], subject(40), false, () => groundContact(weights('autumn'), .8, 0, 0, false));
  assert.equal(first.biome, 'frostpine'); assert.equal(first.kind, 'snow'); assert.equal(first.color, color);
  assert.equal(life.footsteps[0].color, footColor);
  assert.ok(life.particles.slice(-3).every(p => p.biome === 'autumn'));
});

test('shared wildlife and particle limits hold across mixed-biome streaming and teleport resets', () => {
  const life = new BiomeLife();
  for (let step = 0; step < 700; step++) {
    const id = BIOME_IDS[Math.floor(step / 100)], profile = BIOME_LIFE[id];
    const props = Array.from({ length: 80 }, (_, i) => ({ ...prop(i, profile.perches[0] ?? profile.emitters[0]), biome: id, id: id + i }));
    const insects = Array.from({ length: 50 }, (_, i) => ({ ...prop(i + 100, profile.insectAnchors[0] ?? profile.emitters[0]), biome: id, id: id + '-i' + i }));
    life.update(.05, step * .05, [...props, ...insects], subject(step % 100 * 4), false,
      () => groundContact(weights(id), .8, 0, 0, false));
    for (const key of ['trails', 'footsteps', 'particles', 'birds', 'insects'] as const) assert.ok(life[key].length <= BIOME_LIFE_LIMITS[key]);
  }
  life.update(.05, 36, [], subject(10000), false, forestGround);
  assert.equal(life.footsteps.length, 0); assert.equal(life.trails.length, 0);
});
