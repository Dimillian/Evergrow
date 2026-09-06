import assert from 'node:assert/strict';
import test from 'node:test';
import { GamepadInput, PAD, PAD_SKILL_BUTTONS, padStick, type PadSnapshot } from '../src/gamepad-input.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';

function snapshot(buttons: number[] = [], axes = [0, 0, 0, 0], extra: Partial<PadSnapshot> = {}): PadSnapshot {
  return { index: 0, id: 'test', connected: true, mapping: 'standard', axes,
    buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: buttons.includes(index), value: buttons.includes(index) ? 1 : 0 })), ...extra };
}
const aim = { x: 200, y: 0 };
function setup() { const pad = new GamepadInput(); pad.poll([snapshot()], true); return pad; }

test('radial deadzone rejects drift and invalid values while preserving analog speed and circular diagonals', () => {
  for (const point of [[.1, .1], [NaN, 1], [1, Infinity], [0, 0]]) assert.deepEqual(padStick(...point), { x: 0, y: 0 });
  assert.ok(Math.abs(padStick(.6, 0).x - .5) < 1e-10);
  assert.ok(Math.abs(Math.hypot(...Object.values(padStick(1, 1))) - 1) < 1e-10);
});

test('connecting, changing phase, and regaining focus require release before attack or movement', () => {
  const pad = new GamepadInput(), held = snapshot([PAD.attack, PAD.dodge], [1, 0, 0, 0]);
  pad.poll([held], true); assert.equal(pad.active, false);
  pad.poll([snapshot()], true); pad.poll([held], true); assert.equal(pad.gameplay(aim).attack, true);
  for (const interrupt of [() => pad.clear(), () => pad.poll([held], false)]) {
    interrupt();
    for (let i = 0; i < 4; i++) { pad.poll([held], true); assert.equal(pad.active, false); }
    pad.poll([snapshot()], true); pad.poll([held], true);
    assert.equal(pad.gameplay(aim).dodge, true); assert.equal(pad.move.x, 1);
  }
});

test('basic attack and first skill repeat; utility and other skill buttons fire once per press', () => {
  const pad = setup();
  for (const [slot, button] of PAD_SKILL_BUTTONS.entries()) {
    pad.poll([snapshot([button])], true); assert.equal(pad.gameplay(aim).skillSlot, slot);
    pad.poll([snapshot([button])], true); assert.equal(pad.gameplay(aim).skillSlot, slot === 0 ? 0 : null);
    pad.poll([snapshot()], true);
  }
  pad.poll([snapshot([PAD.attack, PAD.dodge, PAD.potion])], true);
  assert.deepEqual(pad.gameplay(aim), { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: true, dodge: true, heal: true, skillSlot: null });
  pad.poll([snapshot([PAD.attack, PAD.dodge, PAD.potion])], true);
  assert.equal(pad.gameplay(aim).attack, true); assert.equal(pad.gameplay(aim).dodge, false); assert.equal(pad.gameplay(aim).heal, false);
});

test('unsupported mappings, sparse slots, disconnects and controller replacement cannot inject input', () => {
  const pad = setup();
  pad.poll([null, snapshot([PAD.attack])], true); assert.equal(pad.gameplay(aim).attack, true);
  pad.poll([snapshot([PAD.attack], undefined, { mapping: '' })], true);
  assert.equal(pad.disconnected, true); assert.equal(pad.active, false);
  pad.poll([], true); assert.equal(pad.disconnected, false);
  pad.poll([snapshot()], true);
  pad.poll([snapshot([PAD.attack], undefined, { id: 'replacement' })], true);
  assert.equal(pad.disconnected, true); assert.equal(pad.active, false);
});

test('selected controller remains stable when another controller appears first in a sparse list', () => {
  const pad = setup();
  pad.poll([snapshot([PAD.attack], undefined, { index: 2 }), null, snapshot()], true);
  assert.equal(pad.active, false); assert.equal(pad.disconnected, false);
});

test('controller inputs use ordinary simulation movement and empty skill rules', () => {
  const pad = setup();
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const start = sim.player.x;
  for (let i = 0; i < 120; i++) {
    pad.poll([snapshot([PAD.skill1], [.6, 0, 0, 1])], true);
    sim.update(FIXED_STEP, pad.gameplay(aim));
  }
  assert.ok(sim.player.x > start + 20); assert.equal(sim.player.mana, sim.player.maxMana);
  assert.equal(sim.player.activeSkill, null);
  pad.clear(); sim.clearInput();
  const stopped = sim.player.x;
  for (let i = 0; i < 120; i++) sim.update(FIXED_STEP, pad.gameplay(aim));
  assert.equal(sim.player.x, stopped);
});
