import assert from 'node:assert/strict';
import test from 'node:test';
import { GameInput } from '../src/game-input.ts';
import { getHUDLayout } from '../src/hud.ts';
import { getMinimapRect } from '../src/map-view.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';

const aim = { x: -41, y: 22 };

test('a press and release between frames retains one action edge, while held weapons repeat', () => {
  const input = new GameInput();
  input.pointerDown(0); input.pointerUp(0);
  input.pointerDown(2); input.pointerUp(2);
  input.keyDown('Space'); input.keyUp('Space'); input.keyDown('KeyQ'); input.keyUp('KeyQ');
  assert.deepEqual(input.consume(aim, false), {
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: true, cast: true, dodge: true, heal: true,
  });
  assert.deepEqual(input.consume(aim, false), {
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: false, cast: false, dodge: false, heal: false,
  });
  input.pointerDown(0); input.pointerDown(2);
  for (let frame = 0; frame < 10; frame++) {
    const next = input.consume(aim, false); assert.equal(next.attack, true); assert.equal(next.cast, true);
  }
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
  assert.equal(blocked.attack, false); assert.equal(blocked.cast, false);
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
    moveX: 0, moveY: 0, aimX: -41, aimY: 22, attack: false, cast: false, dodge: false, heal: false,
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
