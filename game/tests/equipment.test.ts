import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaseStats, createStartingEquipment, deriveAttackStats, getGripLength, getSupportGripOffset,
  STARTING_SWORD } from '../src/equipment.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';

test('equipment instances and character modifiers never mutate the authored starting weapon or another player', () => {
  const first = createStartingEquipment(), second = createStartingEquipment();
  const stats = createBaseStats(); stats.attackSpeedMultiplier = 3;
  first.mainHand.damage = 72; first.mainHand.visual.length = 45; first.mainHand.visual.gripLength = 18;
  assert.equal(second.mainHand.damage, 24); assert.equal(second.mainHand.visual.length, 30);
  assert.equal(second.mainHand.visual.gripLength, 12); assert.equal(createBaseStats().attackSpeedMultiplier, 1);
  assert.equal(STARTING_SWORD.damage, 24);
  assert.ok(Object.isFrozen(STARTING_SWORD) && Object.isFrozen(STARTING_SWORD.visual));
  assert.throws(() => Object.assign(STARTING_SWORD.visual, { length: 0 }), TypeError);
});

test('malformed grip lengths fall back to a connected finite two-hand attachment', () => {
  for (const gripLength of [NaN, Infinity, -Infinity, undefined]) {
    const visual = { ...STARTING_SWORD.visual, gripLength };
    assert.equal(getGripLength(visual), 12);
    assert.ok(Number.isFinite(getSupportGripOffset(visual)));
    assert.ok(getSupportGripOffset(visual) > -getGripLength(visual) && getSupportGripOffset(visual) < -4);
  }
  assert.equal(getGripLength({ ...STARTING_SWORD.visual, gripLength: -10 }), 8);
  assert.equal(getGripLength({ ...STARTING_SWORD.visual, gripLength: 100 }), 20);
});

test('multiplication overflow cannot inject infinite damage into combat state or feedback events', () => {
  const weapon = { ...STARTING_SWORD, damage: Number.MAX_VALUE };
  const stats = { attackSpeedMultiplier: 1, attackDamageMultiplier: Number.MAX_VALUE };
  const derived = deriveAttackStats(stats, weapon);
  assert.equal(derived.damage, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(derived.damage));
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  sim.player.equipment.mainHand = weapon; sim.player.stats = stats;
  const enemy = sim.spawnEnemy('brute', 35, 0)!;
  enemy.stateDuration = 100;
  for (let tick = 0; tick < 40; tick++) sim.update(FIXED_STEP,
    { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: true, cast: false, dodge: false, heal: false });
  assert.equal(enemy.hp, 0); assert.equal(sim.kills, 1);
  const hit = sim.drainEvents().find(event => event.type === 'hit');
  assert.ok(hit && Number.isSafeInteger(hit.value));
  assert.equal(hit.remainingHp, 0);
});

test('invalid weapon and modifier inputs retain a finite resolvable basic attack', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0, -1]) {
    const result = deriveAttackStats({ attackSpeedMultiplier: invalid, attackDamageMultiplier: invalid },
      { ...STARTING_SWORD, baseAttacksPerSecond: invalid, damage: invalid, reach: invalid, arc: invalid });
    assert.deepEqual(result, { attacksPerSecond: 2, damage: 24, range: 60, arc: STARTING_SWORD.arc });
  }
});
