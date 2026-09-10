import test from 'node:test';
import assert from 'node:assert/strict';
import { dungeonJourney } from '../src/dungeon-journey.ts';
import { createDungeonRun, emptyContents, freshExpeditions } from '../src/dungeon-state.ts';
import { dungeonChestMask, expeditionChoices, newExpeditionRoute } from '../src/expedition-route.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { DUNGEON_THEME_IDS, dungeonTheme } from '../src/dungeon-content.ts';
import { freshJourneys, guidedJourney } from '../src/journey-state.ts';

test('every wilderness and expedition theme guides toward its boss without a pinned journey', () => {
  for (const theme of DUNGEON_THEME_IDS) for (const expedition of [false,true]) {
    const entrance={...expeditionChoices(newExpeditionRoute(7319,20,1))[0],theme,...(!expedition?{expedition:undefined}:{})};
    const floor=generateDungeon(entrance.seed,entrance.level,entrance),run=createDungeonRun(entrance);
    const state={...freshExpeditions(),location:entrance.id,runs:[run],surface:emptyContents()};
    const before=structuredClone(state),goal=dungeonJourney(state,floor)!;
    assert.equal(goal.objective,`Defeat ${dungeonTheme(entrance.seed,theme).bossName??'Hollow Warden'}`);
    assert.equal(goal.phase,'boss');assert.ok(goal.marker);assert.equal(goal.marker.known,false);
    assert.equal(goal.stage,expedition?1:undefined);assert.deepEqual(state,before);
    // Room IDs vary with layout. No hard-coded boss room number.
    run.explored.push(floor.rooms.find(r=>r.kind==='boss')!.id);
    assert.deepEqual(dungeonJourney(state,floor)!.marker,{x:run.states.warden.x,y:run.states.warden.y,known:true,name:goal.objective});
  }
});

test('boss guidance advances to chest, waits for every reward, and then points to the exit', () => {
  const entrance=expeditionChoices({...newExpeditionRoute(10,20,1),cleared:9})[0];
  const floor=generateDungeon(entrance.seed,entrance.level,entrance),run=createDungeonRun(entrance);
  const state={...freshExpeditions(),location:entrance.id,runs:[run],surface:emptyContents()};
  run.states.warden.hp=0;run.chestMasks[2]=63;
  assert.equal(dungeonJourney(state,floor)!.phase,'chest');
  assert.equal(dungeonJourney(state,floor)!.marker!.x,floor.chests[2].x);
  run.chestMasks[2]=dungeonChestMask(run,2);
  assert.equal(dungeonJourney(state,floor)!.phase,'exit');
  assert.deepEqual(dungeonJourney(state,floor)!.marker,{...floor.exit,known:true,name:'Return to the surface'});
});

test('leaving a dungeon removes temporary guidance and preserves the outdoor pin', () => {
  const journeys=freshJourneys();
  journeys.townPin={id:'town:home',kind:'town',name:'Home',x:100,y:200,level:1,region:'Home'};
  const before=structuredClone(journeys),state=freshExpeditions();
  assert.equal(dungeonJourney(state,null),null);
  assert.deepEqual(journeys,before);assert.equal(guidedJourney(journeys)?.id,'town:home');
});
