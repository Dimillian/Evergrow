import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelCoordinator, type PanelPhase } from '../src/panel-coordinator.ts';
import { GameInput } from '../src/game-input.ts';
import { Simulation } from '../src/simulation.ts';
function setup() {
  const log: string[] = [], active = new Set<string>(), input = new GameInput();
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const panel = (name: string) => ({ open: () => { assert.equal(active.size, 0); active.add(name); log.push(`open:${name}`); }, close: () => { active.delete(name); log.push(`close:${name}`); } });
  const coordinator = new PanelCoordinator({chronicle:panel('chronicle'), journeys: panel('journeys'), event: panel('event'), service: panel('service'), map: panel('map'), character: panel('character'), skills: panel('skills') }, {
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
  for (const name of ['map', 'character', 'skills', 'service', 'event','chronicle'] as PanelPhase[]) {
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
  for (const next of ['ready', 'dead'] as const) for (const name of ['map', 'character', 'skills', 'service', 'event','chronicle'] as PanelPhase[]) {
    const { coordinator: c, log, active } = setup(); c.transition('playing'); c.open(name); log.length = 0;
    c.transition(next, true); assert.equal(active.size, 0); assert.equal(c.activePanel, null);
    assert.deepEqual(log, ['clear', `close:${name}`, `phase:${next}`, 'save']);
  }
});
test('phase eligibility, repeated opens, toggle and pause remain consistent', () => {
  const { coordinator: c, log } = setup();
  assert.equal(c.open('map'), false); assert.equal(c.resume(), false); assert.equal(log.length, 0);
  c.transition('playing'); assert.ok(c.pause()); const calls = log.length;
  assert.equal(c.pause(), false); assert.equal(log.length, calls);
  assert.ok(c.open('character')); assert.ok(c.resume()); assert.equal(c.phase, 'paused');
  c.resume(); assert.ok(c.toggle('character')); assert.equal(c.open('character'), false);
  assert.equal(c.open('map'), false); assert.ok(c.toggle('character')); assert.equal(c.phase, 'playing');
});

test('Chronicle returns to pause when opened from pause, and cannot open at the title',()=>{const {coordinator:c}=setup();assert.equal(c.open('chronicle'),false);c.transition('playing');c.pause();assert.ok(c.open('chronicle'));assert.equal(c.phase,'chronicle');assert.ok(c.resume());assert.equal(c.phase,'paused');c.resume();c.open('chronicle');c.resume();assert.equal(c.phase,'playing');});

test("Chronicle returns to character inventory without resuming simulation",()=>{const {coordinator:c,active}=setup();c.transition("playing");c.open("character");c.open("chronicle");assert.deepEqual([...active],["chronicle"]);c.resume();assert.equal(c.phase,"character");assert.deepEqual([...active],["character"]);});

test('every Esc destination opens while paused and closing it keeps gameplay paused', () => {
  for (const panel of ['character', 'skills', 'map', 'journeys', 'chronicle'] as const) {
    const { coordinator: c, log, active, input, sim } = setup();
    c.transition('playing'); c.pause(); log.length = 0;
    input.keyDown('KeyW'); input.pointerDown(0); sim.player.vx = 70;
    assert.ok(c.open(panel), panel); assert.equal(c.phase, panel);
    assert.equal(sim.player.vx, 0); assert.equal(input.consume({x:0,y:0},false).attack, false);
    assert.ok(c.resume()); assert.equal(c.phase, 'paused'); assert.equal(active.size, 0);
    assert.ok(!log.includes('focus:game'), 'closing a menu child must not resume combat');
    c.resume(); assert.equal(c.phase, 'playing');
  }
});

test('town interactions still require gameplay rather than bypassing their world entrypoints', () => {
  const { coordinator: c } = setup(); c.transition('playing'); c.pause();
  assert.equal(c.open('event'), false); assert.equal(c.open('service'), false);
  assert.equal(c.phase, 'paused');
});

test('Esc ownership survives inventory/skill switches, nested Chronicle and Journey map links', () => {
  const { coordinator: c, log } = setup(); c.transition('playing'); c.pause();
  c.open('character'); c.open('skills'); c.open('character'); c.open('chronicle');
  log.length = 0; c.resume(); assert.equal(c.phase, 'character');
  c.resume(); assert.equal(c.phase, 'paused'); assert.ok(!log.includes('focus:game'));
  c.open('journeys'); c.transition('map'); c.resume(); assert.equal(c.phase, 'paused');
  c.resume(); c.open('map'); c.resume(); assert.equal(c.phase, 'playing');
});

test('title and defeat discard a previous Esc return destination', () => {
  for (const phase of ['ready','dead'] as const) {
    const { coordinator: c } = setup(); c.transition('playing'); c.pause(); c.open('character');
    c.transition(phase); c.transition('playing'); c.open('skills'); c.resume();
    assert.equal(c.phase, 'playing');
  }
});
