import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, createCharacterSheet, itemAffixPool } from '../src/items.ts';
import { ELEMENTAL_AFFIXES, isElementalAffix, weaponImpactStyle } from '../src/elemental-weapon.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { improveItem } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import { createBaseStats, deriveAttackStats } from '../src/equipment.ts';
import { refreshCharacter } from '../src/character.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { heldEquipmentLights } from '../src/weapon-emission.ts';
import { playerPose } from '../src/character-pose.ts';
import { getPlayerSwordTip } from '../src/character-motion.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import type { Item } from '../src/character-types.ts';

const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const enchanted = (index = 0, level = 1): Item => {
  const item = generateItem(781, level, 'weapon', 'longsword', 'magic'), affix = ELEMENTAL_AFFIXES[index];
  item.affixes = [{ name: affix.name, stat: affix.stat, value: 0 }]; item.recipe.rolls = [.5];
  return deriveItem(item);
};
test('melee affixes roll one real elemental identity; all ranged and nonweapon pools exclude them', () => {
  const seen = new Set<string>();
  for (const profile of WEAPON_PROFILES) for (let seed = 0; seed < 80; seed++) {
    const item = generateItem(seed, 8, 'weapon', profile.id, 'legendary');
    const affixes = item.affixes.filter(a => isElementalAffix(a.stat));
    assert.ok(affixes.length <= (profile.attackKind === 'melee' ? 1 : 0));
    assert.equal(Boolean(item.weapon!.enchantment), affixes.length === 1); assert.ok(validItem(item));
    if (affixes.length) seen.add(affixes[0].stat);
  }
  assert.equal(seen.size, 3);
  for (const kind of ['shield', 'orb', 'grimoire', 'ring', 'chest'] as const) assert.ok(itemAffixPool({ kind }).every(a => !isElementalAffix(a.stat)));
});
test('enchantment damage scales with gear and physical attack bonuses once; the other hand receives no bonus', () => {
  const item = enchanted(), stats = { ...createBaseStats(), attackDamageMultiplier: 2, spellDamageMultiplier: 100 };
  assert.equal(deriveAttackStats(stats, item.weapon!).damage, Math.round((item.weapon!.damage + item.affixes[0].value) * 2));
  const sim = new Simulation(world, { spawn: false });
  sim.player.character = createCharacterSheet(); sim.player.character.equipped.weapon = generateItem(7, 1, 'weapon', 'longsword', 'common');
  sim.player.character.equipped.offhand = null; refreshCharacter(sim.player);
  const before = deriveAttackStats(sim.player.stats, sim.player.equipment.mainHand);
  sim.player.character.equipped.offhand = item; refreshCharacter(sim.player);
  assert.deepEqual(deriveAttackStats(sim.player.stats, sim.player.equipment.mainHand), before);
  assert.ok(enchanted(0, 30).weapon!.enchantment!.damage > item.weapon!.enchantment!.damage);
});
test('enhancement, rarity, relevel and rerolls rebuild the enchantment without retaining removed powers', () => {
  let item = enchanted(); const original = item.weapon!.enchantment!.damage;
  item = improveItem(item, 'enhance', 1, 44); assert.ok(item.weapon!.enchantment!.damage > original);
  item = improveItem(item, 'relevel', 10, 45); assert.ok(validItem(item));
  item = improveItem(item, 'rarity', 10, 46); assert.equal(item.affixes.filter(a => isElementalAffix(a.stat)).length, 1);
  for (let seed = 0; seed < 60; seed++) {
    const rerolled = improveItem(item, 'rerollAll', 10, seed); assert.ok(validItem(rerolled));
    assert.ok(rerolled.affixes.filter(a => isElementalAffix(a.stat)).length <= 1);
  }
  let removed: Item | undefined;
  for (let seed = 0; seed < 100 && !removed; seed++) {
    const candidate = improveItem(enchanted(), 'rerollOne', 1, seed, 0);
    if (!candidate.weapon!.enchantment) removed = candidate;
  }
  assert.ok(removed); assert.equal(removed.weapon!.visual.glow, undefined); assert.equal(weaponImpactStyle(removed.weapon!), undefined);
});
test('one snapshotted enchanted swing applies added damage and elemental death feedback after a gear change', () => {
  const sim = new Simulation(world, { spawn: false }), item = enchanted(1);
  sim.player.character.equipped.weapon = item; sim.player.character.equipped.offhand = null; refreshCharacter(sim.player);
  const enemy = sim.spawnEnemy('hound', 30, 0)!; enemy.hp = 1; enemy.state = 'recover'; enemy.stateDuration = enemy.stateTime = 99;
  const input = { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: true, dodge: false, heal: false, skillSlot: null };
  sim.update(FIXED_STEP, input); const expected = sim.player.attack!.damage;
  sim.player.character.equipped.weapon = generateItem(3, 1, 'weapon', 'longsword', 'common'); refreshCharacter(sim.player);
  for (let i = 0; i < 100; i++) sim.update(FIXED_STEP, { ...input, attack: false });
  const events = sim.drainEvents(), hits = events.filter(e => e.type === 'hit');
  assert.equal(hits.length, 1); assert.equal(hits[0].value, expected); assert.equal(hits[0].style, 'frost');
  assert.equal(events.find(e => e.type === 'kill')?.style, 'frost'); assert.equal(sim.kills, 1);
});
test('caster lights follow actual tip geometry at all facings; offhand focus has its own bounded emitter', () => {
  const sim = new Simulation(world, { spawn: false });
  for (const profile of WEAPON_PROFILES.filter(p => p.attackKind === 'bolt')) {
    sim.player.character.equipped.weapon = generateItem(3, 1, 'weapon', profile.id, 'common');
    sim.player.character.equipped.offhand = profile.hands === 1 ? generateItem(7, 1, 'orb', 'cinder-orb', 'common') : null; refreshCharacter(sim.player);
    for (let i = 0; i < 8; i++) {
      sim.player.angle = i * Math.PI / 4;
      const pose = playerPose(sim.player, 2), lights = heldEquipmentLights(pose, 0, 0), tip = getPlayerSwordTip(pose);
      assert.equal(lights.length, profile.hands === 1 ? 2 : 1);
      assert.ok(Math.hypot(lights[0].x - tip.x, lights[0].y - tip.y) < 2);
      assert.ok(lights.every(l => Number.isFinite(l.x + l.y + l.power + l.radius) && l.core > 0 && l.radius <= 170));
      pose.effectTime = 0; const reduced = heldEquipmentLights(pose, 0, 0);
      assert.deepEqual(heldEquipmentLights(pose, 0, 0), reduced);
      pose.dead = true; assert.deepEqual(heldEquipmentLights(pose, 0, 0), []);
    }
  }
});
test('saved enchanted equipment round-trips, and forged or mismatched elemental projections are rejected', async () => {
  const item = enchanted(2); assert.ok(validItem(JSON.parse(JSON.stringify(item))));
  const bad = structuredClone(item); bad.weapon!.enchantment!.damage++; assert.equal(validItem(bad), false);
  const bow = generateItem(9, 1, 'weapon', 'thorn-shortbow', 'magic'); bow.affixes = item.affixes; assert.equal(validItem(bow), false);
  const store = new Map<string, string>(), repo = new CharacterRepository({ getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } });
  const session = new CharacterSession(repo, 6), sim = new Simulation(world, { spawn: false });
  sim.player.character.equipped.weapon = item; sim.player.character.equipped.offhand = null; refreshCharacter(sim.player);
  assert.ok(await session.create(0, 'Ember', 7319, sim.captureCheckpoint(), 'element-test', 100), session.error);
  const records = await repo.list();
  assert.deepEqual(records[0]?.record?.checkpoint.character.equipped.weapon?.weapon?.enchantment, item.weapon!.enchantment);
});
