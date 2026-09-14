import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancePauseTransition } from '../src/pause-transition.ts';

test('pause wave uses presentation time consistently at different frame rates', () => {
  for (const hz of [30, 60, 120]) {
    let amount = 0;
    for (let i = 0; i < hz / 2; i++) amount = advancePauseTransition(amount, true, 1 / hz, false);
    assert.ok(Math.abs(amount - .5) < 1e-9);
    for (let i = 0; i < hz; i++) amount = advancePauseTransition(amount, true, 1 / hz, false);
    assert.equal(amount, 1);
    amount = advancePauseTransition(amount, false, .375, false);
    assert.equal(amount, .5);
    amount = advancePauseTransition(amount, false, .375, false);
    assert.equal(amount, 0);
  }
});

test('reversing the wave retains its current position and settles at exact endpoints', () => {
  let amount = advancePauseTransition(0, true, .4, false);
  assert.equal(advancePauseTransition(amount, false, 0, false), amount);
  amount = advancePauseTransition(amount, false, .075, false);
  assert.ok(Math.abs(amount - .3) < 1e-9);
  amount = advancePauseTransition(amount, true, .1, false);
  assert.ok(Math.abs(amount - .4) < 1e-9);
  assert.equal(advancePauseTransition(amount, true, 10, false), 1);
  assert.equal(advancePauseTransition(amount, false, 10, false), 0);
});

test('reduced motion immediately finishes either direction even with no elapsed time', () => {
  assert.equal(advancePauseTransition(.4, true, 0, true), 1);
  assert.equal(advancePauseTransition(.4, false, 0, true), 0);
});
