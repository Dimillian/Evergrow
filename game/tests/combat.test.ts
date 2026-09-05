import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_ATTACK_PHASES, circleIntersectsSector, FIXED_STEP, HIT_FLASH_DURATION, Simulation } from '../src/simulation.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false };
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
  // A short acceleration ramp gives up less than eight pixels in the first second.
  assert.ok(cardinal.player.x > 157 && cardinal.player.x < 160);
  assert.ok(cardinal.player.vx > 164);
});

test('movement eases into speed but brakes and reverses without skating', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, moveX: 1 });
  assert.ok(sim.player.vx > 20 && sim.player.vx < 35, 'the first tick does not jump to full speed');
  advance(sim, 0.1 - FIXED_STEP, { moveX: 1 });
  assert.ok(sim.player.vx > 145, 'the player reaches useful speed within 100 ms');
  advance(sim, 0.4, { moveX: 1 });
  const stopX = sim.player.x;
  advance(sim, 0.2);
  assert.equal(sim.player.vx, 0);
  assert.ok(sim.player.x - stopX < 4, 'releasing movement stops within four pixels');

  advance(sim, 0.4, { moveX: 1 });
  sim.update(FIXED_STEP, { ...idle, moveX: -1 });
  assert.ok(sim.player.vx > 0 && sim.player.vx < 100, 'reversal has one continuous turn');
  advance(sim, 0.025 - FIXED_STEP, { moveX: -1 });
  assert.ok(sim.player.vx < 0, 'reversal takes effect within 25 ms');
  advance(sim, 0.1, { moveX: -1 });
  assert.ok(sim.player.vx < -145);
});

test('melee retains movement through the animation', () => {
  const moving = make();
  const melee = make();
  advance(moving, 2, { moveX: 1 });
  advance(melee, 2, { moveX: 1, attack: true });
  assert.ok(melee.player.x > moving.player.x * 0.87, 'combat retains at least 87% traversal speed');
  assert.ok(melee.player.x < moving.player.x);
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

test('holding attack repeats only the same basic strike with no combo or heavy hit', () => {
  const sim = make();
  const enemy = target(sim, 40);
  enemy.hp = enemy.maxHp = 1000;
  advance(sim, 1, { attack: true });
  const events = sim.drainEvents();
  assert.equal(events.filter(event => event.type === 'swing').length, 2);
  const hits = events.filter(event => event.type === 'hit');
  assert.deepEqual(hits.map(event => event.value), [24, 24]);
  assert.ok(events.every(event => !event.heavy));
  assert.ok(sim.player.attack);
  assert.equal('combo' in sim.player.attack, false);
  const duration = sim.player.attack.duration;
  advance(sim, 1.3);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  assert.equal(sim.player.attack?.duration, duration);
  assert.equal(sim.player.attack?.damage, 24);
});

test('weapon speed and character attack speed determine cadence without tick drift', () => {
  for (const [weaponSpeed, multiplier, expectedRate] of [[2, 1, 2], [4, 1, 4], [2, 2, 4], [3.5, 1.5, 5.25]]) {
    const sim = make();
    sim.player.equipment.mainHand.baseAttacksPerSecond = weaponSpeed;
    sim.player.stats.attackSpeedMultiplier = multiplier;
    const times: number[] = [];
    for (let i = 0; i < 240; i++) {
      sim.update(FIXED_STEP, { ...idle, attack: true });
      if (sim.drainEvents().some(event => event.type === 'swing')) times.push(sim.time);
    }
    assert.equal(times.length, Math.ceil(2 * expectedRate));
    for (let i = 0; i < times.length; i++) {
      assert.ok(Math.abs(times[i] - times[0] - i / expectedRate) <= FIXED_STEP + 1e-9,
        `${expectedRate} attacks/sec preserves cumulative timing`);
    }
    assert.ok(Math.abs(sim.player.attack!.duration - 1 / expectedRate) < 1e-9);
  }
});

test('derived weapon damage, reach and timing are snapshotted until the next strike', () => {
  const sim = make();
  sim.player.equipment.mainHand.baseAttacksPerSecond = 2;
  sim.player.equipment.mainHand.reach = 70;
  sim.player.stats.attackDamageMultiplier = 1.5;
  const stats = deriveAttackStats(sim.player.stats, sim.player.equipment.mainHand);
  assert.equal(stats.damage, 36);
  assert.equal(stats.range, 70);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  const first = sim.player.attack!;
  assert.equal(first.duration, .5);
  assert.equal(first.activeStart, .5 * BASIC_ATTACK_PHASES.activeStart);
  assert.equal(first.activeEnd, .5 * BASIC_ATTACK_PHASES.activeEnd);
  assert.equal(first.damage, 36);
  sim.player.stats.attackSpeedMultiplier = 2;
  sim.player.stats.attackDamageMultiplier = 2;
  advance(sim, .25, { attack: true });
  assert.equal(sim.player.attack, first, 'equipping faster gear cannot change an in-flight contact window');
  assert.equal(first.duration, .5);
  advance(sim, .25, { attack: true });
  assert.notEqual(sim.player.attack, first);
  assert.equal(sim.player.attack?.duration, .25);
  assert.equal(sim.player.attack?.damage, 48);
});

test('a tap in recovery buffers exactly one next attack', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.325);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.25);
  assert.ok(sim.player.attack);
  assert.equal(sim.drainEvents().filter(event => event.type === 'swing').length, 2);
  advance(sim, 0.55);
  assert.equal(sim.player.attack, null);
});

