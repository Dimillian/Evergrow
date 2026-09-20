import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyOcclusionFades, enemyOcclusionBounds, enemyOcclusionStrength, overlapsOcclusion } from '../src/enemy-occlusion.ts';
import { ENEMY_BODY_BOUNDS } from '../src/enemy-body.ts';
import { enemyVisualScale } from '../src/enemy-modifiers.ts';
import type { EnemyKind, Enemy } from '../src/model.ts';

test('only nearby living combatants receive a reveal, with a soft distance boundary', () => {
  for (const state of ['chase', 'windup', 'attack', 'recover'] as const) {
    assert.equal(enemyOcclusionStrength({ hp: 1, state }, 0, 0, 0, 0), 1);
    assert.equal(enemyOcclusionStrength({ hp: 1, state }, 660, 0, 0, 0), .5);
    assert.equal(enemyOcclusionStrength({ hp: 1, state }, 720, 0, 0, 0), 0);
    assert.equal(enemyOcclusionStrength({ hp: 0, state }, 0, 0, 0, 0), 0);
  }
  for (const state of ['idle', 'patrol', 'return', 'dead'] as Enemy['state'][]) {
    assert.equal(enemyOcclusionStrength({ hp: 1, state }, 0, 0, 0, 0), 0);
  }
});

test('all ranks and boss bodies include equipment clearance at the displayed position', () => {
  for (const kind of Object.keys(ENEMY_BODY_BOUNDS) as EnemyKind[]) for (const rank of ['normal', 'veteran', 'elite'] as const) {
    const bounds = enemyOcclusionBounds({ kind, rank }, -251.5, 106.25);
    const scale = enemyVisualScale({ kind, rank }), body = ENEMY_BODY_BOUNDS[kind];
    assert.ok(bounds.left < -251.5 - body.radiusX * scale);
    assert.ok(bounds.top < 106.25 + body.top * scale);
    assert.ok(bounds.top + bounds.height > 106.25 + body.bottom * scale);
    assert.equal(overlapsOcclusion(bounds, { left: -252, top: 100, width: 2, height: 2 }), true);
    assert.equal(overlapsOcclusion(bounds, { left: 1000, top: 1000, width: 20, height: 20 }), false);
  }
});

test('fades are time based, respect reduced motion and forget removed/dead actors', () => {
  const a = new EnemyOcclusionFades(), b = new EnemyOcclusionFades();
  const first = a.update(1, 1, 1 / 60, false);
  assert.ok(first > 0 && first < 1);
  const two = a.update(1, 1, 1 / 60, false);
  assert.ok(Math.abs(two - b.update(1, 1, 1 / 30, false)) < 1e-12);
  assert.ok(a.update(1, 0, 1 / 60, false) < two);
  assert.equal(a.update(1, 0, 1, true), 0);
  assert.equal(a.update(1, 1, 0, true), 1);
  a.retain(new Set());
  assert.equal(a.update(1, 1, 0, false), 0);
  a.update(2, 1, 0, true); a.reset();
  assert.equal(a.update(2, 0, 0, false), 0);
});
