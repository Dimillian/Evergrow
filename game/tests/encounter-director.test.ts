import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnemyJoinAttack, chooseEncounterEnemy, encounterPopulationTarget, ENCOUNTER_RULES,
  livingEnemyCount, ENCOUNTER_WEIGHTS, encounterRankChances, chooseEncounterRank } from '../src/encounter-director.ts';
import { Simulation } from '../src/simulation.ts';
import type { EnemyKind, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
function actors(kinds: EnemyKind[]) {
  const sim = new Simulation(world, { spawn: false });
  return kinds.map((kind, index) => sim.spawnEnemy(kind, index * 70, 0)!);
}

test('population follows geographic area level with a fixed simultaneous actor ceiling', () => {
  assert.deepEqual([1, 3, 4, 6, 7, 15, 16, 10000].map(encounterPopulationTarget), [5, 5, 6, 6, 7, 9, 10, 10]);
  assert.ok(ENCOUNTER_RULES.targetPopulationCap <= ENCOUNTER_RULES.hardPopulationCap);
  assert.ok(Object.isFrozen(ENCOUNTER_RULES) && Object.isFrozen(ENCOUNTER_WEIGHTS));
});

test('each biome selects its authored population mix and full areas consume no random draw', () => {
  for (const biome of ['deadwood', 'verdant', 'swamp'] as const) {
    const weights = ENCOUNTER_WEIGHTS[biome];
    assert.equal(weights.stalker + weights.brute + weights.caster, 100);
    assert.equal(chooseEncounterEnemy([], 1, biome, () => 0), 'stalker');
    assert.equal(chooseEncounterEnemy([], 1, biome, () => (weights.stalker + .1) / 100), 'brute');
    assert.equal(chooseEncounterEnemy([], 1, biome, () => .999), 'caster');
  }
  const full = actors(['stalker', 'stalker', 'stalker', 'stalker', 'stalker']);
  assert.equal(chooseEncounterEnemy(full, 1, 'deadwood', () => { throw new Error('Full area rolled a spawn'); }), null);
});

test('special-enemy caps redistribute their weight without increasing simultaneous threats', () => {
  const capped = actors(['brute', 'brute', 'caster', 'caster']);
  for (const roll of [0, .3, .9, .999]) assert.equal(chooseEncounterEnemy(capped, 1, 'swamp', () => roll), 'stalker');
  capped[2].state = 'dead';
  assert.equal(livingEnemyCount(capped), 3);
  assert.equal(chooseEncounterEnemy(capped, 1, 'swamp', () => .999), 'caster');
});

test('veterans and elites unlock by area level and retain independent active caps', () => {
  assert.deepEqual(encounterRankChances(1), { normal: 1, veteran: 0, elite: 0 });
  assert.equal(chooseEncounterRank([], 1, 0), 'normal');
  assert.equal(encounterRankChances(2).veteran, .12);
  assert.equal(encounterRankChances(3).elite, .04);
  const deep = encounterRankChances(100000);
  assert.equal(deep.veteran, .2); assert.equal(deep.elite, .08);
  assert.equal(chooseEncounterRank([], 3, .01), 'elite');
  assert.equal(chooseEncounterRank([], 3, .04), 'veteran');
  const sim = new Simulation(world, { spawn: false });
  const elite = sim.spawnEnemy('stalker', 0, 0, 'elite')!;
  const one = sim.spawnEnemy('stalker', 70, 0, 'veteran')!;
  const two = sim.spawnEnemy('stalker', 140, 0, 'veteran')!;
  assert.equal(chooseEncounterRank([elite, one, two], 10, 0), 'normal');
  assert.equal(chooseEncounterRank([elite, one, two], 10, .1), 'normal');
  elite.state = 'dead'; one.state = 'dead';
  assert.equal(chooseEncounterRank([elite, one, two], 10, 0), 'elite');
  assert.equal(chooseEncounterRank([elite, one, two], 10, .1), 'veteran');
});

test('attack slots independently limit pack enemies and the shared heavy/ranged group', () => {
  const [one, two, three, brute, caster] = actors(['stalker', 'stalker', 'stalker', 'brute', 'caster']);
  const enemies = [one, two, three, brute, caster];
  one.state = 'windup'; two.state = 'attack'; brute.state = 'windup';
  assert.equal(canEnemyJoinAttack(three, enemies), false);
  assert.equal(canEnemyJoinAttack(caster, enemies), false);
  assert.equal(canEnemyJoinAttack(one, enemies), true, 'an actor does not consume its own prospective slot');
  two.state = 'recover'; brute.state = 'recover';
  assert.equal(canEnemyJoinAttack(three, enemies), true);
  assert.equal(canEnemyJoinAttack(caster, enemies), true);
  caster.state = 'attack';
  assert.equal(canEnemyJoinAttack(brute, enemies), false);
  assert.equal(canEnemyJoinAttack(three, enemies), true, 'a ranged attack does not spend the pack allowance');
});
