import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { awardCharacterExperience, assignSkill, refreshCharacter } from '../src/character.ts';
import { equipItem, unequipItem } from '../src/inventory.ts';
import { generateItem } from '../src/items.ts';
import { allocateNode, SKILL_NODES, SKILL_TREE } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import type { Enemy, Input, WorldQuery } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';

const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const createSim = () => new Simulation(emptyWorld, { spawn: false, seed: 984319 });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, { ...idle, ...input });
}
function target(sim: Simulation, x = 45, y = 0, hp = 10000): Enemy {
  const enemy = sim.spawnEnemy('brute', x, y)!;
  enemy.hp = enemy.maxHp = hp; enemy.state = 'recover'; enemy.stateDuration = 999;
  return enemy;
}
function equipForSkill(sim: Simulation, id: SkillId): void {
  const required = SKILL_DEFINITIONS[id].requirement;
  const profile = required === 'staff' ? 'ember-staff' : required === 'bow' ? 'thorn-shortbow'
    : required === 'dagger' ? 'rondel-dagger' : required === 'heavy' ? 'hand-axe' : 'longsword';
  const item = generateItem(723, 1, 'weapon', profile); item.implicit = {}; item.affixes = [];
  sim.player.character.inventory[47] = item;
  assert.ok(equipItem(sim.player.character, 47, sim.player.level).ok);
  if (required === 'shield') {
    const shield = generateItem(724, 1, 'shield', 'iron-buckler'); shield.affixes = [];
    sim.player.character.inventory[47] = shield;
    assert.ok(equipItem(sim.player.character, 47, sim.player.level).ok);
  }
  refreshCharacter(sim.player);
}
function unlock(sim: Simulation, id: SkillId, slot = 0): void {
  equipForSkill(sim, id);
  const major = SKILL_TREE.nodes.find(node => node.skill === id)!;
  const paths = new Map<string, string[]>([['origin', []]]), queue = ['origin'];
  for (let index = 0; index < queue.length && !paths.has(major.id); index++) {
    for (const neighbor of SKILL_NODES.get(queue[index])!.neighbors) if (!paths.has(neighbor)) {
      paths.set(neighbor, [...paths.get(queue[index])!, neighbor]); queue.push(neighbor);
    }
  }
  const path = paths.get(major.id)!;
  sim.player.character.skillPoints += path.filter(node => !sim.player.character.allocatedNodes.includes(node)).length;
  for (const node of path) if (!sim.player.character.allocatedNodes.includes(node)) assert.ok(allocateNode(sim.player.character, node).ok);
  refreshCharacter(sim.player);
  assert.ok(assignSkill(sim.player, slot, id).ok);
}

test('multi-level rewards grant one skill and five attribute points per level without assigning or healing', () => {
  const sim = createSim(), player = sim.player;
  player.xp = 80; player.hp = 42; player.mana = 63;
  player.character.statPoints = 3; player.character.skillPoints = 2;
  const beforeAttributes = { ...player.character.attributes }, beforeStats = { ...player.derived };
  assert.equal(awardCharacterExperience(player, 805), 4);
  assert.equal(player.level, 5); assert.equal(player.xp, 80);
  assert.equal(player.character.skillPoints, 6); assert.equal(player.character.statPoints, 23);
  assert.deepEqual(player.character.attributes, beforeAttributes); assert.deepEqual(player.derived, beforeStats);
  assert.equal(player.hp, 42); assert.equal(player.mana, 63);
  assert.equal(awardCharacterExperience(player, 0), 0);
  assert.equal(player.character.skillPoints, 6); assert.equal(player.character.statPoints, 23);
});

test('equipping an item changes actual melee damage and repeated attack timing through shared stats', () => {
  const sim = createSim(), weapon = generateItem(455, 1, 'weapon', 'longsword');
  weapon.weapon!.damage = 40; weapon.weapon!.baseAttacksPerSecond = 1;
  weapon.implicit = { damagePercent: 50, attackSpeedPercent: 25 }; weapon.affixes = [];
  sim.player.character.inventory[4] = weapon;
  assert.ok(equipItem(sim.player.character, 4, sim.player.level).ok); refreshCharacter(sim.player);
  const enemy = target(sim, 35);
  advance(sim, FIXED_STEP, { attack: true });
  close(sim.player.attack!.duration, .8); assert.equal(sim.player.attack!.damage, 60);
  advance(sim, 4 - FIXED_STEP, { attack: true });
  const events = sim.drainEvents(), hits = events.filter(event => event.type === 'hit');
  assert.equal(events.filter(event => event.type === 'swing').length, 5);
  assert.ok(hits.length >= 4); assert.ok(hits.every(event => event.value === 60));
  assert.equal(enemy.hp, 10000 - hits.length * 60);
});

