import test from 'node:test';
import assert from 'node:assert/strict';
import { CampPopulation, CAMP_POPULATION_RULES } from '../src/camp-population.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import type { EnemyCamp } from '../src/wilderness-sites.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { isSpawnHidden, type SpawnExclusion } from '../src/spawn-visibility.ts';

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
  const update = (camps: readonly EnemyCamp[], exclusion: SpawnExclusion | null = null) => ledger.update(camps, sim.player, sim.enemies, world,
    (member, x, y, source) => sim.spawnEnemy(member.kind, x, y, member.rank, source), 1000, exclusion);
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
    if (mode === 'population') for (let index = 0; index < ENCOUNTER_RULES.hardPopulationCap - 2; index++) sim.spawnEnemy('stalker', -100 - index * 10, 0);
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
  sim.setSpawnExclusion({ x: -200, y: -200, width: 400, height: 400 });
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
  const a = blueprint('far-a', 800), b = blueprint('far-b', 1100), near = blueprint('near', 450);
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
  assert.ok(!sim.enemies.includes(wounded), 'returning camp cannot wake under the player');
  sim.player.x = 1650; update([a, b, near]);
  assert.ok(sim.enemies.includes(wounded)); assert.equal(wounded.hp, 5);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0);
});

test('the reserved camp budget yields only offscreen farther groups to the approaching camp', () => {
  const sim = new Simulation(open, { spawn: false }), ledger = new CampPopulation();
  const camp = (id: string, x: number): EnemyCamp => ({ id, x, y: 0, radius: 150,
    members: Array.from({ length: 6 }, (_, index) => ({ id: `${id}:${index}`, kind: 'stalker', rank: 'normal', dx: index * 25, dy: 0 })) });
  const a = camp('a', 750), b = camp('b', 1000), near = camp('near', 400);
  const update = (camps: EnemyCamp[]) => ledger.update(camps, sim.player, sim.enemies, open,
    (member, x, y, source) => sim.spawnEnemy(member.kind, x, y, member.rank, source), 1000,
    { x: -250, y: -250, width: 500, height: 500 });
  update([a, b]); assert.equal(sim.enemies.length, 12);
  update([near, a, b]);
  assert.equal(sim.enemies.length, 12); assert.equal(sim.enemies.filter(enemy => enemy.campId === near.id).length, 6);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === a.id).length, 6);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === b.id).length, 0);
});

test('one member inside the padded viewport defers the entire fresh camp without evicting other actors', () => {
  const { sim, ledger, update } = harness();
  const a = blueprint('a', 900), b = blueprint('b', 1100), approaching = blueprint('approaching', 500);
  update([a, b]); const existing = sim.enemies.map(enemy => enemy.id);
  const partial = { x: -400, y: -200, width: 800, height: 400 };
  const hidden = approaching.members.map(member => isSpawnHidden(approaching.x + member.dx, member.dy, partial, 17));
  assert.ok(hidden.some(Boolean) && hidden.some(value => !value), 'fixture straddles the protected edge');
  update([approaching], partial);
  assert.deepEqual(sim.enemies.map(enemy => enemy.id), existing);
  assert.equal(ledger.getState(approaching.id), 'dormant'); assert.equal(ledger.recordedCount, 2);
  const narrow = { x: -300, y: -200, width: 600, height: 400 }; update([approaching], narrow);
  assert.equal(sim.enemies.filter(enemy => enemy.campId === approaching.id).length, 3);
  assert.ok(sim.enemies.every(enemy => isSpawnHidden(enemy.x, enemy.y, narrow, enemy.radius)));
});

test('capacity becoming available never causes a visible dormant camp to appear', () => {
  const { sim, ledger, update } = harness(), camp = blueprint('visible', 300);
  for (let index = 0; index < ENCOUNTER_RULES.hardPopulationCap; index++) sim.spawnEnemy('stalker', -index * 3, 0);
  const view = { x: -500, y: -300, width: 1000, height: 600 }; update([camp], view);
  sim.enemies.splice(0, 8); const before = sim.enemies.map(enemy => enemy.id); update([camp], view);
  assert.deepEqual(sim.enemies.map(enemy => enemy.id), before); assert.equal(ledger.getState(camp.id), 'dormant');
  update([camp], { x: -300, y: -300, width: 400, height: 600 });
  assert.equal(sim.enemies.filter(enemy => enemy.campId === camp.id).length, 3);
});

test('sleeping camp restoration waits for every surviving member to leave the viewport and preserves its source', () => {
  const { sim, ledger, update } = harness(), camp = blueprint(); update([camp]);
  const [dead, wounded] = sim.enemies; dead.hp = 0; dead.state = 'dead'; wounded.hp = 9;
  const source = { id: wounded.id, level: wounded.level, rank: wounded.rank, hp: wounded.hp, seed: wounded.lootSeed };
  sim.player.x = 4000; update([], { x: 3800, y: -200, width: 400, height: 400 });
  assert.equal(sim.enemies.length, 0);
  sim.player.x = 0; const view = { x: -400, y: -200, width: 800, height: 400 };
  update([camp], view); assert.equal(sim.enemies.length, 0); assert.equal(ledger.getState(camp.id), 'active');
  update([camp], { x: -200, y: -200, width: 400, height: 400 });
  assert.equal(sim.enemies.length, 2); assert.ok(sim.enemies.includes(wounded)); assert.ok(!sim.enemies.includes(dead));
  assert.deepEqual({ id: wounded.id, level: wounded.level, rank: wounded.rank, hp: wounded.hp, seed: wounded.lootSeed }, source);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0); assert.equal(sim.groundItems.length, 0);
});

