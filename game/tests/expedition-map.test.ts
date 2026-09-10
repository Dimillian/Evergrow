import test from 'node:test';
import assert from 'node:assert/strict';
import { expeditionMap } from '../src/expedition-map.ts';
import { newExpeditionRoute, expeditionChoices } from '../src/expedition-route.ts';
import { createDungeonRun } from '../src/dungeon-state.ts';

test('the revealed map contains only cleared stages and the real current choices', () => {
  for(let stage=0;stage<10;stage++){
    const route={...newExpeditionRoute(7319,24,1),cleared:stage};
    const before=structuredClone(route), map=expeditionMap(route,[]);
    assert.equal(map.length,stage+1);
    assert.ok(map.flat().every(n=>n.stage<=stage));
    assert.deepEqual(map.at(-1)!.map(n=>n.entry),expeditionChoices(route));
    assert.ok(map.slice(0,-1).flat().every(n=>n.state==='cleared'&&!n.entry));
    assert.deepEqual(route,before);
    assert.ok(map.flat().every(n=>n.x>100&&n.x<500&&n.y>=180));
  }
});

test('completed forks show only their saved branch, while a committed choice cannot change', () => {
  const route=newExpeditionRoute(7319,24,1), choices=expeditionChoices(route);
  assert.equal(choices.length,2);
  const chosen=createDungeonRun(choices[1]);
  const past=expeditionMap({...route,cleared:1},[chosen])[0];
  assert.equal(past.length,1);assert.equal(past[0].entry!.id,chosen.entrance.id);
  const current=expeditionMap({...route,choice:1},[])[0];
  assert.equal(current[0].state,'skipped');assert.equal(current[1].state,'available');
  assert.ok(expeditionMap({...route,attempt:2,cleared:1},[chosen])[0].every(n=>!n.entry));
});
