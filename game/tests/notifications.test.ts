import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationQueue, AreaNoticeTracker, NOTICE_EXIT_SECONDS } from '../src/notification-queue.ts';
import { generateItem } from '../src/items.ts';
import { createCharacterSheet } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { equipBest } from '../src/inventory-tools.ts';

test('Auto Equip feedback appears immediately during a loot burst and displaced pickups resume', () => {
  const queue = new NotificationQueue(2), sheet = createCharacterSheet();
  const items = Array.from({ length: 4 }, (_, i) => generateItem(9900 + i, 1, 'boots', undefined, 'rare'));
  for (const item of items) queue.push({ kind: 'loot', item });
  addInventoryItem(sheet, items[0]);
  const result = equipBest(sheet, 1);
  assert.equal(result.ok, true);
  assert.equal(result.message, 'Auto Equip: upgraded 1 equipment slot.');
  queue.push({ kind: 'info', message: result.message! });
  assert.deepEqual(queue.visible.at(-1)?.notice, { kind: 'info', message: result.message });
  assert.equal(queue.visible.length, 2);
  queue.advance(3.1);
  assert.deepEqual(queue.visible.map(entry => entry.notice), items.slice(0, 2).map(item => ({ kind: 'loot', item })));
  assert.equal(queue.pendingCount, 2, 'remaining pickups are still queued');
});

test('repeated Auto Equip reports no upgrade immediately without queuing stale action results', () => {
  const queue = new NotificationQueue(2);
  queue.push({ kind: 'info', message: 'Auto Equip: upgraded 2 equipment slots.' });
  const result = equipBest(createCharacterSheet(), 1);
  assert.equal(result.ok, false);
  assert.equal(result.message, 'No equipment upgrades available.');
  const notice = { kind: 'info' as const, message: result.message! };
  queue.push(notice); queue.advance(1); queue.push(notice);
  assert.deepEqual(queue.visible.map(entry => entry.notice), [notice]);
  assert.equal(queue.visible[0].age, 0);
  assert.equal(queue.pendingCount, 0);
});

test('action feedback stays last for the mobile feed when new pickups arrive or are promoted', () => {
  const queue = new NotificationQueue(2);
  const first = { kind: 'loot' as const, item: generateItem(9990, 1) };
  const second = { kind: 'loot' as const, item: generateItem(9991, 1) };
  const feedback = { kind: 'info' as const, message: 'Auto Equip: upgraded 1 equipment slot.' };
  queue.push(first); queue.advance(3); queue.push(feedback); queue.push(second);
  assert.equal(queue.visible.at(-1)?.notice, feedback);
  queue.advance(1);
  assert.deepEqual(queue.visible.map(entry => entry.notice), [second, feedback]);
  queue.push(feedback);
  assert.equal(queue.visible.at(-1)?.notice, feedback);
});

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

test('duplicate warnings renew and queued notices stay bounded', () => {
  const queue = new NotificationQueue(1);
  queue.push({ kind: 'info', message: 'Inventory full' }); queue.advance(2);
  queue.push({ kind: 'info', message: 'Inventory full' });
  assert.equal(queue.visible.length, 1); assert.equal(queue.pendingCount, 0); assert.equal(queue.visible[0].age, 0);
  for (let i = 0; i < 40; i++) queue.push({ kind: 'area', id: `b${i}`, name: `B${i}`, level: 1 });
  assert.equal(queue.pendingCount, 24);
  queue.advance(5); assert.equal(queue.visible[0].notice.kind, 'area');
  queue.clear(); assert.ok(queue.idle);
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
