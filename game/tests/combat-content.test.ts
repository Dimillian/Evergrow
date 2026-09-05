import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_ATTACK_PHASES, COMBAT_TIMING, ENEMY_DEFINITIONS, PLAYER_ABILITIES,
  PROJECTILE_DEFINITIONS } from '../src/combat-content.ts';
import { FIXED_STEP, HIT_FLASH_DURATION, BASIC_ATTACK_PHASES as LEGACY_PHASES, Simulation } from '../src/simulation.ts';
import { circleIntersectsSector as legacySector } from '../src/simulation.ts';
import { circleIntersectsSector } from '../src/combat-geometry.ts';
import type { EnemyKind, Input, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false };

test('existing simulation exports retain the canonical timing and geometry API', () => {
  assert.equal(FIXED_STEP, COMBAT_TIMING.fixedStep);
  assert.equal(HIT_FLASH_DURATION, COMBAT_TIMING.hitFlashDuration);
  assert.equal(LEGACY_PHASES, BASIC_ATTACK_PHASES);
  assert.equal(legacySector, circleIntersectsSector);
});

test('enemy definitions have complete coherent telegraph, attack and projectile windows', () => {
  const names = new Set<string>();
  for (const kind of ['stalker', 'brute', 'caster'] satisfies EnemyKind[]) {
    const enemy = ENEMY_DEFINITIONS[kind];
    assert.ok(Object.isFrozen(enemy), 'runtime actor updates cannot alter shared definitions');
    assert.ok(enemy.name.length > 0); names.add(enemy.name);
    for (const value of [enemy.hp, enemy.radius, enemy.speed, enemy.windup, enemy.active, enemy.recovery, enemy.range, enemy.damage]) {
      assert.ok(Number.isFinite(value) && value > 0);
    }
    assert.ok(enemy.aimLock > 0 && enemy.aimLock < enemy.windup, 'the attack visibly locks before it lands');
    assert.ok(enemy.active >= FIXED_STEP, 'active attacks survive at least one simulation tick');
    if (enemy.attack === 'melee') {
      assert.ok(enemy.arc > 0 && enemy.arc <= Math.PI * 2);
      assert.ok(enemy.lungeSpeed >= 0);
    } else {
      assert.equal(enemy.projectile.owner, 'enemy');
      assert.equal(enemy.damage, enemy.projectile.damage, 'projectile damage has one source');
      assert.ok(enemy.minAttackDistance < enemy.retreatDistance && enemy.retreatDistance < enemy.maxAttackDistance);
      assert.ok(enemy.maxAttackDistance <= enemy.range);
      assert.ok(enemy.projectile.speed * enemy.projectile.life >= enemy.range, 'hexes can reach their advertised range');
    }
  }
  assert.equal(names.size, 3);
  assert.ok(Object.isFrozen(ENEMY_DEFINITIONS));
  assert.ok(Object.isFrozen(PROJECTILE_DEFINITIONS));
});

test('player ability definitions retain cancellable casts and bounded dodge protection', () => {
  const { ember, dodge, heal, basicAttack } = PLAYER_ABILITIES;
  assert.ok(0 < basicAttack.activeStart && basicAttack.activeStart < basicAttack.activeEnd && basicAttack.activeEnd < 1);
  assert.ok(ember.releaseRemaining > 0 && ember.releaseRemaining < ember.duration && ember.duration < ember.cooldown);
  assert.ok(0 < dodge.invulnerabilityStart && dodge.invulnerabilityStart < dodge.invulnerabilityEnd
    && dodge.invulnerabilityEnd < dodge.duration && dodge.duration < dodge.recharge);
  assert.ok(Number.isInteger(dodge.charges) && dodge.charges > 0);
  assert.ok(Number.isInteger(heal.charges) && heal.charges > 0 && heal.restore > 0 && heal.killsPerCharge > 0);
  for (const definition of Object.values(PLAYER_ABILITIES)) assert.ok(Object.isFrozen(definition));
  assert.throws(() => Object.assign(PLAYER_ABILITIES.ember, { manaCost: 0 }), TypeError);
});

test('spawned actors and actual melee/projectile contact use the authored enemy definitions', () => {
  for (const kind of ['stalker', 'brute', 'caster'] satisfies EnemyKind[]) {
    const definition = ENEMY_DEFINITIONS[kind];
    const sim = new Simulation(world, { spawn: false });
    const enemy = sim.spawnEnemy(kind, definition.attack === 'melee' ? -20 : -200, 0)!;
    assert.equal(enemy.hp, definition.hp); assert.equal(enemy.maxHp, definition.hp); assert.equal(enemy.radius, definition.radius);
    enemy.attackAngle = 0;
    if (definition.attack === 'melee') {
      enemy.state = 'attack'; enemy.stateDuration = definition.active;
      sim.update(FIXED_STEP, idle);
      assert.equal(sim.player.hp, sim.player.maxHp - definition.damage);
      assert.equal(sim.drainEvents().find(event => event.type === 'hurt')?.enemyKind, kind);
    } else {
      enemy.state = 'windup'; enemy.stateDuration = definition.windup; enemy.stateTime = definition.windup - FIXED_STEP / 2;
      sim.update(FIXED_STEP, idle);
      const projectile = sim.projectiles[0]!;
      assert.ok(projectile);
      assert.equal(projectile.damage, definition.damage);
      assert.equal(projectile.maxLife, definition.projectile.life);
      assert.equal(projectile.radius, definition.projectile.radius);
      assert.equal(projectile.owner, definition.projectile.owner);
      assert.equal(Math.hypot(projectile.vx, projectile.vy), definition.projectile.speed);
    }
  }
});