test('equipping larger resource pools preserves current values and removing gear clamps them', () => {
  const sim = createSim(), item = generateItem(879, 1, 'head'), player = sim.player;
  item.implicit = { maxHp: 40, maxMana: 30 }; item.affixes = [];
  player.hp = 37; player.mana = 29; player.character.inventory[4] = item;
  assert.ok(equipItem(player.character, 4, 1).ok); refreshCharacter(player);
  assert.equal(player.maxHp, 140); assert.equal(player.maxMana, 130);
  assert.equal(player.hp, 37); assert.equal(player.mana, 29);
  player.hp = 138; player.mana = 128;
  assert.ok(unequipItem(player.character, 'head').ok); refreshCharacter(player);
  assert.equal(player.maxHp, 100); assert.equal(player.maxMana, 100);
  assert.equal(player.hp, 100); assert.equal(player.mana, 100);
  assert.ok(unequipItem(player.character, 'weapon').ok); refreshCharacter(player);
  assert.equal(player.equipment.mainHand.visual.kind, 'unarmed');
  assert.ok(deriveAttackStats(player.stats, player.equipment.mainHand).damage < 24);
});

test('all five empty slots and a locked skill are inert and cannot consume mana', () => {
  const sim = createSim();
  assert.equal(assignSkill(sim.player, 0, 'fireball').ok, false);
  for (let slot = 0; slot < 5; slot++) advance(sim, .2, { skillSlot: slot });
  sim.player.character.skillSlots[0] = 'fireball';
  advance(sim, .2, { skillSlot: 0 });
  assert.equal(sim.player.mana, 100);
  assert.equal(sim.projectiles.length, 0); assert.equal(sim.player.attack, null);
  assert.equal(sim.player.castTime, 0); assert.deepEqual(sim.player.skillCooldowns, {});
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast' || event.type === 'swing' || event.type === 'hit').length, 0);
});

for (const id of Object.keys(SKILL_DEFINITIONS) as SkillId[]) {
  test(`${id} unlocks through connected nodes, pays its cost once and produces its actual combat effect`, () => {
    const sim = createSim(); unlock(sim, id);
    const player = sim.player, definition = SKILL_DEFINITIONS[id];
    const enemy = target(sim, id === 'fireball' || id === 'volley' || id === 'siphon' ? 80 : 45);
    if (id === 'siphon') player.hp = 20;
    player.mana = player.maxMana;
    sim.drainEvents();
    advance(sim, FIXED_STEP, { skillSlot: 0, aimX: enemy.x });
    close(player.mana, player.maxMana - Math.max(1, Math.round(definition.manaCost * player.derived.manaCostMultiplier * 10) / 10));
    close(player.skillCooldowns[id]!, definition.cooldown * player.derived.cooldownMultiplier);
    const firstEvents = sim.drainEvents();
    assert.equal(firstEvents.filter(event => (event.type === 'cast' || event.type === 'swing') && event.skill === id).length, 1);
    if (id === 'cleave' || id === 'whirlwind') {
      assert.ok(player.attack); assert.ok(player.attack.arc > Math.PI);
      assert.ok(player.attack.damage > deriveAttackStats(player.stats, player.equipment.mainHand).damage);
    } else if (id === 'lunge') {
      assert.ok(player.x > 0 && player.x < 10, 'dash advances over time, not a teleport');
    } else if (id === 'bulwark') assert.ok(player.guardTime > 2.9);
    else if (id === 'meteor' || id === 'rainOfArrows') assert.equal(sim.groundEffects.length, 1);
    advance(sim, id === 'meteor' ? 1 : .5, { aimX: enemy.x });
    const laterEvents = sim.drainEvents();
    assert.equal(laterEvents.filter(event => event.type === 'cast' || event.type === 'swing').length, 0);
    if (id !== 'bulwark') assert.ok(enemy.hp < enemy.maxHp, `${id} must damage the actual enemy`);
    if (id === 'siphon') {
      assert.ok(player.hp > 20); assert.ok(laterEvents.some(event => event.type === 'heal' && event.value! > 0));
    }

  });
}