test('UI combat input clearing drops queued weapons without stopping movement or dodge', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, moveX: 1, attack: true });
  advance(sim, 0.15, { moveX: 1 });
  sim.update(FIXED_STEP * 0.5, { ...idle, moveX: 1, attack: true, dodge: true });
  const velocity = sim.player.vx;
  const alpha = sim.interpolationAlpha;
  sim.clearCombatInput();
  assert.equal(sim.player.vx, velocity);
  assert.equal(sim.interpolationAlpha, alpha);
  assert.ok(sim.player.attack);
  advance(sim, 0.4, { moveX: 1 });
  assert.equal(sim.player.dodgeCharges, 1, 'the independently queued dodge was preserved');
  assert.equal(sim.player.attack, null);
  assert.equal(sim.drainEvents().filter(event => event.type === 'swing').length, 1);
});

test('aim can correct the sword windup but contact keeps a stable hit sector', () => {
  const sim = make();
  const front = target(sim, 55);
  const above = target(sim, 0, 55);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.125, { aimX: 0, aimY: 200 });
  assert.equal(sim.player.attack?.angle, Math.PI / 2);
  assert.equal(above.hp, above.maxHp, 'the turning blade has not reached the center yet');
  advance(sim, 0.05, { aimX: 200, aimY: 0 });
  assert.equal(sim.player.attack?.angle, Math.PI / 2);
  assert.equal(above.hp, above.maxHp - 24);
  assert.equal(front.hp, front.maxHp);
});

test('sword contact follows its sweep through the center and both outer edges', () => {
  for (const speed of [2, 12]) {
    const sim = make();
    sim.player.equipment.mainHand.baseAttacksPerSecond = speed;
    const arc = sim.player.equipment.mainHand.arc;
    const angles = [-arc / 2, 0, arc / 2];
    const targets = angles.map(angle => {
      const enemy = target(sim, Math.cos(angle) * 58, Math.sin(angle) * 58);
      enemy.radius = 2;
      return enemy;
    });
    sim.update(FIXED_STEP, { ...idle, attack: true });
    const attack = sim.player.attack!;
    const hitTimes = new Map<number, number>();
    while (sim.player.attack && sim.player.attack.elapsed <= attack.activeEnd + FIXED_STEP) {
      sim.update(FIXED_STEP, idle);
      for (const event of sim.drainEvents()) if (event.type === 'hit') hitTimes.set(event.targetId!, attack.elapsed);
    }
    assert.equal(hitTimes.size, 3, `${speed} APS reaches both edge targets and the center`);
    assert.ok(hitTimes.get(targets[0].id)! < hitTimes.get(targets[1].id)!);
    assert.ok(hitTimes.get(targets[1].id)! <= hitTimes.get(targets[2].id)!);
    const midpoint = (attack.activeStart + attack.activeEnd) / 2;
    assert.ok(Math.abs(hitTimes.get(targets[1].id)! - midpoint) <= FIXED_STEP + .005,
      `${speed} APS center contact occurs when the blade crosses center, not at startup`);
    for (const enemy of targets) assert.equal(enemy.hp, enemy.maxHp - 24);
  }
});

