import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { startingEnemyCamp } from '../src/wilderness-sites.ts';
import { breakContainer, containerGold, strikeContainers, furnitureContainer, type BreakableContainer } from '../src/breakable-containers.ts';
import { advanceGroundEffects, scheduleGroundEffect } from '../src/ground-effects.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { GOLD_RULES } from '../src/gold.ts';
import type { CombatEvent, Input } from '../src/model.ts';
import type { GroundGold } from '../src/gold.ts';

const targetFor = (world: World) => world.getContainers(628, 208, 10).find(t => t.kind === 'crate')!;
const idle: Input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}) {
  for (let i = 0; i < Math.ceil(seconds / FIXED_STEP); i++) sim.update(FIXED_STEP, { ...idle, ...input });
}

test('real camp crates break on blade contact, clear cached collision and do not grant kill rewards', () => {
  const world = new World(7319), target = targetFor(world), original = JSON.stringify(startingEnemyCamp(7319));
  const sim = new Simulation(world, { spawn: false, startX: target.x + 40, startY: target.y });
  assert.ok(world.blocked(target.x, target.y, 1));
  advance(sim, .08, { attack: true, aimX: target.x, aimY: target.y });
  assert.equal(sim.brokenContainers.has(target.id), false, 'windup cannot break scenery');
  advance(sim, .8, { attack: true, aimX: target.x, aimY: target.y });
  assert.ok(sim.brokenContainers.has(target.id));
  assert.equal(world.blocked(target.x, target.y, 1), false);
  assert.deepEqual(world.move(target.x + 12, target.y, -12, 0, 1), { x: target.x, y: target.y });
  assert.equal(sim.drainEvents().filter(e => e.type === 'container-break' && e.containerId === target.id).length, 1);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0); assert.equal(sim.player.flasks, 2);
  assert.equal(JSON.stringify(startingEnemyCamp(7319)), original, 'immutable blueprints are unchanged');
  world.dispose();
});

test('arrows and bolts break the first solid container; hostile shots do not', () => {
  for (const owner of ['player', 'enemy'] as const) for (const style of ['arrow', 'fire'] as const) {
    const world = new World(7319), target = targetFor(world);
    const sim = new Simulation(world, { spawn: false, startX: target.x + 70, startY: target.y });
    sim.projectiles.push({ id: 999, x: target.x + 30, y: target.y, prevX: target.x + 30, prevY: target.y,
      vx: -600, vy: 0, angle: Math.PI, radius: 3, damage: 20, life: 1, maxLife: 1, owner, sourceLevel: 1,
      hitIds: new Set(), effects: { style } });
    advance(sim, .06);
    assert.equal(sim.brokenContainers.has(target.id), owner === 'player');
    assert.equal(sim.projectiles.length, 0, 'the container absorbs the projectile');
    world.dispose();
  }
});

test('area pulses shatter nearby containers at impact, but do not reach through walls', () => {
  const world = new World(7319), target = targetFor(world), sim = new Simulation(world, { spawn: false });
  const broken: string[] = [], containers = { world, break: (t: BreakableContainer) => { broken.push(t.id); sim.brokenContainers.add(t.id); } };
  let effects: Parameters<typeof advanceGroundEffects>[0] = [];
  scheduleGroundEffect(effects, { kind: 'frost', x: target.x + 35, y: target.y, radius: 55,
    delay: .2, duration: 0, interval: 1, damage: 20, skill: 'iceNova', style: 'frost' }, { nextId: () => 1, emit: () => {} });
  const context = { containers, player: sim.player, enemies: [], visible: () => true, damage: () => {}, emit: () => {} };
  effects = advanceGroundEffects(effects, .1, context); assert.equal(broken.length, 0);
  effects = advanceGroundEffects(effects, .11, context); assert.ok(broken.includes(target.id));
  advanceGroundEffects(effects, 1, context); assert.equal(broken.filter(id => id === target.id).length, 1);
  assert.equal(strikeContainers({ world: { ...context, blocked: () => true, move: (x, y) => ({ x, y }), getContainers: () => [target] },
    break: () => assert.fail('a solid wall must protect the container') }, target.x + 80, target.y, 100), 0);
  world.dispose();
});

