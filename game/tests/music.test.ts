import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MusicDirector, type MusicSituation } from '../src/music-director.ts';
import { prepareMusicLoop } from '../src/music-loop.ts';
import { MusicComposer } from '../src/music-composer.ts';
import { MUSIC_TRACKS } from '../src/music-content.ts';
import { enemyEngaged } from '../src/enemy-engagement.ts';
import { GameAudio } from '../src/audio.ts';

const field: MusicSituation = { phase: 'playing', location: 'field', engaged: false };
const fight: MusicSituation = { ...field, engaged: true };

test('music follows sanctuary, field, crypt and real engagement with a six-second release', () => {
  const d = new MusicDirector();
  assert.equal(d.update({ ...field, phase: 'ready' }, .1).cue, 'town');
  for (let i = 0; i < 4; i++) assert.equal(d.update(field, .25).cue, 'town');
  assert.equal(d.update(field, .25).cue, 'field');
  assert.equal(d.update(fight, .1).cue, 'encounter');
  for (let i = 0; i < 23; i++) assert.equal(d.update(field, .25).cue, 'encounter');
  assert.equal(d.update(field, .25).cue, 'field');
  assert.equal(d.update({ ...field, location: 'crypt' }, .1).cue, 'crypt');
  assert.equal(d.update({ ...fight, location: 'crypt' }, .1).cue, 'encounter');
  assert.equal(d.update({ ...fight, location: 'town' }, .1).cue, 'town');
  assert.equal(d.update(fight, .1).cue, 'encounter', 'real combat bypasses town departure grace');
  assert.equal(d.update({ ...field, location: 'crypt' }, .1).cue, 'crypt', 'travel clears old combat hold');
  for (const state of ['idle', 'patrol', 'return', 'dead'] as const)
    assert.equal(enemyEngaged({ hp: 10, state }), false);
  assert.equal(enemyEngaged({ hp: 10, state: 'chase' }), true);
  assert.equal(enemyEngaged({ hp: 0, state: 'attack' }), false);
});

test('menus duck and freeze encounter release; death fades out and the hall resets it', () => {
  const d = new MusicDirector();
  d.update(fight, .1);
  for (let i = 0; i < 100; i++) {
    const paused = d.update({ ...field, phase: 'character' }, .25);
    assert.equal(paused.cue, 'encounter'); assert.equal(paused.level, .4);
  }
  assert.equal(d.update(field, .1).level, 1);
  assert.deepEqual(d.update({ ...fight, phase: 'dead' }, .1), { cue: null, level: 0, fade: 2 });
  assert.equal(d.update({ ...fight, phase: 'ready' }, .1).cue, 'town');
  assert.equal(d.update({ ...field, location: 'crypt' }, .1).cue, 'crypt');
});

