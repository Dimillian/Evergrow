import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { assignSkill, refreshCharacter } from '../src/character.ts';
import { equipItem } from '../src/inventory.ts';
import { generateItem } from '../src/items.ts';
import { allocateNode, SKILL_TREE } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import type { Attack, CombatEvent, Enemy, Input, WorldQuery } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';

const openWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 400, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const make = (world = openWorld) => new Simulation(world, { spawn: false, seed: 984319 });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, { ...idle, ...input });
}
function target(sim: Simulation, x: number, y = 0, hp = 100000): Enemy {
  const enemy = sim.spawnEnemy('brute', x, y)!; enemy.hp = enemy.maxHp = hp;
  enemy.state = 'idle'; enemy.stateDuration = 999; enemy.angle = Math.PI;
  return enemy;
}
function equip(sim: Simulation, profileId: string, offhand = false): void {
  const weapon = WEAPON_PROFILES.find(profile => profile.id === profileId), shield = SHIELD_PROFILES.find(profile => profile.id === profileId);
  assert.ok(weapon || shield);
  const item = generateItem(77191, 1, shield ? 'shield' : 'weapon', profileId);
  item.implicit = {}; item.affixes = [];
  if (weapon) item.weapon = { ...weapon, visual: { ...weapon.visual } };
  if (shield) item.shield = { ...shield, visual: { ...shield.visual } };
  sim.player.character.inventory[47] = item;
  assert.ok(equipItem(sim.player.character, 47, 1, offhand || shield ? 'offhand' : 'weapon').ok);
  refreshCharacter(sim.player);
}
function unlock(sim: Simulation, id: SkillId): void {
  const major = SKILL_TREE.nodes.find(node => node.skill === id)!;
  const path = previewSkillRoute(buildSkillRoutes(new Set(sim.player.character.allocatedNodes)), major.id).slice(1);
  sim.player.character.skillPoints += path.length;
  for (const node of path) assert.ok(allocateNode(sim.player.character, node).ok);
  refreshCharacter(sim.player); assert.ok(assignSkill(sim.player, 0, id).ok);
  // Incidental critical chance from connecting dexterity nodes is irrelevant to exact hit-count tests.
  sim.player.derived.critChance = 0;
}
function skillSim(id: SkillId, world = openWorld): Simulation {
  const sim = make(world), requirement = SKILL_DEFINITIONS[id].requirement;
  equip(sim, requirement === 'bow' ? 'thorn-shortbow' : requirement === 'staff' ? 'ember-staff'
    : requirement === 'dagger' ? 'rondel-dagger' : requirement === 'heavy' ? 'hand-axe' : 'longsword');
  if (requirement === 'shield') equip(sim, 'iron-buckler');
  unlock(sim, id); sim.drainEvents(); return sim;
}
function cast(sim: Simulation, aimX = 400, aimY = 0): void { sim.update(FIXED_STEP, { ...idle, aimX, aimY, skillSlot: 0 }); }
const hitEvents = (events: CombatEvent[], enemy?: Enemy) => events.filter(event => event.type === 'hit' && (!enemy || event.targetId === enemy.id));
function incoming(sim: Simulation, damage = 40): void {
  sim.projectiles.push({ id: 99999, x: -12, y: 0, prevX: -12, prevY: 0, vx: 600, vy: 0, angle: 0, radius: 4,
    damage, life: 1, sourceLevel: 1, maxLife: 1, owner: 'enemy', hitIds: new Set() });
}

for (const profile of ['thorn-shortbow', 'ember-staff']) {
  test(`${profile} basic attack releases once per cycle at weapon cadence and never deals a melee arc`, () => {
    const sim = make(); equip(sim, profile);
    const straight = target(sim, 160), beside = target(sim, 35, 35);
    sim.update(FIXED_STEP, { ...idle, attack: true });
    const attack = sim.player.attack!; assert.equal(attack.kind, 'ranged');
    assert.equal(sim.projectiles.length, 0, 'windup does not release early');
    const duration = attack.duration, release = attack.activeStart;
    advance(sim, 6 - FIXED_STEP, { attack: true });
    const events = sim.drainEvents(), casts = events.filter(event => event.type === 'cast');
    assert.equal(casts.length, Math.floor((6 - FIXED_STEP - release) / duration) + 1);
    assert.equal(events.filter(event => event.type === 'swing').length, 0);
    assert.ok(straight.hp < straight.maxHp); assert.equal(beside.hp, beside.maxHp);
    assert.ok(hitEvents(events, straight).length <= casts.length, 'one release cannot repeatedly hit its target');
  });
}