test('container gold is modest, occasional, deterministic and conserves value at pile capacity', () => {
  const rolls = Array.from({ length: 1000 }, (_, i) => containerGold(i, 1));
  assert.ok(rolls.filter(Boolean).length > 290 && rolls.filter(Boolean).length < 410);
  assert.ok(rolls.every(n => n === 0 || n >= 2 && n <= 7));
  const seed = rolls.findIndex(Boolean);
  assert.equal(containerGold(seed, 1), rolls[seed]); assert.ok(containerGold(seed, 10) > rolls[seed]);
  const target: BreakableContainer = { id: 'test:crate', kind: 'crate', x: 0, y: 0, radius: 12, seed };
  const broken = new Set<string>(), piles: GroundGold[] = Array.from({ length: GOLD_RULES.maxPiles }, (_, id) => ({ id: id + 1, x: id * 5, y: 0, age: 1, amount: 1 }));
  const events: CombatEvent[] = []; let nextId = 1000;
  assert.ok(breakContainer(target, 0, 1, broken, piles, () => nextId++, e => events.push(e)));
  assert.equal(breakContainer(target, 0, 1, broken, piles, () => nextId++, e => events.push(e)), false);
  assert.equal(piles.length, GOLD_RULES.maxPiles); assert.equal(piles.reduce((n, p) => n + p.amount, 0), GOLD_RULES.maxPiles + rolls[seed]);
  assert.equal(events.length, 1);
});

for (const version of [3, CHARACTER_SAVE_VERSION]) test(`broken receipts and coins survive save v${version} load without rerolling or respawning`, () => {
  const world = new World(7319), target = targetFor(world);
  const sim = new Simulation(world, { spawn: false, startX: target.x + 40, startY: target.y });
  advance(sim, .6, { attack: true, aimX: target.x, aimY: target.y });
  const checkpoint = sim.captureCheckpoint();
  const record = { version, id: 'test-container', name: 'Test', createdAt: 1, updatedAt: 2, worldSeed: 7319, worldVersion: 6, checkpoint };
  const { look: originalLook, ...preEditorCharacter } = checkpoint.character;
  const input = version === 3 ? { ...record, checkpoint: { ...checkpoint, character: preEditorCharacter } } : record;
  const decoded = decodeCharacterSave(JSON.stringify(input)); assert.ok(decoded);
  assert.equal(decoded.version, CHARACTER_SAVE_VERSION);
  assert.deepEqual(decoded.checkpoint.character.look, originalLook);
  assert.deepEqual(decoded.checkpoint.brokenContainers, checkpoint.brokenContainers);
  const nextWorld = new World(7319), next = new Simulation(nextWorld, { spawn: false });
  next.restoreCheckpoint(decoded.checkpoint);
  assert.ok(next.brokenContainers.has(target.id)); assert.equal(nextWorld.blocked(target.x, target.y, 1), false);
  assert.deepEqual(next.groundGold, checkpoint.groundGold);
  assert.equal(nextWorld.getContainers(target.x, target.y, 1).some(t => t.id === target.id), false);
  assert.equal(next.drainEvents().some(e => e.type === 'container-break'), false);
  for (const invalid of [[target.id, target.id], [5], ['x'.repeat(181)]]) {
    const bad = structuredClone(input); bad.checkpoint.brokenContainers = invalid as string[];
    assert.equal(decodeCharacterSave(JSON.stringify(bad)), null);
  }
  next.reset(); assert.equal(nextWorld.blocked(target.x, target.y, 1), true, 'a new character starts intact');
  world.dispose(); nextWorld.dispose();
});

test('indoor barrels use stable furniture identity and release their collision only', () => {
  const world = new World(7319), sim = new Simulation(world, { spawn: false });
  const building = world.getBuildings(-25000, -25000, 50000, 50000).find(b => b.furniture.some(f => f.kind === 'barrel'))!;
  assert.ok(building);
  const index = building.furniture.findIndex(f => f.kind === 'barrel'), target = furnitureContainer(building, index)!;
  assert.ok(world.getContainers(target.x, target.y, 5).some(t => t.id === target.id));
  assert.ok(world.blocked(target.x, target.y, 1)); sim.brokenContainers.add(target.id);
  assert.equal(world.blocked(target.x, target.y, 1), false);
  assert.ok(world.blocked(building.x, building.y, 1), 'building walls remain solid');
  world.dispose();
});
