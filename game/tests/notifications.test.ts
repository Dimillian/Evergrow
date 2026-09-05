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

test('distinct common and magic pickups retain their names, tiers and order', () => {
  const queue = new NotificationQueue(2);
  const items = ['common', 'magic', 'common'].map((tier, index) => generateItem(800 + index, 3, 'boots', undefined, tier as 'common' | 'magic'));
  for (const item of items) queue.push({ kind: 'loot', item });
  assert.equal(queue.visible.length, 2); assert.equal(queue.pendingCount, 1);
  assert.deepEqual(queue.visible.map(entry => entry.notice), items.slice(0, 2).map(item => ({ kind: 'loot', item })));
  queue.advance(4);
  assert.deepEqual(queue.visible[0].notice, { kind: 'loot', item: items[2] });
});

test('gold and XP accumulate independently in one card, renew its lifetime and reset only after it disappears', () => {
  const queue = new NotificationQueue(2);
  queue.push({ kind: 'rewards', gold: 7, xp: 0 });
  const id = queue.visible[0].id;
  queue.advance(2);
  queue.push({ kind: 'rewards', gold: 0, xp: 20 });
  queue.push({ kind: 'rewards', gold: 11, xp: 40 });
  assert.equal(queue.visible.length, 1); assert.equal(queue.visible[0].id, id);
  assert.equal(queue.visible[0].age, 0);
  assert.deepEqual(queue.visible[0].notice, { kind: 'rewards', gold: 18, xp: 60 });
  queue.advance(queue.visible[0].duration + NOTICE_EXIT_SECONDS / 2);
  queue.push({ kind: 'rewards', gold: 2, xp: 5 });
  assert.equal(queue.visible[0].id, id, 'a fading card still receives gains until removed');
  assert.deepEqual(queue.visible[0].notice, { kind: 'rewards', gold: 20, xp: 65 });
  queue.advance(4); assert.ok(queue.idle);
  queue.push({ kind: 'rewards', gold: 3, xp: 0 });
  assert.notEqual(queue.visible[0].id, id);
  assert.deepEqual(queue.visible[0].notice, { kind: 'rewards', gold: 3, xp: 0 });
});

test('queued reward totals accumulate while items keep their own notices and a visible feed slot', () => {
  const queue = new NotificationQueue(2);
  const items = [generateItem(505, 1), generateItem(506, 1)];
  for (const item of items) queue.push({ kind: 'loot', item });
  for (let i = 0; i < 100; i++) queue.push({ kind: 'rewards', gold: 4, xp: 20 });
  assert.equal(queue.pendingCount, 1);
  assert.deepEqual(queue.visible.map(e => e.notice), items.map(item => ({ kind: 'loot', item })));
  queue.advance(4);
  assert.deepEqual(queue.visible[0].notice, { kind: 'rewards', gold: 400, xp: 2000 });
  queue.push({ kind: 'loot', item: generateItem(507, 1) });
  assert.equal(queue.visible.length, 2); assert.equal(queue.visible[1].notice.kind, 'loot');
  queue.clear(); queue.push({ kind: 'rewards', gold: 1, xp: 1 });
  assert.deepEqual(queue.visible[0].notice, { kind: 'rewards', gold: 1, xp: 1 });
});
