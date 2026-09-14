import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROL_ACTIONS, CONTROL_STORAGE_KEY, ControlBindings, controlLabel, defaultControls, parseControls, validControl } from '../src/control-bindings.ts';
import { GameInput } from '../src/game-input.ts';
import { bindGameKeyboard } from '../src/game-keyboard.ts';

const aim = { x: 40, y: -15 };
const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
};

test('bindings persist across sessions, including unbound slots and alternate mouse buttons', () => {
  const store = memory(), controls = new ControlBindings(store);
  assert.equal(controls.bind('skill0', 0, 'KeyF'), 'saved');
  controls.bind('skill0', 1, 'Mouse4'); controls.bind('heal', 0, null);
  const loaded = new ControlBindings(store);
  assert.deepEqual(loaded.get('skill0'), ['KeyF', 'Mouse4']);
  assert.deepEqual(loaded.get('heal'), [null, null]);
  assert.equal(loaded.action('Mouse2'), undefined);
  assert.equal(loaded.action('KeyQ'), undefined);
  assert.deepEqual([...store.data.keys()], [CONTROL_STORAGE_KEY]);
  loaded.reset();
  const defaults = new ControlBindings(store);
  for (const action of CONTROL_ACTIONS) assert.deepEqual(defaults.get(action.id), action.defaults);
});

test('conflicts leave both controls unchanged until explicitly replaced', () => {
  const controls = new ControlBindings(memory());
  assert.equal(controls.bind('skill0', 1, 'ArrowUp'), 'conflict');
  assert.deepEqual(controls.get('up'), ['KeyW', 'ArrowUp']);
  assert.deepEqual(controls.get('skill0'), ['Mouse2', null]);
  assert.equal(controls.bind('skill0', 1, 'ArrowUp', true), 'saved');
  assert.deepEqual(controls.get('up'), ['KeyW', null]);
  assert.deepEqual(controls.get('skill0'), ['Mouse2', 'ArrowUp']);
  controls.bind('skill0', 0, 'ArrowUp');
  assert.deepEqual(controls.get('skill0'), ['ArrowUp', null], 'same-action duplicates move to the selected column');
});

test('invalid or duplicate stored bindings fall back safely without overwriting stored data', () => {
  for (const raw of ['broken', 'null', '[]', '{}', JSON.stringify({ ...defaultControls(), up: ['Escape', null] }),
    JSON.stringify({ ...defaultControls(), heal: ['KeyW', null] }), JSON.stringify({ ...defaultControls(), heal: ['KeyQ'] })]) {
    const store = memory(); store.data.set(CONTROL_STORAGE_KEY, raw);
    const bindings = new ControlBindings(store);
    assert.deepEqual(parseControls(raw), defaultControls());
    assert.equal(bindings.action('Mouse0'), 'attack');
    assert.equal(store.data.get(CONTROL_STORAGE_KEY), raw);
  }
});

test('older saved maps gain loot reveal bindings without losing custom controls', () => {
  const legacy = defaultControls() as Record<string, readonly [string | null, string | null]>;
  delete legacy.revealLoot;
  legacy.skill1 = ['KeyF', null];
  const migrated = parseControls(JSON.stringify(legacy));
  assert.deepEqual(migrated.skill1, ['KeyF', null]);
  assert.deepEqual(migrated.revealLoot, ['ShiftLeft', 'ShiftRight']);
});

test('loot reveal migration never steals Shift from an existing custom binding', () => {
  const legacy = defaultControls() as Record<string, readonly [string | null, string | null]>;
  delete legacy.revealLoot;
  legacy.skill3 = ['ShiftLeft', 'ShiftRight'];
  const migrated = parseControls(JSON.stringify(legacy));
  assert.deepEqual(migrated.skill3, ['ShiftLeft', 'ShiftRight']);
  assert.deepEqual(migrated.revealLoot, [null, null]);
});

test('truncated saved maps still fall back to the complete safe defaults', () => {
  const truncated = JSON.stringify({ attack: ['KeyW', null] });
  assert.deepEqual(parseControls(truncated), defaultControls());
});

test('reserved keys cannot replace escape, browser reload or modifier shortcuts', () => {
  const controls = new ControlBindings();
  for (const code of ['Escape', 'F5', 'F11', 'F12', 'ControlLeft', 'AltRight', 'MetaLeft', 'Unidentified', 'Mouse5', '<script>']) {
    assert.equal(validControl(code), false, code);
    assert.equal(controls.bind('attack', 0, code), 'invalid');
  }
  for (const code of ['KeyZ', 'Digit0', 'ShiftLeft', 'NumpadEnter', 'Mouse1', 'Mouse3', 'Mouse4', 'Tab', 'Backquote']) assert.ok(validControl(code), code);
  assert.equal(controls.action('Mouse0'), 'attack');
});

