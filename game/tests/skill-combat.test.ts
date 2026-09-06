import assert from 'node:assert/strict';
import test from 'node:test';
import { activateSkill, type SkillContext } from '../src/skill-combat.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillWeapon, skillIconSVG, skillRequirementLabel, type SkillRequirement } from '../src/skill-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { Simulation } from '../src/simulation.ts';
import type { CombatEvent, Enemy, Equipment, GroundEffect, ProjectileEffects, WeaponFamily, WorldQuery } from '../src/model.ts';
import type { ProjectileDefinition } from '../src/combat-content.ts';
import type { SkillId } from '../src/character-types.ts';

const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const profile = (family: Exclude<WeaponFamily, 'unarmed'>) => WEAPON_PROFILES.find(weapon => weapon.family === family)!;
const families: Readonly<Record<SkillRequirement, readonly WeaponFamily[]>> = {
  melee: ['sword', 'axe', 'mace', 'dagger'], blade: ['sword', 'axe', 'dagger'], heavy: ['axe', 'mace'],
  dagger: ['dagger'], bow: ['bow'], staff: ['staff'], shield: [],
};
function harness(id: SkillId) {
  const sim = new Simulation(emptyWorld, { spawn: false }), player = sim.player;
  const requirement = SKILL_DEFINITIONS[id].requirement;
  player.equipment = requirement === 'shield' ? { mainHand: profile('sword'), offHand: { kind: 'shield', shield: SHIELD_PROFILES[0] } }
    : { mainHand: profile(families[requirement][0] as Exclude<WeaponFamily, 'unarmed'>), offHand: null };
  player.character.allocatedNodes = ['origin', `skill:${id}`]; player.character.skillSlots[0] = id;
  const hits: Array<{ enemy: Enemy; amount: number }> = [], events: CombatEvent[] = [];
  const missiles: Array<{ angle: number; definition: ProjectileDefinition; skill: SkillId; effects?: ProjectileEffects }> = [];
  const scheduled: Array<Omit<GroundEffect, 'id' | 'tick'>> = [];
  const context: SkillContext = { availableGroundEffects: 16, player, world: emptyWorld, enemies: sim.enemies, aimX: 100, aimY: 0,
    damage: (enemy, amount) => { hits.push({ enemy, amount }); enemy.hp = Math.max(0, enemy.hp - amount); if (!enemy.hp) enemy.state = 'dead'; },
    visible: () => true,
    projectile: (_x, _y, angle, definition, skill, effects) => { missiles.push({ angle, definition, skill, effects }); },
    schedule: effect => { scheduled.push(effect); }, emit: event => { events.push(event); },
  };
  const target = (x: number, y = 0) => {
    const enemy = sim.spawnEnemy('brute', x, y)!; enemy.hp = enemy.maxHp = 10000; enemy.angle = Math.PI; return enemy;
  };
  return { context, player, hits, events, missiles, scheduled, target };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('all skill requirements admit the intended weapon families and reject incompatible profiles', () => {
  for (const skill of Object.values(SKILL_DEFINITIONS)) {
    assert.ok(skillRequirementLabel(skill.requirement).length > 2);
    for (const weapon of WEAPON_PROFILES) {
      const equipment: Equipment = { mainHand: weapon, offHand: null };
      assert.equal(canUseSkill(skill.id, equipment), families[skill.requirement].includes(weapon.family), `${skill.id} with ${weapon.name}`);
      equipment.offHand = { kind: 'shield', shield: SHIELD_PROFILES[0] };
      if (skill.requirement === 'shield') assert.equal(canUseSkill(skill.id, equipment), weapon.hands === 1);
    }
  }
});

test('dual wield admits a matching off-hand skill and uses that hand rather than main-hand damage', () => {
  const h = harness('backstab'), sword = profile('sword'), dagger = profile('dagger');
  h.player.equipment = { mainHand: sword, offHand: { kind: 'weapon', weapon: dagger } };
  assert.equal(skillWeapon('backstab', h.player.equipment), dagger);
  assert.equal(skillWeapon('cleave', h.player.equipment), sword, 'main hand wins when both weapons qualify');
  h.target(35);
  assert.equal(activateSkill(h.context, 0), true);
  close(h.hits[0].amount, deriveAttackStats(h.player.stats, dagger).damage * SKILL_DEFINITIONS.backstab.damageMultiplier);
  h.player.equipment.mainHand = WEAPON_PROFILES.find(weapon => weapon.family === 'sword' && weapon.hands === 2)!;
  assert.equal(skillWeapon('backstab', h.player.equipment), null, 'invalid two-handed dual wield cannot borrow an off-hand');
});

test('incompatible weapons reject every active skill before consuming resources or emitting effects', () => {
  for (const skill of Object.values(SKILL_DEFINITIONS)) {
    const h = harness(skill.id);
    h.player.equipment = { mainHand: WEAPON_PROFILES.find(weapon => !families[skill.requirement].includes(weapon.family))!, offHand: null };
    const before = h.player.mana;
    assert.equal(activateSkill(h.context, 0), false, skill.id);
    assert.equal(h.player.mana, before); assert.equal(h.player.skillCooldowns[skill.id], undefined);
    assert.equal(h.events.length + h.hits.length + h.missiles.length + h.scheduled.length, 0);
    assert.equal(h.player.activeSkill, null);
  }
});

test('each skill has a distinct procedural icon and all metadata is immutable', () => {
  const icons = Object.values(SKILL_DEFINITIONS).map(skill => {
    assert.ok(Object.isFrozen(skill));
    const svg = skillIconSVG(skill.id);
    assert.ok(svg.includes('<path')); assert.ok(!svg.includes('https:'));
    return svg;
  });
  assert.equal(new Set(icons).size, Object.keys(SKILL_DEFINITIONS).length);
});

test('staff skill scaling is applied once and physical arrow skills use attack scaling', () => {
  for (const id of ['fireball', 'volley'] as const) {
    const h = harness(id); h.player.stats.attackDamageMultiplier = 4; h.player.stats.spellDamageMultiplier = 2;
    h.player.derived.spellDamageMultiplier = 2;
    assert.ok(activateSkill(h.context, 0));
    const base = h.player.equipment.mainHand.damage, multiplier = id === 'fireball' ? 2 : 4;
    close(h.missiles[0].definition.damage, base * multiplier * SKILL_DEFINITIONS[id].damageMultiplier);
  }
});

test('cleave and whirlwind snapshot the correct weapon and distinct swept contact arcs', () => {
  const cleave = harness('cleave'), spin = harness('whirlwind');
  assert.ok(activateSkill(cleave.context, 0)); assert.ok(activateSkill(spin.context, 0));
  assert.equal(cleave.player.attack!.weapon, cleave.player.equipment.mainHand);
  assert.equal(cleave.player.attack!.kind, 'melee');
  assert.ok(cleave.player.attack!.arc < Math.PI * 2);
  assert.equal(spin.player.attack!.arc, Math.PI * 2);
  assert.ok(spin.player.attack!.range > spin.player.equipment.mainHand.reach);
  assert.equal(spin.player.attack!.hitIds.size, 0, 'contacts occur during the swept simulation window');
});

test('lunge schedules continuous swept movement rather than teleporting at activation', () => {
  const h = harness('lunge'); h.target(45);
  assert.ok(activateSkill(h.context, 0));
  assert.equal(h.player.x, 0); assert.equal(h.player.y, 0); assert.equal(h.hits.length, 0);
  assert.equal(h.player.dash!.skill, 'lunge');
  assert.ok(h.player.dash!.remaining > 0 && h.player.dash!.speed > 0);
  assert.ok(h.player.dash!.damage > 0 && h.player.dash!.hitIds.size === 0);
});

test('backstab hits one nearby aimed enemy and doubles a genuine rear strike', () => {
  const front = harness('backstab'), rear = harness('backstab');
  front.target(35); front.target(45); front.target(-20);
  const victim = rear.target(35); victim.angle = 0;
  assert.ok(activateSkill(front.context, 0)); assert.ok(activateSkill(rear.context, 0));
  assert.equal(front.hits.length, 1); assert.equal(rear.hits.length, 1);
  close(rear.hits[0].amount, front.hits[0].amount * 2);
});

test('lightning chains through at most five distinct targets with falloff and cannot cross a wall', () => {
  const h = harness('arcLightning'); h.context.aimX = 40;
  for (let i = 0; i < 6; i++) h.target(40 + i * 80);
  assert.ok(activateSkill(h.context, 0));
  assert.equal(h.hits.length, 5); assert.equal(new Set(h.hits.map(hit => hit.enemy.id)).size, 5);
  for (let i = 1; i < h.hits.length; i++) close(h.hits[i].amount, h.hits[i - 1].amount * .78);
  assert.equal(h.events.filter(event => event.type === 'chain').length, 5);
  const walled = harness('arcLightning'); walled.context.aimX = 40;
  walled.target(40); walled.target(120);
  walled.context.visible = (ax, _ay, bx) => (ax < 100) === (bx < 100);
  assert.ok(activateSkill(walled.context, 0)); assert.equal(walled.hits.length, 1);
});

test('earthshatter stuns visible nearby enemies while ice nova applies a real slowing status', () => {
  const heavy = harness('earthshatter'), near = heavy.target(45), behindWall = heavy.target(-45), far = heavy.target(250);
  heavy.context.visible = (_ax, _ay, bx) => bx >= 0;
  assert.ok(activateSkill(heavy.context, 0));
  assert.equal(near.stagger, 1.2); assert.equal(near.interrupted, true);
  assert.equal(behindWall.stagger, 0); assert.equal(far.stagger, 0);
  const frost = harness('iceNova'), chilled = frost.target(45), frozen = frost.target(60);
  frozen.slowFactor = .25; frozen.slowTime = 5;
  assert.ok(activateSkill(frost.context, 0));
  assert.equal(chilled.slowFactor, .5); assert.equal(chilled.slowTime, 2.5);
  assert.equal(frozen.slowFactor, .25); assert.equal(frozen.slowTime, 5, 'stronger existing slows are preserved');
});

test('shield bash stuns only the forward cone and bulwark creates a three-second guard', () => {
  const bash = harness('shieldBash'), front = bash.target(40), back = bash.target(-40);
  assert.ok(activateSkill(bash.context, 0));
  assert.equal(bash.hits.length, 1); assert.equal(bash.hits[0].enemy, front);
  assert.equal(front.stagger, 1.1); assert.equal(back.stagger, 0);
  const guard = harness('bulwark'); guard.target(40);
  assert.ok(activateSkill(guard.context, 0)); assert.equal(guard.player.guardTime, 3);
  assert.equal(guard.hits.length, 0); assert.equal(guard.missiles.length, 0);
});

test('ranged skills pass distinct pierce, chain, explosion, burn, slow and life-steal payloads to simulation', () => {
  const expected: Partial<Record<SkillId, Partial<ProjectileEffects>>> = {
    piercingShot: { style: 'arrow', pierce: 3 }, ricochet: { style: 'arrow', chain: 3, chainRange: 150 },
    fireball: { style: 'fire', blastRadius: 85, burnDuration: 3 }, frostLance: { style: 'frost', pierce: 3, slowFactor: .5, slowDuration: 2.5 },
    siphon: { style: 'spirit', lifeSteal: .35 },
  };
  for (const [id, payload] of Object.entries(expected) as [SkillId, Partial<ProjectileEffects>][]) {
    const h = harness(id); assert.ok(activateSkill(h.context, 0)); assert.equal(h.missiles.length, 1);
    for (const [key, value] of Object.entries(payload)) assert.equal(h.missiles[0].effects![key as keyof ProjectileEffects], value);
    if (id === 'fireball') assert.ok(h.missiles[0].effects!.burnDps! > 0);
  }
  const volley = harness('volley'); assert.ok(activateSkill(volley.context, 0));
  assert.deepEqual(volley.missiles.map(missile => missile.angle), [-.23, 0, .23]);
});

test('ground skills schedule delayed effects inside weapon range and before blocking geometry', () => {
  for (const id of ['meteor', 'rainOfArrows'] as const) {
    const h = harness(id); h.context.aimX = 10000;
    assert.ok(activateSkill(h.context, 0)); assert.equal(h.hits.length, 0); assert.equal(h.scheduled.length, 1);
    const effect = h.scheduled[0];
    assert.ok(effect.delay > 0 && effect.damage > 0);
    assert.ok(Math.hypot(effect.x, effect.y) <= h.player.equipment.mainHand.reach);
    if (id === 'rainOfArrows') close(effect.duration / effect.interval, 4);
    else assert.equal(effect.duration, 0);
    const walled = harness(id); walled.context.aimX = 400;
    walled.context.world = { ...emptyWorld, blocked: x => x >= 100 && x < 120 };
    assert.ok(activateSkill(walled.context, 0)); assert.ok(walled.scheduled[0].x < 100);
  }
});

test('first-row skills repeat after action recovery while second-row skills retain cooldowns', () => {
  const basic: SkillId[] = ['cleave', 'whirlwind', 'shieldBash', 'volley', 'ricochet', 'backstab', 'fireball', 'iceNova', 'arcLightning'];
  for (const skill of Object.values(SKILL_DEFINITIONS)) {
    const h = harness(skill.id);
    assert.equal(skill.tier === 'basic', basic.includes(skill.id));
    assert.equal(activateSkill(h.context, 0), true);
    assert.equal(activateSkill(h.context, 0), false, 'actions cannot overlap even without a cooldown');
    h.player.attack = null; h.player.dash = null; h.player.castTime = 0;
    if (basic.includes(skill.id)) {
      assert.equal(h.player.skillCooldowns[skill.id], 0);
      assert.equal(activateSkill(h.context, 0), true, skill.id);
    } else {
      assert.ok(skill.manaCost >= 24 && h.player.skillCooldowns[skill.id]! > 0);
      assert.equal(activateSkill(h.context, 0), false, skill.id);
    }
  }
});

test('attack and cast speed independently govern weapon and active skill recovery', () => {
  for (const id of ['cleave', 'volley', 'shieldBash', 'fireball', 'iceNova', 'arcLightning'] as SkillId[]) {
    const h = harness(id), magical = SKILL_DEFINITIONS[id].requirement === 'staff';
    const baseRate = h.player.equipment.mainHand.baseAttacksPerSecond;
    h.player.stats.attackSpeedMultiplier = 2;
    h.player.stats.castSpeedMultiplier = 3;
    const expectedDuration = 1 / (baseRate * (magical ? 3 : 2));
    assert.equal(activateSkill(h.context, 0), true);
    close(h.player.attack?.duration ?? h.player.castDuration, expectedDuration);
    const snapshotted = h.player.attack?.duration ?? h.player.castDuration;
    h.player.stats.castSpeedMultiplier = 1; h.player.stats.attackSpeedMultiplier = 1;
    close(h.player.attack?.duration ?? h.player.castDuration, snapshotted);
  }
});

test('effective mana cost is used both to validate and spend, with independent cooldown reduction', () => {
  for (const id of ['fireball', 'meteor'] as SkillId[]) {
    const h = harness(id), definition = SKILL_DEFINITIONS[id];
    h.player.derived.manaCostMultiplier = .5; h.player.derived.cooldownMultiplier = .75;
    h.player.mana = definition.manaCost * .5 - .1;
    assert.equal(activateSkill(h.context, 0), false);
    h.player.mana = definition.manaCost * .5;
    assert.equal(activateSkill(h.context, 0), true);
    close(h.player.mana, 0); close(h.player.skillCooldowns[id]!, definition.cooldown * .75);
  }
});

test('ranked forked fireballs snapshot three stronger projectiles and their actual mana cost', () => {
  const h=harness('fireball');
  h.player.character.skillRanks.fireball=5;
  h.player.character.allocatedNodes.push('specialization:fireball-fork');
  h.player.character.skillSpecializations.fireball='fireball-fork';
  assert.ok(activateSkill(h.context,0));
  assert.equal(h.missiles.length,3);
  close(h.player.mana,100-12*2*1.8);
  close(h.missiles[0].definition.damage,deriveAttackStats(h.player.stats,h.player.equipment.mainHand).damage*SKILL_DEFINITIONS.fireball.damageMultiplier*1.6*.65);
  assert.deepEqual(h.missiles.map(m=>m.angle),[-.24,0,.24]);
});

test('Storm Circuit can revisit two enemies for eight bounded jumps with diminishing damage',()=>{
  const h=harness('arcLightning'); h.context.aimX=40; h.target(40); h.target(90);
  h.player.character.allocatedNodes.push('specialization:arc-circuit'); h.player.character.skillSpecializations.arcLightning='arc-circuit';
  assert.ok(activateSkill(h.context,0)); assert.equal(h.hits.length,8);
  assert.equal(new Set(h.hits.map(h=>h.enemy.id)).size,2);
  for(let i=1;i<h.hits.length;i++) close(h.hits[i].amount,h.hits[i-1].amount*.7);
});

test('Echoing Frost schedules its second impact and Cataclysm schedules seven staggered meteors',()=>{
  const frost=harness('iceNova'); frost.target(40);
  frost.player.character.allocatedNodes.push('specialization:nova-echo'); frost.player.character.skillSpecializations.iceNova='nova-echo';
  assert.ok(activateSkill(frost.context,0)); assert.equal(frost.scheduled.length,1);
  close(frost.scheduled[0].damage,frost.hits[0].amount*.6); assert.equal(frost.scheduled[0].delay,.6);
  const fire=harness('cataclysm'); assert.ok(activateSkill(fire.context,0)); assert.equal(fire.scheduled.length,7);
  assert.equal(new Set(fire.scheduled.map(e=>`${e.x}:${e.y}`)).size,7);
  for(let i=1;i<7;i++) assert.ok(fire.scheduled[i].delay>fire.scheduled[i-1].delay);
});

test('expensive multi-impact casts refuse insufficient ground capacity before spending mana',()=>{
  const h=harness('cataclysm'); h.context.availableGroundEffects=6;
  assert.equal(activateSkill(h.context,0),false); assert.equal(h.player.mana,100);
  assert.equal(h.scheduled.length,0); assert.equal(h.player.skillCooldowns.cataclysm,undefined);
  h.context.availableGroundEffects=7;
  assert.ok(activateSkill(h.context,0)); assert.equal(h.scheduled.length,7);
});
