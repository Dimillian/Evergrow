import assert from 'node:assert/strict';
import test from 'node:test';
import { GameInput } from '../src/game-input.ts';
import { getHUDLayout } from '../src/hud.ts';
import { getMinimapRect } from '../src/map-view.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';

const aim = { x: -41, y: 22 };

test('a press and release between frames retains one action edge, while held basic attack repeats', () => {
  const input = new GameInput();
  input.pointerDown(0); input.pointerUp(0);
  input.keyDown('Space'); input.keyUp('Space'); input.keyDown('KeyQ'); input.keyUp('KeyQ');
  assert.deepEqual(input.consume(aim, false), {
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: true, dodge: true, heal: true, skillSlot: null,
  });
  assert.deepEqual(input.consume(aim, false), {
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: false, dodge: false, heal: false, skillSlot: null,
  });
  input.pointerDown(0);
  for (let frame = 0; frame < 10; frame++) {
    assert.equal(input.consume(aim, false).attack, true);
  }
});

test('five active skill bindings report slots, held RMB repeats, and unused controls stay inert', () => {
  const input = new GameInput();
  for (const button of [1, 3, 4]) {
    input.pointerDown(button); assert.equal(input.consume(aim, false).skillSlot, null); input.pointerUp(button);
  }
  for (let slot = 1; slot <= 4; slot++) {
    input.keyDown(`Digit${slot}`); assert.equal(input.consume(aim, false).skillSlot, slot);
    assert.equal(input.consume(aim, false).skillSlot, null); input.keyUp(`Digit${slot}`);
  }
  input.pointerDown(2); input.pointerDown(0);
  let state = input.consume(aim, false); assert.equal(state.attack, true); assert.equal(state.skillSlot, 0);
  assert.equal(input.consume(aim, false).skillSlot, 0);
  input.pointerUp(2); input.pointerUp(0); assert.equal(input.consume(aim, false).skillSlot, null);
  input.keyDown('Digit1'); assert.equal(input.consume(aim, true).skillSlot, null);
  assert.equal(input.consume(aim, false).skillSlot, null, 'blocked edges never replay after leaving the HUD');
});

test('aliases and opposing movement remain coherent, and repeat keydowns cannot queue extra dodges', () => {
  const input = new GameInput();
  input.keyDown('KeyD'); input.keyDown('ArrowRight'); input.keyDown('KeyW');
  let state = input.consume(aim, false); assert.equal(state.moveX, 1); assert.equal(state.moveY, -1);
  input.keyUp('KeyD'); input.keyDown('KeyA'); input.keyDown('ArrowDown');
  state = input.consume(aim, false); assert.equal(state.moveX, 0); assert.equal(state.moveY, 0);
  input.keyDown('Space'); assert.equal(input.consume(aim, false).dodge, true);
  input.keyDown('Space'); assert.equal(input.consume(aim, false).dodge, false);
  input.keyUp('Space'); input.keyDown('Space'); assert.equal(input.consume(aim, false).dodge, true);
});

test('UI consumes buffered weapon taps without suppressing movement, dodge or healing', () => {
  const input = new GameInput();
  input.keyDown('KeyD'); input.keyDown('Space'); input.keyDown('KeyQ');
  input.pointerDown(0); input.pointerUp(0); input.pointerDown(2); input.pointerUp(2);
  const blocked = input.consume(aim, true);
  assert.equal(blocked.attack, false);
  assert.equal(blocked.moveX, 1); assert.equal(blocked.dodge, true); assert.equal(blocked.heal, true);
  assert.equal(input.consume(aim, false).attack, false, 'leaving the UI cannot replay a blocked tap');
  input.pointerDown(0); assert.equal(input.consume(aim, true).attack, false);
  assert.equal(input.consume(aim, false).attack, true, 'a still-held button resumes when it returns to the world');
});

test('focus loss and phase changes clear every held and pending action', () => {
  const input = new GameInput();
  for (const code of ['KeyD', 'KeyW', 'Space', 'KeyQ']) input.keyDown(code);
  input.pointerDown(0); input.pointerDown(2); input.clear(); input.clear();
  assert.deepEqual(input.consume(aim, false), {
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: false, dodge: false, heal: false, skillSlot: null,
  });
});

test('pointer projection accounts for canvas placement and ignores zero or nonfinite surface bounds', () => {
  const input = new GameInput();
  const bounds = { left: 40, top: 80, width: 1200, height: 800 };
  input.movePointer(640, 480, bounds, 900, 600);
  assert.deepEqual(input.pointer, { x: 450, y: 300, present: true });
  input.movePointer(20, 480, bounds, 900, 600);
  assert.equal(input.pointer.x, -15); assert.equal(input.pointer.present, false);
  input.movePointer(640, 480, bounds, 900, 600);
  for (const invalid of [0, NaN, Infinity]) {
    input.movePointer(640, 480, { ...bounds, width: invalid }, 900, 600);
    assert.deepEqual(input.pointer, { x: 450, y: 300, present: false });
  }
});

test('all UI consumers share minimap and shortcut hit regions while open world space stays free', () => {
  for (const [width, height] of [[540, 450], [960, 600], [1600, 680]]) {
    const map = getMinimapRect(width, height), hud = getHUDLayout(width, height);
    for (const rect of [map, ...hud.shortcuts]) {
      assert.equal(isGameUIPoint(rect.x + rect.width / 2, rect.y + rect.height / 2, width, height), true);
    }
    assert.equal(isGameUIPoint(width / 2, height / 2, width, height), false);
    assert.equal(isGameUIPoint(hud.x - 5, hud.y, width, height), false);
  }
});
