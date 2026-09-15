import assert from 'node:assert/strict';
import test from 'node:test';
import { titleLocation, titlePlayTime } from '../src/title-character-summary.ts';
import { Simulation } from '../src/simulation.ts';
import { WorldLandscape } from '../src/world-landscape.ts';
import { BIOMES } from '../src/biomes.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import { freshExpeditions, createDungeonRun } from '../src/dungeon-state.ts';
import type { CharacterSave } from '../src/character-save.ts';

function fixture(world: WorldLandscape): CharacterSave {
  return { version: 4, id: 'title-review', name: 'Wayfarer', createdAt: 0, updatedAt: 1,
    worldSeed: world.seed, worldVersion: world.generationVersion,
    checkpoint: new Simulation(world, { spawn: false }).captureCheckpoint() };
}
test('hall time distinguishes short sessions, minutes and long durations', () => {
  assert.equal(titlePlayTime(0), 'Less than 1 min');
  assert.equal(titlePlayTime(359), '5 min');
  assert.equal(titlePlayTime(3600), '1 hr 0 min');
  assert.equal(titlePlayTime(3600 * 125 + 120), '125 hr 2 min');
});
test('hall location queries the saved settlement and wilderness without changing the save', () => {
  const world = new WorldLandscape(7319);
  try {
    const record = fixture(world), town = world.getSettlements(-1500, -1500, 3000, 3000)[0];
    assert.ok(town);
    record.checkpoint.x = town.x; record.checkpoint.y = town.y;
    const before = JSON.stringify(record), location = titleLocation(record);
    assert.equal(location.name, town.name);
    assert.equal(location.detail, `${town.kind[0].toUpperCase() + town.kind.slice(1)} · ${world.sampleBiome(town.x, town.y).name}`);
    assert.equal(JSON.stringify(record), before);
    const outside = fixture(world);
    outside.checkpoint.x = 32123; outside.checkpoint.y = -98765;
    assert.equal(titleLocation(outside).name, getZoneAt(32123, -98765, world.seed).districtName);
  } finally { world.dispose(); }
});
test('hall uses the active dungeon identity instead of interpreting floor coordinates as wilderness', () => {
  const world = new WorldLandscape(7319);
  try {
    const record = fixture(world);
    const entrance = { id: 'test-crypt', name: 'The Hollow Archive', seed: 12, level: 3, biome: 'frostpine' as const, x: 3000, y: 4000 };
    const expeditions = freshExpeditions();
    expeditions.runs.push(createDungeonRun(entrance)); expeditions.location = entrance.id;
    record.checkpoint.expeditions = expeditions;
    assert.deepEqual(titleLocation(record), { name: entrance.name, detail: `Dungeon · ${BIOMES.frostpine.name}` });
  } finally { world.dispose(); }
});
