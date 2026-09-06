import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseEncounterEnemy, encounterPopulationTarget, ENCOUNTER_RULES,
  livingEnemyCount, ENCOUNTER_WEIGHTS, encounterRankChances, chooseEncounterRank } from '../src/encounter-director.ts';
import { Simulation } from '../src/simulation.ts';
import { BIOMES, type BiomeId } from '../src/biomes.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { EnemyKind, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
function actors(kinds: EnemyKind[]) {
  const sim = new Simulation(world, { spawn: false });
  return kinds.map((kind, index) => sim.spawnEnemy(kind, index * 70, 0)!);
}

test('population follows geographic area level with a fixed simultaneous actor ceiling', () => {
  assert.deepEqual([1, 3, 4, 6, 7, 15, 16, 10000].map(encounterPopulationTarget), [9, 9, 9, 10, 10, 12, 12, 14]);
  assert.ok(ENCOUNTER_RULES.targetPopulationCap <= ENCOUNTER_RULES.hardPopulationCap);
  assert.ok(Object.isFrozen(ENCOUNTER_RULES) && Object.isFrozen(ENCOUNTER_WEIGHTS));
});

test('each biome selects its authored population mix and full areas consume no random draw', () => {
  for (const biome of Object.keys(BIOMES) as BiomeId[]) {
    const weights = ENCOUNTER_WEIGHTS[biome];
    assert.ok(Object.isFrozen(weights));
    assert.deepEqual(Object.keys(weights).sort(), Object.keys(ENEMY_DEFINITIONS).sort());
    assert.ok(Object.values(weights).every(value => Number.isFinite(value) && value >= 0));
    assert.equal(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 100);
    assert.equal(chooseEncounterEnemy([], 1, biome, () => 0), 'stalker');
    assert.equal(chooseEncounterEnemy([], 1, biome, () => (weights.stalker + .1) / 100), 'brute');
    assert.equal(chooseEncounterEnemy([], 1, biome, () => .999), 'wisp');
  }
  assert.deepEqual(Object.keys(ENCOUNTER_WEIGHTS).sort(), Object.keys(BIOMES).sort());
  const full = actors(Array.from({ length: encounterPopulationTarget(1) }, () => 'stalker'));
  assert.equal(chooseEncounterEnemy(full, 1, 'deadwood', () => { throw new Error('Full area rolled a spawn'); }), null);
});

test('heavy and ranged population limits preserve roaming composition', () => {
  const capped = actors(['brute', 'brute', 'caster', 'caster']);
  for (const roll of [0, .3, .9, .999]) {
    const kind = chooseEncounterEnemy(capped, 100, 'swamp', () => roll);
    assert.ok(kind && kind !== 'brute' && kind !== 'caster');
  }
  capped[2].state = 'dead';
  assert.equal(livingEnemyCount(capped), 3);
  const kinds = new Set(Array.from({ length: 100 }, (_, index) => chooseEncounterEnemy(capped, 100, 'swamp', () => index / 100)));
  assert.ok(kinds.has('caster')); assert.ok(!kinds.has('brute'));
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

test('every registered climate selects exactly its authored roaming weight distribution and zero-weight warband exclusions', () => {
  for (const biome of Object.keys(BIOMES) as BiomeId[]) {
    const counts = Object.fromEntries(Object.keys(ENEMY_DEFINITIONS).map(kind => [kind, 0]));
    for (let index = 0; index < 100; index++) {
      const kind = chooseEncounterEnemy([], 1, biome, () => (index + .5) / 100);
      assert.ok(kind); counts[kind]++;
    }
    assert.deepEqual(counts, ENCOUNTER_WEIGHTS[biome], biome);
  }
});
