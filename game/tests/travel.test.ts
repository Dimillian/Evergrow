import { getZoneAt } from '../src/zone-progression.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { World } from '../src/world.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { type TravelState, freshTravel, portalLanding, portalMapMarkers, townPortalAnchor, validTravel } from '../src/travel.ts';
import { executePortalTravel, activatePortalAnchor } from '../src/travel-command.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { getPortalControlRect } from '../src/map-view.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';

const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), isSanctuary: (_x, y) => y < -500 };
const anchor = { band: 0, x: 0, y: -1150, name: 'Briarwatch' };
function ready(sim: Simulation) {
  assert.equal(sim.portal.start(sim.player, sim.world), null);
  for (let i = 0; i < 360; i++) sim.update(FIXED_STEP, idle);
  assert.ok(sim.portal.ready);
}

test('portal takes exactly three simulated seconds and damage cancels even if a potion restores more life', () => {
  const sim = new Simulation(world, { spawn: false });
  assert.equal(sim.portal.start(sim.player, world), null);
  for (let i = 0; i < 359; i++) sim.update(FIXED_STEP, idle);
  assert.equal(sim.portal.ready, false); sim.update(FIXED_STEP, idle); assert.equal(sim.portal.ready, true);
  sim.portal.cancel(); sim.player.hp = 20;
  sim.portal.start(sim.player, world);
  sim.projectiles.push({ id: 990, x: -2, y: 0, prevX: -2, prevY: 0, vx: 100, vy: 0,
    angle: 0, radius: 5, damage: 4, life: 1, maxLife: 1, sourceLevel: 1, owner: 'enemy', hitIds: new Set() });
  sim.update(FIXED_STEP, { ...idle, heal: true });
  assert.ok(sim.player.hp > 20); assert.equal(sim.portal.active, false);
});

test('movement, offense, dodge, focus cleanup and active actions prevent or interrupt portal casting', () => {
  for (const input of [{ moveX: 1 }, { moveY: 1 }, { attack: true }, { dodge: true }, { skillSlot: 0 }]) {
    const sim = new Simulation(world, { spawn: false }); sim.portal.start(sim.player, world);
    sim.update(FIXED_STEP, { ...idle, ...input }); assert.equal(sim.portal.active, false);
  }
  const sim = new Simulation(world, { spawn: false });
  sim.portal.start(sim.player, world); sim.clearInput(); assert.equal(sim.portal.active, false);
  sim.player.castTime = 1; assert.ok(sim.portal.start(sim.player, world));
  sim.player.castTime = 0; sim.player.vx = 10; assert.ok(sim.portal.start(sim.player, world));
  sim.player.vx = 0; sim.player.y = -1000; assert.ok(sim.portal.start(sim.player, world));
  sim.player.y = 0; assert.ok(sim.portal.start(sim.player, { ...world, blocked: () => true }));
});

test('saved round trip preserves equipment, gold, resources, loot and existing actors; replay cannot travel again', () => {
  const sim = new Simulation(world, { spawn: false });
  const data = new Map<string, string>();
  const session = new CharacterSession(new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } }), 4);
  assert.ok(session.create(0, 'Traveler', 7319, sim.captureCheckpoint(), 'portal-test', 1));
  const persist = (checkpoint: ReturnType<Simulation['captureCheckpoint']>) => ({ ok: session.save(checkpoint, 2), message: session.error });
  const enemy = sim.spawnEnemy('stalker', 1100, 0)!; enemy.hp = 11;
  ready(sim);
  sim.player.hp = 45; sim.player.mana = 17; sim.player.flasks = 1; sim.player.character.gold = 765;
  const before = sim.captureCheckpoint();
  assert.ok(executePortalTravel(sim, anchor, false, persist).ok);
  assert.equal(sim.player.y, anchor.y + 35); assert.equal(sim.player.prevY, sim.player.y);
  assert.deepEqual(sim.travel.returnTo, { x: before.x, y: before.y, town: 0 });
  assert.deepEqual(sim.player.character, before.character);
  assert.equal(sim.player.hp, 45); assert.equal(sim.player.mana, 17); assert.equal(sim.player.flasks, 1);
  assert.equal(sim.enemies[0], enemy); assert.equal(enemy.hp, 11);
  assert.equal(executePortalTravel(sim, anchor, false, persist).ok, false);
  assert.deepEqual(session.repository.read(0).record!.checkpoint.travel, sim.travel);
  const loaded = new Simulation(world, { spawn: false }); loaded.restoreCheckpoint(session.repository.read(0).record!.checkpoint);
  assert.deepEqual(loaded.travel, sim.travel); assert.equal(loaded.portal.active, false);
  assert.ok(executePortalTravel(sim, anchor, true, persist).ok);
  assert.equal(sim.travel.returnTo, null); assert.equal(sim.player.x, before.x); assert.equal(sim.player.y, before.y);
  assert.equal(sim.player.hp, 45); assert.equal(sim.player.mana, 17);
  assert.equal(executePortalTravel(sim, anchor, true, persist).ok, false);
});

