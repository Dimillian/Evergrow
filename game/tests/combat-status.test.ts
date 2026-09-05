import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { applyBurn, applySlow, applyStun, advanceEnemyStatuses } from '../src/combat-status.ts';

function target() {
  const sim = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false });
  return sim.spawnEnemy('stalker', 30, 0)!;
}

test('status reapplication keeps the strongest value and longest duration without stacking or resetting burn progress', () => {
  const enemy = target();
  applySlow(enemy, { duration: 2, factor: .5 });
  applySlow(enemy, { duration: 4, factor: .8 });
  assert.equal(enemy.slowTime, 4); assert.equal(enemy.slowFactor, .5);
  applyBurn(enemy, { duration: 2, dps: 10 });
  advanceEnemyStatuses(enemy, .2, () => assert.fail('not due'));
  applyBurn(enemy, { duration: 1, dps: 20 });
  assert.equal(enemy.burnTime, 1.8); assert.equal(enemy.burnDps, 20); assert.equal(enemy.burnTick, .2);
  const damage: number[] = [];
  advanceEnemyStatuses(enemy, .3, (_actor, amount) => damage.push(amount));
  assert.deepEqual(damage, [10]); assert.equal(enemy.burnTick, 0);
});

test('expiry emits the partial final burn once and restores unmodified speed', () => {
  const enemy = target(), damage: number[] = [];
  applySlow(enemy, { duration: .2, factor: .5 }); applyBurn(enemy, { duration: .7, dps: 10 });
  for (let index = 0; index < 20; index++) advanceEnemyStatuses(enemy, .1, (_actor, amount) => damage.push(amount));
  assert.equal(damage.length, 2); assert.ok(Math.abs(damage.reduce((sum, n) => sum + n, 0) - 7) < 1e-9);
  assert.equal(enemy.slowTime, 0); assert.equal(enemy.slowFactor, 1);
  assert.equal(enemy.burnTime, 0); assert.equal(enemy.burnDps, 0);
});

test('stuns interrupt before AI, and a lethal status suppresses subsequent actor decisions', () => {
  const enemy = target(); enemy.state = 'windup';
  applyStun(enemy, .3); applyStun(enemy, .1);
  assert.equal(enemy.stagger, .3); assert.equal(enemy.interrupted, true);
  assert.equal(advanceEnemyStatuses(enemy, .1, () => {}), false);
  assert.equal(enemy.state, 'recover'); assert.equal(enemy.vx, 0);
  applyBurn(enemy, { duration: .5, dps: 100 });
  assert.equal(advanceEnemyStatuses(enemy, .5, actor => { actor.hp = 0; actor.state = 'dead'; }), false);
  const before = structuredClone(enemy);
  applyBurn(enemy, { duration: 9, dps: 999 }); applySlow(enemy, { duration: 9, factor: .1 }); applyStun(enemy, 10);
  assert.deepEqual(enemy, before); assert.equal(advanceEnemyStatuses(enemy, 1, () => assert.fail('dead actor ticked')), false);
});
