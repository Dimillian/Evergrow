import test from 'node:test';
import assert from 'node:assert/strict';
import { CampPopulation, CAMP_POPULATION_RULES } from '../src/camp-population.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import type { EnemyCamp } from '../src/wilderness-sites.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const open: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function blueprint(id = 'camp-a', x = 400, y = 0): EnemyCamp {
  return Object.freeze({ id, x, y, radius: 120, members: Object.freeze([
    Object.freeze({ id: `${id}:guard`, dx: 0, dy: 0, kind: 'stalker' as const, rank: 'veteran' as const }),
    Object.freeze({ id: `${id}:bow`, dx: 70, dy: -35, kind: 'archer' as const, rank: 'normal' as const }),
    Object.freeze({ id: `${id}:hound`, dx: -45, dy: 50, kind: 'hound' as const, rank: 'normal' as const }),
  ]) });
}
function harness(world: WorldQuery = open) {
  const sim = new Simulation(world, { spawn: false }), ledger = new CampPopulation();
  const update = (camps: readonly EnemyCamp[]) => ledger.update(camps, sim.player, sim.enemies, world,
    (member, x, y, source) => sim.spawnEnemy(member.kind, x, y, member.rank, source), 1000);
  return { sim, ledger, update };
}
function advance(sim: Simulation, seconds: number): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, idle);
}

test('a nearby camp materializes its authored garrison once with fixed member identities and rank', () => {
  const { sim, ledger, update } = harness(), camp = blueprint();
  assert.equal(ledger.getState(camp.id), 'dormant'); update([camp]);
  assert.equal(ledger.getState(camp.id), 'active'); assert.equal(ledger.recordedCount, 1);
  assert.equal(sim.enemies.length, camp.members.length);
  for (const member of camp.members) {
    const enemy = sim.enemies.find(enemy => enemy.campMemberId === member.id)!;
    assert.ok(enemy); assert.equal(enemy.kind, member.kind); assert.equal(enemy.rank, member.rank);
    assert.equal(enemy.homeX, camp.x + member.dx); assert.equal(enemy.homeY, camp.y + member.dy);
  }
  const ids = sim.enemies.map(enemy => enemy.id);
  for (let index = 0; index < 10; index++) update([camp]);
  assert.deepEqual(sim.enemies.map(enemy => enemy.id), ids);
  assert.ok(Object.isFrozen(camp)); assert.ok(Object.isFrozen(camp.members));
});

test('sleeping and revisiting preserve wounded members, dead members, source stats and loot seeds', () => {
  const { sim, ledger, update } = harness(), camp = blueprint(); update([camp]);
  const [dead, wounded] = sim.enemies; dead.state = 'dead'; dead.hp = 0; wounded.hp = 7;
  const source = { hp: wounded.maxHp, level: wounded.level, rank: wounded.rank, damage: wounded.damage, lootSeed: wounded.lootSeed };
  sim.player.x = 4000; update([]); assert.equal(sim.enemies.length, 0);
  assert.equal(ledger.getState(camp.id), 'active', 'sleeping is not clearing');
  sim.player.x = 0; sim.player.level = 80; update([camp]);
  assert.equal(sim.enemies.length, 2); assert.ok(sim.enemies.includes(wounded)); assert.ok(!sim.enemies.includes(dead));
  assert.equal(wounded.hp, 7); assert.deepEqual({ hp: wounded.maxHp, level: wounded.level, rank: wounded.rank,
    damage: wounded.damage, lootSeed: wounded.lootSeed }, source);
  assert.equal(wounded.prevX, wounded.x); assert.equal(wounded.prevY, wounded.y);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0); assert.equal(sim.groundItems.length, 0);
});

