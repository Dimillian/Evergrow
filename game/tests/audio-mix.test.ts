import assert from 'node:assert/strict';
import test from 'node:test';
import { riftAudioStrength } from '../src/rift-audio.ts';
import { GameAudio } from '../src/audio.ts';
class Param {
  value = 0;
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {} cancelAndHoldAtTime() {}
}
class Node { gain = new Param(); connect() {} disconnect() {} }
class Source extends Node {
  frequency = new Param(); starts = 0; stops = 0;
  start() { this.starts++; } stop() { this.stops++; }
}
class Context {
  static created = 0;
  state = 'suspended'; currentTime = 0; sampleRate = 10; destination = new Node(); closes = 0;
  constructor() { Context.created++; }
  sources: Source[] = [];
  createGain() { return new Node(); }
  createOscillator() { const source = new Source(); this.sources.push(source); return source; }
  createBufferSource() { return this.createOscillator(); }
  createBiquadFilter() { return Object.assign(new Node(), { frequency: new Param(), Q: new Param() }); }
  createDynamicsCompressor() { return { ...new Node(), connect() {}, disconnect() {}, threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }; }
  createWaveShaper() { return new Node(); }
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size), duration: 1 }; }
  createMediaElementSource() { return new Node(); }
  async resume() { this.state = 'running'; } async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; this.closes++; }
}
class Media { preload = ''; play() { return Promise.resolve(); } pause() {} load() {} removeAttribute() {} }

test('one audio context keeps independent remembered levels, master mute and background suspension', async () => {
  const previous = ['AudioContext', 'Audio'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.assign(globalThis, { AudioContext: Context, Audio: Media });
  const audio = new GameAudio();
  try {
    audio.setVolume('music', 0); audio.setVolume('sfx', .5);
    await audio.unlock(); await audio.unlock();
    assert.equal(Context.created, 1);
    const internals = audio as unknown as { ctx: Context; master: Node; sfxGain: Node };
    assert.equal(internals.sfxGain.gain.value, .17); assert.equal(internals.master.gain.value, .8);
    audio.setVolume('music', .8); assert.equal(internals.sfxGain.gain.value, .17);
    audio.setEnabled(false); assert.equal(internals.master.gain.value, 0);
    assert.deepEqual(audio.getVolumes(), { master: .8, music: .8, sfx: .5 });
    audio.setEnabled(true); assert.equal(internals.master.gain.value, .8);
    audio.setVolume('master', .6); assert.equal(internals.master.gain.value, .6);
    audio.setForeground(false); assert.equal(internals.ctx.state, 'suspended');
    await audio.unlock(); assert.equal(internals.ctx.state, 'suspended', 'hidden interactions must not resume sound');
    audio.setForeground(true); assert.equal(internals.ctx.state, 'running');
    const ctx = internals.ctx;
    audio.dispose(); audio.dispose(); assert.equal(ctx.closes, 1);
  } finally {
    audio.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('panel sounds are brief, rate limited, and respect silent SFX', () => {
  const audio = new GameAudio(); const tones: number[][] = [], noise: unknown[] = [];
  const internals = audio as unknown as { ctx: { currentTime: number; state: string }; bus: object; tone(...args: number[]): void; hiss(...args: unknown[]): void };
  internals.ctx = { currentTime: 1, state: 'running' }; internals.bus = {};
  internals.tone = (...args) => tones.push(args); internals.hiss = (...args) => noise.push(args);
  for (let i = 0; i < 20; i++) audio.panel(true);
  assert.equal(tones.length, 1); assert.equal(noise.length, 2); assert.ok(tones[0][2] < .1);
  internals.ctx.currentTime += .2; audio.panel(false); assert.equal(tones.length, 2);
  audio.setVolume('sfx', 0); internals.ctx.currentTime += .2; audio.panel(true); assert.equal(tones.length, 2);
});


test('rift influence smoothly fades with distance and rejects invalid distances', () => {
  assert.equal(riftAudioStrength(Infinity), 0);
  assert.equal(riftAudioStrength(NaN), 0);
  assert.equal(riftAudioStrength(260), 0);
  assert.equal(riftAudioStrength(320), 0);
  assert.equal(riftAudioStrength(0), 1);
  assert.equal(riftAudioStrength(45), 1);
  assert.equal(riftAudioStrength(152.5), .5);
  for (let distance = 45; distance < 260; distance++)
    assert.ok(riftAudioStrength(distance) >= riftAudioStrength(distance + 1));
});

test('portal mix reuses one hum, restores normal levels, and releases sources on silence and lifecycle changes', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.assign(globalThis, { AudioContext: Context });
  const audio = new GameAudio();
  try {
    const scene = { phase: 'playing' as const, biome: 'deadwood' as const, town: true, dungeon: false, encounter: 'none' as const };
    audio.score(0, scene, 1);
    await audio.unlock();
    const internals = audio as unknown as { ctx: Context; sceneGain: Node; sfxGain: Node; music: {update: (...args: unknown[]) => void; setRunning: () => void; dispose: () => void} };
    const ctx = internals.ctx;
    let musicDuck = 0;
    internals.music = { update: intent => { musicDuck = (intent as {duck:number}).duck; }, setRunning() {}, dispose() {} };
    const levels = audio.getVolumes();
    for (let n = 0; n < 40; n++) { ctx.currentTime = n / 4; audio.score(n / 4, scene, 1); }
    assert.equal(ctx.sources.length, 5, 'proximity updates reuse the bounded bed');
    assert.equal(internals.sceneGain.gain.value, .75);
    assert.ok(Math.abs(musicDuck - .35) < 1e-9);
    assert.deepEqual(audio.getVolumes(), levels, 'ducking never writes preference levels');
    audio.score(11, scene, 0); ctx.currentTime += 3; audio.score(14, scene, 0);
    assert.equal(internals.sceneGain.gain.value, 1); assert.equal(musicDuck, 1);
    assert.ok(ctx.sources.every(s => s.stops === 1), 'the silent graph is released after its fade');
    audio.score(15, scene, 1); assert.equal(ctx.sources.length, 10);
    audio.setEnabled(false); assert.ok(ctx.sources.every(s => s.stops === 1));
    audio.setEnabled(true); assert.equal(ctx.sources.length, 15);
    audio.setVolume('sfx', 0); assert.ok(ctx.sources.every(s => s.stops === 1));
    audio.score(16, scene, 1); assert.equal(ctx.sources.length, 15, 'zero SFX cannot recreate the hum');
    audio.setVolume('sfx', .5); assert.equal(ctx.sources.length, 20);
    audio.setForeground(false); assert.ok(ctx.sources.every(s => s.stops === 1));
    audio.setForeground(true); assert.equal(ctx.sources.length, 25);
    audio.score(17, { ...scene, phase: 'ready' }, 1);
    ctx.currentTime += 3; audio.score(20, { ...scene, phase: 'ready' }, 1);
    assert.equal(musicDuck, 1); assert.ok(ctx.sources.every(s => s.stops === 1));
    audio.score(21, scene, 1);
    audio.score(22, { ...scene, phase: 'paused' }, 1);
    assert.equal(musicDuck, .6, 'paused panels retain only their ordinary music ducking');
    assert.equal(internals.sceneGain.gain.value, 1);
    audio.score(23, scene, 1); audio.dispose(); audio.dispose();
    assert.ok(ctx.sources.every(s => s.stops === 1));
  } finally {
    audio.dispose();
    if (saved) Object.defineProperty(globalThis, 'AudioContext', saved); else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