test('a tick spanning the entire active window still resolves the whole swept blade once', () => {
  const sim = make();
  const enemy = target(sim, 55);
  sim.player.attack = { elapsed: 0, duration: .02, activeStart: .001, activeEnd: .006,
    angle: 0, range: 60, arc: Math.PI * .75, damage: 24, hitIds: new Set() };
  sim.update(FIXED_STEP, idle);
  assert.equal(enemy.hp, enemy.maxHp - 24);
  advance(sim, .1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'hit').length, 1);
});

test('enemy contact identifies the target and starts one full impact flash', () => {
  const sim = make();
  const enemy = target(sim, 40);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  while (enemy.hp === enemy.maxHp && sim.time < .3) sim.update(FIXED_STEP, idle);
  const hit = sim.drainEvents().find(event => event.type === 'hit');
  assert.equal(hit?.targetId, enemy.id);
  assert.equal(hit?.remainingHp, enemy.maxHp - 24);
  assert.equal(hit?.angle, 0);
  assert.equal(enemy.hitFlash, HIT_FLASH_DURATION);
  assert.equal(enemy.hitAngle, 0);
  advance(sim, .075);
  assert.ok(Math.abs(enemy.hitFlash - (HIT_FLASH_DURATION - .075)) < 1e-9);
  const remainingFlash = enemy.hitFlash;
  sim.clearInput();
  sim.update(0, idle);
  assert.equal(enemy.hitFlash, remainingFlash, 'pause does not restart or erase an impact');
  advance(sim, .1);
  assert.equal(enemy.hitFlash, 0);
  assert.equal(sim.drainEvents().filter(event => event.type === 'hit').length, 0);
});

test('player damage reacts once with incoming direction and protection does not retrigger flashes', () => {
  const sim = make();
  sim.projectiles.push({ id: 999, x: -15, y: 0, prevX: -15, prevY: 0, vx: 1200, vy: 0,
    angle: 0, radius: 5, damage: 13, life: 1, maxLife: 1, owner: 'enemy' });
  sim.update(FIXED_STEP, idle);
  const hurt = sim.drainEvents().find(event => event.type === 'hurt');
  assert.equal(sim.player.hp, 87);
  assert.equal(sim.player.hitFlash, HIT_FLASH_DURATION);
  assert.equal(sim.player.hitAngle, 0);
  assert.equal(hurt?.angle, 0);
  assert.equal(hurt?.remainingHp, 87);
  assert.equal(hurt?.value, 13);
  sim.projectiles.push({ id: 1000, x: 0, y: -15, prevX: 0, prevY: -15, vx: 0, vy: 1200,
    angle: Math.PI / 2, radius: 5, damage: 13, life: 1, maxLife: 1, owner: 'enemy' });
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.player.hp, 87);
  assert.ok(Math.abs(sim.player.hitFlash - (HIT_FLASH_DURATION - FIXED_STEP)) < 1e-9);
  assert.equal(sim.player.hitAngle, 0, 'an immune contact cannot change recoil direction');
  assert.equal(sim.drainEvents().filter(event => event.type === 'hurt').length, 0);
  advance(sim, .175);
  assert.equal(sim.player.hitFlash, 0);
  assert.ok(sim.player.invulnerable > 0, 'damage protection outlasts the visual hit flash');
  sim.reset();
  assert.equal(sim.player.hitFlash, 0);
  assert.equal(sim.player.hitAngle, 0);
});