test('cleared camps never refill after backtracking, while resetting the run restores them', () => {
  const { sim, ledger, update } = harness(), camp = blueprint(); update([camp]);
  for (const enemy of sim.enemies) { enemy.hp = 0; enemy.state = 'dead'; }
  assert.equal(ledger.getState(camp.id), 'cleared');
  sim.player.x = 5000; update([]); sim.player.x = 0;
  for (let index = 0; index < 5; index++) update([camp]);
  assert.equal(sim.enemies.length, 0); assert.equal(ledger.getState(camp.id), 'cleared');
  ledger.reset(); update([camp]); assert.equal(sim.enemies.length, 3); assert.equal(ledger.getState(camp.id), 'active');
});

test('camp reward identity does not depend on traversal order or ambient actor IDs', () => {
  const campA = blueprint('alpha', 740), campB = blueprint('beta', 3700);
  const run = (reverse: boolean) => {
    const { sim, update } = harness();
    if (reverse) for (let index = 0; index < 5; index++) sim.spawnEnemy('stalker', 20 + index * 40, 0);
    for (const camp of reverse ? [campB, campA] : [campA, campB]) { sim.player.x = camp.x; update([camp]); }
    sim.player.x = campA.x; update([campA]);
    return sim.enemies.filter(enemy => enemy.campId === campA.id)
      .map(enemy => ({ id: enemy.campMemberId, seed: enemy.lootSeed })).sort((a, b) => a.id!.localeCompare(b.id!));
  };
  assert.deepEqual(run(false), run(true));
});

test('whole-camp activation respects total/rank caps and rejects blocked or sanctuary slots atomically', () => {
  for (const mode of ['population', 'veterans', 'blocked', 'sanctuary']) {
    let reject = false;
    const world: WorldQuery = { ...open, blocked: x => reject && mode === 'blocked' && x > 450,
      isSanctuary: x => reject && mode === 'sanctuary' && x > 450 };
    const { sim, ledger, update } = harness(world), camp = blueprint();
    if (mode === 'population') for (let index = 0; index < ENCOUNTER_RULES.hardPopulationCap - 2; index++) sim.spawnEnemy('stalker', -100 - index * 30, 0);
    if (mode === 'veterans') for (let index = 0; index < ENCOUNTER_RULES.veteranCap; index++) sim.spawnEnemy('stalker', -100 - index * 30, 0, 'veteran');
    reject = true; const count = sim.enemies.length; update([camp]);
    assert.equal(sim.enemies.length, count, mode); assert.equal(ledger.getState(camp.id), 'dormant', mode);
    sim.enemies = []; reject = false; update([camp]); assert.equal(sim.enemies.length, 3, mode);
  }
});

test('the exact ledger budget never evicts an existing camp, falsely clears it, or farms a replacement', () => {
  const { sim, ledger, update } = harness();
  for (let index = 0; index < CAMP_POPULATION_RULES.ledgerCapacity + 1; index++) {
    sim.player.x = index * 4000;
    update([blueprint(`camp-${index}`, sim.player.x)]);
  }
  assert.equal(ledger.recordedCount, CAMP_POPULATION_RULES.ledgerCapacity);
  assert.equal(ledger.getState('camp-0'), 'active');
  assert.equal(ledger.getState(`camp-${CAMP_POPULATION_RULES.ledgerCapacity}`), 'dormant');
  assert.equal(sim.enemies.length, 0, 'later content stays dormant at the budget rather than refilling an old record');
  sim.player.x = 0; update([blueprint('camp-0', 0)]); assert.equal(sim.enemies.length, 3);
});

