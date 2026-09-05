import test from 'node:test';
import assert from 'node:assert/strict';
import { circleIntersectsSector, FIXED_STEP, Simulation } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, cast: false, dodge: false, heal: false };
const make = (world = emptyWorld) => new Simulation(world, { spawn: false, seed: 42 });

function advance(sim: Simulation, duration: number, input: Partial<Input> = {}, step = FIXED_STEP): void {
  for (let i = 0; i < Math.round(duration / step); i++) sim.update(step, { ...idle, ...input });
}

function target(sim: Simulation, x = 36, y = 0) {
  const enemy = sim.spawnEnemy('brute', x, y)!;
  enemy.stateDuration = 999;
  sim.drainEvents();
  return enemy;
}

test('diagonal input has the same speed as cardinal movement', () => {
  const cardinal = make();
  const diagonal = make();
  advance(cardinal, 1, { moveX: 1 });
  advance(diagonal, 1, { moveX: 1, moveY: 1 });
  assert.ok(Math.abs(cardinal.player.x - Math.hypot(diagonal.player.x, diagonal.player.y)) < 1e-8);
  assert.ok(cardinal.player.x > 160 && cardinal.player.x < 165);
});

test('melee sector respects facing, range, and circle-edge overlap', () => {
  const overlaps = (x: number, y: number, radius = 5) => circleIntersectsSector(x, y, radius, 0, 0, 0, 49, Math.PI / 2);
  assert.equal(overlaps(30, 0), true);
  assert.equal(overlaps(-30, 0), false);
  assert.equal(overlaps(60, 0), false);
  assert.equal(overlaps(52, 0), true);
  assert.equal(overlaps(30, 34, 4), true);
  assert.equal(overlaps(20, 40, 4), false);
});

test('one swing damages each intersecting enemy once across the whole active window', () => {
  const sim = make();
  const front = target(sim);
  const behind = target(sim, -36);
  const far = target(sim, 100);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.225);
  assert.equal(front.hp, front.maxHp - 24);
  assert.equal(behind.hp, behind.maxHp);
  assert.equal(far.hp, far.maxHp);
  assert.equal(sim.drainEvents().filter(event => event.type === 'hit').length, 1);
});

test('solid obstacles occlude sword contact', () => {
  const wall: WorldQuery = { ...emptyWorld, blocked: x => x >= 20 && x <= 23 };
  const sim = make(wall);
  const enemy = target(sim, 42);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.225);
  assert.equal(enemy.hp, enemy.maxHp);
});

test('holding attack repeats the three-step combo and idle resets it', () => {
  const sim = make();
  advance(sim, 1, { attack: true });
  assert.deepEqual(sim.drainEvents().filter(event => event.type === 'swing').map(event => event.value), [1, 2, 3, 1]);
  advance(sim, 1.3);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  assert.equal(sim.player.attack?.combo, 1);
});

test('dodge buffer waits for sword recovery and consumes once', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.075);
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  assert.equal(sim.player.dodgeCharges, 2);
  advance(sim, 0.1);
  assert.equal(sim.player.attack, null);
  assert.equal(sim.player.dodgeCharges, 1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'dodge').length, 1);
});

test('a dodge buffered too early expires before the attack can cancel', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, attack: true });
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  advance(sim, 0.2);
  assert.equal(sim.player.dodgeCharges, 2);
});

test('dodge protects the middle of its animation, not startup or recovery', () => {
  for (const [elapsed, expectedHP] of [[FIXED_STEP, 92], [0.025, 100], [0.175, 100], [0.183333333333, 92]]) {
    const sim = make();
    sim.player.dodgeTime = 0.22 - (elapsed! - FIXED_STEP);
    sim.player.dodgeAngle = 0;
    const enemy = sim.spawnEnemy('stalker', -20, 0)!;
    enemy.state = 'attack';
    enemy.stateDuration = 1;
    enemy.attackAngle = 0;
    sim.update(FIXED_STEP, idle);
    assert.equal(sim.player.hp, expectedHP, `elapsed=${elapsed}`);
  }
});

test('dodge movement delegates collision at player radius and cannot cross a wall', () => {
  let radiusSeen = 0;
  const wall: WorldQuery = {
    blocked: (x, _y, radius) => x + radius >= 25,
    move: (x, y, dx, dy, radius) => { radiusSeen = radius; return { x: Math.min(25 - radius, x + dx), y: y + dy }; },
  };
  const sim = make(wall);
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  advance(sim, 0.25);
  assert.equal(radiusSeen, 9);
  assert.ok(sim.player.x <= 16);
});

test('dodge charges replenish sequentially and mana does not gate dodging', () => {
  const sim = make();
  sim.player.mana = 0;
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  advance(sim, 0.25);
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  assert.equal(sim.player.dodgeCharges, 0);
  advance(sim, 1.6);
  assert.equal(sim.player.dodgeCharges, 1);
  advance(sim, 1.8);
  assert.equal(sim.player.dodgeCharges, 2);
  assert.equal(sim.player.dodgeRecharge, 0);
});

test('ember costs mana once and releases after its windup', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, cast: true });
  assert.ok(sim.player.mana >= 80 && sim.player.mana < 81);
  assert.equal(sim.projectiles.length, 0);
  advance(sim, 0.05);
  assert.equal(sim.projectiles.length, 0);
  advance(sim, 0.05);
  assert.equal(sim.projectiles.length, 1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 1);
});

