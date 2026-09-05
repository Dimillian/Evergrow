import assert from 'node:assert/strict';
import test from 'node:test';
import { ExperienceFeedback } from '../src/hud-experience.ts';

test('XP display smooths gains without overshoot at different frame rates', () => {
  const sample = (fps: number) => {
    const feedback = new ExperienceFeedback();
    assert.equal(feedback.update({ level: 1, xp: 0 }, 0, false).fill, 0);
    let last = 0;
    for (let frame = 0; frame < fps / 2; frame++) {
      const state = feedback.update({ level: 1, xp: 80 }, 1 / fps, false);
      assert.ok(state.fill >= last && state.fill <= .8);
      last = state.fill;
    }
    return last;
  };
  assert.ok(Math.abs(sample(30) - sample(120)) < 1e-10);
});

test('a level-up starts a fresh rail and flashes without sweeping backwards', () => {
  const feedback = new ExperienceFeedback();
  feedback.update({ level: 1, xp: 95 }, 0, false);
  assert.deepEqual(feedback.update({ level: 2, xp: 15 }, 0, false), { fill: 0, pulse: 1 });
  const gain = feedback.update({ level: 2, xp: 15 }, .1, false);
  assert.ok(gain.fill > 0 && gain.fill < .1);
  const paused = feedback.update({ level: 2, xp: 15 }, 0, false);
  assert.deepEqual(paused, gain);
  assert.deepEqual(feedback.update({ level: 5, xp: 0 }, 0, false), { fill: 0, pulse: 1 });
});

test('reduced motion, first render and restart show exact XP without stale feedback', () => {
  const feedback = new ExperienceFeedback();
  assert.deepEqual(feedback.update({ level: 2, xp: 75 }, 0, false), { fill: .5, pulse: 0 });
  assert.deepEqual(feedback.update({ level: 2, xp: 120 }, .01, true), { fill: .8, pulse: 0 });
  assert.deepEqual(feedback.update({ level: 3, xp: 20 }, .01, true), { fill: .1, pulse: 0 });
  feedback.reset();
  assert.deepEqual(feedback.update({ level: 1, xp: 0 }, 0, false), { fill: 0, pulse: 0 });
});