test('runtime camp kills preserve first-kill rewards and remain cleared through an unload/reload', () => {
  const camp = { ...blueprint(), members: blueprint().members.slice(0, 1) };
  const world = { ...open, getEnemyCamps: () => [camp] };
  const sim = new Simulation(world, { seed: 91 }); sim.enemies = [];
  sim.setSpawnExclusion({ x: -20000, y: -20000, width: 40000, height: 40000 });
  advance(sim, FIXED_STEP);
  const enemy = sim.enemies.find(enemy => enemy.campId === camp.id)!; assert.ok(enemy);
  enemy.hp = 1; enemy.state = 'recover'; enemy.stateDuration = 999;
  sim.projectiles.push({ id: 999, sourceLevel: 1, x: enemy.x - 18, y: enemy.y, prevX: enemy.x - 18,
    prevY: enemy.y, vx: 2000, vy: 0, angle: 0, radius: 5, damage: 20, life: 1, maxLife: 1, owner: 'player', hitIds: new Set() });
  advance(sim, .2);
  assert.equal(sim.kills, 1); assert.ok(sim.player.xp > 0); assert.ok(sim.groundItems.length >= 1);
  assert.equal(sim.getCampState(camp.id), 'cleared');
  const drops = sim.groundItems.map(drop => drop.item.id), xp = sim.player.xp;
  sim.player.x = 6000; advance(sim, .5); sim.player.x = 0; advance(sim, .5);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === camp.id).length, 0);
  assert.equal(sim.player.xp, xp); assert.equal(sim.kills, 1); assert.deepEqual(sim.groundItems.map(drop => drop.item.id), drops);
  sim.reset(); assert.equal(sim.getCampState(camp.id), 'dormant');
});

test('approaching camp priority sleeps distant offscreen garrisons while preserving their wounded members', () => {
  const sim = new Simulation(open, { spawn: false }), ledger = new CampPopulation();
  const a = blueprint('far-a', 800), b = blueprint('far-b', 1100), near = blueprint('near', 150);
  const update = (camps: EnemyCamp[], wide = false) => ledger.update(camps, sim.player, sim.enemies, open,
    (member, x, y, source) => sim.spawnEnemy(member.kind, x, y, member.rank, source), 1000,
    { x: sim.player.x - (wide ? 1400 : 300), y: -250, width: wide ? 2800 : 600, height: 500 });
  update([a, b]); assert.equal(sim.enemies.length, 6);
  const wounded = sim.enemies.find(enemy => enemy.campId === b.id)!; wounded.hp = 5;
  update([a, b, near], true);
  assert.equal(ledger.getState(near.id), 'dormant', 'visible foes cannot disappear to manufacture room');
  assert.equal(sim.enemies.length, 6);
  update([a, b, near]);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === near.id).length, 3);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === b.id).length, 0);
  assert.equal(ledger.getState(b.id), 'active', 'a sleeping garrison is still uncleared');
  assert.equal(sim.enemies.filter(enemy => enemy.rank === 'veteran').length, ENCOUNTER_RULES.veteranCap);
  sim.player.x = b.x; update([a, b, near]);
  assert.ok(sim.enemies.includes(wounded)); assert.equal(wounded.hp, 5);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0);
});

test('a full twelve-actor camp budget yields only offscreen farther groups to the approaching camp', () => {
  const sim = new Simulation(open, { spawn: false }), ledger = new CampPopulation();
  const camp = (id: string, x: number): EnemyCamp => ({ id, x, y: 0, radius: 150,
    members: Array.from({ length: 6 }, (_, index) => ({ id: `${id}:${index}`, kind: 'stalker', rank: 'normal', dx: index * 25, dy: 0 })) });
  const a = camp('a', 750), b = camp('b', 1000), near = camp('near', 100);
  const update = (camps: EnemyCamp[]) => ledger.update(camps, sim.player, sim.enemies, open,
    (member, x, y, source) => sim.spawnEnemy(member.kind, x, y, member.rank, source), 1000,
    { x: -250, y: -250, width: 500, height: 500 });
  update([a, b]); assert.equal(sim.enemies.length, 12);
  update([near, a, b]);
  assert.equal(sim.enemies.length, 12); assert.equal(sim.enemies.filter(enemy => enemy.campId === near.id).length, 6);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === a.id).length, 6);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === b.id).length, 0);
});