test('malformed viewport data cannot create, wake or sleep a camp', () => {
  const { sim, ledger, update } = harness(), camp = blueprint();
  const invalid = { x: 0, y: 0, width: NaN, height: 300 }; update([camp], invalid);
  assert.equal(sim.enemies.length, 0); assert.equal(ledger.getState(camp.id), 'dormant');
  update([camp]); const ids = sim.enemies.map(enemy => enemy.id);
  sim.player.x = 5000; update([], invalid); assert.deepEqual(sim.enemies.map(enemy => enemy.id), ids);
  update([]); assert.equal(sim.enemies.length, 0); sim.player.x = 0;
  update([camp], invalid); assert.equal(sim.enemies.length, 0);
});

function normalCamp(id: string, x: number, count = 6): EnemyCamp {
  return { id, x, y: 0, radius: 150, members: Array.from({ length: count }, (_, index) =>
    ({ id: `${id}:${index}`, kind: 'stalker', rank: 'normal', dx: index * 25, dy: 0 })) };
}

test('visible corpses prevent whole-camp priority eviction alongside their surviving garrison', () => {
  const { sim, update } = harness(); const a = normalCamp('a', 750), b = normalCamp('b', 1050), near = normalCamp('near', 400);
  update([a, b]); const corpse = sim.enemies.find(enemy => enemy.campId === b.id)!;
  corpse.hp = 0; corpse.state = 'dead'; corpse.x = corpse.prevX = 0;
  const bIds = sim.enemies.filter(enemy => enemy.campId === b.id).map(enemy => enemy.id);
  update([near], { x: -200, y: -200, width: 400, height: 400 });
  assert.deepEqual(sim.enemies.filter(enemy => enemy.campId === b.id).map(enemy => enemy.id), bIds);
  assert.ok(sim.enemies.includes(corpse)); assert.equal(sim.enemies.filter(enemy => enemy.campId === near.id).length, 6);
});

test('camp count respects its reserved budget and cannot consume the protected roaming slots', () => {
  const { sim, ledger, update } = harness();
  update([normalCamp('a', 100), normalCamp('b', 250)]);
  const roamers = Array.from({ length: ENCOUNTER_RULES.hardPopulationCap - 12 }, (_, index) => sim.spawnEnemy('stalker', -800 - index * 30, 0)!);
  const near = normalCamp('near', 450, ENCOUNTER_RULES.hardPopulationCap - ENCOUNTER_RULES.roamingReserve - 12 + 1); update([near], { x: -300, y: -250, width: 600, height: 500 });
  assert.equal(ledger.getState(near.id), 'dormant');
  assert.ok(roamers.every(enemy => sim.enemies.includes(enemy)), 'ambient retirement cannot solve a camp-only budget conflict');
  assert.equal(sim.enemies.filter(enemy => enemy.campId).length, 12);
  assert.ok(sim.enemies.length <= ENCOUNTER_RULES.hardPopulationCap);
});

test('distant ambient population yields only the surplus above its protected reserve', () => {
  const { sim, ledger, update } = harness();
  update([normalCamp('a', 100), normalCamp('b', 250)]);
  const roamers = Array.from({ length: ENCOUNTER_RULES.hardPopulationCap - 12 }, (_, index) => sim.spawnEnemy('stalker', -800 - index * 30, 0)!);
  const near = normalCamp('near', 450, ENCOUNTER_RULES.hardPopulationCap - ENCOUNTER_RULES.roamingReserve - 12); update([near], { x: -300, y: -250, width: 600, height: 500 });
  assert.equal(ledger.getState(near.id), 'active');
  assert.equal(roamers.filter(enemy => sim.enemies.includes(enemy)).length, ENCOUNTER_RULES.roamingReserve);
  assert.equal(sim.enemies.filter(enemy => enemy.campId).length, ENCOUNTER_RULES.hardPopulationCap - ENCOUNTER_RULES.roamingReserve);
  assert.equal(sim.enemies.length, ENCOUNTER_RULES.hardPopulationCap);
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0);
});

test('sleeping members remain deferred if their saved return position becomes obstructed or protected', () => {
  for (const sanctuary of [false, true]) {
    let reject = false;
    const world = { ...open, blocked: (x: number) => reject && !sanctuary && x > 450,
      isSanctuary: (x: number) => reject && sanctuary && x > 450 };
    const { sim, ledger, update } = harness(world), camp = blueprint(); update([camp]);
    const wounded = sim.enemies[1]; wounded.hp = 5;
    sim.player.x = 5000; update([]); sim.player.x = 0; reject = true;
    update([camp], { x: -200, y: -200, width: 400, height: 400 });
    assert.equal(sim.enemies.length, 0); assert.equal(ledger.getState(camp.id), 'active');
    reject = false; update([camp], { x: -200, y: -200, width: 400, height: 400 });
    assert.equal(sim.enemies.length, 3); assert.ok(sim.enemies.includes(wounded)); assert.equal(wounded.hp, 5);
  }
});

