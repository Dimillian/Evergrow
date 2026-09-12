import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, itemAffixPool, createCharacterSheet, ITEM_KINDS } from '../src/items.ts';
import { isSkillStat, skillAffixRank, SPECIAL_AFFIXES, SKILL_AFFIXES } from '../src/equipment-affix-content.ts';
import { improveItem } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { resolveSkill } from '../src/skill-progression.ts';
import { refreshCharacter } from '../src/character.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { primeSpellweave, consumeSpellweave, advanceAffixBuffs, effectiveArmor } from '../src/affix-combat.ts';
import { damageEnemy, damagePlayer } from '../src/combat-damage.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { activateSkill, type SkillContext } from '../src/skill-combat.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { itemTooltipMarkup } from '../src/item-ui.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import type { Item, StatKey, SkillId } from '../src/character-types.ts';
import type { CombatEvent, Input } from '../src/model.ts';

const world = { isSanctuary: () => false, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function affix(stat: StatKey, kind: Item['kind'] = 'amulet', level = 80, roll = .5): Item {
  const item = generateItem(192, level, kind, undefined, 'magic');
  item.affixes = [{ stat, name: 'Test', value: 0 }]; item.recipe.rolls = [roll]; return deriveItem(item);
}
function make(profile = 'cinder-wand') {
  const sim = new Simulation(world, { spawn: false }); const p = sim.player;
  p.character.equipped.weapon = generateItem(40, 1, 'weapon', profile, 'common'); p.character.equipped.offhand = null;
  refreshCharacter(p); p.derived.critChance = 0; return sim;
}
function skillContext(sim: Simulation, id: SkillId): SkillContext {
  const p = sim.player; p.character.allocatedNodes.push(`skill:${id}`); p.character.skillSlots[0] = id;
  return { player: p, enemies: sim.enemies, world, aimX: 300, aimY: 0, availableGroundEffects: 16, availableProjectiles: 128,
    damage: () => {}, visible: () => true, onScreen: () => true, projectile: () => {}, schedule: () => {}, emit: () => {} };
}
test('new affixes retain slot identities and skill family weights favor matching weapons/elements', () => {
  const has = (kind: Item['kind'], stat: StatKey, family?: string) => itemAffixPool({ kind, weapon: family ? { family } : undefined }).some(a => a.stat === stat);
  for (const kind of ITEM_KINDS) {
    assert.equal(has(kind, 'manaOnKill'), ['ring', 'grimoire', 'amulet'].includes(kind));
    assert.equal(has(kind, 'potionPercent'), ['cloak', 'amulet'].includes(kind));
    assert.equal(has(kind, 'spellweavePercent'), ['grimoire', 'amulet'].includes(kind));
    assert.equal(has(kind, 'afterguardPercent'), ['shield', 'amulet'].includes(kind));
  }
  assert.ok(has('weapon', 'areaPercent', 'sword') && has('weapon', 'areaPercent', 'staff'));
  assert.ok(has('weapon', 'projectilePierce', 'bow') && has('weapon', 'projectilePierce', 'wand'));
  const fire = itemAffixPool({ kind: 'weapon', weapon: { family: 'staff', damageType: 'fire' } }).filter(a => isSkillStat(a.stat));
  near(fire.reduce((n, a) => n + a.weight!, 0), .5);
  near(fire.find(a => a.stat === 'skill:fireball')!.weight!, 3 * fire.find(a => a.stat === 'skill:iceNova')!.weight!);
  assert.ok(!fire.some(a => a.stat === 'skill:cleave'));
  assert.deepEqual(itemAffixPool({ kind: 'shield' }).filter(a => isSkillStat(a.stat)).map(a => a.stat).sort(), ['skill:bulwark', 'skill:ironCitadel', 'skill:repulse', 'skill:shieldBash']);
  const amulet = itemAffixPool({ kind: 'amulet' });
  assert.ok([...SPECIAL_AFFIXES, ...SKILL_AFFIXES].every(a => amulet.some(b => a.stat === b.stat)));
});
test('rank quantiles are progressively rarer, level-gated and independent of enhancement', () => {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 100000; i++) counts[skillAffixRank((i + .5) / 100000, 80) - 1]++;
  assert.deepEqual(counts, [88000, 10000, 1700, 270, 30]);
  assert.deepEqual([1, 12, 30, 55, 80].map(level => skillAffixRank(.99999, level)), [1, 2, 3, 4, 5]);
  let item = affix('skill:meteor', 'amulet', 80, .99999);
  for (let i = 0; i < 10; i++) item = improveItem(item, 'enhance', 80, i);
  assert.equal(item.affixes[0].value, 5); assert.ok(validItem(item));
  const piercing = improveItem(affix('projectilePierce'), 'enhance', 80, 1); assert.equal(piercing.affixes[0].value, 1);
  assert.equal(improveItem(affix('skill:fireball', 'amulet', 1, .99999), 'relevel', 80, 1).affixes[0].value, 5);
  item.affixes[0].value = 4; assert.equal(validItem(item), false, 'save value must match the saved quantile');
});
test('skill ranks are real bonuses to unlocked skills, never purchases, cost inflation or free unlocks', () => {
  const sheet = createCharacterSheet(); sheet.equipped.amulet = affix('skill:meteor', 'amulet', 80, .99999);
  let stats = deriveCharacterStats(sheet); const locked = resolveSkill('meteor', stats, sheet);
  assert.equal(locked.bonusRanks, 0); assert.equal(sheet.skillRanks.meteor, undefined);
  sheet.allocatedNodes.push('skill:meteor', 'mastery:meteor'); sheet.skillRanks.meteor = 7;
  const upgraded = resolveSkill('meteor', stats, sheet), plain = resolveSkill('meteor', { ...stats, skillBonuses: {} }, sheet);
  assert.equal(upgraded.rank, 7); assert.equal(upgraded.effectiveRank, 12); assert.ok(upgraded.damageMultiplier > plain.damageMultiplier);
  assert.equal(upgraded.mana, plain.mana); assert.equal(upgraded.cooldown, plain.cooldown); assert.ok(Number.isFinite(upgraded.mana));
  sheet.equipped.amulet = null; stats = deriveCharacterStats(sheet); assert.equal(resolveSkill('meteor', stats, sheet).effectiveRank, 7);
});
test('Expanse scales area once without extending projectile travel or lightning chains; piercing respects explosions', () => {
  const stats = { manaCostMultiplier: 1, cooldownMultiplier: 1, areaMultiplier: Math.sqrt(2), projectilePierce: 2 };
  const meteor = resolveSkill('meteor', stats).recipe, fireball = resolveSkill('fireball', stats).recipe;
  assert.equal(meteor.kind, 'ground'); if (meteor.kind === 'ground') near(meteor.radius ** 2, SKILL_EXECUTION.meteor.radius ** 2 * 2);
  assert.equal(fireball.kind, 'projectile'); if (fireball.kind === 'projectile') { near(fireball.effects.blastRadius!, 85 * Math.sqrt(2)); assert.equal(fireball.speed, 320); assert.equal(fireball.effects.pierce, undefined); }
  const arrow = resolveSkill('piercingShot', stats).recipe; if (arrow.kind === 'projectile') assert.equal(arrow.effects.pierce, 5);
  const chain = resolveSkill('arcLightning', stats).recipe; if (chain.kind === 'chain') assert.equal(chain.range, SKILL_EXECUTION.arcLightning.range);
});
test('piercing basic arrows hit a second target and snapshot the bonus before gear changes', () => {
  const sim = make('thorn-shortbow'), p = sim.player;
  p.derived.projectilePierce = 1;
  for (const x of [100, 190, 280]) { const e = sim.spawnEnemy('brute', x, 0)!; e.hp = e.maxHp = 100000; e.state = 'recover'; e.stateDuration = 999; }
  sim.update(FIXED_STEP, { ...idle, attack: true }); assert.equal(p.attack?.projectile?.pierce, 1); p.derived.projectilePierce = 0;
  for (let i = 0; i < 120; i++) sim.update(FIXED_STEP, idle);
  assert.deepEqual(sim.enemies.map(e => e.hp < e.maxHp), [true, true, false]);
});
test('Wellsip restores capped mana once per committed kill and never after player death', () => {
  const sim = make(), p = sim.player; p.derived.manaOnKill = 7; p.mana = 90;
  const e = sim.spawnEnemy('brute', 0, 0)!; e.hp = 1; let rewards = 0, id = 0;
  const context = { player: p, enemies: sim.enemies, random: () => 1, visible: () => true, emit: () => {}, killed: (enemy: typeof e) => {
    rewards++; awardKillRewards(enemy, 1, 0, { player: p, groundGold: [], groundItems: [], pickups: [], nextId: () => ++id, emit: () => {} });
  } };
  damageEnemy(e, 5, 0, true, context); damageEnemy(e, 5, 0, true, context); assert.equal(rewards, 1); assert.equal(p.mana, 97);
  p.dead = true; const another = sim.spawnEnemy('brute', 0, 0)!; another.hp = 1;
  damageEnemy(another, 5, 0, true, context); assert.equal(p.mana, 97);
});
test('Deep Draught restores both resources with one charge and clamps to missing amounts', () => {
  const sim = make(), p = sim.player; p.hp = 1; p.mana = 0; p.derived.potionMultiplier = 1.5; p.derived.manaRegeneration = 0;
  const flasks = p.flasks; sim.update(FIXED_STEP, { ...idle, heal: true });
  near(p.hp, 1 + p.maxHp * .42 * 1.5); near(p.mana, p.maxMana * .4 * 1.5); assert.equal(p.flasks, flasks - 1);
  p.hp = p.maxHp - 1; p.mana = p.maxMana - 2; p.healCooldown = 0;
  sim.update(FIXED_STEP, { ...idle, heal: true }); assert.equal(p.hp, p.maxHp); assert.equal(p.mana, p.maxMana);
});
test('Spellweave primes only direct melee/spell contacts, expires, and consumes once for a whole action', () => {
  const sim = make('longsword'), p = sim.player; p.derived.spellweavePercent = 25;
  primeSpellweave(p, false, 'fire'); primeSpellweave(p, false, 'fire');
  sim.update(FIXED_STEP, { ...idle, attack: true }); near(p.attack!.damage, deriveAttackStats(p.stats, p.equipment.mainHand).damage * 1.25);
  assert.equal(p.affixBuffs?.melee, 0); p.attack = null;
  primeSpellweave(p, true, 'fire'); near(consumeSpellweave(p, 'spell'), 1.25); near(consumeSpellweave(p, 'spell'), 1);
  primeSpellweave(p, false, 'arrow'); assert.equal(p.affixBuffs?.melee, 0);
  primeSpellweave(p, true); advanceAffixBuffs(p, 4.1); near(consumeSpellweave(p, 'spell'), 1);
  const enemy = sim.spawnEnemy('brute', 20, 0)!;
  damageEnemy(enemy, 1, 0, false, { player: p, enemies: [enemy], visible: () => true, random: () => 1, emit: () => {}, killed: () => {} }, true, 'fire');
  assert.equal(p.affixBuffs?.melee, 0);
});
test('failed spells keep Spellweave, successful casts snapshot one empowered payload', () => {
  const sim = make(), p = sim.player; const context = skillContext(sim, 'fireball'); p.derived.spellweavePercent = 25;
  primeSpellweave(p, true); p.mana = 0; assert.equal(activateSkill(context, 0), false); assert.equal(p.affixBuffs?.spell, 4);
  let damage = 0; context.projectile = (_x, _y, _a, definition) => { damage = definition.damage; };
  p.mana = p.maxMana; assert.ok(activateSkill(context, 0));
  near(damage, deriveAttackStats(p.stats, p.equipment.mainHand).damage * resolveSkill('fireball', p.derived, p.character).damageMultiplier * 1.25);
  assert.equal(p.affixBuffs?.spell, 0);
});
test('Afterguard improves subsequent armor after a block, refreshes, and clears on expiry or unequip', () => {
  const sim = make('longsword'), p = sim.player;
  p.character.equipped.offhand = generateItem(2, 1, 'shield', 'iron-buckler', 'common'); refreshCharacter(p);
  p.derived.afterguardPercent = 50; p.derived.armor = 100; p.derived.blockChance = 1; p.hp = p.maxHp = 10000;
  const events: CombatEvent[] = []; const context = { player: p, world, random: () => 0, emit: (e: CombatEvent) => events.push(e) };
  damagePlayer(100, 0, 10, 'physical', context); const first = events.find(e => e.type === 'hurt')!;
  near(effectiveArmor(p), 150); advanceAffixBuffs(p, 1); p.invulnerable = 0; events.length = 0;
  damagePlayer(100, 0, 10, 'physical', context); const second = events.find(e => e.type === 'hurt')!;
  assert.ok(first.type === 'hurt' && second.type === 'hurt' && second.value < first.value); assert.equal(p.affixBuffs?.guard, 3);
  advanceAffixBuffs(p, 3.1); near(effectiveArmor(p), 100);
  p.affixBuffs!.guard = 3; p.equipment.offHand = null; advanceAffixBuffs(p, 0); near(effectiveArmor(p), 100);
});
test('tooltips and saves preserve discrete skill rolls, comparison labels and the current character', () => {
  const sim = make(); const item = affix('skill:meteor', 'amulet', 80, .99999); sim.player.character.inventory[0] = item;
  const html = itemTooltipMarkup(item, { sheet: sim.player.character, level: 80, sourceIndex: 0 });
  assert.ok(html.includes('Meteor ranks') && html.includes('+5'));
  assert.ok(!html.includes('require the skill unlocked'));
  const save = { version: CHARACTER_SAVE_VERSION, id: 'affix-save', name: 'Affix', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 4, checkpoint: sim.captureCheckpoint() };
  assert.ok(decodeCharacterSave(JSON.stringify(save)));
});
