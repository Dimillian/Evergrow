import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelCoordinator, type PanelPhase } from '../src/panel-coordinator.ts';
import { GameInput } from '../src/game-input.ts';
import { Simulation } from '../src/simulation.ts';
function setup() {
  const log: string[] = [], active = new Set<string>(), input = new GameInput();
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const panel = (name: string) => ({ open: () => { assert.equal(active.size, 0); active.add(name); log.push(`open:${name}`); }, close: () => { active.delete(name); log.push(`close:${name}`); } });
  const coordinator = new PanelCoordinator({ map: panel('map'), character: panel('character'), skills: panel('skills') }, {
    clearInput: () => { input.clear(); sim.clearInput(); log.push('clear'); },
    changed: phase => log.push(`phase:${phase}`), resumeGameplay: () => { assert.equal(active.size, 0); log.push('focus:game'); }, save: () => log.push('save'),
  });
  return { coordinator, log, active, input, sim };
}
test('switching panels closes the old focus owner before opening the next, saving once', () => {
  const { coordinator: c, log } = setup(); c.transition('playing'); c.open('character'); log.length = 0;
  assert.ok(c.open('skills')); assert.equal(c.phase, 'skills');
  assert.deepEqual(log, ['clear', 'close:character', 'phase:skills', 'open:skills', 'save']);
  log.length = 0; assert.ok(c.resume());
  assert.deepEqual(log, ['clear', 'close:skills', 'phase:playing', 'focus:game']);
});
test('all registered panels clear held movement/actions and simulation velocity on entry and resume', () => {
  for (const name of ['map', 'character', 'skills'] as PanelPhase[]) {
    const { coordinator: c, input, sim } = setup(); c.transition('playing');
    input.keyDown('KeyW'); input.keyDown('Space'); input.pointerDown(0); sim.player.vy = -100;
    assert.ok(c.open(name)); assert.equal(sim.player.vy, 0);
    let state = input.consume({ x: 0, y: 0 }, false);
    assert.equal(state.moveY, 0); assert.equal(state.attack, false); assert.equal(state.dodge, false);
    input.keyDown('KeyD'); input.pointerDown(2); sim.player.vx = 100;
    assert.ok(c.resume()); state = input.consume({ x: 0, y: 0 }, false);
    assert.equal(state.moveX, 0); assert.equal(state.skillSlot, null); assert.equal(sim.player.vx, 0);
  }
});
test('title and defeat close every active panel without returning focus to gameplay', () => {
  for (const next of ['ready', 'dead'] as const) for (const name of ['map', 'character', 'skills'] as PanelPhase[]) {
    const { coordinator: c, log, active } = setup(); c.transition('playing'); c.open(name); log.length = 0;
    c.transition(next, true); assert.equal(active.size, 0); assert.equal(c.activePanel, null);
    assert.deepEqual(log, ['clear', `close:${name}`, `phase:${next}`, 'save']);
  }
});
test('phase eligibility, repeated opens, toggle and pause remain consistent', () => {
  const { coordinator: c, log } = setup();
  assert.equal(c.open('map'), false); assert.equal(c.resume(), false); assert.equal(log.length, 0);
  c.transition('playing'); assert.ok(c.pause()); const calls = log.length;
  assert.equal(c.pause(), false); assert.equal(c.open('character'), false); assert.equal(log.length, calls);
  c.resume(); assert.ok(c.toggle('character')); assert.equal(c.open('character'), false);
  assert.equal(c.open('map'), false); assert.ok(c.toggle('character')); assert.equal(c.phase, 'playing');
});
