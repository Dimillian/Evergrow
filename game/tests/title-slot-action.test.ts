import assert from 'node:assert/strict';
import test from 'node:test';
import { titleSlotAction } from '../src/title-slot-action.ts';
import type { SaveSlot } from '../src/character-storage.ts';
const saved: SaveSlot = { index: 2, state: 'saved', record: null, token: 'revision', summary: { name: 'Test', level: 3, power: 42, updatedAt: 1 } };
test('a highlighted saved character can continue while its portrait read is pending', () => {
  assert.equal(titleSlotAction(saved, true, false, false), 'continue');
  assert.equal(titleSlotAction({ ...saved, state: 'recovered' }, true, false, false), 'continue');
});
test('empty slots open creation; corrupt or inaccessible slots never launch', () => {
  assert.equal(titleSlotAction({ index: 0, state: 'empty', record: null, token: null }, true, false, false), 'create');
  for (const state of ['invalid', 'unavailable'] as const) assert.equal(titleSlotAction({ ...saved, state }, true, false, false), 'none');
  assert.equal(titleSlotAction(undefined, true, false, false), 'none');
});
test('busy, signed-out and confirmation states cannot bypass title safeguards', () => {
  assert.equal(titleSlotAction(saved, false, false, false), 'none');
  assert.equal(titleSlotAction(saved, true, true, false), 'none');
  assert.equal(titleSlotAction(saved, true, false, true), 'none');
});
