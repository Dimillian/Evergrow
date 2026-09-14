import test from 'node:test';
import assert from 'node:assert/strict';
import { TooltipMotion, TOOLTIP_MOTION } from '../src/ui-tooltip-motion.ts';

test('tooltip exit retains content then settles without an ongoing animation', () => {
  const motion = new TooltipMotion();
  motion.set('sword', 0);
  assert.equal(motion.sample(0).opacity, 0);
  assert.equal(motion.sample(TOOLTIP_MOTION.enter).opacity, 1);
  motion.set(null, 200);
  assert.equal(motion.sample(240).id, 'sword');
  assert.ok(motion.sample(240).opacity > 0 && motion.sample(240).opacity < 1);
  assert.deepEqual(motion.sample(320), { id: null, opacity: 0, lift: 4, active: false });
});

test('rapid hover reversal preserves opacity and transfers to the newest item', () => {
  const motion = new TooltipMotion();
  motion.set('sword', 0);
  const entering = motion.sample(50).opacity;
  motion.set(null, 50);
  assert.equal(motion.sample(50).opacity, entering);
  const exiting = motion.sample(80).opacity;
  motion.set('shield', 80);
  assert.equal(motion.sample(80).opacity, exiting);
  assert.equal(motion.sample(80).id, 'shield');
  assert.equal(motion.sample(240).opacity, 1);
  motion.set('ring', 250);
  assert.equal(motion.sample(250).opacity, 1);
  assert.equal(motion.sample(250).active, false);
});

test('reduced motion and disposal settle immediately without stale content', () => {
  const motion = new TooltipMotion();
  motion.set('ring', 0, true);
  assert.equal(motion.sample(0).opacity, 1);
  motion.set(null, 1, true);
  assert.equal(motion.sample(1).id, null);
  assert.equal(motion.sample(1).active, false);
  motion.set('sword', 10); motion.reset();
  assert.equal(motion.sample(20).id, null);
  assert.equal(motion.sample(20).active, false);
});

test('node dwell suppresses cards until 350 ms, including with reduced motion', () => {
  for (const reduced of [false, true]) {
    const motion = new TooltipMotion();
    motion.set('node-a', 0, reduced, 350);
    for (const time of [0, 100, 349]) {
      assert.equal(motion.sample(time).id, null);
      assert.equal(motion.sample(time).active, true, 'pending intent keeps the display loop alive');
    }
    assert.equal(motion.sample(350).id, 'node-a');
    assert.equal(motion.sample(350).opacity, reduced ? 1 : 0);
    assert.equal(motion.sample(510).opacity, 1);
  }
});

test('changing nodes requires fresh dwell and navigation cancels pending or visible cards', () => {
  const motion = new TooltipMotion();
  motion.set('node-a', 0, false, 350);
  motion.reset(); motion.set('node-b', 200, false, 350);
  assert.equal(motion.sample(400).id, null, 'crossing a cluster never opens the previous node');
  assert.equal(motion.sample(550).id, 'node-b');
  motion.reset(); motion.set('node-c', 600, false, 350);
  assert.equal(motion.sample(949).id, null, 'an already-open tooltip does not skip the next dwell');
  motion.reset();
  assert.equal(motion.sample(1200).id, null, 'leaving, panning, zooming or closing cancels pending reveal');
  assert.equal(motion.sample(1200).active, false);
  motion.set('node-d', 1300, true, 350);
  assert.equal(motion.sample(1650).id, 'node-d');
  motion.reset();
  assert.equal(motion.sample(1650).id, null, 'navigation dismisses visible cards immediately');
});
