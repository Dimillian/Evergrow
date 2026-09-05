import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyFocus } from '../src/enemy-focus.ts';
import { cameraView, worldToScreen } from '../src/camera.ts';
import type { CombatEvent, Enemy, EnemyKind } from '../src/model.ts';

const view = cameraView(960, 600, 0, 0, 1);
const enemy = (id = 1, x = 0, y = 0, kind: EnemyKind = 'stalker'): Enemy => ({
  id, level: 1, rank: 'normal', biome: 'deadwood', lootSeed: id, damage: 8, xpReward: 20, x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0,
  angle: 0, hp: 100, maxHp: 100, kind, state: 'idle', stateTime: 0, stateDuration: 1,
  homeX: x, homeY: y, awareness: 0, lostSightTime: 0, lastSeenX: x, lastSeenY: y, senseTime: 0, seesPlayer: false, patrolPhase: 0,
  attackAngle: 0, attackTargetX: x, attackTargetY: y, hitFlash: 0, hitAngle: 0, radius: 10, stagger: 0, attackHit: false, interrupted: false, slowTime: 0, slowFactor: 1, burnTime: 0, burnDps: 0, burnTick: 0,
});
const hit = (id: number, remainingHp = 75): Extract<CombatEvent, { type: 'hit' }> => ({ type: 'hit', angle: 0, enemyKind: 'stalker', heavy: false, targetId: id, x: 0, y: 0, value: 25, remainingHp });
const point = (x = 0, y = -20) => worldToScreen(view, x, y);

test('hover follows the drawn torso and head rather than a ground collision circle', () => {
  for (const [kind, headY] of [['stalker', -40], ['brute', -51], ['caster', -43],
    ['hound', -35], ['archer', -45], ['wisp', -46]] as const) {
    const focus = new EnemyFocus(), target = enemy(1, 0, 0, kind);
    assert.equal(focus.update([target], view, point(0, headY), 1, 0), target, `${kind} head is hoverable`);
    assert.equal(focus.hoveredId, 1);
    focus.update([target], view, point(0, 9), 1, 0);
    assert.equal(focus.hoveredId, null, 'empty ground below the feet is not the enemy');
    focus.update([target], view, point(30, -20), 1, 0);
    assert.equal(focus.hoveredId, null, 'empty ground beside the torso is not the enemy');
  }
});

test('hover accounts for fractional zoom, camera position and camera kick', () => {
  const target = enemy(1, -310.2, 617.8);
  for (const zoom of [.65, .843, 1, 1.417, 1.8]) {
    const transformed = cameraView(967, 611, -292.3, 590.6, zoom, 3.7, -2.3);
    const pointer = worldToScreen(transformed, target.x + 4, target.y - 31);
    const focus = new EnemyFocus();
    assert.equal(focus.update([target], transformed, pointer, 1, 0), target);
    assert.equal(focus.hoveredId, target.id);
  }
});

test('hover uses interpolated positions for both body picking and frontmost depth', () => {
  const moving = enemy(1, 200, 60); moving.prevX = 0; moving.prevY = -20;
  const behind = enemy(2, 50, -2);
  const focus = new EnemyFocus();
  assert.equal(focus.update([behind, moving], view, point(50, -20), .25, 0), moving,
    'rendered feet are at (50, 0), in front of the other enemy');
  assert.equal(focus.update([moving], view, point(200, 40), .25, .3), null,
    'the next simulation position is not yet the visible body');
});

test('overlapping bodies choose frontmost depth then a stable identity tie-break', () => {
  const back = enemy(9, 0, -8), front = enemy(2, 0, 5), tie = enemy(7, 0, 5);
  for (const targets of [[back, front, tie], [tie, front, back], [front, back, tie]]) {
    const focus = new EnemyFocus();
    assert.equal(focus.update(targets, view, point(0, -15), 1, 0), tie);
  }
});

test('focus is only acquired by hover or a damaging hit, never enemy proximity', () => {
  const focus = new EnemyFocus(), target = enemy();
  assert.equal(focus.update([target], view, null, 1, 0), null);
  focus.noteHits([{ type: 'spawn', enemyKind: 'stalker', x: 0, y: 0 },
    { type: 'hurt', value: 8, remainingHp: 92, heavy: false, angle: 0, x: 0, y: 0 }, { ...hit(1), value: 0 }]);
  assert.equal(focus.update([target], view, point(100, 100), 1, 0), null);
});

test('dead and fully offscreen enemies cannot be acquired by hover or hits', () => {
  const corpse = enemy(1); corpse.state = 'dead';
  const zeroHealth = enemy(2); zeroHealth.hp = 0;
  const offscreen = enemy(3, 700, 0);
  const targets = [corpse, zeroHealth, offscreen];
  const focus = new EnemyFocus();
  focus.noteHits(targets.map(target => hit(target.id)));
  assert.equal(focus.update(targets, view, point(), 1, 0), null);
  assert.equal(focus.update(targets, view, point(700, -20), 1, 0), null,
    'a pointer outside the canvas never hovers an offscreen body');
});

