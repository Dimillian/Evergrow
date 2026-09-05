import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyDeaths, deathPose } from '../src/death-presentation.ts';
import { layoutLootLabels } from '../src/loot-label-layout.ts';

test('death presentation retains facing, settles, fades, expires and stays bounded independently of actors', () => {
  const deaths = new EnemyDeaths();
  const event = { type: 'kill' as const, x: 30, y: 50, angle: .3, facing: 2,
    targetId: 7, remainingHp: 0 as const, enemyKind: 'brute' as const };
  deaths.handle(event); deaths.handle(event);
  assert.equal(deaths.remains.length, 1);
  const r = deaths.remains[0];
  assert.equal(r.facing, 2); assert.equal(deathPose(r).fall, 0);
  for (const dt of [NaN, Infinity, -1, 0]) deaths.update(dt);
  assert.equal(r.age, 0);
  deaths.update(.3); assert.ok(deathPose(r).fall > 0 && deathPose(r).fall < 1);
  deaths.update(.4); assert.equal(deathPose(r).fall, 1);
  deaths.update(12); assert.ok(deathPose(r).opacity < 1 && deathPose(r).opacity > 0);
  deaths.update(2); assert.equal(deaths.remains.length, 0);
  for (let id = 0; id < 1000; id++) deaths.handle({ ...event, targetId: id });
  assert.equal(deaths.remains.length, 45);
  deaths.reset(); assert.equal(deaths.remains.length, 0);
});

test('reduced motion settles the corpse immediately without dust; spectral remains expire sooner', () => {
  const deaths = new EnemyDeaths();
  deaths.handle({ type: 'kill', x: 0, y: 0, angle: 0, facing: 0, targetId: 1, remainingHp: 0, enemyKind: 'wisp' });
  assert.equal(deathPose(deaths.remains[0], true).fall, 1);
  assert.equal(deathPose(deaths.remains[0], true).dust, 0);
  deaths.update(5); assert.equal(deaths.remains.length, 0);
});

test('loot labels pack pileups without overlap or clipping at any viewport edge', () => {
  const anchors = Array.from({ length: 12 }, (_, id) => ({ id, x: id % 2 ? 3 : 310, y: 90, width: 150 }));
  for (const [width, height] of [[320, 300], [960, 600], [40, 70]]) {
    const boxes = layoutLootLabels(anchors, width, height);
    assert.deepEqual(boxes, layoutLootLabels([...anchors].reverse(), width, height), 'stable independent of storage order');
    for (const a of boxes) {
      assert.ok(a.left >= 0 && a.top >= 0 && a.left + a.width <= width && a.top + a.height <= height);
      for (const b of boxes) if (a !== b) assert.ok(a.left + a.width <= b.left || b.left + b.width <= a.left
        || a.top + a.height <= b.top || b.top + b.height <= a.top);
    }
  }
  const pile = Array.from({ length: 8 }, (_, id) => ({ id, x: 150, y: 300, width: 180 }));
  assert.equal(layoutLootLabels(pile, 400, 600).length, 8, 'individual names stay visible in an ordinary loot pile');
});