test('a ranged windup retains its original damage and projectile style after an equipment swap', () => {
  const sim = make(); equip(sim, 'thorn-shortbow');
  sim.update(FIXED_STEP, { ...idle, attack: true });
  const original = sim.player.attack!, damage = original.damage;
  equip(sim, 'ember-staff'); advance(sim, original.activeStart + FIXED_STEP);
  const projectile = sim.projectiles[0]!;
  assert.ok(projectile); assert.equal(projectile.damage, damage); assert.equal(projectile.effects!.style, 'arrow');
  assert.equal(sim.player.attack, original); assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 1);
});

test('dual wield alternates actual main/off-hand damage and duration snapshots', () => {
  const sim = make(); equip(sim, 'longsword'); equip(sim, 'hand-axe', true);
  const main = deriveAttackStats(sim.player.stats, sim.player.equipment.mainHand);
  const off = sim.player.equipment.offHand!; assert.equal(off.kind, 'weapon');
  const other = deriveAttackStats(sim.player.stats, off.kind === 'weapon' ? off.weapon : sim.player.equipment.mainHand);
  const attacks: Attack[] = [];
  for (let tick = 0; tick < 500 && attacks.length < 4; tick++) {
    sim.update(FIXED_STEP, { ...idle, attack: true });
    if (sim.player.attack && sim.player.attack !== attacks.at(-1)) attacks.push(sim.player.attack);
  }
  assert.deepEqual(attacks.map(attack => attack.hand), ['main', 'off', 'main', 'off']);
  assert.deepEqual(attacks.map(attack => attack.damage), [main.damage, other.damage, main.damage, other.damage]);
  attacks.forEach((attack, index) => close(attack.duration, 1 / (index % 2 ? other.attacksPerSecond : main.attacksPerSecond)));
});

test('an unlocked bow skill stays assigned but cannot spend mana or cast after equipping a sword', () => {
  const sim = skillSim('piercingShot'); equip(sim, 'longsword');
  const mana = sim.player.mana;
  cast(sim); advance(sim, .2);
  assert.equal(sim.player.character.skillSlots[0], 'piercingShot'); assert.equal(sim.player.mana, mana);
  assert.equal(sim.player.skillCooldowns.piercingShot, undefined); assert.equal(sim.projectiles.length, 0);
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 0);
});

test('lunge advances continuously, hits each crossed target once, and stops at solid walls', () => {
  const sim = skillSim('lunge'), first = target(sim, 45), second = target(sim, 100);
  cast(sim); assert.ok(sim.player.x > 0 && sim.player.x < 10);
  advance(sim, .35);
  close(sim.player.x, 124.8); assert.equal(sim.player.dash, null);
  const events = sim.drainEvents(); assert.equal(hitEvents(events, first).length, 1); assert.equal(hitEvents(events, second).length, 1);
  const wall: WorldQuery = { blocked: x => x >= 60 && x <= 80,
    move: (x, y, dx, dy, radius) => x + dx + radius >= 60 ? { x, y } : { x: x + dx, y: y + dy } };
  const blocked = skillSim('lunge', wall), behind = target(blocked, 100);
  cast(blocked); advance(blocked, .35);
  assert.ok(blocked.player.x + blocked.player.radius < 60); assert.equal(behind.hp, behind.maxHp);
});

test('piercing shot damages exactly four distinct targets and leaves a fifth untouched', () => {
  const sim = skillSim('piercingShot'), targets = Array.from({ length: 5 }, (_, index) => target(sim, 65 + index * 65));
  cast(sim); advance(sim, 1);
  const events = sim.drainEvents();
  for (let index = 0; index < 5; index++) assert.equal(hitEvents(events, targets[index]).length, index < 4 ? 1 : 0);
  assert.equal(sim.projectiles.length, 0);
});

