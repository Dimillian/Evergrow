import assert from 'node:assert/strict';
import test from 'node:test';
import { Lifetime } from '../src/lifetime.ts';

test('resource owners dispose once in reverse construction order, including partial startup', () => {
  const lifetime = new Lifetime(), order: string[] = [];
  const own = (name: string) => lifetime.own({ dispose() { order.push(name); } });
  own('world'); own('exploration'); own('map');
  try { throw new Error('display initialization failed'); } catch { lifetime.dispose(); }
  lifetime.dispose();
  assert.deepEqual(order, ['map', 'exploration', 'world']);
});

test('one failing cleanup cannot leak other owned resources', () => {
  const lifetime = new Lifetime(), order: number[] = [];
  lifetime.defer(() => order.push(1));
  lifetime.defer(() => { order.push(2); throw new Error('failed'); });
  lifetime.defer(() => order.push(3));
  assert.throws(() => lifetime.dispose(), AggregateError);
  assert.deepEqual(order, [3, 2, 1]);
  assert.doesNotThrow(() => lifetime.dispose());
});

test('a resource registered after teardown is released immediately', () => {
  const lifetime = new Lifetime(); lifetime.dispose();
  let released = false;
  lifetime.own({ dispose() { released = true; } });
  assert.equal(released, true);
});
