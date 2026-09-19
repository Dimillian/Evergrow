import { EventArt } from '../src/poi-art.ts';
import { activityStatus } from '../src/activity-status.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { executeEvent } from '../src/poi-command.ts';
import { eventInteractionSites, focusEvent, freshEvents, type EventKind, type EventSite } from '../src/poi-content.ts';
import { eventRewardMask } from '../src/poi-rewards.ts';
import { journeyComplete, type JourneyFacts } from '../src/journey-director.ts';
import { GOLD_RULES } from '../src/gold.ts';
import { WorldMap } from '../src/world-map.ts';
import { drawMapPOIIcon, MAP_ICON_SIZES } from '../src/map-icon-art.ts';
import type { MapPOI } from '../src/exploration.ts';

const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const site = (kind: EventKind): EventSite => ({ id: `site:7319:completion-${kind}`, kind, name: kind, x: 0, y: 30, seed: 7319, biome: 'deadwood', level: 1 });
const persist = () => ({ ok: true, message: '' });

test('all claimed event families lose focus, including compacted claim receipts', () => {
  const kinds: EventKind[] = ['camp', 'caravan', 'watchtower', 'reliquary', 'graveyard', 'standingStones', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'bossLair'];
  for (const kind of kinds) {
    const s = site(kind), events = freshEvents(), player = { x: 0, y: 0, dead: false };
    if (kind !== 'bossLair') assert.equal(focusEvent(eventInteractionSites([s], events), player, world)?.id, s.id);
    events.sites[s.id] = { ...s, phase: 'claimed', choice: null, delivered: 0, wavesCleared: 0, bonusGranted: true };
    assert.equal(focusEvent(eventInteractionSites([s], events), player, world), undefined, kind);
    delete events.sites[s.id]; events.claimed = [s.id];
    assert.equal(focusEvent(eventInteractionSites([s], events), player, world), undefined, `${kind} compacted`);
  }
});

test('manual claims lose their interaction only after successful persistence and stay hidden on reload', async () => {
  for (const kind of ['camp', 'caravan', 'watchtower', 'reliquary'] as const) {
    const sim = new Simulation(world, { spawn: false }), s = site(kind);
    if (kind === 'camp') { const cp = sim.captureCheckpoint(); cp.clearedCamps = [s.id]; sim.restoreCheckpoint(cp); }
    const choice = kind === 'caravan' ? 'goods' : null;
    const focused = () => focusEvent(eventInteractionSites([s], sim.eventState), sim.player, world)?.id;
    assert.equal((await executeEvent(sim, s, choice, () => ({ ok: false, message: 'Disk full' }))).ok, false);
    assert.equal(focused(), s.id);
    assert.equal((await executeEvent(sim, s, choice, persist)).ok, true);
    assert.equal(focused(), undefined);
    const checkpoint = sim.captureCheckpoint();
    sim.restoreCheckpoint(checkpoint);
    assert.equal(focused(), undefined);
    assert.equal((await executeEvent(sim, s, choice, persist)).ok, false);
    assert.deepEqual(sim.captureCheckpoint(), checkpoint);
  }
});

test('camp map checks and Journey completion wait for the full durable strongbox reward', async () => {
  const sim = new Simulation(world, { spawn: false }), s = site('camp');
  const poi: MapPOI = { ...s, kind: 'camp', description: 'An enemy camp.' };
  const goal = { ...s, kind: 'camp' as const, region: 'Test region' };
  const facts = (): JourneyFacts => ({ events: sim.eventState, expeditions: sim.expeditions, x: 0, y: 0, level: 1, time: 0, discovered: () => true, campCleared: id => sim.getCampState(id) === 'cleared' });
  const map = Object.assign(Object.create(WorldMap.prototype), {
    activityStateReader: () => activityStatus(s, facts()),
  }) as { poiIcon(c: CanvasRenderingContext2D, poi: MapPOI, x: number, y: number, size: number, selected: boolean): void; poiLabel(poi: MapPOI): string };
  const check = (claimed: boolean, label: string) => {
    assert.equal(journeyComplete(goal, facts()), claimed);
    assert.equal(sim.journeys.completed?.includes(s.id) ?? false, claimed);
    assert.ok(map.poiLabel(poi).endsWith(label));
    for (const size of [MAP_ICON_SIZES.minimap, MAP_ICON_SIZES.map]) {
      let checkmark = false;
      const c = new Proxy({}, { get: (_, key) => key === 'moveTo'
        ? (x: number, y: number) => { if (x === size * .35 && y === size * .45) checkmark = true; }
        : () => {} }) as CanvasRenderingContext2D;
      map.poiIcon(c, poi, 0, 0, size, false);
      assert.equal(checkmark, claimed, `map size ${size}`);
    }
    assert.equal(!!focusEvent(eventInteractionSites([s], sim.eventState), sim.player, world), !claimed);
  };
  const cp = sim.captureCheckpoint(); cp.clearedCamps = [s.id]; sim.restoreCheckpoint(cp);
  check(false, 'Open strongbox');
  assert.equal((await executeEvent(sim, s, null, () => ({ ok: false, message: 'Disk full' }))).ok, false);
  check(false, 'Open strongbox');
  sim.groundGold = Array.from({ length: GOLD_RULES.maxPiles }, (_, i) => ({ id: 1000 + i, x: 400, y: 400, amount: 1, age: 0 }));
  sim.restoreCheckpoint(sim.captureCheckpoint());
  assert.equal((await executeEvent(sim, s, null, persist)).ok, true);
  assert.equal(sim.eventState.sites[s.id].phase, 'completed');
  check(false, 'Reward waiting');
  sim.restoreCheckpoint(sim.captureCheckpoint());
  check(false, 'Reward waiting');
  sim.groundGold.pop();
  assert.equal((await executeEvent(sim, s, null, persist)).ok, true);
  assert.equal(sim.eventState.sites[s.id].delivered, eventRewardMask(sim.eventState.sites[s.id]));
  assert.ok(sim.groundItems.length > 0, 'completion does not require picking up dropped items');
  check(true, 'Claimed');
  sim.restoreCheckpoint(sim.captureCheckpoint());
  check(true, 'Claimed');
  sim.eventState.claimed = [s.id]; delete sim.eventState.sites[s.id];
  check(true, 'Claimed');
});

