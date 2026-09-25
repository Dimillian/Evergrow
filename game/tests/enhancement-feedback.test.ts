import assert from 'node:assert/strict';
import test from 'node:test';
import { ENHANCEMENT_CHARGE_MS, ENHANCEMENT_SKIP_KEY, EnhancementPreference, EnhancementSequence, type EnhancementResult } from '../src/enhancement-feedback.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  let finish: (() => void) | null = null;
  const phases: string[] = [];
  const sequence = new EnhancementSequence((done, ms) => {
    assert.equal(ms, ENHANCEMENT_CHARGE_MS);
    finish = done;
    return () => { finish = null; };
  });
  return { sequence, phases, phase: (value: string) => phases.push(value), finish: () => finish?.(), pending: () => !!finish };
}
const success = { ok: true, message: 'Enhanced.' };

test('only the final charge tick starts the purchase; repeated confirmation cannot commit twice', async () => {
  const f = fixture();
  let calls = 0;
  const commit = async () => { calls++; return success; };
  const running = f.sequence.run(commit, true, f.phase);
  assert.equal(await f.sequence.run(commit, true, f.phase), null);
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.deepEqual(f.phases, ['charging']);
  f.finish();
  assert.deepEqual(await running, success);
  assert.equal(calls, 1);
  assert.deepEqual(f.phases, ['charging', 'saving']);
  assert.equal(f.pending(), false);
});

test('cancel before the final tick leaves item and gold untouched and allows another attempt', async () => {
  const f = fixture(), wallet = { gold: 200 }, item = { rank: 0 };
  const commit = async () => { wallet.gold -= 50; item.rank++; return success; };
  const running = f.sequence.run(commit, true, f.phase);
  assert.equal(f.sequence.cancel(), true);
  f.finish();
  assert.equal(await running, null);
  assert.deepEqual(wallet, { gold: 200 });
  assert.deepEqual(item, { rank: 0 });
  assert.equal(f.pending(), false);
  const retry = f.sequence.run(commit, true, f.phase);
  f.finish();
  assert.deepEqual(await retry, success);
  assert.deepEqual(wallet, { gold: 150 });
  assert.deepEqual(item, { rank: 1 });
});

test('a full charge waits for persistence before revealing success and cannot cancel a started save', async () => {
  const f = fixture(), save = deferred<EnhancementResult>();
  let revealed = false;
  const running = f.sequence.run(() => save.promise, true, f.phase).then(result => { revealed = true; return result; });
  f.finish();
  await Promise.resolve();
  assert.equal(revealed, false);
  assert.equal(f.sequence.cancel(), false);
  assert.deepEqual(f.phases, ['charging', 'saving']);
  save.resolve(success);
  assert.deepEqual(await running, success);
});

test('skip finishes the charge once but never bypasses persistence', async () => {
  const f = fixture(), save = deferred<EnhancementResult>();
  let revealed = false, calls = 0;
  const running = f.sequence.run(() => { calls++; return save.promise; }, true, f.phase).then(result => { revealed = true; return result; });
  f.sequence.skip(); f.sequence.skip();
  assert.equal(f.pending(), false);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(revealed, false);
  save.resolve(success);
  assert.deepEqual(await running, success);
});

test('a rejected or thrown save produces no success, and subsequent attempts remain available', async () => {
  const f = fixture(), failure = { ok: false, message: 'Save conflict.' };
  const running = f.sequence.run(async () => failure, true, f.phase);
  f.finish();
  assert.deepEqual(await running, failure);
  const throwing = f.sequence.run(async () => { throw new Error('disk'); }, true, f.phase);
  f.finish();
  const thrown = await throwing;
  assert.equal(thrown?.ok, false);
  assert.match(thrown!.message, /No purchase was committed/);
  assert.equal(f.pending(), false);
});

test('closing during charge cancels without starting any purchase', async () => {
  const f = fixture();
  let calls = 0;
  const running = f.sequence.run(async () => { calls++; return success; }, true, f.phase);
  f.sequence.dispose();
  assert.equal(await running, null);
  assert.equal(calls, 0);
  assert.equal(f.pending(), false);
});

test('closing after the final tick suppresses an old saved result without disturbing the reopened charge', async () => {
  const f = fixture(), oldSave = deferred<EnhancementResult>();
  const old = f.sequence.run(() => oldSave.promise, true, f.phase);
  f.finish();
  await Promise.resolve();
  f.sequence.dispose();
  const next = f.sequence.run(async () => success, true, f.phase);
  oldSave.resolve(success);
  assert.equal(await old, null);
  assert.equal(f.pending(), true);
  f.finish();
  assert.deepEqual(await next, success);
  assert.equal(f.pending(), false);
});

test('skip preference and reduced motion can use the no-timer path', async () => {
  const f = fixture();
  assert.deepEqual(await f.sequence.run(async () => success, false, f.phase), success);
  assert.equal(f.pending(), false);
  assert.deepEqual(f.phases, ['saving']);
});

test('skip preference survives a new instance without touching character data', () => {
  const data = new Map([['character', 'untouched']]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const first = new EnhancementPreference(storage);
  assert.equal(first.skip, false);
  assert.equal(first.setSkip(true), true);
  assert.equal(new EnhancementPreference(storage).skip, true);
  first.setSkip(false);
  assert.equal(new EnhancementPreference(storage).skip, false);
  data.set(ENHANCEMENT_SKIP_KEY, 'garbage');
  assert.equal(new EnhancementPreference(storage).skip, false);
  assert.equal(data.get('character'), 'untouched');
  const blocked = new EnhancementPreference({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  assert.equal(blocked.setSkip(true), false);
  assert.equal(blocked.skip, true);
  const review = new EnhancementPreference();
  assert.equal(review.setSkip(true), false);
  assert.equal(review.skip, true);
});
