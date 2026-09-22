import test from 'node:test';
import assert from 'node:assert/strict';
import { canopyCombatTargets, canopyNeedsFade } from '../src/canopy-visibility.ts';
import type { Enemy } from '../src/model.ts';
import type { Prop } from '../src/world.ts';

const view = { left: -400, top: -400, width: 800, height: 800 };
const tree: Prop = { id: 'tree', kind: 'tree', x: 0, y: 0, radius: 10, scale: 1, seed: 1 };
const enemy = (changes: Partial<Enemy> = {}) => ({
  hp: 10, state: 'chase', kind: 'stalker', rank: 'normal', x: 0, y: -40, prevX: 0, prevY: -40, ...changes,
} as Enemy);
const targets = (actors: Enemy[]) => canopyCombatTargets(actors, view, 1, 0, 0, () => false);

test('player canopy clearance remains unchanged and rocks never fade', () => {
  assert.equal(canopyNeedsFade(tree, 0, -40, []), true);
  assert.equal(canopyNeedsFade(tree, 0, 7, []), true);
  assert.equal(canopyNeedsFade(tree, 0, 8, []), false);
  assert.equal(canopyNeedsFade(tree, 70, -40, []), false);
  assert.equal(canopyNeedsFade({ ...tree, kind: 'rock' }, 0, -40, targets([enemy()])), false);
});

test('combatants fade foreground crowns only, using rank-aware body overlap', () => {
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy()])), true);
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy({ y: 0, prevY: 0 })])), false);
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy({ y: 20, prevY: 20 })])), false);
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy({ x: 82, prevX: 82 })])), false);
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy({ x: 82, prevX: 82, rank: 'elite' })])), true);
  assert.equal(canopyNeedsFade(tree, 300, 300, targets([enemy({ y: -200, prevY: -200 })])), false);
  assert.equal(canopyNeedsFade({ ...tree, scale: 2 }, 300, 300, targets([enemy({ x: 100, prevX: 100 })])), true);
});

test('candidates exclude dead, idle, returning, distant, offscreen and indoor enemies', () => {
  for (const changes of [{ hp: 0 }, { state: 'idle' }, { state: 'return' }, { x: 750 }, { x: 500 }]) {
    assert.equal(targets([enemy(changes as Partial<Enemy>)]).length, 0);
  }
  assert.equal(canopyCombatTargets([enemy()], view, 1, 0, 0, () => true).length, 0);
  for (const state of ['chase', 'windup', 'attack', 'recover'] as const) assert.equal(targets([enemy({ state })]).length, 1);
});

test('coverage follows interpolation and includes a body crossing the viewport edge', () => {
  const actor = enemy({ x: 500, prevX: 0 });
  assert.equal(canopyCombatTargets([actor], view, 0, 0, 0, () => false).length, 1);
  assert.equal(canopyCombatTargets([actor], view, 1, 0, 0, () => false).length, 0);
  assert.equal(targets([enemy({ x: 405, prevX: 405 })]).length, 1);
  const at = canopyCombatTargets([enemy({ x: 140, prevX: 0 })], view, .5, 0, 0, () => false);
  assert.equal(canopyNeedsFade(tree, 300, 300, at), true);
});
