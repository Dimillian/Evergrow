import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPolicy, nextMusicTrack, type MusicScene } from '../src/music-policy.ts';
import { audioVolume, DEFAULT_AUDIO } from '../src/audio-preferences.ts';
const scene: MusicScene = { phase: 'playing', biome: 'deadwood', town: false, dungeon: false, encounter: 'none' };
function started() { const p = new MusicPolicy(); p.update(0, scene); p.update(3, scene); return p; }

test('regional music ignores a brief border crossing and shares compatible biome pools', () => {
  const p = started(); assert.equal(p.update(4, scene).mood, 'dark');
  assert.equal(p.update(5, { ...scene, biome: 'verdant' }).mood, 'dark');
  assert.equal(p.update(15, scene).mood, 'dark');
  p.update(20, { ...scene, biome: 'verdant' });
  assert.equal(p.update(34, { ...scene, biome: 'autumn' }).mood, 'dark');
  assert.equal(p.update(35, { ...scene, biome: 'autumn' }).mood, 'verdant');
});
test('panels retain the score, duck it, and never request home music', () => {
  const p = started();
  for (const phase of ['paused', 'character', 'skills', 'map', 'journeys', 'service', 'chronicle'] as const)
    assert.deepEqual(p.update(30, { ...scene, phase }), { mood: 'dark', duck: .6 });
  assert.deepEqual(p.update(31, scene), { mood: 'dark', duck: 1 });
});
test('boss priority persists across short intermissions and yields after the encounter', () => {
  const p = started();
  assert.equal(p.update(5, { ...scene, encounter: 'boss' }).mood, 'boss');
  assert.equal(p.update(6, { ...scene, encounter: 'event' }).mood, 'boss');
  assert.equal(p.update(10, { ...scene, encounter: 'event' }).mood, 'boss');
  assert.equal(p.update(11, { ...scene, encounter: 'boss' }).mood, 'boss');
  p.update(12, scene); assert.equal(p.update(26, scene).mood, 'boss');
  assert.equal(p.update(27, scene).mood, 'dark');
});
test('town, dungeon and title have deliberate transitions; death removes battle music', () => {
  const p = started(); p.update(5, { ...scene, encounter: 'boss' });
  p.update(6, { ...scene, town: true });
  assert.equal(p.update(9, { ...scene, town: true }).mood, 'town');
  p.update(10, { ...scene, dungeon: true });
  assert.equal(p.update(13, { ...scene, dungeon: true }).mood, 'dungeon');
  p.update(14, { ...scene, dungeon: true, encounter: 'boss' });
  assert.deepEqual(p.update(15, { ...scene, dungeon: true, phase: 'dead' }), { mood: 'dungeon', duck: .25 });
  assert.deepEqual(p.update(16, { ...scene, phase: 'ready' }), { mood: 'home', duck: 1 });
});
test('playlist does not immediately repeat a cue, including random endpoints', () => {
  for (const r of [0, .3, .9, 1]) assert.equal(nextMusicTrack(['a', 'b'], 'a', r), 'b');
  assert.equal(nextMusicTrack(['a'], 'a', 0), 'a'); assert.equal(nextMusicTrack([], undefined, 0), undefined);
});
test('audio preferences preserve zero and safely reject malformed values', () => {
  assert.equal(audioVolume(0, DEFAULT_AUDIO.music), 0);
  assert.equal(audioVolume(NaN, .35), .35); assert.equal(audioVolume('1', .75), .75);
  assert.equal(audioVolume(9, .35), 1); assert.equal(audioVolume(-1, .35), 0);
});
