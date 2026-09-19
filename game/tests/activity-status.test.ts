import { dungeonInteractionChests } from '../src/dungeon-locations.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { activityStatus } from '../src/activity-status.ts';
import { freshEvents } from '../src/poi-content.ts';
import { createDungeonRun, freshExpeditions } from '../src/dungeon-state.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { dungeonChestMask } from '../src/expedition-route.ts';
import { dungeonEventLabel } from '../src/dungeon-prop-art.ts';
import { journeyComplete, type JourneyFacts } from '../src/journey-director.ts';
import { MAP_LEGEND_GROUPS, MapIconVisibility } from '../src/map-legend-content.ts';
const css = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); } });
const { drawDungeonMap } = await import('../src/dungeon-map.ts');
css.deregister();
const entrance = { id: 'dungeon:claim-status', name: 'Test dungeon', seed: 7319, level: 30, biome: 'deadwood' as const, x: 0, y: 0 };

test('dungeon entrances and Journeys distinguish boss victory, partial delivery and full claims', () => {
  for (const extra of [{}, { expedition: { attempt: 1, stage: 0, choice: 0, modifier: 'peril' as const } }, { expedition: { attempt: 1, stage: 9, choice: 0, modifier: 'peril' as const } }, { rift: { attempt: 1 } }]) {
    const run = createDungeonRun({ ...entrance, ...extra }), expeditions = freshExpeditions(); expeditions.runs = [run];
    const facts: JourneyFacts = { events: freshEvents(), expeditions, campCleared: () => false, discovered: () => true, x: 0, y: 0, level: 30, time: 0 };
    const goal = { ...entrance, kind: 'dungeon' as const, region: 'Test region' };
    assert.deepEqual(activityStatus(goal, facts), { label: 'Expedition active', rewardsClaimed: false });
    run.states.warden.hp = 0;
    const full = dungeonChestMask(run, 2);
    for (const mask of [0, 1, full - 1]) {
      run.chestMasks[2] = mask;
      assert.deepEqual(activityStatus(goal, facts), { label: 'Reward waiting', rewardsClaimed: false });
      assert.equal(journeyComplete(goal, facts), false);
    }
    run.chestMasks[2] = full;
    assert.deepEqual(activityStatus(goal, facts), { label: 'Claimed', rewardsClaimed: true });
    assert.equal(journeyComplete(goal, facts), true);
    assert.deepEqual(activityStatus(goal, { ...facts, expeditions: structuredClone(expeditions) }), { label: 'Claimed', rewardsClaimed: true });
  }
});

test('retired dungeon receipts preserve claimed map status', () => {
  const facts = { events: freshEvents(), expeditions: freshExpeditions(), campCleared: () => false };
  const source = { ...entrance, kind: 'dungeon' };
  assert.equal(activityStatus(source, facts), null);
  facts.expeditions.cleared = [entrance.id];
  assert.deepEqual(activityStatus(source, facts), { label: 'Claimed', rewardsClaimed: true });
});

test('all dungeon chamber map markers and labels wait for their own full chest claim', () => {
  const witnessed = new Set<string>();
  for (const seed of [7317, 7318, 7319]) {
    const floor = generateDungeon(seed, 30), run = createDungeonRun({ ...entrance, seed });
    run.explored = floor.rooms.map(room => room.id);
    for (const event of floor.events ?? []) {
      witnessed.add(event.kind);
      run.events![event.id].finished = true;
      const visibility = new MapIconVisibility();
      visibility.set(MAP_LEGEND_GROUPS.flatMap(group => group.entries.map(entry => entry.id)), false);
      visibility.set([`dungeon:${event.kind}`], true);
      const full = dungeonChestMask(run, event.chest);
      for (const mask of [0, 1, full]) {
        run.chestMasks[event.chest] = mask;
        assert.equal(dungeonEventLabel(run, event), mask === full ? 'Claimed' : 'Reward waiting');
        let muted = 0;
        const c = new Proxy({}, { get: () => () => {}, set: (_, key, value) => { if (key === 'fillStyle' && value === '#688879') muted++; return true; } }) as CanvasRenderingContext2D;
        drawDungeonMap(c, { ...floor, events: [event] }, run, { x: 0, y: 0, angle: 0 }, { x: 0, y: 0, width: 800, height: 600 }, .1, 0, 0, null, false, [], visibility);
        assert.equal(muted > 0, mask === full, `${event.kind}: ${mask}`);
      }
    }
  }
  assert.equal(witnessed.size, 3);
});


test('dungeon chest prompt and input targets retain pending rewards and exclude full claims', () => {
  const floor = generateDungeon(entrance.seed, entrance.level);
  for (const extra of [{}, { rift: { attempt: 1 } }]) {
    const run = createDungeonRun({ ...entrance, ...extra });
    if (run.rift) {
      assert.deepEqual(dungeonInteractionChests(floor, run), []);
      run.rift.phase = 'complete'; run.rift.treasure = { x: 123, y: 456 };
    }
    const indices = run.rift ? [2] : [0, 1, 2];
    for (const index of indices) {
      const full = dungeonChestMask(run, index);
      for (const mask of [0, 1, full - 1]) {
        run.chestMasks[index] = mask;
        const target = dungeonInteractionChests(floor, run).find(chest => chest.index === index);
        assert.ok(target);
        if (run.rift) assert.deepEqual({ x: target.x, y: target.y }, run.rift.treasure);
      }
      run.chestMasks[index] = full;
      assert.ok(!dungeonInteractionChests(floor, run).some(chest => chest.index === index));
      assert.ok(!dungeonInteractionChests(floor, structuredClone(run)).some(chest => chest.index === index));
    }
    assert.deepEqual(dungeonInteractionChests(floor, run), []);
  }
});
