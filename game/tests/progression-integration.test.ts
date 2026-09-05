import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { awardCharacterExperience, refreshCharacter } from '../src/character.ts';
import { armorReduction } from '../src/progression-content.ts';
import { getZoneAt, scaledEnemyStats, ZONE_RULES } from '../src/zone-progression.ts';
import { awardExperience, xpForNextLevel, xpLevelFactor } from '../src/progression.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { generateItem } from '../src/items.ts';
import { sampleBiome } from '../src/biomes.ts';
import { LOOT_RULES, PLAYER_ABILITIES } from '../src/combat-content.ts';
import type { Enemy, Input, Projectile, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const createSim = () => new Simulation(world, { spawn: false, seed: 640981 });
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, { ...idle, ...input });
}
function prepareKill(enemy: Enemy): void {
  enemy.x = enemy.prevX = 45; enemy.y = enemy.prevY = 0;
  enemy.hp = 1; enemy.state = 'idle'; enemy.stateTime = 0; enemy.stateDuration = 999;
}
function projectile(sourceLevel: number): Projectile {
  return { id: 8100, sourceLevel, x: -20, y: 0, prevX: -20, prevY: 0, vx: 145, vy: 0,
    angle: 0, radius: 5, damage: 40, owner: 'enemy', life: 1, maxLife: 1, hitIds: new Set() };
}

test('spawn geography snapshots monster health, damage, rank, biome, and XP independently of the player', () => {
  const sim = createSim(), x = ZONE_RULES.bandWidth * 3 + 50;
  const enemy = sim.spawnEnemy('brute', x, 0, 'elite')!;
  const expected = scaledEnemyStats('brute', 4, 'elite');
  assert.equal(getZoneAt(x, 0).level, 4); assert.equal(enemy.level, 4);
  assert.equal(enemy.rank, 'elite'); assert.equal(enemy.biome, sampleBiome(x, 0).id);
  assert.equal(enemy.hp, expected.maxHp); assert.equal(enemy.maxHp, expected.maxHp);
  assert.equal(enemy.damage, expected.damage); assert.equal(enemy.xpReward, expected.xpReward);
  const snapshot = { hp: enemy.hp, maxHp: enemy.maxHp, damage: enemy.damage, xpReward: enemy.xpReward,
    lootSeed: enemy.lootSeed, level: enemy.level, rank: enemy.rank, biome: enemy.biome };
  enemy.x = enemy.prevX = -20; enemy.y = enemy.prevY = 0;
  enemy.stateDuration = 999;
  sim.player.level = 40;
  sim.player.character.equipped.chest!.implicit = { armor: 120 };
  refreshCharacter(sim.player);
  advance(sim, .1);
  assert.deepEqual({ hp: enemy.hp, maxHp: enemy.maxHp, damage: enemy.damage, xpReward: enemy.xpReward,
    lootSeed: enemy.lootSeed, level: enemy.level, rank: enemy.rank, biome: enemy.biome }, snapshot);
  enemy.state = 'attack'; enemy.stateTime = 0; enemy.stateDuration = 999; enemy.attackAngle = 0;
  advance(sim, FIXED_STEP);
  const hurt = sim.drainEvents().find(event => event.type === 'hurt')!;
  assert.equal(hurt.value, Math.round(expected.damage * (1 - armorReduction(120, 4))));
  assert.notEqual(hurt.value, Math.round(expected.damage * (1 - armorReduction(120, sim.player.level))));
});

test('source-level XP and rank loot survive moving home and the kill itself gaining multiple levels', () => {
  const sim = createSim(), enemy = sim.spawnEnemy('brute', ZONE_RULES.bandWidth * 3 + 20, 0, 'elite')!;
  const source = { seed: enemy.lootSeed, level: enemy.level, rank: enemy.rank, biome: enemy.biome,
    kind: enemy.kind, firstKill: true };
  sim.player.xp = 90;
  const expectedProgress = { level: 1, xp: 90 };
  const reward = Math.max(1, Math.round(enemy.xpReward * xpLevelFactor(expectedProgress.level, enemy.level)));
  awardExperience(expectedProgress, reward);
  prepareKill(enemy);
  advance(sim, .25, { attack: true });
  assert.equal(enemy.state, 'dead'); assert.equal(sim.kills, 1);
  assert.ok(sim.player.level > 2);
  assert.equal(sim.player.level, expectedProgress.level); assert.equal(sim.player.xp, expectedProgress.xp);
  assert.equal(sim.player.character.skillPoints, expectedProgress.level - 1);
  assert.equal(sim.player.character.statPoints, (expectedProgress.level - 1) * 5);
  assert.deepEqual(sim.groundItems.map(drop => drop.item), rollEnemyLoot(source));
  assert.ok(sim.groundItems.every(drop => drop.item.itemLevel === 6));
  const count = sim.groundItems.length;
  advance(sim, .6, { attack: true });
  assert.equal(sim.kills, 1); assert.equal(sim.groundItems.length, count);
  assert.equal(sim.player.xp, expectedProgress.xp);
});

