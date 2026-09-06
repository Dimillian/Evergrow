import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { executeEvent } from '../src/poi-command.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { validEvents } from '../src/poi-validation.ts';
import { EVENT_RULES, blessingChoices, syncTrial, type EventSite } from '../src/poi-content.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { SAVE_MAX_BYTES } from '../src/character-save.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { Exploration } from '../src/exploration.ts';
import { World } from '../src/world.ts';
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const site = (kind: EventSite['kind'], id = 1): EventSite => ({ id: `site:7319:test-${id}`, kind, name: 'Test site', x: 0, y: 30, seed: id * 7319, biome: 'deadwood', level: 1 });
function setup(w = world) {
  const sim = new Simulation(w, { spawn: false, seed: 7319 });
  const data = new Map<string, string>();
  const repo = new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } });
  const session = new CharacterSession(repo, 7319, 4);
  assert.ok(session.create(0, 'Rowan', sim.captureCheckpoint(), 'test-character', 100));
  const persist = (c: ReturnType<Simulation['captureCheckpoint']>) => ({ ok: session.save(c, 200), message: session.error });
  return { sim, repo, session, persist };
}
function tick(sim: Simulation, seconds: number, input: Partial<Input> = {}) { for (let i = 0; i < Math.ceil(seconds / FIXED_STEP); i++)
  sim.update(FIXED_STEP, { ...idle, ...input }); }
