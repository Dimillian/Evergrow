import assert from 'node:assert/strict';
import test from 'node:test';
import { MusicPlayer } from '../src/music-player.ts';
import { MUSIC_POOLS } from '../src/music-playlist.ts';
class Param { value = 0; cancelAndHoldAtTime() {} cancelScheduledValues() {} linearRampToValueAtTime(v: number) { this.value = v; } }
class Node { gain = new Param(); connect() {} disconnect() {} }
class Media {
  duration = 120; currentTime = 0;
  src = ''; preload = ''; ended = false; error = null; paused = true; plays = 0;
  reject?: Error; defer = false; resolve?: () => void;
  play() { this.plays++; if (this.reject) return Promise.reject(this.reject); this.paused = false;
    return this.defer ? new Promise<void>(r => { this.resolve = r; }) : Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() { this.ended = false; }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup() {
  const media: Media[] = [], saved = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: class extends Media { constructor() { super(); media.push(this); } } });
  const ctx = { currentTime: 0, createGain: () => new Node(), createMediaElementSource: () => new Node() };
  const files = Object.fromEntries(Object.values(MUSIC_POOLS).flat().map(id => [id, `${id}.mp3`]));
  const player = new MusicPlayer(ctx as unknown as AudioContext, new Node() as unknown as AudioNode, files);
  return { player, media, ctx, close() { player.dispose(); if (saved) Object.defineProperty(globalThis, 'Audio', saved); else Reflect.deleteProperty(globalThis, 'Audio'); } };
}
test('crossfades never allocate a third stream and latest realm wins after the outgoing tail', async () => {
  const s = setup(); try {
    s.player.update({ mood: 'dark', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.filter(m => !m.paused).length, 1);
    s.ctx.currentTime = 20; s.player.update({ mood: 'verdant', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.filter(m => !m.paused).length, 2);
    s.ctx.currentTime = 21; s.player.update({ mood: 'boss', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.some(m => m.src === 'boss.mp3'), false);
    s.ctx.currentTime = 29; s.player.update({ mood: 'boss', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.some(m => m.src === 'boss.mp3'), true);
    assert.equal(s.media.length, 2);
  } finally { s.close(); }
});
test('exploration gives breathing room and never immediately repeats the previous cue', async () => {
  const s = setup(); try {
    s.player.update({ mood: 'dark', duck: 1 }, .35, true); await flush();
    const first = s.media.find(m => !m.paused)!; const id = first.src;
    first.ended = true; s.ctx.currentTime = 120; s.player.update({ mood: 'dark', duck: 1 }, .35, true);
    s.ctx.currentTime = 134; s.player.update({ mood: 'dark', duck: 1 }, .35, true);
    assert.equal(s.media.some(m => !m.paused), false);
    s.ctx.currentTime = 151; s.player.update({ mood: 'dark', duck: 1 }, .35, true); await flush();
    assert.notEqual(s.media.find(m => !m.paused)!.src, id);
  } finally { s.close(); }
});
test('backgrounding cancels a pending load; its late promise cannot restart playback', async () => {
  const s = setup(); try {
    s.media[0].defer = true;
    s.player.update({ mood: 'dark', duck: 1 }, .35, true);
    s.player.setRunning(false); s.media[0].resolve!(); await flush();
    assert.ok(s.media.every(m => m.paused)); assert.ok(s.media.every(m => !m.src));
    s.media[0].defer = false;
    s.player.update({ mood: 'town', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.filter(m => !m.paused).length, 1);
    s.player.update({ mood: 'town', duck: 1 }, 0, true);
    assert.ok(s.media.every(m => m.paused));
  } finally { s.close(); }
});
test('autoplay rejection waits for activation instead of retrying every update', async () => {
  const s = setup(); try {
    s.media[0].reject = Object.assign(new Error('gesture required'), { name: 'NotAllowedError' });
    s.player.update({ mood: 'home', duck: 1 }, .35, true); await flush();
    for (let n = 0; n < 10; n++) { s.ctx.currentTime++; s.player.update({ mood: 'home', duck: 1 }, .35, true); await flush(); }
    assert.equal(s.media[0].plays, 1);
    s.media[0].reject = undefined; s.player.activate();
    s.player.update({ mood: 'home', duck: 1 }, .35, true); await flush();
    assert.equal(s.media[0].plays, 2); assert.equal(s.media[0].paused, false);
  } finally { s.close(); }
});
test('an unavailable mood backs off instead of creating a network retry storm', async () => {
  const s = setup(); try {
    s.media.forEach(m => m.reject = new Error('network'));
    for (let n = 0; n < 30; n++) { s.ctx.currentTime = n / 4; s.player.update({ mood: 'boss', duck: 1 }, .35, true); await flush(); }
    assert.ok(s.media.reduce((n, m) => n + m.plays, 0) <= 2);
  } finally { s.close(); }
});


test('a sustained boss encounter crossfades into its next cycle before the old recording ends', async () => {
  const s = setup(); try {
    s.player.update({ mood: 'boss', duck: 1 }, .35, true); await flush();
    const first = s.media.find(m => !m.paused)!;
    first.currentTime = 115; s.ctx.currentTime = 115;
    s.player.update({ mood: 'boss', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.filter(m => !m.paused).length, 2);
    s.ctx.currentTime = 119; s.player.update({ mood: 'boss', duck: 1 }, .35, true);
    assert.equal(first.paused, true);
    assert.equal(s.media.filter(m => !m.paused).length, 1);
  } finally { s.close(); }
});


test('gesture priming reuses exactly two silent elements, then releases them for music', async () => {
  const s = setup(); try {
    s.player.prime(); s.player.prime();
    assert.equal(s.media.length, 2); assert.ok(s.media.every(m => m.plays === 1 && m.src.startsWith('data:audio/wav')));
    s.player.update({ mood: 'home', duck: 1 }, .35, true);
    assert.ok(s.media.every(m => m.plays === 1), 'do not abort priming with a track load');
    await flush(); assert.ok(s.media.every(m => m.paused));
    s.player.prime(); assert.ok(s.media.every(m => m.plays === 1));
    s.player.update({ mood: 'home', duck: 1 }, .35, true); await flush();
    assert.equal(s.media.filter(m => !m.paused).length, 1);
    assert.ok(s.media.some(m => m.src.endsWith('.mp3')));
  } finally { s.close(); }
});
