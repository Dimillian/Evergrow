import assert from 'node:assert/strict';
import test from 'node:test';
import { eventProgress } from '../src/event-progress.ts';
import { EVENT_RECIPES, eventRecipe } from '../src/event-recipes.ts';
import { eventStudyProfile, stageEventProgress } from '../src/tools/event-progress-study.ts';
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
  assert.equal(eventProgress(state)!.fraction, 1);
  assert.equal(eventProgress(state)!.started, false);
  trial.started = true; trial.elapsed = duration / 2;
  const before = structuredClone(state), progress = eventProgress(state)!;
  assert.match(progress.label, /45s/); assert.equal(progress.fraction, .5);
  assert.deepEqual(state, before);
});

test('countdown stays bounded at its endpoints', () => {
  const { state, trial, duration } = fixture();
  trial.elapsed = -.01; assert.equal(eventProgress(state)!.fraction, 1);
  trial.elapsed = duration + .01;
  assert.match(eventProgress(state)!.label, /0s/);
  assert.equal(eventProgress(state)!.fraction, 0);
});

test('only an active trial owns an indicator', () => {
  const { site, state } = fixture();
  for (const phase of ['paused', 'completed', 'claimed'] as const) {
    site.phase = phase; assert.equal(eventProgress(state), null);
  }
  site.phase = 'active'; site.kind = 'caravan'; assert.equal(eventProgress(state), null);
  delete state.sites[site.id]; assert.equal(eventProgress(state), null);
  state.trial = null; assert.equal(eventProgress(state), null);
});

test('every trial recipe stages actual roster counts and its objective, with repeatable scrubbing', () => {
  for (const [kind, recipes] of Object.entries(EVENT_RECIPES)) for (let index = 0; index < recipes.length; index++) {
    const site = { ...fixture().site, kind: kind as EventRecord['kind'], seed: index << 8 };
    const profile = eventStudyProfile(site);
    assert.equal(profile.mode, recipes[index].mode);
    const staged = stageEventProgress(site, 10.8), trial = staged.state.trial!;
    assert.equal(trial.guardians.filter(g => g.wave === 0).length, recipes[index].size);
    assert.ok(eventProgress(staged.state));
    if (profile.mode === 'seals') assert.equal(trial.sealReady, true);
    if (profile.mode === 'defend') assert.equal(trial.held, recipes[index].rules.hold);
    const halfway = stageEventProgress(site, profile.duration / 2);
    stageEventProgress(site, profile.duration);
    assert.deepEqual(stageEventProgress(site, profile.duration / 2), halfway);
    if (profile.mode !== 'timed') {
      const progress = eventProgress(stageEventProgress(site, 12).state)!;
      assert.equal(progress.fraction, 1 / recipes[index].rules.count);
      assert.equal(progress.timed, false);
    }
  }
});

test('beacons use the native channel duration and instant events never invent trials', () => {
  for (const kind of ['watchtower', 'camp', 'caravan', 'reliquary'] as const) {
    const site = { ...fixture().site, kind };
    const staged = stageEventProgress(site, 100);
    assert.equal(staged.state.trial, null);
    assert.deepEqual(staged.state.sites, {});
    assert.equal(staged.profile.mode, kind === 'watchtower' ? 'channel' : 'instant');
    assert.equal(eventStudyProfile(site).duration, kind === 'watchtower' ? 2 : 0);
  }
});