test('caravan choices persist complete physical rewards once without touching wallet or healing', () => {
  const { sim, repo, persist } = setup();
  sim.player.hp = 31;
  sim.player.mana = 22;
  assert.ok(executeEvent(sim, site('caravan'), 'goods', persist).ok);
  assert.equal(sim.groundItems.length, 2);
  assert.equal(sim.player.character.gold, 0);
  assert.equal(sim.player.hp, 31);
  assert.equal(sim.player.mana, 22);
  const saved = repo.read(0).record!;
  assert.ok(saved);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(saved.checkpoint);
  assert.equal(executeEvent(resumed, site('caravan'), 'coin', persist).ok, false);
  assert.deepEqual(resumed.groundItems, sim.groundItems);
});
test('storage rejection leaves reward IDs, character, ledger and existing actors untouched', () => {
  const { sim } = setup();
  const enemy = sim.spawnEnemy('stalker', 200, 0)!;
  const before = sim.captureCheckpoint(), id = sim.nextEntityIdentity;
  const result = executeEvent(sim, site('caravan'), 'goods', () => ({ ok: false, message: 'Storage full' }));
  assert.equal(result.ok, false);
  assert.deepEqual(sim.captureCheckpoint(), before);
  assert.equal(sim.nextEntityIdentity, id);
  assert.equal(sim.enemies[0], enemy);
});
test('full ground stores a deterministic pending bundle and partial delivery never rerolls', () => {
  const { sim, persist, repo } = setup();
  sim.groundItems = Array.from({ length: 96 }, (_, i) => ({ id: 1000 + i, x: 500, y: 500, item: generateItem(i + 900, 1) }));
  // Restore establishes the shared identity allocator as in an actual saved full-ground run.
  sim.restoreCheckpoint(sim.captureCheckpoint());
  assert.ok(executeEvent(sim, site('caravan'), 'goods', persist).ok);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'completed');
  assert.equal(sim.groundItems.length, 96);
  const expected = eventRewards(sim.eventState.sites[site('caravan').id]).items;
  sim.groundItems.pop();
  assert.ok(executeEvent(sim, site('caravan'), 'goods', persist).ok);
  assert.deepEqual(sim.groundItems.at(-1)!.item, expected[0]);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(repo.read(0).record!.checkpoint);
  resumed.groundItems.shift();
  assert.ok(executeEvent(resumed, site('caravan'), 'goods', persist).ok);
  assert.deepEqual(resumed.groundItems.at(-1)!.item, expected[1]);
  assert.equal(resumed.eventState.sites[site('caravan').id].phase, 'claimed');
  assert.equal(new Set(resumed.groundItems.map(i => i.id)).size, 96);
});
test('full coin capacity retains value until a later interaction', () => {
  const { sim, persist } = setup();
  sim.groundGold = Array.from({ length: 128 }, (_, i) => ({ id: i + 1, x: 400, y: 400, amount: 1, age: 1 }));
  sim.restoreCheckpoint(sim.captureCheckpoint());
  assert.ok(executeEvent(sim, site('caravan'), 'coin', persist).ok);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'completed');
  sim.groundGold.pop();
  assert.ok(executeEvent(sim, site('caravan'), 'coin', persist).ok);
  assert.equal(sim.groundGold.length, 128);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'claimed');
});
test('camp reward reads the actual camp clear ledger and never adds a wave', () => {
  const { sim, persist } = setup();
  const camp = site('camp');
  assert.equal(executeEvent(sim, camp, null, persist).ok, false);
  const c = sim.captureCheckpoint();
  c.clearedCamps = [camp.id];
  sim.restoreCheckpoint(c);
  assert.ok(executeEvent(sim, camp, null, persist).ok);
  assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.groundGold.length, 1);
  assert.equal(sim.enemies.length, 0);
});
test('trial admission waits for camera coverage and budgets, then preserves source and injuries on reload', () => {
  const { sim, persist, repo } = setup();
  const grave = site('graveyard');
  assert.ok(executeEvent(sim, grave, null, persist).ok);
  tick(sim, 1);
  assert.equal(sim.enemies.length, 0);
  const view = { x: -900, y: -550, width: 1800, height: 1100 };
  sim.setSpawnExclusion(view);
  tick(sim, .6);
  assert.equal(sim.enemies.length, 3);
  assert.ok(sim.enemies.every(e => isSpawnHidden(e.x, e.y, view, e.radius)));
  assert.ok(sim.enemies.every(e => e.level === 1 && e.biome === 'deadwood'));
  const first = sim.enemies[0];
  first.hp = 3;
  first.state = 'dead';
  first.hp = 0;
  sim.enemies[1].hp = 4;
  assert.ok(persist(sim.captureCheckpoint()).ok);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(repo.read(0).record!.checkpoint);
  assert.equal(resumed.eventState.trial!.guardians[0].dead, true);
  assert.equal(resumed.eventState.trial!.guardians[1].hp, 4);
  resumed.setSpawnExclusion(view);
  tick(resumed, .6);
  assert.equal(resumed.enemies.length, 2);
  assert.ok(resumed.enemies.some(e => e.hp === 4));
  assert.equal(executeEvent(resumed, site('standingStones', 2), blessingChoices(site('standingStones', 2))[0], persist).ok, false);
});
test('a two-wave objective counts only defeated members and pays its bonus exactly once', () => {
  const { sim, persist } = setup();
  const grave = site('graveyard');
  assert.ok(executeEvent(sim, grave, null, persist).ok);
  const trial = sim.eventState.trial!;
  syncTrial(sim.eventState, []);
  assert.equal(sim.eventState.sites[grave.id].phase, 'active');
  for (const g of trial.guardians.slice(0, 3)) {
    g.admitted = true;
    g.dead = true;
    g.hp = 0;
  }
  syncTrial(sim.eventState, []);
  assert.equal(trial.wave, 1);
  assert.equal(sim.eventState.sites[grave.id].phase, 'active');
  for (const g of trial.guardians.slice(3)) {
    g.admitted = true;
    g.dead = true;
    g.hp = 0;
  }
  syncTrial(sim.eventState, []);
  assert.equal(sim.eventState.trial, null);
  assert.equal(sim.eventState.sites[grave.id].phase, 'completed');
  assert.ok(executeEvent(sim, grave, null, persist).ok);
  assert.equal(sim.player.xp, 10);
  assert.equal(sim.drainEvents().filter(e => e.type === 'experience').length, 1);
  assert.equal(executeEvent(sim, grave, null, persist).ok, false);
  assert.equal(sim.player.xp, 10);
});
test('blessings use shared stat derivation, expire in wilderness, pause in town and disappear on death', () => {
  const { sim } = setup({ ...world, isSanctuary: x => x > 1000 });
  sim.player.character.blessing = { kind: 'haste', remaining: 1 };
  refreshCharacter(sim.player);
  assert.equal(sim.player.stats.attackSpeedMultiplier, 1.15);
  assert.equal(sim.player.stats.castSpeedMultiplier, 1.15);
  sim.player.x = 1100;
  tick(sim, .5);
  assert.equal(sim.player.character.blessing.remaining, 1);
  sim.player.x = 0;
  tick(sim, 1.1);
  assert.equal(sim.player.character.blessing, undefined);
  assert.equal(sim.player.stats.attackSpeedMultiplier, 1);
  sim.player.character.blessing = { kind: 'wellspring', remaining: 90 };
  refreshCharacter(sim.player);
  assert.equal(sim.player.derived.manaCostMultiplier, .8);
  sim.player.dead = true;
  sim.player.hp = 0;
  sim.revive();
  assert.equal(sim.player.character.blessing, undefined);
});
test('event channels stop on movement, combat and input clearing', () => {
  const { sim } = setup();
  const beacon = site('watchtower');
  sim.eventChannel.start(beacon, null);
  tick(sim, .5);
  assert.equal(sim.eventChannel.ready, false);
  tick(sim, .02, { moveX: 1 });
  assert.equal(sim.eventChannel.site, null);
  sim.player.vx = 0;
  sim.eventChannel.start(beacon, null);
  sim.clearInput();
  assert.equal(sim.eventChannel.site, null);
  sim.eventChannel.start(beacon, null);
  tick(sim, .02, { attack: true });
  assert.equal(sim.eventChannel.site, null);
});
test('beacon terrain and sighted target replay without discovery spam or a path through fog', () => {
  const landmark = { id: 'site:target', name: 'Distant grave', kind: 'graveyard' as const, x: 2100, y: 0, description: 'A grave' };
  const notices: string[] = [];
  const exploration = new Exploration({ seed: 1, getPOIs: () => [landmark] }, { storage: null, onDiscover: p => notices.push(p.id) });
  exploration.revealFromBeacon(0, 0, landmark);
  assert.equal(exploration.isRevealed(900, 0), true);
  assert.equal(exploration.isRevealed(1500, 0), false);
  assert.equal(exploration.isRevealed(2100, 0), false);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, true);
  assert.equal(notices.length, 0);
  exploration.reveal(2100, 0, 50);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, undefined);
  assert.deepEqual(notices, [landmark.id]);
  exploration.revealFromBeacon(0, 0, landmark);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, undefined);
  const restored = new Exploration({ seed: 1, getPOIs: () => [] }, { storage: null });
  assert.ok(restored.restore(exploration.serialize()));
  exploration.dispose();
  restored.dispose();
});
test('event validation rejects forged completion, bad waves and invalid blessings without accepting partial state', () => {
  const { sim, persist } = setup();
  assert.ok(executeEvent(sim, site('graveyard'), null, persist).ok);
  assert.ok(validEvents(sim.eventState));
  for (const mutate of [(s: typeof sim.eventState) => { s.trial!.wave = 1; }, (s: typeof sim.eventState) => { s.sites[site('graveyard').id].phase = 'claimed'; }, (s: typeof sim.eventState) => { s.trial!.guardians[0].hp = 1e30; }]) {
    const clone = structuredClone(sim.eventState);
    mutate(clone);
    assert.equal(validEvents(clone), false);
  }
});
test('the bounded event ledger stays compact and rejects additional state without evicting claims', () => {
  const { sim, persist } = setup();
  for (let i = 0; i < EVENT_RULES.capacity; i++) {
    const s = site('watchtower', i + 1);
    sim.eventState.sites[s.id] = { ...s, phase: 'claimed', choice: null, delivered: 0, bonusGranted: true };
  }
  assert.ok(validEvents(sim.eventState));
  assert.ok(persist(sim.captureCheckpoint()).ok);
  assert.ok(JSON.stringify(sim.eventState).length < 100000);
  assert.ok(JSON.stringify(sim.captureCheckpoint()).length < SAVE_MAX_BYTES);
  assert.equal(executeEvent(sim, site('reliquary', 999), null, persist).ok, false);
  assert.equal(Object.keys(sim.eventState.sites).length, EVENT_RULES.capacity);
});
test('roadside reliquaries have deterministic separated safe approaches and are discoverable POIs', () => {
  const w = new World(74319);
  const sites = w.getEventSites(-4000, -6000, 8000, 12000).filter(s => s.kind === 'reliquary');
  assert.ok(sites.length > 0);
  assert.deepEqual(w.getEventSites(-4000, -6000, 8000, 12000).filter(s => s.kind === 'reliquary'), sites);
  for (const s of sites) {
    assert.equal(w.blocked(s.x, s.y, 25), false);
    assert.equal(w.isSanctuary(s.x, s.y), false);
    assert.ok(w.getPOIs(s.x - 1, s.y - 1, 2, 2).some(p => p.id === s.id));
    for (const other of sites)
      if (other !== s)
        assert.ok(Math.hypot(s.x - other.x, s.y - other.y) >= 450);
  }
});
test('trial actors wait for population room and suspend without rewarding or healing survivors', () => {
  const { sim, persist } = setup();
  const grave = site('graveyard');
  executeEvent(sim, grave, null, persist);
  const view = { x: -900, y: -550, width: 1800, height: 1100 };
  sim.setSpawnExclusion(view);
  for (let i = 0; i < ENCOUNTER_RULES.hardPopulationCap - 1; i++)
    sim.spawnEnemy('stalker', 2500 + i * 50, 0, 'normal', { campId: 'capacity-fixture', memberId: String(i), lootSeed: i });
  tick(sim, .6);
  assert.equal(sim.eventState.trial!.guardians.some(g => g.admitted), false);
  sim.enemies.length = 0;
  tick(sim, .6);
  assert.equal(sim.enemies.length, 3);
  sim.enemies[1].hp = 7;
  const xp = sim.player.xp, kills = sim.kills;
  sim.player.x = 4000;
  sim.setSpawnExclusion({ x: 3500, y: -400, width: 1000, height: 800 });
  tick(sim, .6);
  assert.equal(sim.enemies.length, 0);
  assert.equal(sim.eventState.trial!.guardians[1].hp, 7);
  assert.equal(sim.player.xp, xp);
  assert.equal(sim.kills, kills);
  sim.player.x = 0;
  sim.setSpawnExclusion(view);
  tick(sim, .6);
  assert.equal(sim.enemies.length, 3);
  assert.ok(sim.enemies.some(e => e.hp === 7));
});
test('landed enemy damage cancels an opening before it can award anything', () => {
  const { sim } = setup();
  const enemy = sim.spawnEnemy('stalker', 0, 25)!;
  enemy.state = 'windup';
  enemy.stateTime = 1;
  enemy.stateDuration = .1;
  enemy.attackAngle = -Math.PI / 2;
  enemy.attackTargetX = 0;
  enemy.attackTargetY = 0;
  sim.eventChannel.start(site('reliquary'), null);
  tick(sim, .1);
  assert.ok(sim.player.hp < sim.player.maxHp);
  assert.equal(sim.eventChannel.site, null);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.eventState.sites, {});
});
