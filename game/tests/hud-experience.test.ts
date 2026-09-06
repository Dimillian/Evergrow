import assert from 'node:assert/strict';
import test from 'node:test';
import { ExperienceFeedback } from '../src/hud-experience.ts';
import { RewardCounter } from '../src/reward-counter.ts';
import { RewardFeedback } from '../src/reward-feedback.ts';

test('XP gains stack ahead of solid fill, wait for arrival and quiet, then settle without overshoot', () => {
  const f = new ExperienceFeedback(); f.update({ level: 1, xp: 0 }, 0, false);
  const first = f.update({ level: 1, xp: 20 }, .3, false);
  assert.equal(first.fill, 0); assert.equal(first.pendingFill, .2); assert.equal(first.pending, 20);
  const second = f.update({ level: 1, xp: 60 }, .3, false);
  assert.equal(second.fill, 0); assert.equal(second.pending, 60);
  let value = 0;
  for (let i = 0; i < 240; i++) {
    const s = f.update({ level: 1, xp: 60 }, 1 / 60, false);
    assert.ok(s.fill >= value && s.fill <= .6); value = s.fill;
  }
  assert.equal(value, .6);
});

test('visual XP completes each rail before carrying overflow into the new level', () => {
  const f = new ExperienceFeedback(); f.update({ level: 1, xp: 95 }, 0, false);
  f.handleEvents([{ type: 'experience', amount: 25, x: 0, y: 0 }]);
  const gain = f.update({ level: 2, xp: 20 }, 0, false);
  assert.equal(gain.level, 1); assert.equal(gain.fill, .95); assert.equal(gain.pendingFill, 1);
  let full = false, next = false, state = gain;
  for (let i = 0; i < 300; i++) {
    state = f.update({ level: 2, xp: 20 }, 1 / 60, false);
    if (state.level === 1 && state.fill === 1) full = true;
    if (state.level === 2) { assert.ok(full); next = true; }
  }
  assert.ok(next); assert.equal(state.xp, 20); assert.equal(state.pending, 0);
});

test('reward batch timing is frame-rate independent and sustained rewards cannot defer filling forever', () => {
  const sample = (fps: number) => {
    const c = new RewardCounter(); c.reset(100); c.add(40);
    for (let i = 0; i < fps * 2; i++) c.update(1 / fps, false);
    return c.value;
  };
  assert.ok(Math.abs(sample(30) - sample(120)) < 1e-8);
  const c = new RewardCounter();
  for (let i = 0; i < 180; i++) { if (i % 10 === 0) c.add(10); c.update(1 / 60, false); }
  assert.ok(c.value > 0); assert.ok(c.value < c.target);
  const before = c.value; c.add(50); c.update(.05, false); assert.ok(c.value >= before);
  c.update(10, false); assert.equal(c.value, c.target);
});

test('reduced motion, save reloads, paused clocks and wallet debits reconcile cleanly', () => {
  const f = new ExperienceFeedback(); f.update({ level: 1, xp: 0 }, 0, false);
  const gain = f.update({ level: 1, xp: 40 }, .2, false);
  assert.deepEqual(f.update({ level: 1, xp: 40 }, 0, false), gain);
  assert.equal(f.update({ level: 2, xp: 85 }, 0, true).fill, .5);
  f.reset(); assert.equal(f.update({ level: 1, xp: 5 }, 0, false).fill, .05);
  const gold = new RewardFeedback(); gold.update(100, 0, false);
  gold.handleEvents([{ type: 'gold', amount: 40, balance: 140, x: 0, y: 0 }], false);
  gold.update(140, .2, false); assert.equal(gold.balance, 100); assert.equal(gold.gold.pending, 40);
  gold.update(60, .1, false); assert.equal(gold.balance, 60); assert.equal(gold.gold.pending, 0);
  gold.update(900, 0, true); assert.equal(gold.balance, 900);
});

test('multi-level bursts merge their earned points and have a bounded celebration lifetime', () => {
  const f = new RewardFeedback();
  f.handleEvents([{ type: 'level', x: 0, y: 0, level: 2, skillPoints: 1, statPoints: 5 }], false);
  f.update(0, .3, false);
  f.handleEvents([{ type: 'level', x: 0, y: 0, level: 4, skillPoints: 2, statPoints: 10 }], false);
  assert.deepEqual(f.level, { age: 0, level: 4, skillPoints: 3, statPoints: 15 });
  f.update(0, 3, false); assert.equal(f.level, null);
});

test('extreme multi-level rewards compress their visual queue and large gold balances finish exactly', () => {
  const f = new ExperienceFeedback(); f.update({ level: 1, xp: 95 }, 0, false);
  f.handleEvents([{ type: 'experience', amount: 1000000, x: 0, y: 0 }]);
  let state = f.update({ level: 50, xp: 10 }, 0, false);
  for (let i = 0; i < 300; i++) state = f.update({ level: 50, xp: 10 }, 1 / 60, false);
  assert.equal(state.level, 50); assert.equal(state.xp, 10); assert.equal(state.pending, 0);
  const c = new RewardCounter(); c.reset(Number.MAX_SAFE_INTEGER - 100); c.add(100, 0);
  for (let i = 0; i < 300; i++) c.update(1 / 60, false);
  assert.equal(c.value, Number.MAX_SAFE_INTEGER); assert.equal(c.pending, 0);
});