test('combat RNG draws and gear/pickup entity IDs cannot change later source seeds or loot', () => {
  const filled = createSim(), empty = createSim();
  filled.player.derived.critChance = .75;
  filled.groundItems = Array.from({ length: LOOT_RULES.maxGroundItems }, (_, index) => ({
    id: 50_000 + index, x: 10_000, y: 10_000, item: generateItem(9000 + index, 1),
  }));
  for (const sim of [filled, empty]) {
    const first = sim.spawnEnemy('stalker', 45, 0)!;
    prepareKill(first); advance(sim, .25, { attack: true });
    assert.equal(sim.kills, 1);
  }
  assert.notEqual(filled.pickups[0].id, empty.pickups[0].id, 'different gear outcomes consumed different entity IDs');
  for (const sim of [filled, empty]) {
    sim.enemies = []; sim.groundItems = []; sim.pickups = [];
    advance(sim, .6);
  }
  const a = filled.spawnEnemy('caster', -ZONE_RULES.bandWidth - 50, 0, 'elite')!;
  const b = empty.spawnEnemy('caster', -ZONE_RULES.bandWidth - 50, 0, 'elite')!;
  assert.notEqual(a.id, b.id);
  assert.equal(a.lootSeed, b.lootSeed);
  prepareKill(a); prepareKill(b);
  advance(filled, .25, { attack: true }); advance(empty, .25, { attack: true });
  assert.equal(filled.kills, 2); assert.equal(empty.kills, 2);
  assert.deepEqual(filled.groundItems.map(drop => drop.item), empty.groundItems.map(drop => drop.item));
  assert.ok(filled.groundItems.length > 0);
});

test('a caster bolt snapshots source level and scaled damage through its caster death and a player level change', () => {
  const sim = createSim(), caster = sim.spawnEnemy('caster', ZONE_RULES.bandWidth * 8 + 30, 0, 'veteran')!;
  const sourceDamage = caster.damage, sourceLevel = caster.level;
  caster.x = caster.prevX = caster.homeX = -150; caster.y = caster.prevY = 0;
  caster.state = 'windup'; caster.stateDuration = 0; caster.attackAngle = 0;
  sim.player.character.equipped.chest!.implicit = { armor: 120 }; refreshCharacter(sim.player);
  advance(sim, FIXED_STEP);
  const bolt = sim.projectiles.find(shot => shot.owner === 'enemy')!;
  assert.ok(bolt); assert.equal(bolt.sourceLevel, sourceLevel); assert.equal(bolt.damage, sourceDamage);
  prepareKill(caster);
  advance(sim, .25, { attack: true });
  assert.equal(caster.state, 'dead');
  assert.ok(sim.projectiles.includes(bolt));
  sim.player.level = 50; refreshCharacter(sim.player);
  const beforeHp = sim.player.hp;
  advance(sim, 1);
  assert.equal(bolt.sourceLevel, 9); assert.equal(bolt.damage, sourceDamage);
  assert.equal(beforeHp - sim.player.hp, Math.round(sourceDamage * (1 - armorReduction(120, sourceLevel))));
  assert.equal(sim.drainEvents().filter(event => event.type === 'hurt').length, 1);
});

