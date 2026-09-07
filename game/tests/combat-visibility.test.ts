import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyInCombatViewport } from '../src/combat-visibility.ts';

test('combat visibility uses the rendered body at each viewport edge without spawn padding', () => {
  const view = { x: 0, y: 0, width: 200, height: 100 };
  const body = { kind: 'stalker' as const, x: 100, y: 50 };
  assert.equal(enemyInCombatViewport(body, null), false);
  for (const [x, y] of [[-15, 50], [215, 50], [100, -4], [100, 144]])
    assert.equal(enemyInCombatViewport({ ...body, x, y }, view), false);
  for (const [x, y] of [[-13, 50], [213, 50], [100, -2], [100, 142]])
    assert.equal(enemyInCombatViewport({ ...body, x, y }, view), true, 'partly visible bodies remain targetable');
});
