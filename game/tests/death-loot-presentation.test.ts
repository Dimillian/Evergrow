import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyDeaths, deathPose } from '../src/death-presentation.ts';
import { layoutLootLabels } from '../src/loot-label-layout.ts';
import { enemyDeathAnimation, DEATH_KINDS, ENEMY_DEATHS } from '../src/death-content.ts';

test('death presentation retains facing, settles, fades, expires and stays bounded independently of actors', () => {
  const deaths = new EnemyDeaths(()=>0);
  const event = { type: 'kill' as const, x: 30, y: 50, angle: .3, facing: 2,
    targetId: 7, remainingHp: 0 as const, enemyKind: 'brute' as const };
  deaths.handle(event); deaths.handle(event);
  assert.equal(deaths.remains.length, 1);
  const r = deaths.remains[0];
  assert.equal(r.facing, 2); assert.equal(deathPose(r).age, 0); assert.equal(deathPose(r).settled, false);
  for (const dt of [NaN, Infinity, -1, 0]) deaths.update(dt);
  assert.equal(r.age, 0);
  deaths.update(.3); assert.equal(deathPose(r).settled, false);
  deaths.update(enemyDeathAnimation(r.kind,r.variant).settle); assert.equal(deathPose(r).settled, true);
  deaths.update(11); assert.ok(deathPose(r).opacity < 1 && deathPose(r).opacity > 0);
  deaths.update(2); assert.equal(deaths.remains.length, 0);
  for (let id = 0; id < 1000; id++) deaths.handle({ ...event, targetId: id });
  assert.equal(deaths.remains.length, 45);
  deaths.reset(); assert.equal(deaths.remains.length, 0);
});

test('reduced motion settles the corpse immediately without dust; spectral remains expire sooner', () => {
  const deaths = new EnemyDeaths();
  deaths.handle({ type: 'kill', x: 0, y: 0, angle: 0, facing: 0, targetId: 1, remainingHp: 0, enemyKind: 'wisp' });
  assert.equal(deathPose(deaths.remains[0], true).settled, true);
  assert.equal(deathPose(deaths.remains[0], true).dust, 0);
  deaths.update(5); assert.equal(deaths.remains.length, 0);
});

test('every enemy has four equally selectable deaths; selection happens once and never rerolls with time',()=>{
  for(const kind of DEATH_KINDS) {
    assert.equal(ENEMY_DEATHS[kind].length,4);
    assert.equal(new Set(ENEMY_DEATHS[kind].map(d=>d.family)).size,4);
    for(const [value,expected] of [[0,0],[.2499,0],[.25,1],[.4999,1],[.5,2],[.7499,2],[.75,3],[.999999,3]]) {
      let calls=0;const deaths=new EnemyDeaths(()=>{calls++;return value;});
      const event={type:'kill' as const,x:1,y:2,angle:.4,facing:1,targetId:17,remainingHp:0 as const,enemyKind:kind};
      deaths.handle(event);deaths.handle(event);
      assert.equal(calls,1);assert.equal(deaths.remains[0].variant,expected);
      deaths.update(2.5);deathPose(deaths.remains[0]);deathPose(deaths.remains[0],true);
      assert.equal(calls,1);assert.equal(deaths.remains[0].variant,expected);
      assert.deepEqual(event,{type:'kill',x:1,y:2,angle:.4,facing:1,targetId:17,remainingHp:0,enemyKind:kind});
    }
  }
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