test('failed persistence preserves position and the previous return link on both directions', () => {
  const sim = new Simulation(world, { spawn: false }); ready(sim);
  sim.travel.returnTo = { x: 50, y: 60, town: 0 };
  const before = sim.captureCheckpoint();
  assert.equal(executePortalTravel(sim, anchor, false, () => ({ ok: false, message: 'Stale save' })).ok, false);
  assert.deepEqual(sim.captureCheckpoint(), before); assert.equal(sim.portal.active, false);
  sim.player.x = anchor.x; sim.player.y = anchor.y;
  const town = sim.captureCheckpoint();
  assert.equal(executePortalTravel(sim, anchor, true, () => ({ ok: false, message: 'Storage full' })).ok, false);
  assert.deepEqual(sim.captureCheckpoint(), town);
});

test('blocked return searches locally, never changes area level, and retains link when no landing exists', () => {
  assert.equal(portalLanding({ ...world, blocked: () => true }, { x: 0, y: 0 }, 9), null);
  const near = portalLanding({ ...world, blocked: (x, y) => Math.hypot(x, y) < 10 }, { x: 0, y: 0 }, 9)!;
  assert.ok(Math.hypot(near.x, near.y) <= 80);
  let boundary = 0;
  while (boundary < 20000 && getZoneAt(boundary,0).level === getZoneAt(boundary+16,0).level) boundary += 8;
  const originLevel = getZoneAt(boundary,0).level;
  assert.ok(boundary < 20000);
  assert.equal(portalLanding({ ...world, blocked: (x,y) => getZoneAt(x,y).level === originLevel }, { x: boundary, y: 0 }, 9), null);
  const sim = new Simulation({ ...world, blocked: (_x, y) => y > -500 }, { spawn: false });
  sim.player.x = 0; sim.player.y = anchor.y; sim.travel.returnTo = { x: 0, y: 0, town: 0 };
  let saved = false;
  assert.equal(executePortalTravel(sim, anchor, true, () => { saved = true; return { ok: true, message: '' }; }).ok, false);
  assert.equal(saved, false); assert.ok(sim.travel.returnTo);
});

test('arrival protection expires after one second and ends immediately on offensive input', () => {
  const sim = new Simulation(world, { spawn: false }); sim.relocate(0, 0);
  sim.update(.25, idle); assert.ok(sim.player.invulnerable > .7);
  sim.update(.25, idle); sim.update(.25, idle); sim.update(.25, idle);
  assert.ok(sim.player.invulnerable < 1e-8);
  sim.relocate(0, 0); sim.update(FIXED_STEP, { ...idle, attack: true }); assert.equal(sim.player.invulnerable, 0);
});

test('death clears a return link, and character reset/restore do not share travel state', () => {
  const sim = new Simulation(world, { spawn: false }); sim.travel.returnTo = { x: 30, y: 30, town: 0 };
  const checkpoint = sim.captureCheckpoint();
  sim.player.hp = 1;
  sim.projectiles.push({ id: 99, x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, angle: 0,
    radius: 5, damage: 50, life: 1, maxLife: 1, sourceLevel: 1, owner: 'enemy', hitIds: new Set() });
  sim.update(FIXED_STEP, idle); assert.ok(sim.player.dead); assert.equal(sim.travel.returnTo, null);
  sim.reset(); assert.deepEqual(sim.travel, freshTravel());
  sim.restoreCheckpoint(checkpoint); assert.deepEqual(sim.travel, checkpoint.travel);
  (sim.travel as TravelState).returnTo!.x = 99; assert.equal(checkpoint.travel!.returnTo!.x, 30);
});

