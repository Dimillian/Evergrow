import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/audio.ts';

test('reward sounds bound rapid bursts and level-up has its own sustained high-priority phrase', () => {
  const audio = new GameAudio();
  const tones: number[][] = [], noises: unknown[] = [];
  const internals = audio as unknown as { ctx: { currentTime: number; state: string }; bus: object; tone(...args: number[]): void; hiss(...args: unknown[]): void };
  internals.ctx = { currentTime: 1, state: 'running' }; internals.bus = {};
  internals.tone = (...args) => { tones.push(args); }; internals.hiss = (...args) => { noises.push(args); };
  for (let i = 0; i < 1000; i++) audio.play({ type: 'gold', amount: 4, balance: i * 4, x: 0, y: 0 });
  assert.equal(tones.length, 3); assert.equal(noises.length, 1);
  const pitch = tones[0][0]; internals.ctx.currentTime += .1;
  audio.play({ type: 'gold', amount: 4, balance: 4000, x: 0, y: 0 });
  assert.equal(tones.length, 6); assert.notEqual(tones[3][0], pitch);
  tones.length = 0;
  for (let i = 0; i < 20; i++) audio.play({ type: 'level', level: 2 + i, skillPoints: 1, statPoints: 5, x: 0, y: 0 });
  assert.equal(tones.length, 10);
  assert.ok(tones.some(t => t[2] >= 1.2)); assert.ok(tones.every(t => t[4] === 3));
  tones.length = 0; audio.setEnabled(false);
  audio.play({ type: 'experience', amount: 20, x: 0, y: 0 }); assert.equal(tones.length, 0);
});
