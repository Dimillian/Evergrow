import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationQueue, AreaNoticeTracker, NOTICE_EXIT_SECONDS } from '../src/notification-queue.ts';
import { generateItem } from '../src/items.ts';

test('loot bursts queue independently, preserve item identity and wait through the exit animation', () => {
  const queue = new NotificationQueue(3);
  const items = Array.from({ length: 8 }, (_, seed) => generateItem(seed, 4));
  for (const item of items) queue.push({ kind: 'loot', item });
  assert.equal(queue.visible.length, 3); assert.equal(queue.pendingCount, 5);
  assert.deepEqual(queue.visible.map(entry => entry.notice.kind === 'loot' && entry.notice.item.id), items.slice(0, 3).map(item => item.id));
  queue.advance(3.6); assert.equal(queue.visible.length, 3); assert.equal(queue.pendingCount, 5);
  queue.advance(NOTICE_EXIT_SECONDS + .001);
  assert.deepEqual(queue.visible.map(entry => entry.notice.kind === 'loot' && entry.notice.item.id), items.slice(3, 6).map(item => item.id));
  queue.clear(); assert.ok(queue.idle);
});

test('multi-level rewards combine exact earned points and repeated warnings do not stack', () => {
  const queue = new NotificationQueue(1);
  queue.push({ kind: 'level', level: 2, skillPoints: 1, statPoints: 5 }); queue.advance(2);
  queue.push({ kind: 'level', level: 5, skillPoints: 3, statPoints: 15 });
  assert.equal(queue.visible.length, 1); assert.equal(queue.visible[0].age, 0);
  assert.deepEqual(queue.visible[0].notice, { kind: 'level', level: 5, skillPoints: 4, statPoints: 20 });
  queue.clear(); queue.push({ kind: 'info', message: 'Inventory full' }); queue.advance(2);
  queue.push({ kind: 'info', message: 'Inventory full' });
  assert.equal(queue.visible.length, 1); assert.equal(queue.pendingCount, 0); assert.equal(queue.visible[0].age, 0);
});

test('pending messages stay bounded and level-ups take priority over discovery backlogs', () => {
  const queue = new NotificationQueue(1);
  queue.push({ kind: 'area', id: 'a', name: 'A', level: 1 });
  for (let i = 0; i < 40; i++) queue.push({ kind: 'area', id: `b${i}`, name: `B${i}`, level: 1 });
  queue.push({ kind: 'level', level: 2, skillPoints: 1, statPoints: 5 });
  assert.equal(queue.pendingCount, 24);
  queue.advance(5); assert.equal(queue.visible[0].notice.kind, 'level');
  queue.advance(NaN); assert.equal(queue.visible[0].age, 0);
  queue.clear(); assert.equal(queue.visible.length, 0); assert.equal(queue.pendingCount, 0);
});

test('biome borders require sustained entry and continuing does not announce the starting biome', () => {
  const tracker = new AreaNoticeTracker(); tracker.reset('deadwood');
  assert.equal(tracker.update('deadwood', 10), false);
  assert.equal(tracker.update('swamp', 1), false);
  assert.equal(tracker.update('deadwood', .5), false);
  assert.equal(tracker.update('swamp', 1), false);
  assert.equal(tracker.update('swamp', .7), true);
  assert.equal(tracker.update('swamp', 10), false);
  assert.equal(tracker.update('deadwood', 2), true);
  assert.equal(tracker.update('swamp', 2), false, 'a recently announced boundary has a cooldown');
  tracker.reset('swamp'); assert.equal(tracker.update('swamp', 100), false);
});

test('routine pickup counts merge instead of filling the feed with individual common items', () => {
  const queue = new NotificationQueue(2);
  for (let i = 0; i < 12; i++) queue.push({ kind: 'lootSummary', count: 1 });
  assert.equal(queue.visible.length, 1); assert.equal(queue.pendingCount, 0);
  assert.deepEqual(queue.visible[0].notice, { kind: 'lootSummary', count: 12 });
});
