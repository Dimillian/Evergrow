import assert from 'node:assert/strict';
import test from 'node:test';
import { cursedChestProgress } from '../src/event-progress.ts';
import { eventRecipe } from '../src/event-recipes.ts';
import { freshEvents, type EventRecord } from '../src/poi-content.ts';
import { freshWaves } from '../src/wave-system.ts';

function fixture() {
  const site: EventRecord = { id: 'chest', kind: 'cursedChest', name: 'Cursed chest', x: 0, y: 0, seed: 7319, biome: 'deadwood', level: 1, phase: 'active', choice: null, delivered: 0, wavesCleared: 0, bonusGranted: false };
  const state = freshEvents(); state.sites[site.id] = site;
  state.trial = { ...freshWaves(), siteId: site.id, guardians: [], sealReady: false };
  return { site, state, trial: state.trial, duration: eventRecipe(site)!.rules.duration };
}

test('cursed countdown uses the recipe and saved trial clock without mutating progress', () => {
  const { state, trial, duration } = fixture();
  assert.equal(cursedChestProgress(state)!.remaining, duration);
  assert.equal(cursedChestProgress(state)!.started, false);
  trial.started = true; trial.elapsed = duration / 2;
  const before = structuredClone(state), progress = cursedChestProgress(state)!;
  assert.equal(progress.remaining, duration / 2); assert.equal(progress.fraction, .5);
  assert.deepEqual(state, before);
});

test('countdown stays bounded at its endpoints', () => {
  const { state, trial, duration } = fixture();
  trial.elapsed = -.01; assert.equal(cursedChestProgress(state)!.fraction, 1);
  trial.elapsed = duration + .01;
  assert.equal(cursedChestProgress(state)!.remaining, 0);
  assert.equal(cursedChestProgress(state)!.fraction, 0);
});

test('only the active cursed chest owns an indicator', () => {
  const { site, state } = fixture();
  for (const phase of ['paused', 'completed', 'claimed'] as const) {
    site.phase = phase; assert.equal(cursedChestProgress(state), null);
  }
  site.phase = 'active'; site.kind = 'graveyard'; assert.equal(cursedChestProgress(state), null);
  delete state.sites[site.id]; assert.equal(cursedChestProgress(state), null);
  state.trial = null; assert.equal(cursedChestProgress(state), null);
});