test('ember can cancel sword recovery while attack remains held', () => {
  const sim = make();
  advance(sim, 0.15, { attack: true });
  sim.update(FIXED_STEP, { ...idle, attack: true, cast: true });
  assert.equal(sim.player.attack, null);
  assert.ok(sim.player.castTime > 0);
  advance(sim, 0.1, { attack: true, cast: true });
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 1);
});

test('swept projectiles hit the first crossed enemy exactly once', () => {
  const sim = make();
  const first = target(sim, 40);
  const second = target(sim, 80);
  sim.projectiles.push({ id: 999, x: 0, y: 0, prevX: 0, prevY: 0, vx: 10000, vy: 0, angle: 0, radius: 5, damage: 36, life: 1, maxLife: 1, owner: 'player' });
  sim.update(FIXED_STEP, idle);
  assert.equal(first.hp, first.maxHp - 36);
  assert.equal(second.hp, second.maxHp);
  assert.equal(sim.projectiles.length, 0);
});

test('simultaneous lethal attacks award one kill and one pickup', () => {
  const sim = make();
  const enemy = target(sim, 35);
  enemy.hp = 20;
  sim.player.attack = { elapsed: 0.079, duration: 0.32, activeStart: 0.08, activeEnd: 0.13, angle: 0, combo: 1, range: 49, arc: Math.PI, damage: 24, hitIds: new Set() };
  sim.projectiles.push({ id: 999, x: 25, y: 0, prevX: 25, prevY: 0, vx: 360, vy: 0, angle: 0, radius: 5, damage: 36, life: 1, maxLife: 1, owner: 'player' });
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.kills, 1);
  assert.equal(sim.pickups.length, 1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'kill').length, 1);
});

test('healing clamps health, requires a charge, and does not consume at full health', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, heal: true });
  assert.equal(sim.player.flasks, 2);
  sim.clearInput();
  sim.player.hp = 90;
  sim.update(FIXED_STEP, { ...idle, heal: true });
  assert.equal(sim.player.hp, 100);
  assert.equal(sim.player.flasks, 1);
  sim.player.flasks = 0;
  sim.player.hp = 30;
  advance(sim, 0.9);
  sim.update(FIXED_STEP, { ...idle, heal: true });
  assert.equal(sim.player.hp, 30);
});

test('full-resource pickups remain and collected resources clamp at maximum', () => {
  const sim = make();
  sim.pickups.push({ id: 10, x: 0, y: 0, kind: 'health', value: 12, life: 20, radius: 4 });
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.pickups.length, 1);
  sim.player.hp = 97;
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.player.hp, 100);
  assert.equal(sim.pickups.length, 0);
});

test('blocked spawning terminates after bounded attempts without owed-spawn bursts', () => {
  let queries = 0;
  let blocked = true;
  const world: WorldQuery = { ...emptyWorld, blocked: () => { queries++; return blocked; } };
  const sim = new Simulation(world, { seed: 2 });
  advance(sim, 120, {}, 1 / 30);
  assert.equal(sim.enemies.length, 0);
  assert.ok(queries <= 800, `${queries} collision queries`);
  blocked = false;
  advance(sim, 2.1);
  assert.ok(sim.enemies.length <= 2);
});

test('encounter director caps enemy population and heavy/ranged composition', () => {
  const sim = new Simulation(emptyWorld, { seed: 17 });
  sim.player.hp = sim.player.maxHp = 100000;
  sim.kills = 100;
  advance(sim, 80, {}, 1 / 30);
  assert.ok(sim.enemies.length <= 12);
  assert.ok(sim.enemies.filter(enemy => enemy.kind === 'brute').length <= 2);
  assert.ok(sim.enemies.filter(enemy => enemy.kind === 'caster').length <= 2);
});

test('clearInput discards buffered controls and death stops simulation until reset', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, attack: true });
  sim.update(FIXED_STEP, { ...idle, dodge: true });
  sim.clearInput();
  advance(sim, 0.2);
  assert.equal(sim.player.dodgeCharges, 2);
  sim.player.hp = 1;
  const enemy = sim.spawnEnemy('stalker', -20, 0)!;
  enemy.state = 'attack';
  enemy.stateDuration = 1;
  enemy.attackAngle = 0;
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.player.dead, true);
  const time = sim.time;
  advance(sim, 1, { attack: true, moveX: 1 });
  assert.equal(sim.time, time);
  sim.reset();
  assert.equal(sim.player.hp, 100);
  assert.equal(sim.player.dead, false);
  assert.equal(sim.player.attack, null);
  assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.kills, 0);
});

test('same seed and input stream produce identical state and restart restores the seed', () => {
  const a = new Simulation(emptyWorld, { seed: 123 });
  const b = new Simulation(emptyWorld, { seed: 123 });
  const initial = JSON.stringify(a.enemies);
  const input = { moveX: 0.4, moveY: 1, attack: true };
  advance(a, 4, input, 1 / 60);
  advance(b, 4, input, 1 / 30);
  assert.deepEqual(a.player, b.player);
  assert.deepEqual(a.enemies, b.enemies);
  assert.deepEqual(a.drainEvents(), b.drainEvents());
  a.reset();
  assert.equal(JSON.stringify(a.enemies), initial);
});
