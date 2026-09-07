import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseEncounterEnemy, ENCOUNTER_WEIGHTS, encounterRankChances, chooseEncounterRank } from '../src/encounter-director.ts';
import { BIOMES, type BiomeId } from '../src/biomes.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';


test('each biome selects its authored population mix', () => {
  for (const biome of Object.keys(BIOMES) as BiomeId[]) {
    const weights = ENCOUNTER_WEIGHTS[biome];
    assert.ok(Object.isFrozen(weights));
    assert.deepEqual(Object.keys(weights).sort(), Object.keys(ENEMY_DEFINITIONS).sort());
    assert.ok(Object.values(weights).every(value => Number.isFinite(value) && value >= 0));
    assert.equal(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 100);
    assert.equal(chooseEncounterEnemy(biome, () => 0), 'stalker');
    assert.equal(chooseEncounterEnemy(biome, () => (weights.stalker + .1) / 100), 'brute');
    assert.equal(chooseEncounterEnemy(biome, () => .999), 'wisp');
  }
  assert.deepEqual(Object.keys(ENCOUNTER_WEIGHTS).sort(), Object.keys(BIOMES).sort());

});

test('veterans and elites unlock by area level and are not blocked by existing ranks', () => {
  assert.deepEqual(encounterRankChances(1), { normal: 1, veteran: 0, elite: 0 });
  assert.equal(chooseEncounterRank(1, 0), 'normal');
  assert.equal(encounterRankChances(2).veteran, .12);
  assert.equal(encounterRankChances(3).elite, .04);
  const deep = encounterRankChances(100000);
  assert.equal(deep.veteran, .2); assert.equal(deep.elite, .08);
  assert.equal(chooseEncounterRank(3, .01), 'elite');
  assert.equal(chooseEncounterRank(3, .04), 'veteran');
  assert.equal(chooseEncounterRank(10, 0), 'elite');
  assert.equal(chooseEncounterRank(10, .1), 'veteran');
  assert.equal(chooseEncounterRank(10, .99), 'normal');
});

test('every registered climate selects exactly its authored roaming weight distribution and zero-weight warband exclusions', () => {
  for (const biome of Object.keys(BIOMES) as BiomeId[]) {
    const counts = Object.fromEntries(Object.keys(ENEMY_DEFINITIONS).map(kind => [kind, 0]));
    for (let index = 0; index < 100; index++) {
      const kind = chooseEncounterEnemy(biome, () => (index + .5) / 100);
      assert.ok(kind); counts[kind]++;
    }
    assert.deepEqual(counts, ENCOUNTER_WEIGHTS[biome], biome);
  }
});