test('ricochet strikes four different enemies once and cannot bounce through a wall', () => {
  const sim = skillSim('ricochet');
  const targets = [[65, 0], [110, 65], [185, 25], [225, 100], [300, 80]].map(([x, y]) => target(sim, x, y));
  cast(sim, 400); advance(sim, 1.4);
  const events = sim.drainEvents(), hits = hitEvents(events);
  assert.equal(hits.length, 4); assert.equal(new Set(hits.map(event => event.targetId)).size, 4);
  assert.equal(events.filter(event => event.type === 'chain').length, 3);
  assert.equal(targets.filter(enemy => enemy.hp < enemy.maxHp).length, 4);
  const wall: WorldQuery = { ...openWorld, blocked: x => x >= 100 && x <= 115 };
  const blocked = skillSim('ricochet', wall), first = target(blocked, 60), behind = target(blocked, 145, 25);
  cast(blocked); advance(blocked, 1);
  assert.equal(hitEvents(blocked.drainEvents(), first).length, 1); assert.equal(behind.hp, behind.maxHp);
});

test('fireball explodes once into nearby enemies and burns for three seconds without periodic crits or life on hit', () => {
  const sim = skillSim('fireball'), direct = target(sim, 80), splash = target(sim, 85, 45), far = target(sim, 250, 60);
  sim.player.derived.critChance = 1; sim.player.derived.critMultiplier = 2; sim.player.derived.lifeOnHit = 4; sim.player.hp = 20;
  cast(sim); advance(sim, .35);
  const impact = sim.drainEvents();
  assert.equal(hitEvents(impact, direct).length, 1); assert.equal(hitEvents(impact, splash).length, 1); assert.equal(far.hp, far.maxHp);
  assert.equal(impact.filter(event => event.type === 'blast' && event.skill === 'fireball').length, 1);
  assert.ok(hitEvents(impact).every(event => event.heavy));
  close(sim.player.hp, 28); assert.ok(direct.burnTime > 2.7 && splash.burnTime > 2.7);
  const dps = direct.burnDps;
  advance(sim, 3.3);
  const burning = sim.drainEvents();
  for (const enemy of [direct, splash]) {
    const ticks = hitEvents(burning, enemy);
    assert.equal(ticks.length, 6); assert.ok(ticks.every(event => !event.heavy && event.value === Math.round(dps * .5)));
    assert.equal(enemy.burnTime, 0); assert.equal(enemy.burnDps, 0);
  }
  close(sim.player.hp, 28);
});

test('ice nova halves movement until its slowing status expires', () => {
  const sim = skillSim('iceNova'), enemy = target(sim, 105);
  cast(sim); sim.drainEvents();
  assert.equal(enemy.slowFactor, .5); assert.ok(enemy.slowTime > 2.4);
  enemy.x = enemy.prevX = 330; enemy.knockbackX = enemy.knockbackY = 0; enemy.state = 'chase';
  advance(sim, .1); const slowedSpeed = Math.hypot(enemy.vx, enemy.vy);
  assert.ok(slowedSpeed > 0);
  enemy.state = 'idle'; enemy.stateDuration = 999;
  advance(sim, 2.5); assert.equal(enemy.slowTime, 0); assert.equal(enemy.slowFactor, 1);
  enemy.x = enemy.prevX = 330; enemy.y = enemy.prevY = 0; enemy.state = 'chase';
  advance(sim, .1); close(Math.hypot(enemy.vx, enemy.vy), slowedSpeed * 2);
});

test('Arc Lightning deals successive hits without making a jump through blocked geometry', () => {
  const wall: WorldQuery = { ...openWorld, blocked: x => x >= 100 && x <= 115 };
  const sim = skillSim('arcLightning', wall), visible = target(sim, 60), behind = target(sim, 140);
  cast(sim, 60); advance(sim, .3);
  const events = sim.drainEvents();
  assert.equal(hitEvents(events, visible).length, 1); assert.equal(behind.hp, behind.maxHp);
  assert.equal(events.filter(event => event.type === 'chain').length, 1);
});

