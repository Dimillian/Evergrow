import test from 'node:test';
import assert from 'node:assert/strict';
import { waterFlowPhases, WATER_FLOW_PERIOD, WATER_FLOW_SPEED } from '../src/water-flow.ts';
const pattern = (time: number, flow: number) => {
  const p = waterFlowPhases(time);
  return Math.cos(41 - flow * p.b * .11) * (1 - p.weight) + Math.cos(41 - flow * p.a * .11) * p.weight;
};
test('advected shader detail has bounded distortion even after hours of play', () => {
  for (const age of [0, .8, 59, 600, 3600, 86400]) for (let step = 0; step < 100; step++) {
    const time = age + step * .04, p = waterFlowPhases(time);
    assert(p.a >= 0 && p.a < WATER_FLOW_PERIOD * WATER_FLOW_SPEED);
    assert(p.b >= 0 && p.b < WATER_FLOW_PERIOD * WATER_FLOW_SPEED);
    assert(p.weight >= 0 && p.weight <= 1);
    assert(Math.abs(pattern(time, .51) - pattern(time, .5101)) < .0006, 'nearby flow vectors cannot drift apart with session age');
  }
});
test('staggered phase wraps do not pop or change the pattern between cycles', () => {
  for (const time of [0, 2, 4, 6, 600, 602, 3600]) {
    assert(Math.abs(pattern(time - .00001, .51) - pattern(time + .00001, .51)) < .0001);
    assert(Math.abs(pattern(time + .3, .51) - pattern(time + .3 + WATER_FLOW_PERIOD, .51)) < 1e-10);
  }
});