class Param {
  value = 0;
  calls: Array<[string, number, number]> = [];
  cancelScheduledValues(t: number) { this.calls.push(['cancel', 0, t]); }
  setValueAtTime(v: number, t: number) { this.calls.push(['set', v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(['ramp', v, t]); }
}
class Node {
  gain = new Param(); disconnected = false;
  connect() { return this; }
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  buffer: AudioBuffer | null = null;
  loop = false; loopStart = -1; loopEnd = -1;
  starts: number[][] = []; stops = 0;
  start(...args: number[]) { this.starts.push(args); }
  stop() { this.stops++; }
}
function buffer(channels = 2, length = 484000, sampleRate = 8000): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
    getChannelData: (channel: number) => data[channel] } as AudioBuffer;
}
function setup(fetchAudio: typeof fetch = async () => new Response(new ArrayBuffer(4))) {
  const sources: Source[] = [], gains: Node[] = [];
  const ctx = {
    currentTime: 0, state: 'running', destination: {},
    createGain: () => { const g = new Node(); gains.push(g); return g; },
    createBufferSource: () => { const s = new Source(); sources.push(s); return s; },
    decodeAudioData: async () => buffer(),
    createBuffer: buffer,
  };
  const music = new MusicComposer({ town: { url: 'town', frames48k: 2880000 }, field: { url: 'field', frames48k: 2880000 },
    crypt: { url: 'crypt', frames48k: 2880000 }, encounter: { url: 'encounter', frames48k: 2880000 } }, fetchAudio);
  return { music, ctx, sources, gains, attach: () => music.attach(ctx as unknown as AudioContext) };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

test('the main menu loads town music without rebinding the browser fetch receiver', async t => {
  const requests: string[] = [];
  const fetcher = async function(this: unknown, url: RequestInfo | URL, init?: RequestInit) {
    // Browser fetch accepts a global/undefined receiver, not a MusicComposer.
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    requests.push(String(url));
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(new ArrayBuffer(4));
  };
  const f = setup(fetcher); t.after(() => f.music.dispose());
  const menu: MusicSituation = { phase: 'ready', location: 'crypt', engaged: true };
  f.music.update(menu, .016);
  assert.equal(requests.length, 0, 'the menu still waits for audio unlock');
  f.attach(); await flush();
  assert.deepEqual(requests, ['town'], 'the main menu overrides the character location and engagement');
  assert.equal(f.sources.length, 1, 'town audio reaches looping playback');
  assert.equal(f.sources[0].loop, true);
  for (let i = 0; i < 120; i++) f.music.update(menu, .016);
  assert.equal(f.sources.length, 1, 'menu frames do not restart the track');
});

test('native buffer looping, crossfades, in-progress ramp reversal and position resumption', async t => {
  const f = setup(); t.after(() => f.music.dispose());
  f.attach(); f.music.update(fight, .1); await flush();
  assert.equal(f.sources.length, 1);
  assert.equal(f.sources[0].loop, true); assert.equal(f.sources[0].loopStart, 0); assert.equal(f.sources[0].loopEnd, 60);
  f.ctx.currentTime = 5;
  const crypt = { ...field, location: 'crypt' as const };
  f.music.update(crypt, .1); await flush();
  assert.equal(f.sources.length, 2);
  assert.deepEqual(f.gains[1].gain.calls.at(-1), ['ramp', 0, 8]);
  f.ctx.currentTime = 6;
  f.music.update({ ...crypt, engaged: true }, .1);
  assert.equal(f.sources.length, 2, 'reverse existing voices without duplicate playback');
  assert.ok(Math.abs(f.gains[1].gain.calls.at(-2)![1] - 2 / 3) < 1e-8, 'ramp continues at actual current gain');
  f.ctx.currentTime = 10;
  f.music.update({ ...field, location: 'town' }, .1); await flush();
  f.ctx.currentTime = 14; f.music.update({ ...field, location: 'town' }, .1);
  assert.equal(f.sources[0].stops, 1); assert.equal(f.sources[1].stops, 1);
  f.music.update(fight, .1); await flush();
  assert.equal(f.sources.at(-1)!.starts[0][1], 14, 'returning cue resumes instead of replaying introduction');
  const count = f.sources.length;
  for (let i = 0; i < 200; i++) f.music.update(fight, .016);
  assert.equal(f.sources.length, count);
});

test('no download before unlock or while muted; stale fetch cannot play an outdated cue', async t => {
  const requests: string[] = [];
  let resolve!: (value: Response) => void;
  const fetcher = ((url: string) => {
    requests.push(url);
    if (requests.length === 1) return new Promise<Response>(r => { resolve = r; });
    return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) } as Response);
  }) as typeof fetch;
  const f = setup(fetcher); t.after(() => f.music.dispose());
  f.music.update(fight, .1); assert.equal(requests.length, 0);
  f.music.setEnabled(false); f.attach(); assert.equal(requests.length, 0);
  f.music.setEnabled(true); assert.deepEqual(requests, ['encounter']);
  f.music.update({ ...field, location: 'crypt' }, .1);
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) } as Response);
  await flush();
  assert.deepEqual(requests, ['encounter', 'crypt']);
  assert.equal(f.sources.length, 1, 'only latest selection starts');
});

test('muting during decode cannot start audio; failed loads have bounded retry; disposal releases nodes', async () => {
  const f = setup();
  let decoded!: (buffer: AudioBuffer) => void;
  f.ctx.decodeAudioData = () => new Promise(r => { decoded = r; });
  f.attach(); f.music.update(fight, .1); await flush();
  f.music.setEnabled(false); decoded({ duration: 60 } as AudioBuffer); await flush();
  assert.equal(f.sources.length, 0);
  f.music.dispose(); assert.ok(f.gains[0].disconnected);
  let requests = 0;
  const failing = setup((async () => { requests++; throw new Error('offline'); }) as typeof fetch);
  failing.attach(); failing.music.update(fight, .1); await flush();
  for (let i = 0; i < 100; i++) failing.music.update(fight, .1);
  assert.equal(requests, 1);
  failing.ctx.currentTime = 31; failing.music.update(fight, .1); await flush();
  assert.equal(requests, 2); failing.music.dispose();
});

test('muting fades out and stops voices; resuming does not lose position', async t => {
  const f = setup(); t.after(() => f.music.dispose());
  f.attach(); f.music.update(fight, .1); await flush();
  f.ctx.currentTime = 4; f.music.setEnabled(false);
  assert.deepEqual(f.gains[0].gain.calls.at(-1), ['ramp', 0, 4.08]);
  f.ctx.currentTime = 5; f.music.update(fight, .1);
  assert.equal(f.sources[0].stops, 1);
  f.music.setEnabled(true); assert.equal(f.sources[1].starts[0][1], 5);
  f.music.dispose(); f.music.dispose();
  assert.ok(f.sources.every(s => s.stops === 1 && s.disconnected));
});

