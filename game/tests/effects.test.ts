import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatEffects } from '../src/effects.ts';
import { Simulation } from '../src/simulation.ts';
import { SkillEffects } from '../src/skill-effects.ts';
import type { CombatEvent, Projectile, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const fields = ['sparks', 'flashes', 'impacts', 'popups'] as const;
type EffectField = typeof fields[number];
type EffectStorage = Record<EffectField, unknown[]>;
const storage = (effects: CombatEffects) => effects as unknown as EffectStorage;

test('effect storage stays bounded while processing a large event batch, not only after it', () => {
  const effects = new CombatEffects();
  const peaks: Record<EffectField, number> = { sparks: 0, flashes: 0, impacts: 0, popups: 0 };
  for (const field of fields) {
    const list = storage(effects)[field], push = list.push.bind(list);
    list.push = (...items: unknown[]) => {
      const length = push(...items); peaks[field] = Math.max(peaks[field], length); return length;
    };
  }
  const samples: CombatEvent[] = [
    { type: 'hit', x: 0, y: 0, angle: .3, value: 20, enemyKind: 'brute', targetId: 1, remainingHp: 80, heavy: false },
    { type: 'kill', facing: 0, x: 0, y: 0, angle: .3, enemyKind: 'brute', targetId: 1, remainingHp: 0 },
    { type: 'hurt', x: 0, y: 0, angle: .3, value: 20, remainingHp: 80, enemyKind: 'brute', heavy: false },
    { type: 'heal', x: 0, y: 0, value: 20 },
  ];
  effects.handleEvents(Array.from({ length: 4000 }, (_, index) => ({ ...samples[index % samples.length], x: index })));
  assert.ok(peaks.sparks <= 700 && peaks.flashes <= 24 && peaks.impacts <= 26 && peaks.popups <= 36,
    `transient storage must be independent of event batch length: ${JSON.stringify(peaks)}`);
  assert.ok(storage(effects).sparks.length <= 650);
  assert.ok(storage(effects).flashes.length <= 22);
  assert.ok(storage(effects).impacts.length <= 24);
  assert.ok(storage(effects).popups.length <= 35);
  assert.ok(effects.getLights().length <= 7);
  effects.reset();
  assert.ok(fields.every(field => storage(effects)[field].length === 0));
  assert.equal(effects.getLights().length, 0);
});

test('long display gaps expire old feedback without replaying a particle emission backlog', () => {
  const effects = new CombatEffects(), sim = new Simulation(emptyWorld, { spawn: false });
  sim.projectiles = Array.from({ length: 32 }, (_, id): Projectile => ({
    id, x: id * 5, y: 0, prevX: id * 5, prevY: 0, vx: 100, vy: 0, angle: 0,
    radius: 3, damage: 10, life: 2, sourceLevel: 1, maxLife: 2, owner: 'player', hitIds: new Set(),
  }));
  effects.handleEvents([{ type: 'hit', x: 0, y: 0, value: 20, angle: 0, targetId: 1, remainingHp: 80, enemyKind: 'stalker', heavy: false }]);
  effects.update(sim, 30);
  assert.ok(storage(effects).sparks.length > 0 && storage(effects).sparks.length <= 128,
    'only a bounded current-frame emission is generated');
  assert.equal(storage(effects).flashes.length, 0);
  assert.equal(storage(effects).popups.length, 0);
  sim.player.dead = true;
  effects.update(sim, 2);
  assert.ok(fields.every(field => storage(effects)[field].length === 0), 'stopped gameplay cannot emit indefinitely');
});

test('invalid visual deltas cannot poison live particles', () => {
  const effects = new CombatEffects(), sim = new Simulation(emptyWorld, { spawn: false });
  effects.handleEvents([{ type: 'hit', x: 0, y: 0, value: 20, angle: 0, targetId: 1, remainingHp: 80, enemyKind: 'stalker', heavy: false }]);
  const before = structuredClone(storage(effects));
  for (const dt of [0, -1, NaN, Infinity]) effects.update(sim, dt);
  for (const field of fields) assert.deepEqual(storage(effects)[field], before[field]);
});


test('confirmed spell areas and chain links have independent bounded lifetimes', () => {
  const effects = new SkillEffects();
  const storage = effects as unknown as { areas: unknown[]; links: unknown[] };
  for (let index = 0; index < 4000; index++) {
    effects.handle({ type: 'chain', x: 0, y: 0, toX: 250, toY: -50, style: 'lightning' });
    effects.handle({ type: index % 2 ? 'blast' : 'ground', x: index, y: 0,
      skill: index % 2 ? 'meteor' : 'rainOfArrows', style: index % 2 ? 'fire' : 'arrow', radius: 80, duration: 2 });
    assert.ok(storage.areas.length <= 20 && storage.links.length <= 24, 'event batches cannot retain unbounded area/link history');
  }
  assert.ok(effects.getLights().length <= 3);
  effects.update(10);
  assert.equal(storage.areas.length, 0); assert.equal(storage.links.length, 0);
  assert.equal(effects.getLights().length, 0);
  effects.handle({ type: 'block', x: 0, y: 0, angle: 0, value: 12 });
  effects.reset();
  assert.equal(storage.areas.length, 0); assert.equal(storage.links.length, 0);
});


test('chain presentation honors the duration supplied by execution content', () => {
  const effects = new SkillEffects();
  const state = effects as unknown as { links: unknown[] };
  effects.handle({ type: 'chain', x: 0, y: 0, toX: 100, toY: 0, duration: 1.2, style: 'lightning' });
  effects.update(.4); assert.equal(state.links.length, 1);
  effects.update(.9); assert.equal(state.links.length, 0);
});
