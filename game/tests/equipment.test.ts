import { stockTestGear } from './fixtures/character-pack.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaseStats, createStartingEquipment, deriveAttackStats, getGripLength, getSupportGripOffset, getWeaponGrip,
  STARTING_SWORD, weaponActionRate } from '../src/equipment.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { refreshCharacter } from '../src/character.ts';
import { equipItem } from '../src/inventory.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';

test('equipment instances and character modifiers never mutate the authored starting weapon or another player', () => {
  const first = createStartingEquipment(), second = createStartingEquipment();
  const stats = createBaseStats(); stats.attackSpeedMultiplier = 3;
  first.mainHand.damage = 72; first.mainHand.visual.length = 45; first.mainHand.visual.gripLength = 18;
  assert.equal(second.mainHand.damage, 24); assert.equal(second.mainHand.visual.length, 30);
  assert.equal(second.mainHand.visual.gripLength, 12); assert.equal(createBaseStats().attackSpeedMultiplier, 1);
  assert.equal(STARTING_SWORD.damage, 24);
  assert.ok(Object.isFrozen(STARTING_SWORD) && Object.isFrozen(STARTING_SWORD.visual));
  assert.throws(() => Object.assign(STARTING_SWORD.visual, { length: 0 }), TypeError);
});

test('malformed grip lengths fall back to a connected finite two-hand attachment', () => {
  for (const gripLength of [NaN, Infinity, -Infinity, undefined]) {
    const visual = { ...STARTING_SWORD.visual, gripLength };
    assert.equal(getGripLength(visual), 12);
    assert.ok(Number.isFinite(getSupportGripOffset(visual)));
    assert.ok(getSupportGripOffset(visual) > -getGripLength(visual) && getSupportGripOffset(visual) < -4);
  }
  assert.equal(getGripLength({ ...STARTING_SWORD.visual, gripLength: -10 }), 8);
  assert.equal(getGripLength({ ...STARTING_SWORD.visual, gripLength: 100 }), 20);
});

test('multiplication overflow cannot inject infinite damage into combat state or feedback events', () => {
  const weapon = { ...STARTING_SWORD, damage: Number.MAX_VALUE };
  const stats = { castSpeedMultiplier: 1, attackSpeedMultiplier: 1, attackDamageMultiplier: Number.MAX_VALUE, spellDamageMultiplier: 1 };
  const derived = deriveAttackStats(stats, weapon);
  assert.equal(derived.damage, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(derived.damage));
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  sim.player.equipment.mainHand = weapon; sim.player.stats = stats;
  const enemy = sim.spawnEnemy('brute', 35, 0)!;
  enemy.stateDuration = 100;
  for (let tick = 0; tick < 40; tick++) sim.update(FIXED_STEP,
    { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: true, dodge: false, heal: false, skillSlot: null });
  assert.equal(enemy.hp, 0); assert.equal(sim.kills, 1);
  const hit = sim.drainEvents().find(event => event.type === 'hit');
  assert.ok(hit && Number.isSafeInteger(hit.value));
  assert.equal(hit.remainingHp, 0);
});

test('invalid weapon and modifier inputs retain a finite resolvable basic attack', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0, -1]) {
    const result = deriveAttackStats({ castSpeedMultiplier: 1, attackSpeedMultiplier: invalid, attackDamageMultiplier: invalid, spellDamageMultiplier: invalid },
      { ...STARTING_SWORD, baseAttacksPerSecond: invalid, damage: invalid, reach: invalid, arc: invalid });
    assert.deepEqual(result, { attacksPerSecond: 2, damage: 24, range: 60, arc: STARTING_SWORD.arc });
  }
});


test('weapon profile selects the authored grip and attack or spell scaling independently', () => {
  const stats = { castSpeedMultiplier: 1, attackSpeedMultiplier: 1.5, attackDamageMultiplier: 2, spellDamageMultiplier: 3 };
  for (const weapon of WEAPON_PROFILES) {
    assert.equal(getWeaponGrip({ mainHand: weapon, offHand: null }), weapon.hands === 2 ? 'two-handed' : 'one-handed');
    const attack = deriveAttackStats(stats, weapon);
    assert.equal(attack.damage, Math.round(weapon.damage * (weapon.attackKind === 'bolt' ? 3 : 2)));
    assert.equal(attack.attacksPerSecond, weaponActionRate(weapon) * (weapon.family === 'staff' ? stats.castSpeedMultiplier : stats.attackSpeedMultiplier));
  }
});

test('refresh projects shield and dual weapon loadouts from the character sheet', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const player = sim.player;
  stockTestGear(player.character);
  assert.ok(equipItem(player.character, 0, 1).ok); assert.ok(equipItem(player.character, 4, 1).ok);
  refreshCharacter(player);
  assert.equal(player.equipment.mainHand.family, 'sword');
  const heldShield = player.equipment.offHand;
  assert.equal(heldShield?.kind, 'shield'); assert.ok(player.derived.blockChance > 0);
  assert.ok(equipItem(player.character, 7, 1, 'offhand').ok); refreshCharacter(player);
  assert.equal(player.equipment.offHand?.kind, 'weapon');
  if (player.equipment.offHand?.kind === 'weapon') assert.equal(player.equipment.offHand.weapon.family, 'dagger');
  assert.equal(player.derived.blockChance, 0);
  assert.equal(player.stats.spellDamageMultiplier, player.derived.spellDamageMultiplier);
});
