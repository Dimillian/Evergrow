import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, DungeonGeometry, dungeonBlocked, type DungeonEntrance } from '../src/dungeon.ts';
import { createDungeonRun, freshExpeditions, currentDungeon } from '../src/dungeon-state.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { planDungeonTravel, claimDungeonChest } from '../src/dungeon-command.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { applyStun } from '../src/combat-status.ts';
import { updateWarden } from '../src/dungeon-boss.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { updateDungeon } from '../src/dungeon-runtime.ts';
import { generateItem } from '../src/items.ts';
import { World } from '../src/world.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
const entrance: DungeonEntrance = { id: 'dungeon:test', name: 'Rootbound Crypt', seed: 7319, level: 4, biome: 'deadwood', x: 600, y: 0 };
const surface = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: (x: number) => x === 0 };
const ok = () => ({ ok: true, message: '' });
async function setup() { const sim = new Simulation(surface, { spawn: false, startX: 600, startY: 0 }); const result = (await planDungeonTravel(sim, { kind: 'enter', entrance }, surface, ok)); assert.ok(result.ok); const f = generateDungeon(entrance.seed, entrance.level); sim.world = new DungeonWorld(f, entrance); sim.restoreCheckpoint(result.checkpoint); return { sim, f, run: currentDungeon(sim.expeditions)! }; }
function decoded(c: CharacterCheckpoint) { return decodeCharacterSave(JSON.stringify({ version: 3, id: 'test', name: 'Test', worldSeed: 7319, worldVersion: 5, createdAt: 1, updatedAt: 2, checkpoint: c })); }
test('crypt seeds produce bounded connected rooms, two branches, a loop and collision-safe rosters', () => {
    for (let seed = 0; seed < 150; seed++) {
        const f = generateDungeon(seed, 4);
        assert.deepEqual(f, generateDungeon(seed, 4));
        assert.equal(f.rooms.length, 13);
        assert.equal(f.rooms.filter(r => r.kind === 'treasure').length, 2);
        assert.ok(f.edges.length >= f.rooms.length);
        assert.ok(f.members.length >= 45 && f.members.length <= 70);
        assert.ok(Object.isFrozen(f.rooms));
        for (const m of f.members)
            assert.equal(dungeonBlocked(f, m.x, m.y, 25), false);
        const reached = new Set([0]);
        for (let j = 0; j < 13; j++)
            for (const [a, b] of f.edges) {
                if (reached.has(a))
                    reached.add(b);
                if (reached.has(b))
                    reached.add(a);
            }
        assert.equal(reached.size, 13);
        for (const [a, b] of f.edges) {
            const p = f.rooms[a], q = f.rooms[b], geo = new DungeonGeometry(f);
            let x = p.x + p.width / 2, y = p.y + p.height / 2;
            const tx = q.x + q.width / 2, ty = q.y + q.height / 2;
            for (let i = 0; i < 400 && Math.hypot(tx - x, ty - y) > 10; i++) {
                const v = geo.navigationTarget(x, y, tx, ty), d = Math.hypot(v.x - x, v.y - y);
                if (d < .01)
                    break;
                ({ x, y } = geo.move(x, y, (v.x - x) / d * Math.min(20, d), (v.y - y) / d * Math.min(20, d), 24));
            }
            assert.ok(Math.hypot(tx - x, ty - y) < 70, `seed ${seed}: ${a}->${b}`);
        }
    }
});
test('first crypt entrance is deterministic, reachable and map-discoverable without rewriting geography', () => { const w = new World(7319), a = w.getDungeonEntrances(-1000, 0, 1000, 1000); assert.ok(a.some(e => e.id === 'dungeon:first')); assert.deepEqual(a, w.getDungeonEntrances(-1000, 0, 1000, 1000)); for (const e of a)
    assert.equal(w.blocked(e.x, e.y, 25), false); assert.ok(w.getPOIs(-1000, 0, 1000, 1000).some(e => e.kind === 'dungeon')); });
