import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DEFAULT_AUDIO, audioVolume } from '../src/audio-preferences.ts';
import { GameAudio } from '../src/audio.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { audioControlsMarkup } = await import('../src/audio-controls.ts');
css.deregister();

test('audio preferences define standard default channels including master volume', () => {
  assert.equal(DEFAULT_AUDIO.master, 0.8);
  assert.equal(DEFAULT_AUDIO.sfx, 0.75);
  assert.equal(DEFAULT_AUDIO.music, 0.35);
});

test('audioVolume clamps numbers between 0 and 1 and falls back on non-numbers', () => {
  assert.equal(audioVolume(-0.2, 0.8), 0);
  assert.equal(audioVolume(1.5, 0.8), 1);
  assert.equal(audioVolume(0.45, 0.8), 0.45);
  assert.equal(audioVolume(NaN, 0.8), 0.8);
  assert.equal(audioVolume(undefined, 0.8), 0.8);
  assert.equal(audioVolume('quiet', 0.8), 0.8);
});

test('audioControlsMarkup renders master volume slider alongside music and sfx', () => {
  const markup = audioControlsMarkup(true);
  assert.match(markup, /data-audio-volume="master"/);
  assert.match(markup, /data-audio-volume="music"/);
  assert.match(markup, /data-audio-volume="sfx"/);
  assert.match(markup, />Master</);
  assert.match(markup, />80%</);
});

test('GameAudio manages master volume with clamping and retrieval', () => {
  const audio = new GameAudio();
  assert.equal(audio.getVolumes().master, 0.8);

  audio.setVolume('master', 0.5);
  assert.equal(audio.getVolumes().master, 0.5);

  audio.setVolume('master', 2.0);
  assert.equal(audio.getVolumes().master, 1.0);

  audio.setVolume('master', -0.5);
  assert.equal(audio.getVolumes().master, 0.0);
});
