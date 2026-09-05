import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { ENCOUNTER_RULES, encounterPopulationTarget, livingEnemyCount } from '../src/encounter-director.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { getZoneAt, scaledEnemyStats } from '../src/zone-progression.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import type { CombatEvent, Enemy, Input, WorldQuery } from '../src/model.ts';
import type { EnemyCamp } from '../src/wilderness-sites.ts';

// Freeze movement to inspect population lifecycle independently of pursuit/combat feel.
const open: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }), sampleBiome: () => ({ id: 'deadwood' }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
type View = { x: number; y: number; width: number; height: number };
const viewAt = (x = 0, y = 0, width = 1300, height = 900): View => ({ x: x - width / 2, y: y - height / 2, width, height });
function advance(sim: Simulation, seconds: number): Extract<CombatEvent, { type: 'spawn' }>[][] {
  const batches: Extract<CombatEvent, { type: 'spawn' }>[][] = [];
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) {
    sim.update(FIXED_STEP, idle);
    const births = sim.drainEvents().filter(event => event.type === 'spawn');
    if (births.length) batches.push(births);
  }
  return batches;
}
function outsideView(x: number, y: number, radius: number, view: View): boolean {
  return x + radius < view.x || x - radius > view.x + view.width
    || y + radius < view.y || y - radius > view.y + view.height;
}
const ambient = (sim: Simulation) => sim.enemies.filter(enemy => !enemy.campId && enemy.state !== 'dead');

test('automatic populations wait for a valid view on both construction and reset', () => {
  const camp: EnemyCamp = { id: 'near', x: 1100, y: 0, radius: 100,
    members: [{ id: 'near:guard', kind: 'stalker', rank: 'normal', dx: 0, dy: 0 }] };
  const sim = new Simulation({ ...open, getEnemyCamps: () => [camp] }, { seed: 78 });
  assert.equal(sim.enemies.length, 0);
  assert.deepEqual(advance(sim, 12), []); assert.equal(sim.enemies.length, 0);
  sim.setSpawnExclusion({ x: 0, y: 0, width: Infinity, height: 900 });
  assert.deepEqual(advance(sim, 6), []);
  sim.setSpawnExclusion(viewAt()); advance(sim, 12);
  assert.ok(sim.enemies.length > 0);
  sim.reset(); assert.equal(sim.enemies.length, 0);
  assert.deepEqual(advance(sim, 12), [], 'reset must obtain the fresh camera view before automatic births');
});

test('wide world views still receive wholly offscreen solitary and small grouped encounters', () => {
  const batchSizes = new Set<number>();
  for (const width of [1300, 2600]) {
    const sim = new Simulation(open, { seed: 64391 });
    const view = viewAt(0, 0, width, width * .64); sim.setSpawnExclusion(view);
    const batches = advance(sim, 20);
    assert.ok(batches.length > 0, `${width}-unit viewport must not starve the population`);
    for (const batch of batches) {
      batchSizes.add(batch.length); assert.ok(batch.length >= 1 && batch.length <= 3);
      for (const event of batch) {
        const radius = ENEMY_DEFINITIONS[event.enemyKind!].radius;
        assert.ok(outsideView(event.x, event.y, radius + 70, view), 'the complete body and visual margin spawn outside view');
      }
      for (const event of batch) assert.ok(Math.hypot(event.x - batch[0].x, event.y - batch[0].y) < 250,
        'members of one roaming group share a compact formation');
    }
    assert.ok(ambient(sim).length <= encounterPopulationTarget(1));
    assert.ok(livingEnemyCount(sim.enemies) <= ENCOUNTER_RULES.hardPopulationCap);
  }
  assert.ok([...batchSizes].some(size => size > 1), 'seeded samples include a small group');
});

test('standing on cleared ground does not refill it from elapsed time or camera zoom alone', () => {
  const sim = new Simulation(open, { seed: 681 }); sim.setSpawnExclusion(viewAt());
  advance(sim, 20); assert.ok(ambient(sim).length > 0);
  for (const enemy of sim.enemies) { enemy.state = 'dead'; enemy.hp = 0; }
  advance(sim, 1); sim.drainEvents();
  assert.deepEqual(advance(sim, 60), []);
  sim.setSpawnExclusion(viewAt(0, 0, 2600, 1700));
  assert.deepEqual(advance(sim, 20), []);
  sim.setSpawnExclusion(viewAt()); assert.deepEqual(advance(sim, 20), []);
});

