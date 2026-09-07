import assert from 'node:assert/strict';
import test from 'node:test';
import { enemyDebuffs, debuffDuration } from '../src/enemy-debuffs.ts';
import { getEnemyPlateLayout } from '../src/enemy-plate.ts';
import { Simulation } from '../src/simulation.ts';
import { applyBurn, applySlow, applyStun, advanceEnemyStatuses } from '../src/combat-status.ts';

test('enemy badges reflect all active combat timers, ordered consistently and without mutation', () => {
  const enemy = { hp: 80, burnTime: 2, burnDps: 4, slowTime: 1.2, slowFactor: .8, stagger: .12 };
  const before = { ...enemy };
  const badges = enemyDebuffs(enemy);
  assert.deepEqual(badges.map(d => [d.id, d.remaining]), [['burn', 2], ['chill', 1.2], ['stagger', .12]]);
  assert.deepEqual(enemy, before);
  assert.deepEqual(enemyDebuffs({ ...enemy, hp: 0 }), []);
  assert.deepEqual(enemyDebuffs({ ...enemy, state: 'dead' }), []);
  assert.deepEqual(enemyDebuffs({ hp: 80 }), []);
  assert.deepEqual(enemyDebuffs({ hp: 80, burnTime: 1, burnDps: 0, slowTime: 1, slowFactor: 1, stagger: NaN }), []);
});
test('reapplication extends displayed timers, expiry removes badges, and interruption flags alone show nothing', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const enemy = sim.spawnEnemy('brute', 100, 0)!;
  applyBurn(enemy, { duration: 2, dps: 4 }); applySlow(enemy, { duration: 1, factor: .8 }); applyStun(enemy, .12);
  advanceEnemyStatuses(enemy, .2, () => {});
  assert.deepEqual(enemyDebuffs(enemy).map(d => d.id), ['burn', 'chill']);
  assert.equal(enemy.interrupted, true);
  applySlow(enemy, { duration: 3, factor: .6 });
  assert.equal(enemyDebuffs(enemy).find(d => d.id === 'chill')?.remaining, 3);
  for (let i = 0; i < 40; i++) advanceEnemyStatuses(enemy, .1, () => {});
  assert.deepEqual(enemyDebuffs(enemy), []);
});
test('brief effects have readable nonzero durations and rows fit desktop, touch and compact viewports', () => {
  assert.equal(debuffDuration(.016), '0.1s'); assert.equal(debuffDuration(1.23), '1.3s');
  assert.equal(debuffDuration(12.2), '13s'); assert.equal(debuffDuration(NaN), '0s');
  for (const touch of [false, true]) for (const [w, h] of [[960, 600], [832, 468], [540, 450], [390, 844]]) {
    const plate = getEnemyPlateLayout(w, h, touch, 0, true);
    assert.equal(plate.height, 94); assert.ok(plate.y + plate.height <= h);
  }
  assert.equal(getEnemyPlateLayout(320, 90, true, 0, true).height, 70, 'retain HP/name if only the extra row cannot fit');
});
