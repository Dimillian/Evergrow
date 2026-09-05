import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import type { EnemyKind, Input, WorldQuery } from '../src/model.ts';
import { awardExperience, enemyXPReward, xpForNextLevel, xpLevelFactor } from '../src/progression.ts';
import { MAX_CONTENT_LEVEL } from '../src/progression-content.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) sim.update(FIXED_STEP, { ...idle, ...input });
}

test('XP thresholds pace matching-level enemies across the early and later game', () => {
  assert.deepEqual([1, 2, 3, 5, 10, 20, 50].map(xpForNextLevel), [100, 170, 230, 375, 865, 2295, 9800]);
  let last = 0;
  for (let level = 1; level <= 1000; level++) {
    const threshold = xpForNextLevel(level);
    assert.ok(threshold > last); assert.equal(threshold % 5, 0); last = threshold;
  }
  assert.equal(xpForNextLevel(Number.NaN), 100);
  assert.equal(xpForNextLevel(1e12), xpForNextLevel(MAX_CONTENT_LEVEL));
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
  awardExperience(progress, 805);
  assert.deepEqual(progress, { level: 5, xp: 80 });
  const split = { level: 1, xp: 80 };
  for (let i = 0; i < 161; i++) awardExperience(split, 5);
  assert.deepEqual(split, progress, 'reward grouping does not affect the resulting level');
});

test('XP rewards use source level and rank, with a bounded player-level difference factor', () => {
  assert.deepEqual([1, 5, 10, 20, 50].map(level => enemyXPReward(20, level, level, 'normal')), [20, 34, 52, 88, 196]);
  assert.equal(enemyXPReward(20, 1, 1, 'veteran'), 40);
  assert.equal(enemyXPReward(20, 1, 1, 'elite'), 100);
  assert.equal(xpLevelFactor(10, 6), 1, 'the free gap expands with player level');
  assert.equal(xpLevelFactor(10, 5), .8);
  assert.equal(xpLevelFactor(1, 2), 1.05);
  assert.equal(xpLevelFactor(1, 100), 1.25);
  assert.equal(xpLevelFactor(100, 1), .01);
  assert.equal(enemyXPReward(20, 100, 1, 'normal'), 1, 'even trivial positive rewards retain one XP');
  assert.equal(enemyXPReward(20, 1, 2, 'normal'), 25, 'source XP rounds before the player-level factor');
  assert.equal(enemyXPReward(Number.NaN, 1, 1, 'normal'), 0);
});

test('invalid rewards are ignored and extreme rewards remain bounded with exact ordinary overflow', () => {
  const progress = { level: 1, xp: 20 };
  for (const reward of [Number.NaN, Infinity, -Infinity, -20, 0, .5]) awardExperience(progress, reward);
  assert.deepEqual(progress, { level: 1, xp: 20 });
  const damaged = { level: Number.NaN, xp: Infinity };
  awardExperience(damaged, 100);
  assert.deepEqual(damaged, { level: 2, xp: 0 });
  const huge = { level: 1, xp: 0 };
  awardExperience(huge, Number.MAX_VALUE);
  assert.ok(Number.isSafeInteger(huge.level) && huge.level > 1000 && huge.level <= MAX_CONTENT_LEVEL);
  assert.ok(Number.isSafeInteger(huge.xp) && huge.xp >= 0 && huge.xp < xpForNextLevel(huge.level));
  const edge = { level: MAX_CONTENT_LEVEL - 1, xp: 0 };
  awardExperience(edge, xpForNextLevel(edge.level) + 100);
  assert.deepEqual(edge, { level: MAX_CONTENT_LEVEL, xp: 0 });
  awardExperience(edge, Number.MAX_VALUE);
  assert.deepEqual(edge, { level: MAX_CONTENT_LEVEL, xp: 0 });
});

test('each enemy archetype awards its authored XP once on lethal melee contact', () => {
  const expectedRewards: Record<EnemyKind, number> = { stalker: 20, caster: 30, brute: 50, hound: 22, archer: 28, wisp: 32 };
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
  sim.setSpawnExclusion({ x: -300, y: -250, width: 600, height: 500 });
  enemy.x = sim.player.x - ENCOUNTER_RULES.despawnDistance - 1;
  advance(sim, FIXED_STEP);
  assert.equal(sim.enemies.length, 0);
  assert.equal(sim.kills, 0);
  assert.equal(sim.player.level, 1);
  assert.equal(sim.player.xp, 0);
});