test('every overworld event shares reward-gated map status and Journey completion', () => {
  const kinds: EventKind[] = ['camp', 'caravan', 'watchtower', 'reliquary', 'graveyard', 'standingStones', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'bossLair'];
  for (const kind of kinds) {
    const s = site(kind), sim = new Simulation(world, { spawn: false });
    const facts: JourneyFacts = { events: sim.eventState, expeditions: sim.expeditions, x: 0, y: 0, level: 1, time: 0, discovered: () => true, campCleared: () => true };
    const goal = { ...s, region: 'Test region' };
    for (const phase of ['active', 'paused', 'completed', 'claimed'] as const) {
      sim.eventState.sites[s.id] = { ...s, phase, choice: null, delivered: phase === 'completed' ? 1 : 0, wavesCleared: 1, bonusGranted: phase === 'claimed' };
      const status = activityStatus(s, facts)!;
      assert.equal(status.rewardsClaimed, phase === 'claimed', `${kind}: ${phase}`);
      assert.equal(journeyComplete(goal, facts), phase === 'claimed', `${kind}: ${phase}`);
      if (phase === 'completed') assert.equal(status.label, 'Reward waiting', kind);
    }
    delete sim.eventState.sites[s.id]; sim.eventState.claimed = [s.id];
    assert.equal(activityStatus(s, facts)?.rewardsClaimed, true, `${kind}: compacted`);
    assert.equal(journeyComplete(goal, facts), true, `${kind}: compacted`);
  }
});


test('finishing combat does not open event chests before durable reward delivery', () => {
  const art = new EventArt();
  let open = false;
  art.chests.draw = (_c, _id, _x, _y, value) => { open = value; };
  const c = {} as CanvasRenderingContext2D;
  for (const kind of ['camp', 'caravan', 'reliquary', 'graveyard', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'bossLair'] as const) {
    const s = site(kind);
    art.draw(c, s, { phase: 'completed', delivered: 0, bonusGranted: false }, 0, 0, true);
    assert.equal(open, false, kind);
    art.draw(c, s, { phase: 'completed', delivered: 1, bonusGranted: true }, 0, 0, true);
    assert.equal(open, true, `${kind}: partial delivery`);
    art.draw(c, s, { phase: 'claimed' }, 0, 0, true);
    assert.equal(open, true, `${kind}: claimed`);
  }
});


test('every claimed event and dungeon icon keeps its completion check at all map sizes, including hover', () => {
  const kinds = ['camp', 'caravan', 'watchtower', 'reliquary', 'graveyard', 'standingStones', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'bossLair', 'dungeon'] as const;
  for (const kind of kinds) for (const size of Object.values(MAP_ICON_SIZES)) for (const selected of [false, true]) for (const claimed of [false, true]) {
    let checkmark = false;
    const c = new Proxy({}, { get: (_, key) => key === 'moveTo'
      ? (x: number, y: number) => { if (x === size * .35 && y === size * .45) checkmark = true; }
      : () => {} }) as CanvasRenderingContext2D;
    drawMapPOIIcon(c, kind, 0, 0, size, selected, claimed);
    assert.equal(checkmark, claimed, `${kind}: size ${size}, hovered ${selected}, claimed ${claimed}`);
  }
});
