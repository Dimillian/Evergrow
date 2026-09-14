import assert from 'node:assert/strict';
import test from 'node:test';
import { EventProgressPresentation } from '../src/event-progress-presentation.ts';
import { eventProgress } from '../src/event-progress.ts';
import { stageEventProgress } from '../src/tools/event-progress-study.ts';
import type { EventSite } from '../src/poi-content.ts';

const site: EventSite = { id: 'chest', kind: 'cursedChest', name: 'Cursed chest', x: 0, y: 0, seed: 7319, biome: 'deadwood', level: 1 };
const progress = () => eventProgress(stageEventProgress(site, 20).state)!;

test('frame opens at full height before contents fade in, and reverses on exit', () => {
  const card = new EventProgressPresentation(), active = progress();
  card.update(active, 0, false);
  assert.equal(card.view!.width, 0); assert.equal(card.view!.opacity, 0);
  card.update(active, .18, false);
  assert.equal(card.view!.width, .5); assert.equal(card.view!.opacity, 0);
  card.update(active, .18, false);
  assert.equal(card.view!.width, 1); assert.equal(card.view!.opacity, 0);
  card.update(active, .12, false);
  assert.equal(card.view!.width, 1); assert.ok(Math.abs(card.view!.opacity - .5) < 1e-9);
  card.update(active, 1, false);
  assert.equal(card.view!.opacity, 1);
  card.update(null, .12, false);
  assert.equal(card.view!.width, 1); assert.ok(Math.abs(card.view!.opacity - .5) < 1e-9);
  card.update(null, .3, false);
  assert.ok(Math.abs(card.view!.width - .5) < 1e-9); assert.equal(card.view!.opacity, 0);
  card.update(null, 1, false); assert.equal(card.view, null);
});

test('end during entrance and reactivation reverse continuously without stale live mutations', () => {
  const card = new EventProgressPresentation(), active = progress();
  card.update(active, .18, false);
  const before = card.view;
  card.update(null, 0, false); assert.deepEqual(card.view, before);
  active.site.name = 'Changed';
  assert.equal(card.view!.progress.site.name, 'Cursed chest');
  card.update(null, .09, false);
  const closing = card.view;
  card.update(progress(), 0, false); assert.deepEqual(card.view, closing);
  card.update(progress(), .09, false); assert.equal(card.view!.width, .5);
});

test('new event identities and renderer resets cannot retain the previous card', () => {
  const card = new EventProgressPresentation();
  card.update(progress(), 1, false);
  const next = progress(); next.site.id = 'chapel';
  card.update(next, 0, false);
  assert.equal(card.view!.progress.site.id, 'chapel'); assert.equal(card.view!.width, 0);
  card.reset(); assert.equal(card.view, null);
});

test('reduced motion settles immediately and zero or invalid time does not advance motion', () => {
  const card = new EventProgressPresentation();
  card.update(progress(), 0, true);
  assert.equal(card.view!.width, 1); assert.equal(card.view!.opacity, 1);
  card.update(null, 0, true); assert.equal(card.view, null);
  card.update(progress(), .18, false);
  for (const dt of [0, -1, NaN, Infinity]) { card.update(progress(), dt, false); assert.equal(card.view!.width, .5); }
});