test('rain of arrows waits for its marker then produces exactly four actual damage pulses', () => {
  const sim = skillSim('rainOfArrows'), enemy = target(sim, 180);
  cast(sim, 180); advance(sim, .3);
  assert.equal(enemy.hp, enemy.maxHp); assert.equal(sim.groundEffects.length, 1);
  assert.equal(hitEvents(sim.drainEvents()).length, 0);
  advance(sim, 1.5);
  const events = sim.drainEvents();
  assert.equal(hitEvents(events, enemy).length, 4); assert.equal(events.filter(event => event.type === 'blast' && event.skill === 'rainOfArrows').length, 4);
  assert.equal(sim.groundEffects.length, 0);
  advance(sim, 1); assert.equal(hitEvents(sim.drainEvents(), enemy).length, 0);
});

test('meteor waits for impact, explodes exactly once, and applies its burning status', () => {
  const sim = skillSim('meteor'), enemy = target(sim, 180);
  cast(sim, 180); advance(sim, .7); assert.equal(enemy.hp, enemy.maxHp);
  advance(sim, .25);
  const events = sim.drainEvents();
  assert.equal(hitEvents(events, enemy).length, 1); assert.equal(events.filter(event => event.type === 'blast' && event.skill === 'meteor').length, 1);
  assert.equal(sim.groundEffects.length, 0); assert.ok(enemy.burnTime > 2.8 && enemy.burnDps > 0);
  advance(sim, 3.2);
  assert.equal(sim.drainEvents().filter(event => event.type === 'blast' && event.skill === 'meteor').length, 0);
  assert.equal(enemy.burnTime, 0);
});

test('shield blocks apply their reduction, while Bulwark guarantees stronger reduction then expires', () => {
  const shield = skillSim('bulwark'); shield.player.derived.blockChance = 1; shield.player.derived.blockReduction = .55;
  incoming(shield); advance(shield, FIXED_STEP);
  assert.equal(shield.player.hp, 82); assert.equal(shield.drainEvents().find(event => event.type === 'block')!.value, 22);
  const guard = skillSim('bulwark'); guard.player.derived.blockChance = 0; guard.player.derived.blockReduction = .55;
  cast(guard); incoming(guard); advance(guard, FIXED_STEP);
  assert.equal(guard.player.hp, 90); assert.equal(guard.drainEvents().find(event => event.type === 'block')!.value, 30);
  advance(guard, 3.1); assert.equal(guard.player.guardTime, 0);
  incoming(guard); advance(guard, FIXED_STEP);
  assert.equal(guard.player.hp, 50); assert.equal(guard.drainEvents().filter(event => event.type === 'block').length, 0);
});

for (const variant of ['normal', 'critical', 'overkill', 'cap'] as const) {
  test(`Soul Siphon heals from actual HP removed (${variant})`, () => {
    const sim = skillSim('siphon'), enemy = target(sim, 80, 0, variant === 'overkill' ? 7 : 10000);
    sim.player.hp = variant === 'cap' ? sim.player.maxHp - 2 : 10;
    sim.player.derived.critChance = variant === 'critical' ? 1 : 0; sim.player.derived.critMultiplier = 2;
    const beforePlayer = sim.player.hp, beforeEnemy = enemy.hp;
    cast(sim); advance(sim, .35);
    const removed = beforeEnemy - enemy.hp, expected = Math.min(sim.player.maxHp - beforePlayer, removed * .35);
    close(sim.player.hp - beforePlayer, expected);
    const events = sim.drainEvents(); assert.equal(events.filter(event => event.type === 'heal').length, 1);
    close(events.find(event => event.type === 'heal')!.value!, expected);
    assert.equal(hitEvents(events, enemy)[0].heavy, variant === 'critical');
  });
}

test('a spirit already in flight cannot restore life after an enemy kills the player in that tick', () => {
  const sim = skillSim('siphon'), enemy = target(sim, 85);
  sim.player.hp = 1; cast(sim);
  const spirit = sim.projectiles[0]!; assert.ok(spirit);
  spirit.x = spirit.prevX = 69; spirit.y = spirit.prevY = 0;
  const attacker = target(sim, -20); attacker.state = 'attack'; attacker.attackAngle = 0; attacker.stateDuration = 999;
  advance(sim, FIXED_STEP);
  assert.equal(sim.player.dead, true); assert.equal(sim.player.hp, 0);
  assert.ok(enemy.hp < enemy.maxHp, 'the in-flight projectile still contacts its enemy');
  assert.equal(sim.drainEvents().filter(event => event.type === 'heal').length, 0);
});
