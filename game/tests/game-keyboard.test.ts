import assert from 'node:assert/strict';
import test from 'node:test';
import { bindGameKeyboard } from '../src/game-keyboard.ts';
import { GameInput } from '../src/game-input.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';

function setup() {
  const target = new EventTarget(), abort = new AbortController(), input = new GameInput();
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const presses: string[] = [];
  bindGameKeyboard(target, {
    press: event => { if (!event.repeat) { presses.push(event.code); input.keyDown(event.code); } },
    release: code => input.keyUp(code), clear: () => { input.clear(); sim.clearInput(); },
  }, abort.signal);
  const key = (type: 'keydown' | 'keyup', code: string, options = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, metaKey: false, ctrlKey: false,
      altKey: false, isComposing: false, repeat: false, ...options });
    target.dispatchEvent(event); return event;
  };
  const state = () => input.consume({ x: 100, y: 0 }, false);
  const advance = (frames: number) => { for (let i = 0; i < frames; i++) sim.update(FIXED_STEP, state()); };
  return { target, abort, input, sim, presses, key, state, advance };
}

test('system shortcut during movement clears missing releases and simulation velocity without blocking the browser', () => {
  for (const [code, flag] of [['MetaLeft', 'metaKey'], ['ControlLeft', 'ctrlKey'], ['AltLeft', 'altKey']]) {
    const { key, state, sim, advance } = setup();
    key('keydown', 'KeyW'); advance(30); assert.ok(sim.player.vy < -100);
    const shortcut = key('keydown', code, { [flag]: true });
    // Deliberately omit W keyup: this is the lost-release sequence.
    key('keyup', code);
    assert.equal(state().moveY, 0); assert.equal(sim.player.vy, 0);
    const y = sim.player.y; advance(120); assert.equal(sim.player.y, y);
    assert.equal(shortcut.defaultPrevented, false);
    key('keydown', 'KeyW', { repeat: true }); assert.equal(state().moveY, 0);
    key('keydown', 'KeyW'); assert.equal(state().moveY, -1);
  }
});

test('modified gameplay and menu shortcuts never reach game actions; modifier release also clears stale input', () => {
  const { key, state, input, presses } = setup();
  for (const code of ['KeyD', 'KeyW', 'KeyQ', 'Space', 'KeyI', 'KeyT', 'KeyM']) {
    key('keydown', code, { metaKey: true });
  }
  assert.deepEqual(presses, []); assert.equal(state().moveX, 0); assert.equal(state().heal, false);
  input.keyDown('KeyA'); input.pointerDown(0);
  key('keyup', 'MetaRight');
  assert.equal(state().moveX, 0); assert.equal(state().attack, false);
});

test('ordinary long holds, diagonal movement and Shift remain responsive and stop after release', () => {
  const { key, state, sim, advance } = setup();
  key('keydown', 'KeyD'); key('keydown', 'KeyW'); key('keydown', 'ShiftLeft');
  advance(1200); assert.ok(sim.player.x > 500 && sim.player.y < -500);
  key('keyup', 'KeyD'); assert.equal(state().moveX, 0); assert.equal(state().moveY, -1);
  key('keyup', 'KeyW'); advance(120);
  assert.equal(sim.player.vx, 0); assert.equal(sim.player.vy, 0);
});

test('text composition cancels held input and queued actions; disposal removes keyboard handlers', () => {
  const { key, state, input, target, abort, presses } = setup();
  key('keydown', 'KeyS'); input.pointerDown(2);
  target.dispatchEvent(new Event('compositionstart'));
  assert.equal(state().moveY, 0); assert.equal(state().skillSlot, null);
  key('keydown', 'KeyD', { isComposing: true }); assert.equal(state().moveX, 0);
  const count = presses.length; abort.abort(); key('keydown', 'KeyW');
  assert.equal(presses.length, count); assert.equal(state().moveY, 0);
});