test('skill cooldown belongs to the skill and cannot be reset by moving it to another slot', () => {
  const sim = createSim(); unlock(sim, 'frostLance');
  advance(sim, FIXED_STEP, { skillSlot: 0 }); sim.drainEvents();
  assert.ok(assignSkill(sim.player, 4, 'frostLance').ok);
  assert.equal(sim.player.character.skillSlots[0], null); assert.equal(sim.player.character.skillSlots[4], 'frostLance');
  advance(sim, .4, { skillSlot: 4 });
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 0);
  advance(sim, 1.5, { skillSlot: 4 });
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 1);
});

test('insufficient mana and blocked geometry prevent free or wall-crossing skill effects', () => {
  const sim = createSim(); unlock(sim, 'iceNova');
  sim.player.mana = 0;
  advance(sim, FIXED_STEP, { skillSlot: 0 });
  assert.ok(sim.player.mana < 1); assert.equal(sim.player.activeSkill, null); assert.equal(sim.player.skillCooldowns.iceNova, undefined);
  const wall: WorldQuery = { blocked: x => x >= 30 && x <= 40,
    move: (x, y, dx, dy, radius) => x + dx + radius >= 30 ? { x, y } : { x: x + dx, y: y + dy } };
  const blocked = new Simulation(wall, { spawn: false }); unlock(blocked, 'lunge');
  const behind = target(blocked, 55);
  advance(blocked, FIXED_STEP, { skillSlot: 0 });
  assert.ok(blocked.player.x < 30); assert.equal(behind.hp, behind.maxHp);
});

test('armor, passive regeneration and movement gear affect simulation rather than only the character panel', () => {
  const sim = createSim(), item = sim.player.character.equipped.chest!;
  item.implicit = { armor: 120, lifeRegen: 6, manaRegen: 3, moveSpeedPercent: 20 };
  refreshCharacter(sim.player);
  const enemy = sim.spawnEnemy('brute', -20, 0)!;
  enemy.state = 'attack'; enemy.attackAngle = 0; enemy.stateDuration = 999;
  advance(sim, FIXED_STEP);
  assert.equal(sim.player.hp, 89);
  assert.equal(sim.drainEvents().find(event => event.type === 'hurt')!.value, 11);
  sim.enemies = []; sim.player.hp = 50; sim.player.mana = 20;
  advance(sim, 1, { moveX: 1 });
  close(sim.player.hp, 56); close(sim.player.mana, 32);
  assert.ok(sim.player.vx > 197 && sim.player.vx <= 198);
});

test('the first real death drops loot and awards level points exactly once', () => {
  const sim = createSim(); sim.player.xp = 90;
  const enemy = sim.spawnEnemy('stalker', 45, 0)!; enemy.hp = 1; enemy.stateDuration = 999;
  advance(sim, .25, { attack: true });
  assert.equal(enemy.state, 'dead'); assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.player.level, 2); assert.equal(sim.player.xp, 10);
  assert.equal(sim.player.character.skillPoints, 1); assert.equal(sim.player.character.statPoints, 5);
  assert.equal(sim.groundItems[0].item.itemLevel, 1, 'the source level owns loot even when the kill levels the player');
  const id = sim.groundItems[0].item.id;
  advance(sim, 1, { attack: true });
  assert.equal(sim.kills, 1); assert.equal(sim.player.xp, 10);
  assert.equal(sim.groundItems.length, 1); assert.equal(sim.groundItems[0].item.id, id);
  const events = sim.drainEvents();
  assert.equal(events.filter(event => event.type === 'kill').length, 1);
  const levels = events.filter(event => event.type === 'level');
  assert.equal(levels.length, 1);
  assert.equal(levels[0].level, sim.player.level);
  assert.equal(levels[0].skillPoints, 1); assert.equal(levels[0].statPoints, 5);
});

