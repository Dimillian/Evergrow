import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import type { EnemyKind, Input, WorldQuery } from '../src/model.ts';
import { awardExperience, xpForNextLevel } from '../src/progression.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) sim.update(FIXED_STEP, { ...idle, ...input });
}

test('XP thresholds grow from 100 by 50 per additional level', () => {
  assert.deepEqual([1, 2, 3, 10].map(xpForNextLevel), [100, 150, 200, 550]);
});

test('only reaching the full XP threshold advances the level', () => {
  const progress = { level: 1, xp: 0 };
  awardExperience(progress, 99);
  assert.deepEqual(progress, { level: 1, xp: 99 });
  awardExperience(progress, 1);
  assert.deepEqual(progress, { level: 2, xp: 0 });
  awardExperience(progress, 0);
  assert.deepEqual(progress, { level: 2, xp: 0 });
});

test('XP overflow carries through several level thresholds without losing progress', () => {
  const progress = { level: 1, xp: 80 };
  awardExperience(progress, 700);
  assert.deepEqual(progress, { level: 5, xp: 80 });
  const split = { level: 1, xp: 80 };
  for (let i = 0; i < 35; i++) awardExperience(split, 20);
  assert.deepEqual(split, progress, 'reward grouping does not affect the resulting level');
});

test('each enemy archetype awards its authored XP once on lethal melee contact', () => {
  const expectedRewards: Record<EnemyKind, number> = { stalker: 20, caster: 30, brute: 50 };
  for (const kind of Object.keys(expectedRewards) as EnemyKind[]) {
    const sim = new Simulation(emptyWorld, { spawn: false });
    const enemy = sim.spawnEnemy(kind, 36, 0)!;
    enemy.hp = 24;
    enemy.stateDuration = 999;
    advance(sim, .25, { attack: true });
    assert.equal(enemy.state, 'dead', kind);
    assert.equal(sim.player.xp, expectedRewards[kind], kind);
    assert.equal(ENEMY_DEFINITIONS[kind].xpReward, expectedRewards[kind]);
    advance(sim, 1, { attack: true });
    assert.equal(sim.player.xp, expectedRewards[kind], 'later swings over the corpse do not award XP');
    assert.equal(sim.kills, 1);
    assert.equal(sim.drainEvents().filter(event => event.type === 'kill').length, 1);
  }
});

test('nonlethal damage awards no XP and a kill can cross a level without healing or changing stats', () => {
  const sim = new Simulation(emptyWorld, { spawn: false });
  sim.player.xp = 90;
  sim.player.hp = 40;
  const beforeStats = { ...sim.player.stats };
  const enemy = sim.spawnEnemy('stalker', 36, 0)!;
  enemy.stateDuration = 999;
  advance(sim, .25, { attack: true });
  assert.equal(enemy.hp, 24);
  assert.equal(sim.player.xp, 90);
  assert.equal(sim.player.level, 1);
  advance(sim, .5, { attack: true });
  assert.equal(enemy.state, 'dead');
  assert.equal(sim.player.level, 2);
  assert.equal(sim.player.xp, 10);
  assert.equal(sim.player.hp, 40);
  assert.deepEqual(sim.player.stats, beforeStats);
});

test('a new run starts again at level one with no XP', () => {
  const sim = new Simulation(emptyWorld, { spawn: false });
  assert.equal(sim.player.level, 1);
  assert.equal(sim.player.xp, 0);
  awardExperience(sim.player, 375);
  assert.equal(sim.player.level, 3);
  sim.reset();
  assert.equal(sim.player.level, 1);
  assert.equal(sim.player.xp, 0);
});

test('sanctuary withdrawal and living-enemy despawn do not award XP', () => {
  const world: WorldQuery = { ...emptyWorld, isSanctuary: x => x >= 0 };
  const sim = new Simulation(world, { spawn: false, startX: 5 });
  const enemy = sim.spawnEnemy('stalker', -20, 0)!;
  advance(sim, .5);
  assert.ok(enemy.x < -35, 'the enemy withdraws from the sanctuary');
  assert.equal(sim.player.xp, 0);
  enemy.x = sim.player.x - ENCOUNTER_RULES.despawnDistance - 1;
  advance(sim, FIXED_STEP);
  assert.equal(sim.enemies.length, 0);
  assert.equal(sim.kills, 0);
  assert.equal(sim.player.level, 1);
  assert.equal(sim.player.xp, 0);
});