test('location transitions persist atomically and keep equipment, resources and surface loot', async () => {
    const sim = new Simulation(surface, { spawn: false, startX: 600 });
    sim.player.hp = 47;
    sim.player.mana = 12;
    sim.groundItems = [{ id: 700, x: 630, y: 0, item: generateItem(44, 1, 'ring') }];
    sim.spawnEnemy('stalker', 700, 0)!.hp = 12;
    const before = JSON.stringify(sim.captureCheckpoint());
    assert.equal((await planDungeonTravel(sim, { kind: 'enter', entrance }, surface, () => ({ ok: false, message: 'disk full' }))).ok, false);
    assert.equal(JSON.stringify(sim.captureCheckpoint()), before);
    const r = (await planDungeonTravel(sim, { kind: 'enter', entrance }, surface, ok));
    assert.ok(r.ok);
    assert.ok(decoded(r.checkpoint));
    sim.world = new DungeonWorld(generateDungeon(7319, 4), entrance);
    sim.restoreCheckpoint(r.checkpoint);
    assert.equal(sim.groundItems.length, 0);
    assert.equal(sim.player.hp, 47);
    assert.equal(sim.player.mana, 12);
    const exit = (await planDungeonTravel(sim, { kind: 'exit' }, surface, ok));
    assert.ok(exit.ok);
    assert.ok(decoded(exit.checkpoint));
    sim.world = surface;
    sim.restoreCheckpoint(exit.checkpoint);
    assert.equal(sim.groundItems[0].id, 700);
    assert.equal(sim.enemies[0].hp, 12);
    assert.equal(sim.player.hp, 47);
});
test('dungeon actors use fixed entrance level, keep casualties, and never visibly refill rooms', async () => {
    const { sim, f, run } = (await setup());
    const visible = { x: -4000, y: -4000, width: 10000, height: 10000 };
    updateDungeon(sim, visible);
    assert.equal(sim.enemies.length, 0);
    const view = { x: -400, y: -300, width: 800, height: 600 };
    updateDungeon(sim, view);
    assert.ok(sim.enemies.length > 0);
    assert.ok(sim.enemies.length <= 24);
    assert.ok(sim.enemies.every(e => e.level === 4));
    const e = sim.enemies[0], id = e.campMemberId!;
    e.hp = 0;
    e.state = 'dead';
    updateDungeon(sim, view);
    sim.enemies = sim.enemies.filter(e => e.hp > 0);
    updateDungeon(sim, view);
    assert.equal(run.states[id].hp, 0);
    assert.ok(!sim.enemies.some(e => e.campMemberId === id));
    assert.ok(decoded(sim.captureCheckpoint()));
    assert.equal(f.members.length, Object.keys(run.states).length);
});
test('boss threshold waves and controls are finite; warnings are not resumed mid-impact', async () => {
    const { sim, f } = (await setup()), b = f.members.find(m => m.id === 'warden')!, e = sim.spawnEnemy('warden', b.x, b.y)!;
    sim.player.x = b.x + 90;
    sim.player.y = b.y;
    e.hp = e.maxHp * .2;
    e.state = 'chase';
    const c = { player: sim.player, enemies: sim.enemies, world: sim.world, time: 0, visible: () => true, move: () => { }, hurt: () => { }, shoot: () => { }, emit: () => { } };
    updateWarden(e, FIXED_STEP, c);
    assert.equal(e.bossPhases, 1);
    assert.equal(e.bossMove, 'summon');
    e.state = 'chase';
    updateWarden(e, FIXED_STEP, c);
    assert.equal(e.bossPhases, 3);
    e.state = 'chase';
    updateWarden(e, FIXED_STEP, c);
    assert.notEqual(e.bossMove, 'summon');
    applyStun(e, 10);
    assert.equal(e.stagger, .35);
    e.stagger = 0;
    applyStun(e, 10);
    assert.equal(e.stagger, 0);
});
test('boss death grants XP once through the shared owner but no extra equipment or gold', async () => {
    const { sim, f } = (await setup()), b = f.members.find(m => m.id === 'warden')!, e = sim.spawnEnemy('warden', b.x, b.y)!;
    const events: unknown[] = [];
    let id = 1;
    awardKillRewards(e, 0, 0, { player: sim.player, groundGold: sim.groundGold, groundItems: sim.groundItems, pickups: sim.pickups, nextId: () => id++, emit: event => events.push(event) });
    assert.equal(sim.groundItems.length, 0);
    assert.equal(sim.groundGold.length, 0);
    assert.ok(sim.player.xp > 0 || sim.player.level > 1);
});
test('chest claims preserve partial delivery and reject duplicates and failed saves', async () => {
    const { sim, f, run } = (await setup());
    sim.player.x = f.chests[2].x;
    sim.player.y = f.chests[2].y;
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, false);
    run.states.warden.hp = 0;
    const before = JSON.stringify(sim.captureCheckpoint());
    assert.equal((await claimDungeonChest(sim, 2, () => ({ ok: false, message: 'stale writer' }))).ok, false);
    assert.equal(JSON.stringify(sim.captureCheckpoint()), before);
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, true);
    assert.equal(sim.groundItems.length, 3);
    assert.equal(sim.groundGold.length, 1);
    assert.ok(decoded(sim.captureCheckpoint()));
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, false);
});
test('dungeon portal and death preserve the exact instance and suspended progression', async () => {
    const { sim, run } = (await setup());
    sim.player.x = 100;
    sim.player.y = 150;
    sim.player.hp = 42;
    run.states.warden.hp = 711;
    run.states.warden.bossPhases = 1;
    const anchor = { band: 0, x: 0, y: 0, name: 'Briarwatch' };
    sim.portal.origin = { x: 100, y: 150 };
    sim.portal.elapsed = 3;
    const result = (await planDungeonTravel(sim, { kind: 'town', anchor }, surface, ok));
    assert.ok(result.ok);
    assert.equal(result.checkpoint.travel?.returnTo?.dungeon, entrance.id);
    sim.world = surface;
    sim.restoreCheckpoint(result.checkpoint);
    sim.player.y = 0;
    const ret = (await planDungeonTravel(sim, { kind: 'return', anchor }, surface, ok));
    assert.ok(ret.ok);
    assert.ok(decoded(ret.checkpoint));
    assert.equal(ret.checkpoint.x, 100);
    assert.equal(currentDungeon(ret.checkpoint.expeditions!)!.states.warden.hp, 711);
    sim.world = new DungeonWorld(generateDungeon(7319, 4), entrance);
    sim.restoreCheckpoint(ret.checkpoint);
    sim.player.dead = true;
    sim.player.hp = 0;
    const death = (await planDungeonTravel(sim, { kind: 'death' }, surface, ok));
    assert.ok(death.ok);
    assert.equal(death.checkpoint.expeditions!.location, null);
    assert.equal(death.checkpoint.expeditions!.runs[0].states.warden.hp, 711);
});
test('save validation rejects malformed and oversized expedition state', () => { const state = freshExpeditions(); assert.equal(validExpeditions(state), true); state.runs.push(createDungeonRun(entrance)); assert.equal(validExpeditions(state), true); state.location = entrance.id; assert.equal(validExpeditions(state), false); state.location = null; state.runs[0].states.warden.hp = Infinity; assert.equal(validExpeditions(state), false); });
test('full ground storage preserves a partial chest bundle and an interrupted opening awards nothing', async () => {
    const { sim, f, run } = (await setup());
    run.states.warden.hp = 0;
    sim.player.x = f.chests[2].x;
    sim.player.y = f.chests[2].y;
    sim.groundItems = Array.from({ length: 95 }, (_, i) => ({ id: i + 1000, x: 0, y: 0, item: generateItem(i + 19000, 1, 'ring') }));
    sim.groundGold = Array.from({ length: 128 }, (_, i) => ({ id: i + 3000, x: 0, y: 0, amount: 1, age: 0 }));
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, true);
    assert.equal(currentDungeon(sim.expeditions)!.chestMasks[2], 1);
    const first = sim.groundItems.at(-1)!.item.id;
    sim.groundItems = [];
    sim.groundGold = [];
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, true);
    assert.equal(sim.groundItems.length, 2);
    assert.ok(sim.groundItems.every(i => i.item.id !== first));
    assert.equal(sim.groundGold.length, 1);
    const before = JSON.stringify(sim.captureCheckpoint());
    sim.eventChannel.start({ ...f.chests[0], kind: 'cryptChest', index: 0, name: 'Chest' }, null);
    sim.eventChannel.advance(.5, sim.player, { moveX: 1, moveY: 0, attack: false, dodge: false, heal: false, skillSlot: null, aimX: 0, aimY: 0 });
    assert.equal(sim.eventChannel.site, null);
    assert.equal(JSON.stringify(sim.captureCheckpoint()), before);
});
test('Warden fracture locks three lanes and commits at most one hit during their sequence', async () => {
    const { sim, f } = (await setup()), b = f.members.find(m => m.id === 'warden')!, e = sim.spawnEnemy('warden', b.x, b.y)!;
    sim.player.x = b.x + 200;
    sim.player.y = b.y;
    e.state = 'attack';
    e.bossMove = 'fracture';
    e.attackAngle = 0;
    e.stateDuration = .6;
    let hits = 0;
    const c = { player: sim.player, enemies: sim.enemies, world: sim.world, time: 0, visible: () => true, move: () => { }, hurt: () => hits++, shoot: () => { }, emit: () => { } };
    e.stateTime = .01;
    updateWarden(e, .01, c);
    assert.equal(hits, 0, 'first side lane misses center');
    e.stateTime = .17;
    updateWarden(e, .01, c);
    assert.equal(hits, 1, 'middle lane hits at its scheduled instant');
    e.stateTime = .33;
    updateWarden(e, .01, c);
    assert.equal(hits, 1);
    assert.equal(e.attackAngle, 0);
});