test('repeated seeded enemy deaths generate reproducible loot with unique identities', () => {
  const run = () => {
    const sim = createSim();
    for (let wave = 0; wave < 4; wave++) {
      for (let count = 0; count < 10; count++) {
        const enemy = sim.spawnEnemy('stalker', 48, 0)!; assert.ok(enemy);
        enemy.hp = 1; enemy.stateDuration = 999;
      }
      advance(sim, .75, { attack: true });
    }
    assert.equal(sim.kills, 40);
    assert.ok(sim.groundItems.length > 5);
    assert.equal(new Set(sim.groundItems.map(drop => drop.item.id)).size, sim.groundItems.length);
    return sim.groundItems.map(drop => drop.item);
  };
  assert.deepEqual(run(), run());
});

test('a full inventory preserves dropped loot until a cell is available, then collects it once', () => {
  const sim = createSim();
  sim.player.character.inventory = Array.from({ length: 64 }, (_, index) => generateItem(9000 + index, 1));
  const enemy = sim.spawnEnemy('stalker', 22, 0)!; enemy.hp = 1; enemy.stateDuration = 999;
  advance(sim, .25, { attack: true });
  assert.equal(sim.groundItems.length, 1);
  const drop = sim.groundItems[0];
  assert.equal(sim.player.character.inventory.some(item => item?.id === drop.item.id), false);
  assert.ok(sim.drainEvents().some(event => event.type === 'notice' && event.message.includes('Inventory full')));
  sim.player.x = drop.x; sim.player.y = drop.y;
  sim.player.character.inventory[7] = null;
  advance(sim, FIXED_STEP);
  assert.equal(sim.groundItems.length, 0); assert.equal(sim.player.character.inventory.at(7)?.id, drop.item.id);
  advance(sim, .25);
  assert.equal(sim.player.character.inventory.filter(item => item?.id === drop.item.id).length, 1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'loot' && event.item.id === drop.item.id).length, 1);
  assert.equal(sim.player.xp, ENEMY_DEFINITIONS.stalker.xpReward);
});

test('starting a new run resets character allocations, points, inventory changes and drops together', () => {
  const sim = createSim(); unlock(sim, 'iceNova'); awardCharacterExperience(sim.player, 800);
  sim.player.character.inventory.fill(null);
  sim.groundItems.push({ id: 991, x: 10, y: 10, item: generateItem(991, 4) });
  sim.reset();
  assert.equal(sim.player.level, 1); assert.equal(sim.player.xp, 0);
  assert.equal(sim.player.character.skillPoints, 0); assert.equal(sim.player.character.statPoints, 0);
  assert.deepEqual(sim.player.character.allocatedNodes, ['origin']);
  assert.deepEqual(sim.player.character.skillSlots, [null, null, null, null, null]);
  assert.equal(sim.player.character.inventory.filter(Boolean).length, 0);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.player.skillCooldowns, {});
});


test('a projectile already in flight cannot revive a fallen player through life on hit', () => {
  const sim = createSim(), enemy = target(sim, 40), player = sim.player;
  const armor = player.character.equipped.chest!;
  armor.implicit = { lifeOnHit: 20 }; refreshCharacter(player);
  player.hp = 1;
  const attacker = target(sim, -20); attacker.state = 'attack'; attacker.attackAngle = 0; attacker.stateDuration = 1;
  sim.projectiles.push({ hitIds: new Set(), id: 9999, x: 38, y: 0, prevX: 38, prevY: 0, vx: 360, vy: 0, angle: 0,
    radius: 5, damage: 10, life: 1, maxLife: 1, owner: 'player', sourceLevel: 1 });
  sim.update(FIXED_STEP, idle);
  assert.equal(player.dead, true); assert.equal(player.hp, 0);
  assert.ok(enemy.hp < enemy.maxHp);
});

test('held no-cooldown magic repeats at cast speed, never at physical attack speed', () => {
  const casts = (castSpeed: number, attackSpeed: number) => {
    const sim = createSim(); unlock(sim, 'fireball');
    sim.player.stats.castSpeedMultiplier = castSpeed;
    sim.player.stats.attackSpeedMultiplier = attackSpeed;
    sim.player.mana = sim.player.maxMana = 1000;
    advance(sim, 2, { skillSlot: 0 });
    assert.equal(sim.player.skillCooldowns.fireball, 0);
    return sim.drainEvents().filter(event => event.type === 'cast' && event.skill === 'fireball').length;
  };
  const normal = casts(1, 1);
  assert.ok(normal >= 2);
  assert.equal(casts(1, 3), normal);
  assert.ok(casts(2, 1) >= normal * 2 - 1);
});