test('knockback is a continuous decaying motion after impact', () => {
  const sim = make();
  const enemy = target(sim, 40);
  sim.projectiles.push({ id: 999, x: 0, y: 0, prevX: 0, prevY: 0, vx: 10000, vy: 0, angle: 0, radius: 5, damage: 36, life: 1, maxLife: 1, owner: 'player' });
  sim.update(FIXED_STEP, idle);
  assert.equal(enemy.x, 40, 'contact records an impulse without teleporting the target');
  assert.ok(enemy.knockbackX > 0);
  let previousTravel = Infinity;
  for (let i = 0; i < 40; i++) {
    const x: number = enemy.x;
    sim.update(FIXED_STEP, idle);
    const travel = enemy.x - x;
    assert.ok(travel >= 0 && travel < 0.7, 'one tick only advances a fraction of the shove');
    assert.ok(travel <= previousTravel + 1e-9, 'impact slows continuously');
    assert.equal(enemy.prevX, x);
    previousTravel = travel;
  }
  assert.ok(enemy.x > 44.9 && enemy.x <= 45, 'the integrated motion delivers the five-pixel brute shove');
});

test('knockback respects enemy collision radius through the entire motion', () => {
  const wall: WorldQuery = {
    blocked: (x, _y, radius) => x + radius > 54,
    move: (x, y, dx, dy, radius) => ({ x: Math.min(54 - radius, x + dx), y: y + dy }),
  };
  const sim = make(wall);
  const enemy = target(sim, 36);
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.3);
  assert.equal(enemy.x, 37);
  assert.equal(enemy.y, 0);
  assert.equal(enemy.hp, enemy.maxHp - 24);
});

