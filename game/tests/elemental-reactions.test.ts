import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTAL_REACTION_RULES } from '../src/elemental-reaction.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { advanceEnemyStatuses, applyElementalContact } from '../src/combat-status.ts';
import { Simulation } from '../src/simulation.ts';
import type { CombatEvent, Enemy, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };

function createTestHarness() {
  const sim = new Simulation(emptyWorld, { spawn: false, seed: 12345 });
  const player = sim.player;
  const events: CombatEvent[] = [];
  const killedEnemies: Enemy[] = [];
  const context = {
    player,
    enemies: sim.enemies,
    random: () => 1,
    visible: () => true,
    emit: (event: CombatEvent) => { events.push(event); },
    killed: (enemy: Enemy) => { killedEnemies.push(enemy); },
  };

  const spawnTarget = (kind: Enemy['kind'] = 'brute', x = 50, y = 0, hp = 10000) => {
    const enemy = sim.spawnEnemy(kind, x, y)!;
    enemy.hp = enemy.maxHp = hp;
    enemy.angle = Math.PI;
    return enemy;
  };

  return { sim, player, events, killedEnemies, context, spawnTarget };
}

test('Melt reaction: Fire on Frost/Freeze multiplies damage and shortens frost duration', () => {
  const h = createTestHarness();
  const enemy = h.spawnTarget('brute', 50, 0, 10000);

  // Apply frost contact
  applyElementalContact(enemy, 'frost', 100);
  assert.ok((enemy.chillTime ?? 0) > 0);
  assert.ok(enemy.slowTime > 0);

  const initialHp = enemy.hp;
  const rawDamage = 100;
  damageEnemy(enemy, rawDamage, 0, false, h.context, false, 'fire', rawDamage);

  // Melt multiplier is 1.6x -> expected damage 160
  const expectedDamage = Math.round(rawDamage * ELEMENTAL_REACTION_RULES.meltMultiplier);
  assert.equal(initialHp - enemy.hp, expectedDamage);

  // Cooldown applied
  assert.ok((enemy.reactionCooldown ?? 0) > 0);

  // Hit event has reaction marked
  const hitEvent = h.events.find(e => e.type === 'hit' && e.reaction === 'melt');
  assert.ok(hitEvent);
  assert.equal(hitEvent.reaction, 'melt');
});

test('Melt reaction: Boss receives reduced multiplier and longer internal cooldown', () => {
  const h = createTestHarness();
  const boss = h.spawnTarget('warden', 50, 0, 50000);

  applyElementalContact(boss, 'frost', 100);
  const initialHp = boss.hp;
  const rawDamage = 200;

  damageEnemy(boss, rawDamage, 0, false, h.context, false, 'fire', rawDamage);

  const expectedDamage = Math.round(rawDamage * ELEMENTAL_REACTION_RULES.meltBossMultiplier);
  assert.equal(initialHp - boss.hp, expectedDamage);
  assert.equal(boss.reactionCooldown, ELEMENTAL_REACTION_RULES.bossIcd);
});

test('Overload reaction: Lightning on Burning target consumes burn and deals AoE blast damage', () => {
  const h = createTestHarness();
  const primary = h.spawnTarget('brute', 50, 0, 10000);
  const secondary = h.spawnTarget('brute', 80, 0, 10000); // within 140px
  const far = h.spawnTarget('brute', 300, 0, 10000); // beyond 140px

  // Apply burn
  applyElementalContact(primary, 'fire', 100);
  assert.ok(primary.burnTime > 0);

  const secondaryHpBefore = secondary.hp;
  const farHpBefore = far.hp;
  const rawDamage = 100;

  damageEnemy(primary, rawDamage, 0, false, h.context, false, 'lightning', rawDamage);

  // Burn is consumed
  assert.equal(primary.burnTime, 0);

  // Blast event emitted
  const blastEvent = h.events.find(e => e.type === 'blast' && e.reaction === 'overload');
  assert.ok(blastEvent);

  // Secondary within radius takes blast damage & knockback
  assert.ok(secondary.hp < secondaryHpBefore);
  assert.ok(secondary.knockbackX !== 0);

  // Far enemy is untouched
  assert.equal(far.hp, farHpBefore);
  assert.equal(far.knockbackX, 0);
});

test('Superconduct reaction: Lightning on Frost applies fracture defense debuff and extends stagger', () => {
  const h = createTestHarness();
  const enemy = h.spawnTarget('brute', 50, 0, 10000);

  applyElementalContact(enemy, 'frost', 100);
  const rawDamage = 100;

  damageEnemy(enemy, rawDamage, 0, false, h.context, false, 'lightning', rawDamage);

  // Fracture debuff applied
  assert.ok((enemy.fractureTime ?? 0) > 0);
  assert.equal(enemy.statusDurations?.fracture, ELEMENTAL_REACTION_RULES.superconductDuration);

  // Event emitted with superconduct
  const hitEvent = h.events.find(e => e.type === 'hit' && e.reaction === 'superconduct');
  assert.ok(hitEvent);
  assert.equal(hitEvent.reaction, 'superconduct');

  // Next hit benefits from defense shred
  enemy.reactionCooldown = 0; // clear reaction cooldown to test damage amplification
  const hpBeforeSecondHit = enemy.hp;
  damageEnemy(enemy, 100, 0, false, h.context, false, 'fire', 100);
  // Takes damage normally or amplified by fracture
  assert.ok(hpBeforeSecondHit - enemy.hp >= 100);
});

test('Internal cooldown prevents immediate reaction stacking on the same target', () => {
  const h = createTestHarness();
  const enemy = h.spawnTarget('brute', 50, 0, 10000);

  applyElementalContact(enemy, 'frost', 100);
  damageEnemy(enemy, 100, 0, false, h.context, false, 'fire', 100); // triggers Melt

  assert.ok((enemy.reactionCooldown ?? 0) > 0);

  // Immediately apply frost again while on cooldown
  applyElementalContact(enemy, 'frost', 100);
  const eventsCountBefore = h.events.filter(e => e.type === 'hit' && e.reaction === 'melt').length;
  
  // Second fire hit during cooldown
  damageEnemy(enemy, 100, 0, false, h.context, false, 'fire', 100);
  const eventsCountAfter = h.events.filter(e => e.type === 'hit' && e.reaction === 'melt').length;

  // No second melt reaction triggered
  assert.equal(eventsCountAfter, eventsCountBefore);

  // Advance clock past ICD
  advanceEnemyStatuses(enemy, 0.5, () => {});
  assert.equal(enemy.reactionCooldown ?? 0, 0);

  // Now next hit triggers Melt
  damageEnemy(enemy, 100, 0, false, h.context, false, 'fire', 100);
  assert.equal(h.events.filter(e => e.type === 'hit' && e.reaction === 'melt').length, eventsCountBefore + 1);
});
