import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRangedAim, PROJECTILE_HEIGHT, PLAYER_PROJECTILE_FORGIVENESS } from '../src/ranged-aim.ts';
import { Simulation } from '../src/simulation.ts';
import { advanceProjectiles } from '../src/projectile-combat.ts';
import { hasLineOfSight } from '../src/combat-geometry.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import type { Input, Projectile, WorldQuery } from '../src/model.ts';
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const options = { range: 500, speed: 560, alpha: 1, previousTargetId: null,
  bounds: { left: -500, top: -500, width: 1000, height: 1000 }, visible: () => true };
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: -25, attack: false, dodge: false, heal: false, skillSlot: null };

test('ranged assistance targets the visible body, while free aim compensates for projectile height', () => {
  const sim = new Simulation(world, { spawn: false });
  const enemy = sim.spawnEnemy('stalker', 200, 0)!;
  const result = resolveRangedAim({ x: 0, y: 0 }, { x: 209, y: -29 }, [enemy], options);
  assert.deepEqual(result, { x: 200, y: 0, targetId: enemy.id });
  const free = resolveRangedAim({ x: 0, y: 0 }, { x: 200, y: -90 }, [enemy], options);
  assert.deepEqual(free, { x: 200, y: -90 + PROJECTILE_HEIGHT, targetId: null });
});

test('assistance rejects dead, occluded, offscreen and out of range targets, even previously selected ones', () => {
  const sim = new Simulation(world, { spawn: false }), enemy = sim.spawnEnemy('brute', 200, 0)!;
  const cursor = { x: 200, y: -25 }, origin = { x: 0, y: 0 };
  const sticky = { ...options, previousTargetId: enemy.id };
  assert.equal(resolveRangedAim(origin, cursor, [enemy], { ...sticky, visible: () => false }).targetId, null);
  assert.equal(resolveRangedAim(origin, cursor, [enemy], { ...sticky, range: 100 }).targetId, null);
  assert.equal(resolveRangedAim(origin, cursor, [enemy], { ...sticky, bounds: { left: -50, top: -50, width: 100, height: 100 } }).targetId, null);
  enemy.state = 'dead'; enemy.hp = 0;
  assert.equal(resolveRangedAim(origin, cursor, [enemy], sticky).targetId, null);
});

test('moving targets receive bounded prediction, which cannot lead through solid geometry', () => {
  const sim = new Simulation(world, { spawn: false }), enemy = sim.spawnEnemy('archer', 200, 0)!;
  enemy.vy = 1000;
  const origin = { x: 0, y: 0 }, cursor = { x: 200, y: -24 };
  const predicted = resolveRangedAim(origin, cursor, [enemy], options);
  assert.ok(predicted.y > 0 && predicted.y <= 18);
  const blocked = resolveRangedAim(origin, cursor, [enemy], { ...options, visible: (_ax, _ay, _bx, by) => by === 0 });
  assert.equal(blocked.y, 0);
});

test('close overlapping silhouettes resolve deterministically and retain only a modest cursor preference', () => {
  const sim = new Simulation(world, { spawn: false });
  const a = sim.spawnEnemy('stalker', 200, 0)!, b = sim.spawnEnemy('stalker', 201, 0)!;
  const origin = { x: 0, y: 0 }, cursor = { x: 200, y: -20 };
  const select = (enemies: typeof sim.enemies) => resolveRangedAim(origin, cursor, enemies, options).targetId;
  assert.equal(select([a, b]), select([b, a]));
  assert.equal(resolveRangedAim(origin, cursor, [a, b], { ...options, previousTargetId: b.id }).targetId, b.id);
  assert.equal(resolveRangedAim(origin, { x: 140, y: -20 }, [a, b], { ...options, previousTargetId: b.id }).targetId, null);
});

test('ranged aim drives ranged direction only, preserving raw ground aim and melee direction', () => {
  const sim = new Simulation(world, { spawn: false });
  const input = { ...idle, rangedAim: { x: 200, y: 0 } };
  sim.update(.01, input);
  assert.ok(sim.player.angle < 0, 'melee uses raw pointer');
  sim.player.equipment.mainHand = WEAPON_PROFILES.find(w => w.family === 'bow')!;
  sim.update(.01, input);
  assert.equal(sim.player.angle, 0);
  assert.equal(input.aimY, -25, 'ground skill target is not rewritten');
});

function shot(owner: 'enemy' | 'player', y: number): Projectile {
  return { id: 500, owner, x: 0, y, prevX: 0, prevY: y, vx: 500, vy: 0, angle: 0,
    radius: 2, damage: 1, life: 1, maxLife: 1, sourceLevel: 1, hitIds: new Set() };
}
test('player projectiles accept small grazes without enlarging enemy shots or crossing walls', () => {
  const sim = new Simulation(world, { spawn: false }), enemy = sim.spawnEnemy('stalker', 100, 0)!;
  let hits = 0, hurts = 0;
  const context = { player: sim.player, enemies: [enemy], world,
    damage: () => { hits++; }, hurt: () => { hurts++; }, visible: () => true, emit: () => {} };
  const grazingY = enemy.radius + 2 + PLAYER_PROJECTILE_FORGIVENESS - 1;
  advanceProjectiles([shot('player', grazingY)], .24, context);
  assert.equal(hits, 1);
  advanceProjectiles([shot('player', grazingY + 3)], .24, context);
  assert.equal(hits, 1, 'clear misses stay misses');
  const wall = { ...world, blocked: (x: number) => x >= 45 && x <= 55 };
  advanceProjectiles([shot('player', grazingY)], .24, { ...context, world: wall,
    visible: (ax, ay, bx, by) => hasLineOfSight(wall, ax, ay, bx, by) });
  assert.equal(hits, 1);
  sim.player.x = 100; sim.player.y = 0;
  advanceProjectiles([shot('enemy', sim.player.radius + 4)], .24, context);
  assert.equal(hurts, 0, 'enemy projectiles retain their original collision');
});