test('background cleanup retries when a newer fade outlasts the pending timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(); t.after(() => f.music.dispose());
  f.attach(); f.music.update(fight, .1); await flush();
  f.ctx.currentTime = 5; t.mock.timers.tick(5000);
  f.music.update({ ...field, location: 'crypt' }, .1); await flush();
  assert.equal(f.sources.length, 2);
  f.ctx.currentTime = 8.19; t.mock.timers.tick(3190);
  f.music.setEnabled(false); // Background event: no more update/render calls.
  f.ctx.currentTime = 8.2; t.mock.timers.tick(10);
  assert.equal(f.sources[0].stops, 1);
  assert.equal(f.sources[1].stops, 0, 'the newer fade must finish before cleanup');
  f.ctx.currentTime = 11.4; t.mock.timers.tick(3200);
  assert.ok(f.sources.every(s => s.stops === 1 && s.disconnected),
    'every silent source is released without another animation frame');
  f.ctx.currentTime = 20; t.mock.timers.tick(8600);
  assert.ok(f.sources.every(s => s.stops === 1), 'completed sources are stopped only once');
});

test('shipped WebMs match verified Opus outputs and musical lengths', () => {
  const expected = [
    { bytes: 1359405, frames: 2560000, sha256: '7cf2f9eb1e59a8b5d197661ffac5e6bb9b9a65187a940586502dd2f7269f0f36' },
    { bytes: 1399760, frames: 2425264, sha256: '29918f19b3cb4b985fb47bc257885f85729d5bdae857729ee64635611ca8d61e' },
    { bytes: 1629698, frames: 3072000, sha256: '921c9c1005332c86851cff9b462a5df41284e237631fe08455b8d46e5400f6b4' },
    { bytes: 1121060, frames: 1920000, sha256: '8bc5d73fd33a42ecca9a54115ce34508b3cf9f7a36153fa0da93565b7890d7a1' },
  ];
  for (const [i, track] of Object.values(MUSIC_TRACKS).entries()) {
    const file = readFileSync(new URL(track.url));
    assert.ok(track.url.endsWith('.webm'));
    assert.equal(file.readUInt32BE(0), 0x1a45dfa3, 'EBML header');
    assert.ok(file.includes(Buffer.from('A_OPUS')));
    assert.equal(file.length, expected[i].bytes);
    assert.equal(track.frames48k, expected[i].frames);
    assert.equal(createHash('sha256').update(file).digest('hex'), expected[i].sha256);
  }
});

test('decoded loop preparation excludes guards, preserves tempo and joins continuous samples at both output rates', () => {
  for (const rate of [44100, 48000]) {
    const decoded = buffer(2, Math.round(2.5 * rate), rate);
    const start = Math.round(.25 * rate), length = 2 * rate;
    for (let ch = 0; ch < 2; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * .003) * .1 * (ch + 1);
    }
    const prepared = prepareMusicLoop({ createBuffer: buffer }, decoded, 96000);
    assert.equal(prepared.length, length); assert.equal(prepared.duration, 2);
    for (let ch = 0; ch < 2; ch++) {
      const source = decoded.getChannelData(ch), output = prepared.getChannelData(ch);
      assert.equal(output[0], source[start]);
      assert.equal(output[length - 1], source[start - 1]);
      assert.deepEqual(output.subarray(0, rate), source.subarray(start, start + rate));
      assert.ok(Math.abs(output[0] - output[length - 1]) < .001);
    }
  }
  assert.throws(() => prepareMusicLoop({ createBuffer: buffer }, buffer(2, 100), 96000));
  assert.throws(() => prepareMusicLoop({ createBuffer: buffer }, buffer(), NaN));
});

test('background audio suppression does not overwrite the saved sound preference', () => {
  const enabled: boolean[] = [];
  let disposed = 0;
  const music = { setEnabled: (value: boolean) => enabled.push(value), dispose: () => disposed++ };
  const audio = new GameAudio(music as unknown as MusicComposer);
  audio.setEnabled(true); audio.setBackgrounded(true);
  assert.equal(audio.enabled, true); assert.equal(enabled.at(-1), false);
  audio.setEnabled(true); assert.equal(enabled.at(-1), false);
  audio.setEnabled(false); audio.setBackgrounded(false);
  assert.equal(enabled.at(-1), false);
  audio.setEnabled(true); assert.equal(enabled.at(-1), true);
  audio.dispose(); audio.dispose(); assert.equal(disposed, 1);
});

test('teardown during decode cannot reconnect an audio graph', async () => {
  const f = setup();
  let decoded!: (buffer: AudioBuffer) => void;
  f.ctx.decodeAudioData = () => new Promise(r => { decoded = r; });
  f.attach(); f.music.update(fight, .1); await flush();
  f.music.dispose(); decoded({ duration: 60 } as AudioBuffer); await flush();
  assert.equal(f.sources.length, 0);
  assert.ok(f.gains.every(g => g.disconnected));
});
