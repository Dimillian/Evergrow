import assert from 'node:assert/strict';
import test from 'node:test';
import { GameAudio } from '../src/audio.ts';
class Param {
  value = 0;
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {} cancelAndHoldAtTime() {}
}
class Node { gain = new Param(); connect() {} disconnect() {} }
class Context {
  static created = 0;
  state = 'suspended'; currentTime = 0; sampleRate = 10; destination = new Node(); closes = 0;
  constructor() { Context.created++; }
  createGain() { return new Node(); }
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
    assert.equal(internals.sfxGain.gain.value, .17); assert.equal(internals.master.gain.value, 1);
    audio.setVolume('music', .8); assert.equal(internals.sfxGain.gain.value, .17);
    audio.setEnabled(false); assert.equal(internals.master.gain.value, 0);
    assert.deepEqual(audio.getVolumes(), { sfx: .5, music: .8 });
    audio.setEnabled(true); assert.equal(internals.master.gain.value, 1);
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
