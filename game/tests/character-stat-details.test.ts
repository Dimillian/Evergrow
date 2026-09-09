import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { createCharacterSheet, generateItem, STARTER_LOADOUTS } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { characterStatDetails, DERIVED_STAT_DETAILS } from '../src/character-stat-details.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { effectiveArmor } from '../src/affix-combat.ts';
import { armorReduction } from '../src/progression-content.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
const world = { blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({ x:x+dx,y:y+dy }) };
const player = () => new Simulation(world, { spawn: false }).player;
const rows = (p: ReturnType<typeof player>) => new Map(characterStatDetails(p).flatMap(group => group.rows).map(row => [row.id, row]));

test('every starter shows actual weapon output and every derived stat has a detailed readout', () => {
  for (const starter of STARTER_LOADOUTS) {
    const p = player(); p.character = createCharacterSheet(starter.id); refreshCharacter(p);
    const before = JSON.stringify(p), all = rows(p), attack = deriveAttackStats(p.stats, p.equipment.mainHand);
    assert.equal(all.get('damage')!.amount, attack.damage);
    assert.equal(all.get('rate')!.amount, attack.attacksPerSecond);
    assert.equal(all.get('spellDamage')!.amount, p.derived.spellDamageMultiplier - 1);
    assert.equal(all.get('maxHp')!.amount, p.maxHp);
    assert.equal(all.get('maxMana')!.amount, p.maxMana);
    for (const id of Object.values(DERIVED_STAT_DETAILS)) if (!['attributes','skills','resistances'].includes(id)) assert.ok(all.has(id), id);
    for (const row of all.values()) { assert.ok(Number.isFinite(row.amount)); assert.ok(row.description && row.calculation); }
    assert.equal(JSON.stringify(p), before, 'inspection cannot mutate the character');
  }
});

test('armor includes active blessing and Afterguard, and uses the displayed attacker level', () => {
  const p = player(); p.character = createCharacterSheet('sword-shield'); p.level = 18;
  p.character.equipped.offhand!.implicit = {}; p.character.equipped.offhand!.affixes = [];
  p.character.equipped.chest!.implicit = { armor: 200, afterguardPercent: 25 };
  p.character.blessing = { kind: 'bulwark', remaining: 40 }; refreshCharacter(p);
  p.affixBuffs = { melee: 0, spell: 0, guard: 2 };
  p.guardTime = 1; p.guardReduction = .85;
  const all = rows(p);
  assert.equal(all.get('armor')!.amount, effectiveArmor(p));
  assert.equal(all.get('armor')!.amount, 350);
  assert.equal(all.get('armorReduction')!.amount, armorReduction(350, 18));
  assert.equal(all.get('activeGuard')!.amount, Math.max(.85,p.derived.blockReduction));
  assert.ok(all.get('armor')!.sources.some(s => s.label.includes('Bulwark')));
  assert.ok(all.get('armor')!.sources.some(s => s.label.includes('Afterguard')));
  p.affixBuffs.guard = 0; assert.equal(rows(p).get('armor')!.amount, 280);
});

test('source explanations include equipment attributes, allocated tree and live blessings, never bag items', () => {
  const p = player(); p.character.attributes.dexterity = 20;
  const ring = generateItem(777, 1, 'ring'); ring.implicit = { dexterity: 5, attackSpeedPercent: 9 }; ring.affixes = [];
  p.character.equipped.ring1 = ring;
  const node = SKILL_TREE.nodes.find(n => (n.bonuses.attackSpeedPercent ?? 0) > 0)!;
  p.character.allocatedNodes.push(node.id);
  p.character.blessing = { kind:'haste', remaining:10 };
  p.character.inventory[0] = generateItem(999, 1, 'ring'); p.character.inventory[0].name = 'Bag-only ring';
  p.character.inventory[0].implicit = { attackSpeedPercent: 9999 };
  refreshCharacter(p);
  const speed = rows(p).get('attackSpeed')!;
  assert.equal(speed.amount, p.derived.attackSpeedMultiplier - 1);
  assert.match(speed.calculation,/\+3\.75% Dexterity/);
  assert.match(rows(p).get('dexterity')!.description,/\+0\.25% attack speed and \+0\.075% critical chance/);
  assert.ok(speed.sources.some(s => s.label.includes(ring.name)));
  assert.ok(speed.sources.some(s => s.label === 'Skill tree'));
  assert.ok(speed.sources.some(s => s.label === 'Haste blessing'));
  assert.ok(speed.sources.some(s => s.label.includes('starting + assigned') && s.value === '20'));
  assert.ok(!speed.sources.some(s => s.label.includes('Bag-only')));
  p.character.blessing.remaining = 0; refreshCharacter(p);
  assert.ok(!rows(p).get('attackSpeed')!.sources.some(s => s.label.includes('Haste')));
});

test('offhand magic uses casting cadence and weapon-local elemental damage remains separate', () => {
  const p = player(); p.character = createCharacterSheet('sword-shield'); p.character.equipped.offhand = generateItem(551, 8, 'weapon', 'cinder-wand');
  p.character.equipped.weapon!.weapon!.enchantment = { damage: 12, element: 'fire' } as NonNullable<typeof p.equipment.mainHand.enchantment>;
  refreshCharacter(p);
  const all = rows(p), off = p.equipment.offHand; assert.ok(off?.kind === 'weapon');
  assert.equal(all.get('off-rate')!.label, 'Off-hand casts / s');
  assert.equal(all.get('off-damage')!.amount, deriveAttackStats(p.stats, off.weapon).damage);
  assert.ok(all.get('damage')!.sources.some(s => s.label.includes('enchantment')));
  assert.ok(!all.get('off-damage')!.sources.some(s => s.label.includes('enchantment')));
});

test('caps, missing shields and skill-rank bonuses match the gameplay projection', () => {
  const p = player(); p.character.equipped.offhand = null;
  p.character.equipped.chest!.implicit = { critChance:200, critDamage:900, blockChance:100, blockReduction:100, manaCostPercent:200, cooldownPercent:200, areaPercent:400, projectilePierce:20, 'skill:fireball':30 };
  refreshCharacter(p); const all = rows(p);
  assert.equal(all.get('critChance')!.amount,.75); assert.equal(all.get('critDamage')!.amount,5);
  assert.equal(all.get('blockChance')!.amount,0); assert.equal(all.get('blockReduction')!.amount,0);
  assert.equal(all.get('manaCost')!.amount,.75); assert.equal(all.get('cooldown')!.amount,.75);
  assert.ok(Math.abs(all.get('area')!.amount - 1)<1e-12); assert.equal(all.get('pierce')!.amount,4);
  assert.equal(all.get('skill:fireball')!.amount,10);
  assert.match(all.get('skill:fireball')!.description,/once this skill is learned/);
});
