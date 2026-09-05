import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnemyJoinAttack, chooseEncounterEnemy, encounterPopulationTarget, ENCOUNTER_RULES,
  livingEnemyCount, SPECIAL_ENCOUNTERS } from '../src/encounter-director.ts';
import { Simulation } from '../src/simulation.ts';
import type { EnemyKind, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
function actors(kinds: EnemyKind[]) {
  const sim = new Simulation(world, { spawn: false });
  return kinds.map((kind, index) => sim.spawnEnemy(kind, index * 70, 0)!);
}

test('encounter population grows only at authored milestones and remains below the hard actor cap', () => {
  assert.deepEqual([0, 6, 7, 13, 14, 34, 35, 10000].map(encounterPopulationTarget), [5, 5, 6, 6, 7, 9, 10, 10]);
  assert.ok(ENCOUNTER_RULES.targetPopulationCap <= ENCOUNTER_RULES.hardPopulationCap);
  assert.ok(Object.isFrozen(ENCOUNTER_RULES) && Object.isFrozen(SPECIAL_ENCOUNTERS));
});

test('guaranteed enemy introductions and full populations do not consume a random draw', () => {
  let calls = 0;
  const random = () => { calls++; return .9; };
  assert.equal(chooseEncounterEnemy([], 3, random), 'brute');
  assert.equal(chooseEncounterEnemy([], 6, random), 'caster', 'the ranged introduction has priority when both are missing');
  const caster = actors(['caster']);
  assert.equal(chooseEncounterEnemy(caster, 6, random), 'brute');
  const full = actors(['stalker', 'stalker', 'stalker', 'stalker', 'stalker']);
  assert.equal(chooseEncounterEnemy(full, 0, random), null);
  assert.equal(calls, 0, 'moving director policy must not shift the seeded spawn stream');
  assert.equal(chooseEncounterEnemy([], 0, random), 'stalker');
  assert.equal(calls, 1, 'a starter-only decision still consumes its original random draw');
});

test('composition rolls preserve ordered thresholds and special-enemy caps', () => {
  const present = actors(['brute', 'caster']);
  for (const [roll, expected] of [[.179999, 'caster'], [.18, 'brute'], [.379999, 'brute'], [.38, 'stalker']] as const) {
    assert.equal(chooseEncounterEnemy(present, 6, () => roll), expected);
  }
  assert.equal(chooseEncounterEnemy(actors(['brute', 'caster', 'caster']), 6, () => .01), 'brute',
    'a capped caster cohort leaves the original brute threshold intact');
  assert.equal(chooseEncounterEnemy(actors(['brute', 'brute', 'caster']), 6, () => .2), 'stalker');
  assert.equal(chooseEncounterEnemy(actors(['brute', 'brute', 'caster', 'caster']), 100, () => 0), 'stalker');
});

test('dead actors free population and composition slots while living recoveries still count', () => {
  const enemies = actors(['caster', 'brute', 'stalker', 'stalker', 'stalker']);
  enemies[0].state = 'dead'; enemies[1].state = 'recover';
  assert.equal(livingEnemyCount(enemies), 4);
  assert.equal(chooseEncounterEnemy(enemies, 6, () => .9), 'caster');
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
