import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelCoordinator, type PanelPhase } from '../src/panel-coordinator.ts';
import { GameInput } from '../src/game-input.ts';
import { Simulation } from '../src/simulation.ts';
function setup() {
  const log: string[] = [], active = new Set<string>(), input = new GameInput();
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const panel = (name: string) => ({ open: () => { assert.equal(active.size, 0); active.add(name); log.push(`open:${name}`); }, close: () => { active.delete(name); log.push(`close:${name}`); } });
  const coordinator = new PanelCoordinator({lootLog:panel('lootLog'), chronicle:panel('chronicle'), journeys: panel('journeys'), event: panel('event'), service: panel('service'), map: panel('map'), character: panel('character'), skills: panel('skills') }, {
    clearInput: preserve => { input.clear(preserve); sim.clearInput(preserve); log.push('clear'); },
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
test('pausing panels clear held movement/actions and simulation velocity on entry and resume', () => {
  for (const name of ['map', 'character', 'skills', 'service', 'event','chronicle', 'lootLog'] as PanelPhase[]) {
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

test('Tab entry and exit retain held movement and mouse attack but discard queued utility actions', () => {
  const { coordinator: c, input, sim } = setup(); c.transition('playing');
  input.keyDown('KeyW'); input.keyDown('Space'); input.pointerDown(0); sim.player.vy = -100;
  c.holdMap(); assert.equal(sim.player.vy, -100); assert.equal(c.simulationActive, true);
  let state = input.consume({ x: 0, y: -100 }, false);
  assert.equal(state.moveY, -1); assert.equal(state.attack, true); assert.equal(state.dodge, false);
  const y = sim.player.y, time = sim.time;
  sim.update(1 / 30, state);
  assert.ok(sim.player.y < y); assert.ok(sim.time > time, 'the full simulation can continue behind the chart');
  input.keyDown('KeyD'); input.pointerDown(2); c.resume();
  state = input.consume({ x: 0, y: 0 }, false);
  assert.equal(state.moveX, 1); assert.equal(state.moveY, -1); assert.equal(state.skillSlot, 0);
  input.keyUp('KeyW'); input.keyUp('KeyD'); state = input.consume({ x: 0, y: 0 }, false);
  assert.equal(state.moveX, 0); assert.equal(state.moveY, 0);
});

test('map hold releases, toggle latches, and interruption cannot reopen a held map', () => {
  const { coordinator: c, input } = setup(); c.transition('playing'); input.keyDown('KeyW');
  assert.ok(c.holdMap()); assert.equal(c.mapHeld, true);
  assert.equal(c.holdMap(), false, 'key repeat cannot toggle the hold');
  c.releaseMap(); assert.equal(c.phase, 'playing'); assert.equal(c.mapHeld, false);
  assert.equal(input.consume({ x: 0, y: 0 }, false).moveY, -1);
  c.holdMap(); c.toggleMap(); c.releaseMap(); assert.equal(c.phase, 'map', 'M replaces a Tab glance with the paused map');
  assert.equal(c.simulationActive, false); assert.equal(c.mapHeld, false);
  assert.equal(input.consume({ x: 0, y: 0 }, false).moveY, 0);
  c.toggleMap(); assert.equal(c.phase, 'playing');
  c.holdMap(); c.pause(); c.releaseMap(); assert.equal(c.phase, 'paused');
  assert.equal(input.consume({ x: 0, y: 0 }, false).moveY, 0);
  c.resume(); c.holdMap(); c.transition('dead'); c.releaseMap(); assert.equal(c.phase, 'dead');
});

test('map mode is established before opening the view and only hold mode advances simulation', () => {
  const modes: boolean[] = [], movement: boolean[] = [];
  const panel = { open() {}, close() {} };
  const c = new PanelCoordinator({ map: { open() { modes.push(c.mapHeld); }, close() {} },
    character: panel, skills: panel, journeys: panel, event: panel, service: panel, chronicle: panel, lootLog: panel }, {
    clearInput: preserve => movement.push(!!preserve), changed() {}, resumeGameplay() {}, save() {},
  });
  c.transition('playing'); assert.equal(c.simulationActive, true);
  c.holdMap(); assert.equal(c.simulationActive, true);
  c.toggleMap(); assert.equal(c.simulationActive, false);
  c.releaseMap(); assert.equal(c.simulationActive, false);
  c.resume(); assert.equal(c.simulationActive, true);
  c.open('map'); assert.equal(c.simulationActive, false);
  assert.deepEqual(modes, [true, false, false]);
  assert.deepEqual(movement, [false, true, false, false, false]);
});
test('title and defeat close every active panel without returning focus to gameplay', () => {
  for (const next of ['ready', 'dead'] as const) for (const name of ['map', 'character', 'skills', 'service', 'event','chronicle', 'lootLog'] as PanelPhase[]) {
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
  for (const panel of ['character', 'skills', 'map', 'journeys', 'chronicle', 'lootLog'] as const) {
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


test('quick map yields to gameplay panels and releasing Tab cannot dismiss their focus owner', () => {
  for (const panel of ['character', 'skills', 'journeys', 'event', 'service', 'chronicle', 'lootLog'] as const) {
    const { coordinator: c, input, sim } = setup();
    c.transition('playing'); c.holdMap();
    input.keyDown('KeyW'); input.pointerDown(0); sim.player.vy = -100;
    assert.equal(c.canOpen(panel), true, panel);
    assert.equal(c.open(panel), true, panel);
    assert.equal(c.mapHeld, false); assert.equal(c.simulationActive, false);
    const state = input.consume({ x: 0, y: 0 }, false);
    assert.equal(state.attack, false); assert.equal(state.moveY, 0); assert.equal(sim.player.vy, 0);
    c.releaseMap(); assert.equal(c.phase, panel);
  }
});


test('opening the full map from a quick map upgrades it and survives Tab release', () => {
  const { coordinator: c } = setup();
  c.transition('playing'); c.holdMap();
  assert.equal(c.open('map'), true);
  assert.equal(c.mapHeld, false); assert.equal(c.simulationActive, false);
  c.releaseMap(); assert.equal(c.phase, 'map');
});

test('loot log preserves a manual pause and rejects title/defeat entry', () => {
  const { coordinator:c } = setup(); assert.equal(c.open('lootLog'),false);
  c.transition('playing'); c.pause(); assert.ok(c.open('lootLog')); c.resume(); assert.equal(c.phase,'paused');
  c.transition('dead'); assert.equal(c.open('lootLog'),false);
});

test('inventory loot log returns to inventory without resuming gameplay or losing manual pause', () => {
  for (const paused of [false, true]) {
    const { coordinator: c, log, active } = setup();
    c.transition('playing'); if (paused) c.pause();
    c.open('character'); log.length = 0;
    assert.ok(c.open('lootLog'));
    assert.equal(c.simulationActive, false);
    assert.deepEqual([...active], ['lootLog']);
    assert.ok(c.resume()); assert.equal(c.phase, 'character');
    assert.deepEqual([...active], ['character']);
    assert.equal(c.simulationActive, false);
    assert.ok(!log.includes('focus:game'));
    c.resume(); assert.equal(c.phase, paused ? 'paused' : 'playing');
  }
});