test('a visible pursuing member prevents distant-home sleeping for the entire garrison', () => {
  const { sim, update } = harness(), camp = blueprint(); update([camp]);
  const ids = sim.enemies.map(enemy => enemy.id), visible = sim.enemies[0];
  sim.player.x = 5000; visible.x = visible.prevX = 5000;
  update([], { x: 4800, y: -200, width: 400, height: 400 });
  assert.deepEqual(sim.enemies.map(enemy => enemy.id), ids);
  assert.equal(visible.x, 5000, 'visible actors cannot be snapped to home when the camp sleeps');
});

test('hidden engaged roamers cannot be retired to admit an approaching camp', () => {
  for (const [state, awareness] of [['patrol', 1], ['chase', 0], ['windup', 0], ['attack', 0], ['recover', 0]] as const) {
    const { sim, ledger, update } = harness();
    update([normalCamp('a', 100), normalCamp('b', 250)]);
    const roamers = Array.from({ length: ENCOUNTER_RULES.hardPopulationCap - 12 }, (_, index) => sim.spawnEnemy('stalker', -800 - index * 30, 0)!);
    for (const enemy of roamers) { enemy.state = state; enemy.awareness = awareness; }
    const near = normalCamp('near', 450, ENCOUNTER_RULES.hardPopulationCap - ENCOUNTER_RULES.roamingReserve - 12), view = { x: -300, y: -250, width: 600, height: 500 };
    update([near], view);
    assert.equal(ledger.getState(near.id), 'dormant', state);
    assert.ok(roamers.every(enemy => sim.enemies.includes(enemy)), `${state}: hidden fighters stay alive`);
    for (const enemy of roamers) { enemy.state = 'return'; enemy.awareness = .25; }
    update([near], view); assert.equal(ledger.getState(near.id), 'active');
    assert.equal(roamers.filter(enemy => sim.enemies.includes(enemy)).length, ENCOUNTER_RULES.roamingReserve);
  }
});

test('an engaged member protects the whole hidden camp from priority eviction and distant sleeping', () => {
  for (const [state, awareness] of [['idle', 1], ['chase', 0], ['windup', 0], ['attack', 0], ['recover', 0]] as const) {
    const { sim, ledger, update } = harness();
    const a = blueprint('a', 800), b = blueprint('b', 1100), near = blueprint('near', 450);
    update([a, b]);
    const guards = [sim.enemies.find(enemy => enemy.campId === a.id)!, sim.enemies.find(enemy => enemy.campId === b.id)!];
    for (const guard of guards) { guard.state = state; guard.awareness = awareness; }
    const ids = sim.enemies.map(enemy => enemy.id);
    update([near], { x: -300, y: -250, width: 600, height: 500 });
    assert.equal(ledger.getState(near.id), 'dormant', state); assert.deepEqual(sim.enemies.map(enemy => enemy.id), ids);
    sim.player.x = 5000; update([], { x: 4800, y: -250, width: 400, height: 500 });
    assert.deepEqual(sim.enemies.map(enemy => enemy.id), ids, `${state}: the group waits for its fighters`);
    for (const guard of guards) { guard.state = 'return'; guard.awareness = .25; }
    update([], { x: 4800, y: -250, width: 400, height: 500 });
    assert.equal(sim.enemies.length, 0); assert.equal(ledger.getState(a.id), 'active'); assert.equal(ledger.getState(b.id), 'active');
    assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0);
  }
});

test('saved camp casualties do not respawn or duplicate rewards when the rest of a garrison reloads', () => {
  const first = harness(), camp = blueprint(); first.update([camp]);
  const killed = first.sim.enemies[0]; killed.hp = 0; killed.state = 'dead';
  const second = harness(); second.ledger.restoreDefeated(first.ledger.defeatedMembers());
  assert.equal(second.ledger.getState(camp.id), 'active'); assert.equal(second.ledger.recordedCount, 1);
  second.update([camp]);
  assert.equal(second.sim.enemies.length, 2);
  assert.ok(second.sim.enemies.every(enemy => enemy.campMemberId !== killed.campMemberId));
  assert.equal(second.sim.kills, 0); assert.equal(second.sim.groundItems.length, 0);
  for (const enemy of second.sim.enemies) { enemy.hp = 0; enemy.state = 'dead'; }
  assert.equal(second.ledger.getState(camp.id), 'cleared');
  assert.equal(second.ledger.defeatedMembers()[camp.id].length, 3);
  const third = harness(); third.ledger.restoreCleared(second.ledger.clearedIds()); third.ledger.restoreDefeated(second.ledger.defeatedMembers());
  third.update([camp]); assert.equal(third.sim.enemies.length, 0); assert.equal(third.ledger.getState(camp.id), 'cleared');
});