test('a partially visible head can be hovered even when its feet are below the viewport', () => {
  const target = enemy(1, 0, 324), focus = new EnemyFocus();
  assert.equal(focus.update([target], view, point(0, 287), 1, 0), target);
  target.y = target.prevY = 348;
  assert.equal(focus.update([target], view, null, 1, 0), null, 'fully leaving the screen clears focus immediately');
});

test('hover overrides recent combat focus and retains a short grace before returning to it', () => {
  const fighting = enemy(1, -100), inspecting = enemy(2, 100), targets = [fighting, inspecting];
  const focus = new EnemyFocus();
  focus.noteHits([hit(1)]);
  assert.equal(focus.update(targets, view, null, 1, 0), fighting);
  assert.equal(focus.update(targets, view, point(100, -20), 1, .1), inspecting);
  focus.noteHits([hit(1)]);
  assert.equal(focus.update(targets, view, point(100, -20), 1, .1), inspecting, 'another hit does not override a hovered body');
  assert.equal(focus.update(targets, view, null, 1, .24), inspecting);
  assert.equal(focus.hoveredId, null, 'retention does not report an actual hover');
  assert.equal(focus.targetId, 2);
  assert.equal(focus.update(targets, view, null, 1, .011), fighting);
});

test('hover grace and recent hits expire independently and new hits refresh combat focus', () => {
  const target = enemy(), focus = new EnemyFocus();
  focus.update([target], view, point(), 1, 0);
  assert.equal(focus.update([target], view, null, 1, .249), target);
  assert.equal(focus.update([target], view, null, 1, .002), null);
  focus.noteHits([hit(1)]);
  focus.update([target], view, null, 1, 0);
  assert.equal(focus.update([target], view, null, 1, 1.4), target);
  focus.noteHits([hit(1)]);
  assert.equal(focus.update([target], view, null, 1, .1), target);
  assert.equal(focus.update([target], view, null, 1, 1.49), target);
  assert.equal(focus.update([target], view, null, 1, .011), null);
  assert.equal(focus.targetId, null);
});

test('disabling focus clears hover, combat memory and pending hits immediately', () => {
  const target = enemy(), focus = new EnemyFocus();
  focus.noteHits([hit(1)]);
  focus.update([target], view, point(), 1, 0);
  focus.noteHits([hit(1)]);
  assert.equal(focus.update([target], view, point(), 1, 0, false), null);
  assert.equal(focus.hoveredId, null); assert.equal(focus.targetId, null);
  assert.equal(focus.update([target], view, null, 1, 0), null, 'resuming cannot restore stale focus');
  focus.noteHits([hit(1)]); focus.reset();
  assert.equal(focus.update([target], view, null, 1, 0), null);
});

test('kills and removal clear retained focus without waiting for its timeout', () => {
  const target = enemy(), focus = new EnemyFocus();
  focus.update([target], view, point(), 1, 0); focus.noteHits([hit(1)]);
  focus.update([target], view, null, 1, 0);
  focus.noteHits([{ type: 'kill', facing: 0, angle: 0, enemyKind: 'stalker', targetId: 1, x: 0, y: 0, remainingHp: 0 }]);
  assert.equal(focus.targetId, null);
  assert.equal(focus.update([target], view, point(), 1, 0), null, 'a kill event suppresses reacquisition before the corpse state arrives');
  focus.reset(); focus.noteHits([hit(1)]); focus.update([target], view, null, 1, 0);
  assert.equal(focus.update([], view, null, 1, 0), null);
  assert.equal(focus.update([target], view, null, 1, 0), null, 'returning to view does not restore cleared focus');
});

test('area hits preserve the current focus and are stable when event order changes', () => {
  const targets = [enemy(1, -100), enemy(2), enemy(3, 100)];
  const focus = new EnemyFocus();
  focus.noteHits([hit(3)]); focus.update(targets, view, null, 1, 0);
  for (const batch of [[hit(1), hit(2), hit(3)], [hit(3), hit(2), hit(1)]]) {
    focus.noteHits(batch);
    assert.equal(focus.update(targets, view, null, 1, .1), targets[2]);
  }
  focus.update(targets, view, point(0, -20), 1, 0);
  focus.noteHits([hit(1), hit(2), hit(3)]);
  focus.update(targets, view, null, 1, .1);
  assert.equal(focus.update(targets, view, null, 1, .2), targets[1], 'hitting the hovered target preserves it after hover grace');
  for (const batch of [[hit(3), hit(1)], [hit(1), hit(3)]]) {
    focus.reset(); focus.noteHits(batch);
    assert.equal(focus.update(targets, view, null, 1, 0), targets[0], 'unfocused batches use a stable identity choice');
  }
});

test('lethal or invisible hits do not obscure a surviving visible enemy in the same batch', () => {
  const survivor = enemy(2), invisible = enemy(1, 900), dying = enemy(3, 100);
  const focus = new EnemyFocus();
  focus.noteHits([hit(1), hit(3, 0), hit(2)]);
  assert.equal(focus.update([invisible, survivor, dying], view, null, 1, 0), survivor);
});