test('dodge buffer waits for sword recovery and consumes once', () => {
  const sim = make();
  sim.update(FIXED_STEP, { ...idle, attack: true });
  advance(sim, 0.15);
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
  advance(sim, 0.3);
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

test('legacy direct cast input cannot start or buffer an unassigned fireball', () => {
  const sim = make();
  const legacyInput = { ...idle, cast: true };
  sim.update(FIXED_STEP / 2, legacyInput);
  sim.update(FIXED_STEP / 2, idle);
  for (let i = 0; i < 240; i++) sim.update(FIXED_STEP, legacyInput);
  advance(sim, .5);
  assert.equal(sim.player.mana, sim.player.maxMana);
  assert.equal(sim.player.castTime, 0);
  assert.equal(sim.player.castCooldown, 0);
  assert.deepEqual(sim.projectiles, []);
  assert.deepEqual(sim.drainEvents(), []);
});

test('legacy cast input cannot interrupt basic attack, movement, dodge or potion', () => {
  const expected = make(), legacy = make();
  expected.player.hp = legacy.player.hp = 40;
  expected.player.mana = legacy.player.mana = 50;
  for (let tick = 0; tick < 240; tick++) {
    const input = { ...idle, attack: true, moveX: 1, dodge: tick === 60, heal: tick === 120 };
    const legacyInput = { ...input, cast: true };
    expected.update(FIXED_STEP, input);
    legacy.update(FIXED_STEP, legacyInput);
    assert.deepEqual(legacy.player, expected.player, `legacy cast is inert through action tick ${tick}`);
    assert.deepEqual(legacy.drainEvents(), expected.drainEvents());
  }
  assert.equal(legacy.player.flasks, 1);
  assert.ok(legacy.player.hp > 40);
  assert.ok(legacy.player.x > 200);
  assert.equal(legacy.player.castTime, 0);
  assert.deepEqual(legacy.projectiles, []);
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

test('simultaneous lethal attacks award one kill, one XP reward, and one pickup', () => {
  const sim = make();
  const enemy = target(sim, 35);
  enemy.hp = 20;
  sim.player.attack = { elapsed: 0.079, duration: 0.32, activeStart: 0.08, activeEnd: 0.13, angle: 0, range: 49, arc: Math.PI, damage: 24, hitIds: new Set() };
  sim.projectiles.push({ id: 999, x: 25, y: 0, prevX: 25, prevY: 0, vx: 360, vy: 0, angle: 0, radius: 5, damage: 36, life: 1, maxLife: 1, owner: 'player' });
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.kills, 1);
  assert.equal(sim.player.xp, 50);
  assert.equal(sim.player.level, 1);
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
  sim.projectiles.push({ id: 999, x: 120, y: 120, prevX: 120, prevY: 120, vx: 120, vy: 0, angle: 0, radius: 5, damage: 13, life: 1, maxLife: 1, owner: 'enemy' });
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.player.dead, true);
  assert.equal(sim.interpolationAlpha, 0);
  for (const actor of [sim.player, ...sim.enemies, ...sim.projectiles]) {
    assert.equal(actor.prevX, actor.x, 'death freezes the final tick without stale interpolation');
    assert.equal(actor.prevY, actor.y);
  }
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

test('render interpolation follows fixed ticks and clears stale positions with input', () => {
  const sim = make();
  const enemy = target(sim);
  enemy.knockbackX = 120;
  sim.projectiles.push({ id: 999, x: 100, y: 0, prevX: 100, prevY: 0, vx: 120, vy: 0, angle: 0, radius: 5, damage: 36, life: 1, maxLife: 1, owner: 'player' });
  sim.update(FIXED_STEP * 1.5, { ...idle, moveX: 1 });
  assert.ok(Math.abs(sim.interpolationAlpha - 0.5) < 1e-9);
  assert.equal(sim.player.prevX, 0);
  assert.equal(enemy.prevX, 36);
  assert.equal(sim.projectiles[0]!.prevX, 100);
  const firstX = sim.player.x;
  sim.update(FIXED_STEP * 0.25, { ...idle, moveX: 1 });
  assert.equal(sim.player.x, firstX, 'a partial tick changes only render interpolation');
  assert.ok(Math.abs(sim.interpolationAlpha - 0.75) < 1e-9);
  sim.update(FIXED_STEP * 0.5, { ...idle, moveX: 1 });
  assert.equal(sim.player.prevX, firstX);
  assert.ok(sim.player.x > firstX);
  assert.ok(Math.abs(sim.interpolationAlpha - 0.25) < 1e-9);

  sim.clearInput();
  assert.equal(sim.interpolationAlpha, 0);
  for (const actor of [sim.player, ...sim.enemies, ...sim.projectiles]) {
    assert.equal(actor.prevX, actor.x);
    assert.equal(actor.prevY, actor.y);
  }
  sim.reset();
  assert.equal(sim.player.prevX, sim.player.x);
  assert.equal(sim.player.prevY, sim.player.y);
  assert.equal(sim.interpolationAlpha, 0);
});

test('same seed and held input remain deterministic at 30, 60, 120, 144, and 240 Hz', () => {
  const a = new Simulation(emptyWorld, { seed: 123 });
  const initial = JSON.stringify(a.enemies);
  const input = { moveX: 0.4, moveY: 1, attack: true };
  advance(a, 4, input, FIXED_STEP);
  const events = a.drainEvents();
  for (const hz of [30, 60, 144, 240]) {
    const b = new Simulation(emptyWorld, { seed: 123 });
    advance(b, 4, input, 1 / hz);
    assert.deepEqual(a.player, b.player, `${hz} Hz player state`);
    assert.deepEqual(a.enemies, b.enemies, `${hz} Hz enemy state`);
    assert.deepEqual(a.projectiles, b.projectiles, `${hz} Hz projectiles`);
    assert.deepEqual(events, b.drainEvents(), `${hz} Hz combat events`);
  }
  a.reset();
  assert.equal(JSON.stringify(a.enemies), initial);
});