test('equal-damage projectiles use their own source levels for armor instead of current player or local-zone level', () => {
  const losses: number[] = [];
  for (const sourceLevel of [1, 20]) {
    const sim = createSim();
    sim.player.level = 50;
    sim.player.character.equipped.chest!.implicit = { armor: 120 }; refreshCharacter(sim.player);
    sim.projectiles.push(projectile(sourceLevel));
    advance(sim, .1);
    const loss = 100 - sim.player.hp; losses.push(loss);
    assert.equal(loss, Math.round(40 * (1 - armorReduction(120, sourceLevel))));
    assert.equal(sim.drainEvents().filter(event => event.type === 'hurt').length, 1);
  }
  assert.ok(losses[1] > losses[0]);
});

test('level gains refresh the sheet armor estimate without healing, spending points, or altering the actual armor', () => {
  const sim = createSim(), player = sim.player;
  player.character.equipped.chest!.implicit = { armor: 120 };
  player.hp = 40; player.mana = 30; refreshCharacter(player);
  assert.equal(player.derived.damageReduction, armorReduction(120, 1));
  assert.equal(awardCharacterExperience(player, xpForNextLevel(1)), 1);
  assert.equal(player.level, 2); assert.equal(player.derived.armor, 120);
  assert.equal(player.derived.damageReduction, armorReduction(120, 2));
  assert.equal(player.hp, 40); assert.equal(player.mana, 30);
  assert.equal(player.character.skillPoints, 1); assert.equal(player.character.statPoints, 5);
  assert.deepEqual(player.character.attributes, { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 });
});

test('potion recovery scales with maximum life, consumes a charge only when useful, and clamps to missing life', () => {
  const sim = createSim(), player = sim.player;
  player.character.equipped.chest!.implicit = { maxHp: 900, maxMana: 1900, manaRegen: -9 };
  refreshCharacter(player);
  assert.equal(player.maxHp, 1000); assert.equal(player.maxMana, 2000);
  assert.equal(player.hp, 100); assert.equal(player.mana, 100, 'larger resource pools grant no free restoration');
  advance(sim, FIXED_STEP, { heal: true });
  assert.equal(player.hp, 100 + 1000 * PLAYER_ABILITIES.heal.restoreFraction);
  assert.equal(player.flasks, 1);
  advance(sim, 1);
  player.hp = 990;
  advance(sim, FIXED_STEP, { heal: true });
  assert.equal(player.hp, 1000); assert.equal(player.flasks, 0);
  assert.deepEqual(sim.drainEvents().filter(event => event.type === 'heal').map(event => event.value), [420, 10]);
  advance(sim, 1); player.flasks = 1;
  advance(sim, FIXED_STEP, { heal: true });
  assert.equal(player.flasks, 1); assert.equal(player.hp, 1000);
});

test('death pickups retain the health cadence and restore percentages of current maxima with missing-resource clamps', () => {
  const sim = createSim(), player = sim.player;
  player.character.equipped.chest!.implicit = { maxHp: 900, maxMana: 1900, manaRegen: -9 };
  refreshCharacter(player); player.hp = player.maxHp; player.mana = player.maxMana;
  for (let index = 0; index < 3; index++) {
    const enemy = sim.spawnEnemy('stalker', 45, 0)!; prepareKill(enemy);
    advance(sim, .75, { attack: true });
  }
  assert.equal(sim.kills, 3);
  assert.deepEqual(sim.pickups.map(pickup => pickup.kind), ['mana', 'mana', 'health']);
  assert.deepEqual(sim.pickups.map(pickup => pickup.restoreFraction), [.16, .16, .12]);
  player.hp = 100; player.mana = 0;
  for (const pickup of sim.pickups) { pickup.x = 0; pickup.y = 0; }
  advance(sim, FIXED_STEP);
  assert.equal(player.hp, 220); assert.equal(player.mana, 640); assert.equal(sim.pickups.length, 0);
  player.hp = 997; player.mana = 1998;
  sim.pickups.push({ id: 91_001, x: 0, y: 0, kind: 'health', restoreFraction: LOOT_RULES.healthFraction, life: 20, radius: 4 },
    { id: 91_002, x: 0, y: 0, kind: 'mana', restoreFraction: LOOT_RULES.manaFraction, life: 20, radius: 4 });
  sim.drainEvents(); advance(sim, FIXED_STEP);
  assert.equal(player.hp, 1000); assert.equal(player.mana, 2000);
  assert.deepEqual(sim.drainEvents().filter(event => event.type === 'pickup').map(event => event.value), [3, 2]);
});
