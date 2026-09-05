import assert from 'node:assert/strict';
import test from 'node:test';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const world: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
  isSanctuary: (x) => x >= 0,
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0,
  attack: false, cast: false, dodge: false, heal: false };
function advance(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) sim.update(FIXED_STEP, idle);
}

test('sanctuary rejects hostile spawns but the wilderness still accepts them', () => {
  const sim = new Simulation(world, { spawn: false, startX: 20 });
  assert.equal(sim.spawnEnemy('stalker', 10, 0), null);
  assert.ok(sim.spawnEnemy('stalker', -100, 0));
  const sheltered = new Simulation({ ...world, isSanctuary: () => true });
  advance(sheltered, 8);
  assert.equal(sheltered.enemies.length, 0);
});

test('entering sanctuary cancels incoming melee and sends pursuers away without awarding kills', () => {
  const sim = new Simulation(world, { spawn: false, startX: -5 });
  const enemy = sim.spawnEnemy('stalker', -20, 0)!;
  enemy.state = 'attack'; enemy.stateDuration = .18; enemy.attackAngle = 0;
  sim.player.x = sim.player.prevX = 5;
  advance(sim, .4);
  assert.equal(sim.player.hp, sim.player.maxHp);
  assert.ok(enemy.x < -35, 'the enemy withdraws from the sanctuary entrance');
  assert.equal(sim.kills, 0);
  assert.equal(enemy.hp, enemy.maxHp);
});

test('hostile projectiles dissolve at the sanctuary boundary', () => {
  const sim = new Simulation(world, { spawn: false, startX: 10 });
  sim.projectiles.push({ id: 1, x: -2, y: 0, prevX: -2, prevY: 0, vx: 300, vy: 0,
    angle: 0, radius: 5, damage: 13, life: 2, maxLife: 2, owner: 'enemy' });
  advance(sim, FIXED_STEP);
  assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.player.hp, sim.player.maxHp);
});

test('sanctuary protection ends when the player returns to the wilderness', () => {
  const sim = new Simulation(world, { spawn: false, startX: 10 });
  const enemy = sim.spawnEnemy('stalker', -30, 0)!;
  advance(sim, .1);
  sim.player.x = sim.player.prevX = enemy.x + 12;
  assert.ok(sim.player.x < 0);
  enemy.state = 'attack'; enemy.stateTime = 0; enemy.stateDuration = .18;
  enemy.attackAngle = 0; enemy.attackHit = false;
  advance(sim, FIXED_STEP);
  assert.equal(sim.player.hp, sim.player.maxHp - 8);
});