test('camp garrisons do not consume the ambient target while all actors share the hard cap', () => {
  const sim = new Simulation(open, { seed: 356 }); sim.setSpawnExclusion(viewAt());
  for (let index = 0; index < ENCOUNTER_RULES.hardPopulationCap - encounterPopulationTarget(1); index++) assert.ok(sim.spawnEnemy('stalker', -1100, -250 + index * 45, 'normal', {
    campId: 'authored', memberId: `authored:${index}`, lootSeed: 500 + index,
  }));
  sim.drainEvents(); advance(sim, 20);
  assert.equal(ambient(sim).length, encounterPopulationTarget(1));
  assert.equal(livingEnemyCount(sim.enemies), ENCOUNTER_RULES.hardPopulationCap);
  assert.equal(sim.spawnEnemy('stalker', 1500, 100), null, 'manual and automatic sources share the final guard');
});

test('automatic placement rejects blocked terrain and sanctuary regions', () => {
  for (const mode of ['blocked', 'sanctuary'] as const) {
    let checks = 0;
    const world: WorldQuery = { ...open,
      blocked: () => { checks++; return mode === 'blocked'; },
      isSanctuary: () => { checks++; return mode === 'sanctuary'; },
    };
    const sim = new Simulation(world, { seed: 257 }); sim.setSpawnExclusion(viewAt());
    assert.deepEqual(advance(sim, 20), [], mode); assert.equal(sim.enemies.length, 0, mode);
    assert.ok(checks > 0 && checks < 25000, 'rejected terrain retries remain bounded');
  }
});

test('a cleared authored footprint remains reserved from ambient placement', () => {
  // Oversized synthetic reservation covers every sampled placement, isolating the exclusion rule.
  const camp: EnemyCamp = { id: 'cleared-site', x: 0, y: 0, radius: 100000,
    members: [{ id: 'cleared-site:guard', kind: 'stalker', rank: 'normal', dx: 1100, dy: 0 }] };
  const sim = new Simulation({ ...open, getEnemyCamps: () => [camp] }, { seed: 15 }); sim.setSpawnExclusion(viewAt());
  advance(sim, 1); assert.equal(sim.enemies.length, 1); assert.equal(sim.enemies[0].campId, camp.id);
  sim.enemies[0].state = 'dead'; sim.enemies[0].hp = 0;
  assert.deepEqual(advance(sim, 20), []);
  assert.equal(sim.getCampState(camp.id), 'cleared'); assert.equal(sim.enemies.length, 0);
});

test('ambient retirement preserves visible actors and grants no kill rewards', () => {
  const sim = new Simulation(open, { seed: 52 });
  sim.setSpawnExclusion(viewAt(0, 0, 3000, 3000));
  const visible = sim.spawnEnemy('stalker', 1450, 1450)!;
  const distant = sim.spawnEnemy('hound', -10000, -10000)!;
  assert.ok(visible && distant); sim.drainEvents(); advance(sim, 2);
  assert.ok(sim.enemies.includes(visible), 'a viewport corner beyond the old 1800-unit radius must stay alive');
  assert.ok(!sim.enemies.includes(distant), 'far hidden inactive ambient actors release population capacity');
  assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0); assert.equal(sim.groundItems.length, 0);
});