test('town anchors are reachable and changing home is a persisted interaction without consuming the old return', () => {
  const real = new World(7319);
  for (let band = -6; band <= 6; band++) {
    const a = real.getPortalAnchor(band);
    assert.equal(real.blocked(a.x, a.y, 9), false); assert.ok(real.isSanctuary(a.x, a.y + 35));
    assert.ok(portalLanding(real, { x: a.x, y: a.y + 35 }, 9));
  }
  const sim = new Simulation(world, { spawn: false }); sim.player.x = 0; sim.player.y = anchor.y;
  sim.travel.returnTo = { x: 0, y: 0, town: 0 };
  const next = { ...anchor, band: 1 };
  assert.equal(activatePortalAnchor(sim, next, () => ({ ok: false, message: 'Storage full' })).ok, false);
  assert.equal(sim.travel.homeTown, 0);
  assert.ok(activatePortalAnchor(sim, next, () => ({ ok: true, message: '' })).ok);
  assert.equal(sim.travel.homeTown, 1); assert.equal(sim.travel.returnTo!.town, 0);
  const towns = real.getSettlements(-2000, -2000, 4000, 1800);
  assert.ok(towns.some(t => townPortalAnchor(t).band === 0)); real.dispose();
});

test('travel validation rejects invalid coordinates and identities; current saves may omit an unused portal', () => {
  for (const value of [null, {}, { homeTown: 1.5, returnTo: null }, { homeTown: 0, returnTo: {} },
    { homeTown: 0, returnTo: { x: Infinity, y: 0, town: 0 } }, { homeTown: 1000000001, returnTo: null }]) assert.equal(validTravel(value), false);
  assert.ok(validTravel(freshTravel()));
  const sim = new Simulation(world, { spawn: false });
  const record = { version: 3, id: 'current-character', name: 'Traveler', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 4, checkpoint: sim.captureCheckpoint() };
  delete record.checkpoint.travel;
  assert.ok(decodeCharacterSave(JSON.stringify(record)));
  sim.restoreCheckpoint(record.checkpoint); assert.deepEqual(sim.travel, freshTravel());
  record.checkpoint.travel = { homeTown: 0, returnTo: { x: NaN, y: 0, town: 0 } };
  assert.equal(decodeCharacterSave(JSON.stringify(record)), null);
});

test('portal markers are explicit knowledge without exploration changes, and button pixels block attacks', () => {
  const markers = portalMapMarkers({ homeTown: 0, returnTo: { x: 800, y: 10, town: 0 } }, () => anchor);
  assert.equal(markers.length, 2); assert.equal(new Set(markers.map(m => m.id)).size, 2);
  assert.ok(markers.some(m => m.x === 800));
  for (const width of [540, 960]) {
    const r = getPortalControlRect(width, 600);
    assert.ok(isGameUIPoint(r.x + r.width / 2, r.y + r.height / 2, width, 600));
  }
});

test('relocation waits for destination camera coverage before births and keeps new enemies offscreen', () => {
  const sim = new Simulation(world);
  sim.setSpawnExclusion({ x: -400, y: -300, width: 800, height: 600 });
  sim.relocate(9000, 9000);
  for (let i = 0; i < 20; i++) sim.update(.05, idle);
  assert.equal(sim.enemies.length, 0);
  const view = { x: 8300, y: 8500, width: 1400, height: 1000 };
  sim.setSpawnExclusion(view);
  for (let i = 0; i < 100; i++) {
    sim.update(.05, { ...idle, aimX: 9100, aimY: 9000 });
    for (const event of sim.drainEvents()) if (event.type === 'spawn') {
      assert.ok(event.x < view.x - 80 || event.x > view.x + view.width + 80
        || event.y < view.y - 120 || event.y > view.y + view.height + 120);
    }
  }
  assert.ok(sim.enemies.length > 0);
});

test('portal displacement does not grant encounter travel credit or restart the initial population', async () => {
  const { RoamingEncounters } = await import('../src/roaming-encounters.ts');
  const director = new RoamingEncounters(); director.reset(0, 0);
  director.resolved(9, () => 0);
  director.advance({ x: 0, y: 0 }, 10); assert.equal(director.ready, false);
  director.relocate(9000, 9000); director.advance({ x: 9000, y: 9000 }, 10);
  assert.equal(director.ready, false);
  director.relocate(0, 0); director.advance({ x: 0, y: 0 }, 10);
  assert.equal(director.ready, false);
});
