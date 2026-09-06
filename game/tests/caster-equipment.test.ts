import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, itemAffixPool, TIER_AFFIXES } from '../src/items.ts';
import { FOCUS_PROFILES } from '../src/focus-content.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { improveItem } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import { basicAttackManaCost, deriveAttackStats } from '../src/equipment.ts';
import { Simulation, initialPlayer } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { refreshCharacter } from '../src/character.ts';
import { skillWeapon, SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { itemFitsSlot } from '../src/inventory.ts';
import { previewEquipmentChange } from '../src/equipment-preview.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { itemIconSVG, itemDropShapes } from '../src/item-art.ts';
import { playerPose } from '../src/character-pose.ts';
import { playerMotion } from '../src/character-motion.ts';
import { characterBounds } from '../src/character-framing.ts';
import { vendorStock } from '../src/commerce.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import type { TownNPC } from '../src/npcs.ts';
import type { ItemTier, SkillId } from '../src/character-types.ts';

const put = (p: ReturnType<typeof initialPlayer>, id: string, seed: number) => {
  const item = generateItem(seed, 1, undefined, id, 'common');
  p.character.inventory[63] = item;
  assert.ok(executeCharacterCommand(p, { type: 'equip', index: 63 }).ok);
  return item;
};
test('wands use cast speed, spell power and cheaper bolts while supporting every magic skill and shield skills', () => {
  const stats = { castSpeedMultiplier: 1.5, attackSpeedMultiplier: 4, attackDamageMultiplier: 9, spellDamageMultiplier: 2 };
  for (const wand of WEAPON_PROFILES.filter(w => w.family === 'wand')) {
    const staff = WEAPON_PROFILES.find(w => w.family === 'staff' && w.damageType === wand.damageType) ?? WEAPON_PROFILES.find(w => w.id === 'ember-staff')!;
    const a = deriveAttackStats(stats, wand), b = deriveAttackStats(stats, staff);
    assert.ok(a.attacksPerSecond > b.attacksPerSecond && a.damage < b.damage);
    assert.equal(a.damage, wand.damage * 2);
    assert.equal(a.attacksPerSecond, wand.baseAttacksPerSecond * .8 * 1.5);
    assert.equal(basicAttackManaCost(wand, { manaCostMultiplier: 1 }), 2);
    const p = initialPlayer(0, 0); put(p, wand.id, 21); put(p, 'vigil-kite', 22);
    for (const [id, definition] of Object.entries(SKILL_DEFINITIONS)) if (definition.requirement === 'magic') assert.equal(skillWeapon(id as SkillId, p.equipment), p.equipment.mainHand);
    assert.ok(skillWeapon('shieldBash', p.equipment));
    assert.equal(itemFitsSlot(p.character.equipped.weapon!, 'offhand'), false, 'wands belong in the main hand');
  }
});
test('caster recipes survive every tier, level, upgrade, relevel and reroll with appropriate affixes', () => {
  for (const profile of [...FOCUS_PROFILES, ...WEAPON_PROFILES.filter(w => w.family === 'wand')]) {
    for (const level of [1, 80, 1_000_000]) for (const tier of Object.keys(TIER_AFFIXES) as ItemTier[]) {
      const item = generateItem(3781, level, undefined, profile.id, tier);
      assert.ok(validItem(item)); assert.deepEqual(deriveItem(item), item);
      assert.deepEqual(generateItem(3781, level, undefined, profile.id, tier), item);
      let next = improveItem(item, 'enhance', level, 61);
      assert.ok(validItem(next));
      if (tier !== 'legendary') next = improveItem(next, 'rarity', level, 81);
      if (next.affixes.length) {
        next = improveItem(next, 'rerollOne', level, 97, 0);
        next = improveItem(next, 'rerollAll', level, 132);
      }
      if (level < 1_000_000) next = improveItem(next, 'relevel', level + 5, 145);
      assert.ok(validItem(next));
      assert.ok(next.affixes.every(a => itemAffixPool(next).some(def => def.stat === a.stat)));
      assert.ok(!next.affixes.some(a => ['attackSpeedPercent', 'damagePercent', 'strength'].includes(a.stat)));
      assert.ok(Object.values(next.implicit).every(Number.isFinite));
    }
  }
});
test('wand + focus round-trips through save validation and projection, while forged hand/profile combinations fail', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  for (const [index, profile] of FOCUS_PROFILES.entries()) {
    sim.player.character.inventory.fill(null);
    put(sim.player, 'star-wand', 280 + index); const focus = put(sim.player, profile.id, 400 + index);
    assert.equal(sim.player.equipment.offHand?.kind, 'focus');
    const checkpoint = sim.captureCheckpoint();
    const record = { version: CHARACTER_SAVE_VERSION, id: 'caster-save', name: 'Caster', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 4, checkpoint };
    const loaded = decodeCharacterSave(JSON.stringify(record)); assert.ok(loaded);
    assert.deepEqual(loaded.checkpoint.character.equipped.offhand, focus);
    const wrongProfile = structuredClone(focus); wrongProfile.recipe.profileId = 'longsword'; assert.equal(validItem(wrongProfile), false);
    const wrongKind = structuredClone(focus); wrongKind.kind = 'shield'; assert.equal(validItem(wrongKind), false);
    const injectedWeapon = structuredClone(focus); injectedWeapon.weapon = sim.player.equipment.mainHand; assert.equal(validItem(injectedWeapon), false);
    checkpoint.character.equipped.weapon = generateItem(999, 1, 'weapon', 'ember-staff', 'common');
    assert.equal(decodeCharacterSave(JSON.stringify(record)), null, 'two-handed staff plus focus is invalid');
  }
});
test('focus stats preview exactly, staff swaps stow both pieces and full packs fail without losing items', () => {
  for (const profile of FOCUS_PROFILES) {
    const p = initialPlayer(0, 0); put(p, 'cinder-wand', 20);
    const before = { ...p.derived }; put(p, profile.id, 31);
    assert.ok(profile.visual.kind === 'grimoire' ? p.maxMana > before.maxMana : p.derived.spellDamageMultiplier > before.spellDamageMultiplier);
    const staff = generateItem(61, 1, 'weapon', 'ember-staff', 'common'); p.character.inventory[50] = staff;
    const preview = previewEquipmentChange(p.character, staff, 1, { sourceIndex: 50 }); assert.ok(preview.ok);
    assert.ok(executeCharacterCommand(p, { type: 'equip', index: 50 }).ok);
    assert.equal(p.character.equipped.offhand, null); assert.deepEqual(p.character.equipped, preview.equipped);
    for (const change of preview.changes) if (change.key === 'maxMana') assert.equal(p.maxMana, change.after);
    assert.ok(p.character.inventory.some(i => i?.recipe.profileId === profile.id));
    put(p, 'cinder-wand', 70); put(p, profile.id, 71);
    p.character.inventory = p.character.inventory.map((_, i) => generateItem(1000 + i, 1, 'head'));
    p.character.inventory[50] = staff;
    const snapshot = structuredClone(p);
    assert.equal(executeCharacterCommand(p, { type: 'equip', index: 50 }).ok, false);
    assert.deepEqual(p, snapshot);
  }
});
test('new foci appear in real loot and vendor stock, with shared finite inventory/drop/portrait geometry', () => {
  const p = initialPlayer(0, 0);
  const npc = { id: 'town:7319:0:building:2:jeweler', role: 'jeweler', level: 1 } as TownNPC;
  const stock = vendorStock(p.character, npc, 1);
  assert.equal(stock[6]?.kind, 'grimoire'); assert.equal(stock[7]?.kind, 'orb'); assert.ok(stock.every(validItem));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 1000; seed++) for (const item of rollEnemyLoot({ seed, level: 1, kind: 'caster', rank: 'elite', biome: 'swamp' })) seen.add(item.recipe.profileId ?? item.kind);
  for (const profile of FOCUS_PROFILES) {
    assert.ok(seen.has(profile.id)); const item = put(p, profile.id, 410); put(p, 'cinder-wand', 420);
    for (const size of [44, 120]) assert.ok(!/NaN|Infinity|undefined/.test(itemIconSVG(item, size)));
    assert.ok(itemDropShapes(item).length > 5);
    for (let facing = 0; facing < 8; facing++) {
      p.angle = facing * Math.PI / 4; refreshCharacter(p);
      assert.ok(Object.values(characterBounds(playerPose(p, 1))).every(Number.isFinite));
    }
  }
  for (const wand of WEAPON_PROFILES.filter(w => w.family === 'wand')) assert.ok(seen.has(wand.id));
});


test('a wand stays in its guard while an equipped melee off-hand performs its own swing', () => {
  const p = initialPlayer(0, 0); put(p, 'cinder-wand', 12);
  p.character.inventory[63] = generateItem(13, 1, 'weapon', 'rondel-dagger', 'common');
  assert.ok(executeCharacterCommand(p, { type: 'equip', index: 63, slot: 'offhand' }).ok);
  const base = playerPose(p, 1);
  const idle = playerMotion(base), strike = playerMotion({ ...base, attack: .3, attackKind: 'melee', attackHand: 'off' });
  assert.ok(strike.commitment !== 0, 'off-hand melee is not treated as a ranged cast');
  assert.deepEqual(strike.weaponArm.hand, idle.weaponArm.hand, 'wand palm keeps its own resting mount');
  assert.ok(Math.sin(strike.weaponAngle) < -.8, 'wand stays raised');
});