test('automated roaming keeps source geography and deterministic loot after the player advances', () => {
  const sim = new Simulation(open, { seed: 901, startX: 6400 });
  sim.setSpawnExclusion(viewAt(6400)); advance(sim, 20);
  const enemy = ambient(sim)[0]; assert.ok(enemy);
  const source = { level: enemy.level, rank: enemy.rank, biome: enemy.biome, kind: enemy.kind, seed: enemy.lootSeed, firstKill: true };
  const stats = scaledEnemyStats(enemy.kind, getZoneAt(enemy.homeX, enemy.homeY).level, enemy.rank);
  assert.equal(enemy.level, getZoneAt(enemy.homeX, enemy.homeY).level);
  assert.equal(enemy.damage, stats.damage); assert.equal(enemy.xpReward, stats.xpReward); assert.equal(enemy.maxHp, stats.maxHp);
  const items = rollEnemyLoot(source);
  sim.player.level = 20; enemy.x = enemy.prevX = sim.player.x + 45; enemy.y = enemy.prevY = sim.player.y;
  enemy.hp = 1; enemy.state = 'recover'; enemy.stateDuration = 999;
  sim.projectiles.push({ id: 99999, sourceLevel: 20, x: enemy.x - 18, y: enemy.y, prevX: enemy.x - 18,
    prevY: enemy.y, vx: 2000, vy: 0, angle: 0, radius: 5, damage: 1000, life: 1, maxLife: 1, owner: 'player', hitIds: new Set() });
  advance(sim, .1);
  assert.equal(enemy.state, 'dead'); assert.equal(sim.kills, 1);
  assert.deepEqual(sim.groundItems.map(drop => drop.item), items);
  assert.deepEqual({ level: enemy.level, rank: enemy.rank, biome: enemy.biome, kind: enemy.kind, seed: enemy.lootSeed, firstKill: true }, source);
});

test('seed and real headless travel reproduce hidden forward encounters and source rewards', () => {
  const run = (seed: number) => {
    const sim = new Simulation({ ...open, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { seed });
    sim.player.invulnerable = 999;
    const trace: Array<Pick<Enemy, 'id' | 'kind' | 'rank' | 'homeX' | 'homeY' | 'lootSeed' | 'level'>> = [];
    let ahead = 0, births = 0;
    for (let tick = 0; tick < 48 / FIXED_STEP; tick++) {
      const view = viewAt(sim.player.x, sim.player.y, 2600, 1650); sim.setSpawnExclusion(view);
      const moveX = tick < 32 / FIXED_STEP ? 1 : 0, moveY = tick >= 16 / FIXED_STEP ? 1 : 0;
      sim.update(FIXED_STEP, { ...idle, moveX, moveY, aimX: sim.player.x + 300, aimY: sim.player.y });
      for (const event of sim.drainEvents().filter(event => event.type === 'spawn')) {
        assert.ok(outsideView(event.x, event.y, ENEMY_DEFINITIONS[event.enemyKind!].radius + 70, view));
        births++;
        if ((event.x - sim.player.x) * moveX + (event.y - sim.player.y) * moveY > 0) ahead++;
      }
      for (const enemy of ambient(sim)) if (!trace.some(value => value.id === enemy.id)) trace.push({
        id: enemy.id, kind: enemy.kind, rank: enemy.rank, homeX: enemy.homeX, homeY: enemy.homeY, lootSeed: enemy.lootSeed, level: enemy.level,
      });
    }
    assert.ok(trace.length > 5, 'travel brings additional roaming enemies into the forward population');
    assert.ok(ahead > births * .6, 'new encounters favor the travelled direction');
    return trace;
  };
  assert.deepEqual(run(581), run(581)); assert.notDeepEqual(run(581), run(582));
});

test('ordinary travel actually reaches roaming encounters instead of only spawning distant actors', () => {
  for (const width of [1300, 2600]) {
    const sim = new Simulation({ ...open, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { seed: 581 });
    sim.player.invulnerable = 999;
    const encountered = new Set<number>();
    let births = 0;
    for (let tick = 0; tick < 60 / FIXED_STEP; tick++) {
      const p = sim.player, view = viewAt(p.x, p.y, width, width * .64);
      sim.setSpawnExclusion(view);
      sim.update(FIXED_STEP, { ...idle, moveX: 1, aimX: p.x + 300, aimY: p.y });
      for (const event of sim.drainEvents().filter(event => event.type === 'spawn')) {
        births++;
        assert.ok(outsideView(event.x, event.y, ENEMY_DEFINITIONS[event.enemyKind!].radius + 70, view));
      }
      for (const enemy of ambient(sim)) if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < 300) encountered.add(enemy.id);
      assert.ok(livingEnemyCount(sim.enemies) <= ENCOUNTER_RULES.hardPopulationCap);
    }
    assert.ok(encountered.size >= 12, `${width}: a minute of travel should reach several packs`);
    assert.ok(encountered.size >= births * .6, `${width}: most placements should lie along the travelled route`);
  }
});
