import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, ITEM_KINDS, itemAffixPool, affixConflicts } from '../src/items.ts';
import { isElementalAffix, ELEMENTAL_AFFIXES } from '../src/elemental-weapon.ts';
import { improveItem } from '../src/item-improvement.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { refreshCharacter } from '../src/character.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { skillWeapon } from '../src/skill-content.ts';
import { resolveSkill } from '../src/skill-progression.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { validItem } from '../src/item-validation.ts';
import { playerPose } from '../src/character-pose.ts';
import { playerMotion } from '../src/character-motion.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import type { Item, StatKey } from '../src/character-types.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const idle = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const singleAffix = (kind: Item['kind'], stat: StatKey): Item => {
  const item = generateItem(291, 1, kind, undefined, 'magic');
  item.affixes = [{ name: 'Test', stat, value: 0 }]; item.recipe.rolls = [.5]; return deriveItem(item);
};
test('new items and every reroll respect slot identity and exclusive affix groups', () => {
  for (const kind of ITEM_KINDS) for (let seed = 0; seed < 100; seed++) {
    let item = generateItem(seed, 10, kind, undefined, 'legendary');
    for (let operation = 0; operation < 3; operation++) {
      assert.ok(validItem(item)); assert.deepEqual(deriveItem(item), item);
      const stats = item.affixes.map(a => a.stat);
      assert.ok(stats.every((stat, index) => !affixConflicts(stat, stats.filter((_, i) => i !== index))));
      assert.ok(stats.every(stat => itemAffixPool(item).some(a => a.stat === stat)));
      if (stats.includes('moveSpeedPercent')) assert.ok(kind === 'boots' || kind === 'amulet');
      if (stats.includes('attackSpeedPercent') || stats.includes('castSpeedPercent')) assert.ok(kind === 'gloves' || kind === 'amulet');
      item = improveItem(item, operation ? 'rerollOne' : 'rerollAll', 10, seed + 498, 0);
    }
  }
  let item = generateItem(19, 1, 'gloves', undefined, 'common');
  for (let i = 0; i < 4; i++) { item = improveItem(item, 'rarity', 1, 24 + i); assert.equal(item.affixes.length, i + 1); }
});
test('specialist movement and speed rolls are twice amulet rolls, with bounded scaling', () => {
  assert.equal(singleAffix('boots', 'moveSpeedPercent').affixes[0].value, 10.9);
  assert.equal(singleAffix('gloves', 'attackSpeedPercent').affixes[0].value, 13.1);
  assert.equal(singleAffix('gloves', 'castSpeedPercent').affixes[0].value, 13.1);
  assert.ok(singleAffix('boots', 'moveSpeedPercent').affixes[0].value > singleAffix('amulet', 'moveSpeedPercent').affixes[0].value * 1.9);
});
test('elemental weapon affixes remain uncommon rolls in generation and enchanting', () => {
  let drops = 0, rerolls = 0;
  const count = 5000;
  for (let seed = 0; seed < count; seed++) {
    const item = generateItem(seed, 12, 'weapon', 'longsword', 'magic');
    drops += Number(item.affixes.some(a => isElementalAffix(a.stat)));
    rerolls += Number(improveItem(item, 'rerollAll', 12, seed + 10000).affixes.some(a => isElementalAffix(a.stat)));
  }
  for (const value of [drops, rerolls]) assert.ok(value / count > .02 && value / count < .08, `${value}/${count}`);
});
test('sword + offhand wand casts Fireball, keeps sword basics mana-free and round-trips saves', () => {
  const sim = new Simulation(world, { spawn: false }), p = sim.player;
  p.character.equipped.weapon = generateItem(3, 1, 'weapon', 'longsword', 'common'); p.character.equipped.offhand = null;
  p.character.inventory[0] = generateItem(4, 1, 'weapon', 'cinder-wand', 'common');
  assert.ok(executeCharacterCommand(p, { type: 'equip', index: 0, slot: 'offhand' }).ok);
  assert.equal(skillWeapon('fireball', p.equipment), p.character.equipped.offhand!.weapon);
  const checkpoint = sim.captureCheckpoint();
  assert.ok(decodeCharacterSave(JSON.stringify({ version: CHARACTER_SAVE_VERSION, id: 'hybrid-save', name: 'Hybrid', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 4, checkpoint })));
  for (let i = 0; i < 180; i++) { sim.update(FIXED_STEP, { ...idle, attack: true }); if (p.attack) assert.equal(p.attack.hand, 'main'); }
  assert.equal(p.mana, p.maxMana);
  for (let i = 0; i < 120; i++) sim.update(FIXED_STEP, idle);
  p.character.allocatedNodes.push('skill:fireball'); p.character.skillSlots[0] = 'fireball';
  const before = p.mana, resolved = resolveSkill('fireball', p.derived, p.character);
  const expectedDamage = deriveAttackStats(p.stats, p.character.equipped.offhand!.weapon!).damage * resolved.damageMultiplier;
  sim.update(FIXED_STEP, { ...idle, skillSlot: 0, rangedAim: { x: 0, y: 300 } });
  assert.equal(p.mana, before - resolved.mana); assert.equal(sim.projectiles.length, 1);
  assert.equal(sim.projectiles[0].damage, expectedDamage); assert.ok(Math.abs(sim.projectiles[0].angle - Math.PI / 2) < 1e-6);
  p.castTime = p.castDuration * .5;
  const pose = playerPose(p, 1), motion = playerMotion(pose), rest = playerMotion({ ...pose, cast: 0 });
  assert.equal(pose.attackHand, 'off'); assert.notDeepEqual(motion.offArm.hand, rest.offArm.hand);
  assert.deepEqual(motion.weaponArm.hand, rest.weaponArm.hand);
});
test('enchanted melee contacts apply burn, chill and interruption using snapshotted elemental potency', () => {
  for (const affix of ELEMENTAL_AFFIXES) {
    const sim = new Simulation(world, { spawn: false }), p = sim.player;
    let item = generateItem(51, 1, 'weapon', 'longsword', 'magic');
    item.affixes = [{ name: affix.name, stat: affix.stat, value: 0 }]; item.recipe.rolls = [.5]; item = deriveItem(item);
    p.character.equipped.weapon = item; p.character.equipped.offhand = null;
    p.character.attributes.intelligence = 30; refreshCharacter(p);
    const enemy = sim.spawnEnemy('brute', 30, 0)!; enemy.hp = enemy.maxHp = 10000; enemy.state = 'recover'; enemy.stateDuration = 99;
    sim.update(FIXED_STEP, { ...idle, attack: true });
    const expected = p.attack!.elementalDamage!;
    p.character.equipped.weapon = generateItem(9, 1, 'weapon', 'longsword', 'common'); p.character.attributes.intelligence = 10; refreshCharacter(p);
    for (let i = 0; i < 100 && enemy.hp === enemy.maxHp; i++) sim.update(FIXED_STEP, idle);
    assert.ok(enemy.hp < enemy.maxHp);
    if (affix.element === 'fire') { assert.ok(enemy.burnTime > 0); assert.equal(enemy.burnDps, expected * .15); }
    if (affix.element === 'frost') { assert.ok(enemy.slowTime > 0); assert.equal(enemy.slowFactor, .8); }
    if (affix.element === 'lightning') assert.ok(enemy.interrupted);
  }
});
test('basic caster elements apply real status and a single fire hit eventually stops burning', () => {
  for (const [profile, element] of [['cinder-wand', 'fire'], ['hoarfrost-wand', 'frost'], ['spark-wand', 'lightning']] as const) {
    const sim = new Simulation(world, { spawn: false }), p = sim.player;
    p.character.equipped.weapon = generateItem(11, 1, 'weapon', profile, 'common'); p.character.equipped.offhand = null; refreshCharacter(p);
    const enemy = sim.spawnEnemy('brute', 110, 0)!; enemy.hp = enemy.maxHp = 10000; enemy.state = 'recover'; enemy.stateDuration = 99;
    sim.update(FIXED_STEP, { ...idle, attack: true });
    for (let i = 0; i < 160 && enemy.hp === enemy.maxHp; i++) sim.update(FIXED_STEP, idle);
    assert.ok(enemy.hp < enemy.maxHp);
    if (element === 'frost') assert.ok(enemy.slowTime > 0);
    if (element === 'lightning') assert.ok(enemy.interrupted);
    if (element === 'fire') {
      assert.ok(enemy.burnTime > 0); const directHp = enemy.hp;
      for (let i = 0; i < 300; i++) sim.update(FIXED_STEP, idle);
      assert.equal(enemy.burnTime, 0); assert.ok(enemy.hp < directHp);
      const endHp = enemy.hp;
      for (let i = 0; i < 120; i++) sim.update(FIXED_STEP, idle);
      assert.equal(enemy.hp, endHp, 'periodic fire does not reignite itself');
    }
  }
});