test('denied storage keeps mappings usable and reports that they only last this session', () => {
  const bindings = new ControlBindings({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.equal(bindings.bind('skill2', 0, 'Mouse3'), 'session');
  assert.equal(bindings.action('Mouse3'), 'skill2');
  assert.equal(bindings.reset(), 'session');
  assert.equal(bindings.action('Digit2'), 'skill2');
});

test('custom mouse and keyboard bindings preserve taps, holds, skill identities and releases', () => {
  const bindings = new ControlBindings(), input = new GameInput(bindings);
  bindings.bind('attack', 0, 'KeyF'); bindings.bind('skill0', 0, 'KeyG');
  bindings.bind('skill3', 0, 'Mouse3'); bindings.bind('dodge', 0, 'Mouse4'); bindings.bind('heal', 0, 'Mouse1');
  input.pointerDown(0); input.pointerDown(2);
  assert.equal(input.consume(aim, false).attack, false);
  assert.equal(input.consume(aim, false).skillSlot, null);
  input.keyDown('KeyF'); input.keyDown('KeyG');
  let state = input.consume(aim, false);
  assert.equal(state.attack, true); assert.equal(state.skillSlot, 0);
  state = input.consume(aim, false);
  assert.equal(state.attack, true); assert.equal(state.skillSlot, 0); assert.equal(state.skillPressed, false);
  input.pointerDown(3); state = input.consume(aim, false);
  assert.equal(state.skillSlot, 3); assert.deepEqual(state.heldSkillSlots, [0, 3]);
  input.pointerUp(3); input.keyUp('KeyF'); input.keyUp('KeyG');
  input.pointerDown(4); input.pointerUp(4); input.pointerDown(1); input.pointerUp(1);
  state = input.consume(aim, false); assert.equal(state.dodge, true); assert.equal(state.heal, true);
  state = input.consume(aim, false); assert.equal(state.dodge, false); assert.equal(state.heal, false);
  assert.equal(state.attack, false); assert.deepEqual(state.heldSkillSlots, []);
});

test('loot reveal supports WASD movement, alternate holds, mouse bindings and independent releases', () => {
  const bindings = new ControlBindings(), input = new GameInput(bindings);
  input.keyDown('ShiftLeft');
  assert.equal(input.held('revealLoot'), true);
  for (const [code, axis, value] of [
    ['KeyW', 'moveY', -1], ['KeyA', 'moveX', -1], ['KeyS', 'moveY', 1], ['KeyD', 'moveX', 1],
  ] as const) {
    input.keyDown(code); assert.equal(input.consume(aim, false)[axis], value, `Shift + ${code}`); input.keyUp(code);
  }
  input.keyDown('ShiftRight'); input.keyUp('ShiftLeft');
  assert.equal(input.held('revealLoot'), true);
  input.keyUp('ShiftRight'); assert.equal(input.held('revealLoot'), false);
  bindings.bind('revealLoot', 0, 'Mouse3', true);
  input.pointerDown(3); assert.equal(input.held('revealLoot'), true);
  input.pointerUp(3); assert.equal(input.held('revealLoot'), false);
  bindings.bind('revealLoot', 0, null); bindings.bind('revealLoot', 1, null);
  assert.equal(bindings.has('revealLoot'), false);
});

test('rebinding while held clears pending input through the runtime subscription', () => {
  const bindings = new ControlBindings(), input = new GameInput(bindings);
  const unsubscribe = bindings.subscribe(() => input.clear());
  input.keyDown('KeyW'); input.pointerDown(0); input.keyDown('Space'); input.keyDown('ShiftLeft');
  assert.equal(input.held('revealLoot'), true);
  bindings.bind('attack', 0, 'KeyF');
  const state = input.consume(aim, false);
  assert.equal(state.moveY, 0); assert.equal(state.attack, false); assert.equal(state.dodge, false);
  assert.equal(input.held('revealLoot'), false);
  unsubscribe();
});

test('custom alternate movement and native modified shortcuts retain keyboard ownership', () => {
  const bindings = new ControlBindings(), input = new GameInput(bindings);
  bindings.bind('up', 0, 'KeyZ'); bindings.bind('up', 1, 'Mouse3');
  input.keyDown('KeyW'); assert.equal(input.consume(aim, false).moveY, 0);
  input.keyDown('KeyZ'); input.pointerDown(3); input.keyUp('KeyZ');
  assert.equal(input.consume(aim, false).moveY, -1);
  const target = new EventTarget(), abort = new AbortController();
  bindGameKeyboard(target, { press: event => input.keyDown(event.code), release: code => input.keyUp(code), clear: () => input.clear() }, abort.signal);
  target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyZ', ctrlKey: true }));
  assert.equal(input.consume(aim, false).moveY, 0);
  abort.abort();
});

test('labels describe the current primary or alternate assignment', () => {
  const bindings = new ControlBindings();
  bindings.bind('heal', 0, null); assert.equal(bindings.label('heal'), '—');
  bindings.bind('heal', 1, 'Mouse4'); assert.equal(bindings.label('heal'), 'M5');
  assert.equal(controlLabel('NumpadEnter'), 'Num Enter'); assert.equal(controlLabel('KeyZ'), 'Z');
});
