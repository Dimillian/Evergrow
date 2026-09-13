import { SKILL_EXECUTION, groundEffectPulseCount } from './skill-execution-content.ts';
import type { SkillId } from './character-types.ts';
import type { Equipment, WeaponDefinition } from './model.ts';

export type SkillRequirement = 'any' | 'melee' | 'blade' | 'heavy' | 'dagger' | 'bow' | 'magic' | 'shield';
export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly requirement: SkillRequirement;
  readonly domain: 'Might' | 'Cunning' | 'Arcana';
  readonly tier: 'basic' | 'advanced' | 'ultimate';
  readonly manaCost: number;
  readonly cooldown: number;
  readonly damageMultiplier: number;
  readonly color: string;
}

/** Costs, potency and equipment requirements are shared by the atlas, HUD and combat. */
export const SKILL_DEFINITIONS: Readonly<Record<SkillId, Readonly<SkillDefinition>>> = Object.freeze({
  repulse: Object.freeze({ id: 'repulse', name: 'Repulse', description: 'Drive a broad shield shockwave through nearby enemies, damaging and stunning the front line.', requirement: 'shield', domain: 'Might', tier: 'advanced', manaCost: 24, cooldown: 5, damageMultiplier: 1.65, color: '#e5bd80' }),
  ironCitadel: Object.freeze({ id: 'ironCitadel', name: 'Iron Citadel', description: 'Strike every enemy around your shield, then take 45% less hit damage for 5 seconds. Stance mitigation uses the strongest active value.', requirement: 'shield', domain: 'Might', tier: 'ultimate', manaCost: 45, cooldown: 28, damageMultiplier: 2.4, color: '#f0d5a2' }),
  smokeVeil: Object.freeze({ id: 'smokeVeil', name: 'Smoke Veil', description: 'Slow surrounding enemies by 50% for 3 seconds and take 20% less hit damage for 2 seconds. No weapon requirement; deals no damage.', requirement: 'any', domain: 'Cunning', tier: 'advanced', manaCost: 20, cooldown: 9, damageMultiplier: 0, color: '#9bbfc6' }),
  nightReaping: Object.freeze({ id: 'nightReaping', name: 'Night Reaping', description: 'Your dagger strikes up to five nearby enemies in every direction. Rear strikes deal double damage. Does not teleport or grant invulnerability.', requirement: 'dagger', domain: 'Cunning', tier: 'ultimate', manaCost: 48, cooldown: 28, damageMultiplier: 2.2, color: '#b9e3d6' }),
  sidestep: Object.freeze({ id: 'sidestep', name: 'Sidestep', description: 'Step toward your aim without invulnerability. Terrain still blocks movement.', requirement: 'any', domain: 'Cunning', tier: 'advanced', manaCost: 8, cooldown: 3.5, damageMultiplier: 0, color: '#b5cbb8' }),
  brace: Object.freeze({ id: 'brace', name: 'Brace', description: 'Brace for 2 seconds, taking 20% less hit damage. Does not require a shield.', requirement: 'any', domain: 'Might', tier: 'advanced', manaCost: 14, cooldown: 8, damageMultiplier: 0, color: '#cfb88f' }),
  runicWard: Object.freeze({ id: 'runicWard', name: 'Runic Ward', description: 'Create a barrier equal to 18% of maximum life for 4 seconds. Absorbs damage after mitigation; does not stack.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 22, cooldown: 10, damageMultiplier: 0, color: '#9ed6d5' }),
  vaultingShot: Object.freeze({ id: 'vaultingShot', name: 'Vaulting Shot', description: 'Loose one arrow toward your aim while retreating. The retreat has no invulnerability.', requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 22, cooldown: 6, damageMultiplier: 1.2, color: '#a7c897' }),
  rallyOfIron: Object.freeze({ id: 'rallyOfIron', name: 'Rally of Iron', description: 'For 6 seconds take 25% less hit damage. The next three melee actions deal 35% more damage.', requirement: 'melee', domain: 'Might', tier: 'ultimate', manaCost: 42, cooldown: 24, damageMultiplier: 0, color: '#d4a677' }),
  ghostHunt: Object.freeze({ id: 'ghostHunt', name: 'Ghost Hunt', description: 'For 6 seconds, your next three projectile arrow actions each release one delayed echo along the original aim. Echoes deal 60% of the first arrow’s damage and retain its critical chance, piercing and rebounds. They cannot restore life, apply statuses or create more echoes.', requirement: 'bow', domain: 'Cunning', tier: 'ultimate', manaCost: 40, cooldown: 24, damageMultiplier: 0, color: '#c5dbc7' }),
  cataclysm: Object.freeze({ id: 'cataclysm', name: 'Cataclysm', description: 'Seven meteors converge on a wide area, each igniting its impact zone.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 80, cooldown: 30, damageMultiplier: 2.8, color: '#ffa46b' }),
  tempest: Object.freeze({ id: 'tempest', name: 'Tempest', description: 'A moving lightning storm strikes nearby enemies for up to six seconds. Each pulse consumes mana; exhaustion ends the storm.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 35, cooldown: 24, damageMultiplier: .65, color: '#c4c4ff' }),
  absoluteZero: Object.freeze({ id: 'absoluteZero', name: 'Absolute Zero', description: 'Two vast freezing waves damage and chill surrounding enemies. Elite enemies resist the freeze.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 75, cooldown: 28, damageMultiplier: 2.4, color: '#b7efff' }),
  cleave: Object.freeze({ id: 'cleave', name: 'Crescent Cleave', description: 'Sweep a melee weapon through a broad crescent, striking each nearby enemy once.', requirement: 'melee', domain: 'Might', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.8, color: '#e6bd7b' }),
  lunge: Object.freeze({ id: 'lunge', name: 'Rift Lunge', description: 'Drive your blade forward in a swift dash, cutting enemies along your path.', requirement: 'blade', domain: 'Might', tier: 'advanced', manaCost: 24, cooldown: 4, damageMultiplier: 1.5, color: '#add9ca' }),
  whirlwind: Object.freeze({ id: 'whirlwind', name: 'Whirlwind', description: 'Turn a full circle with your melee weapon, sweeping through enemies on every side.', requirement: 'melee', domain: 'Might', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.6, color: '#d8c28c' }),
  earthshatter: Object.freeze({ id: 'earthshatter', name: 'Earthshatter', description: 'Slam an axe or mace into the ground. The shockwave damages and stuns nearby enemies.', requirement: 'heavy', domain: 'Might', tier: 'advanced', manaCost: 36, cooldown: 6, damageMultiplier: 2.6, color: '#d9a077' }),
  shieldBash: Object.freeze({ id: 'shieldBash', name: 'Shield Bash', description: 'Batter enemies in front of you with your shield, damaging and stunning them.', requirement: 'shield', domain: 'Might', tier: 'basic', manaCost: 10, cooldown: 0, damageMultiplier: 1.35, color: '#b7c9bf' }),
  bulwark: Object.freeze({ id: 'bulwark', name: 'Bulwark', description: `Raise your shield in a lasting guard, greatly reducing incoming damage for ${SKILL_EXECUTION.bulwark.duration} seconds.`, requirement: 'shield', domain: 'Might', tier: 'advanced', manaCost: 32, cooldown: 8, damageMultiplier: 0, color: '#b8ccdb' }),
  volley: Object.freeze({ id: 'volley', name: 'Thorn Volley', description: `Loose ${SKILL_EXECUTION.volley.offsets.length} arrows from your bow in a spreading fan. Each arrow stops at its first enemy.`, requirement: 'bow', domain: 'Cunning', tier: 'basic', manaCost: 10, cooldown: 0, damageMultiplier: .8, color: '#a6ce9d' }),
  piercingShot: Object.freeze({ id: 'piercingShot', name: 'Piercing Shot', description: `Draw a powerful bow shot that pierces through up to ${SKILL_EXECUTION.piercingShot.effects.pierce + 1} enemies in a line.`, requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 28, cooldown: 3.5, damageMultiplier: 1.6, color: '#d0d7a1' }),
  ricochet: Object.freeze({ id: 'ricochet', name: 'Ricochet', description: `Fire an arrow that rebounds between nearby enemies, striking up to ${SKILL_EXECUTION.ricochet.effects.chain + 1} different targets.`, requirement: 'bow', domain: 'Cunning', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.2, color: '#c0dca6' }),
  rainOfArrows: Object.freeze({ id: 'rainOfArrows', name: 'Rain of Arrows', description: `Mark an area with your bow. ${groundEffectPulseCount(SKILL_EXECUTION.rainOfArrows)} waves of falling arrows strike it after a short delay.`, requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 36, cooldown: 6, damageMultiplier: .7, color: '#b7c49a' }),
  backstab: Object.freeze({ id: 'backstab', name: 'Backstab', description: `Make a close dagger thrust. Striking an enemy from behind deals ${SKILL_EXECUTION.backstab.rearMultiplier}× damage.`, requirement: 'dagger', domain: 'Cunning', tier: 'basic', manaCost: 10, cooldown: 0, damageMultiplier: 2.1, color: '#d1b2c3' }),
  fireball: Object.freeze({ id: 'fireball', name: 'Fireball', description: 'Cast a fireball from your staff or wand. It bursts on impact, damaging and igniting nearby enemies.', requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.45, color: '#f4a271' }),
  arcLightning: Object.freeze({ id: 'arcLightning', name: 'Arc Lightning', description: `Call a bolt from your staff or wand that chains through up to ${SKILL_EXECUTION.arcLightning.jumps} enemies, weakening with each jump.`, requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.4, color: '#c4c4ff' }),
  iceNova: Object.freeze({ id: 'iceNova', name: 'Ice Nova', description: 'Release frost from your staff or wand in every direction, damaging and slowing surrounding enemies.', requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 14, cooldown: 0, damageMultiplier: 1.5, color: '#a5dbe7' }),
  frostLance: Object.freeze({ id: 'frostLance', name: 'Frost Lance', description: `Launch a shard of ice from your staff or wand. It pierces up to ${SKILL_EXECUTION.frostLance.effects.pierce + 1} enemies and slows each one.`, requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 28, cooldown: 1.8, damageMultiplier: 1.65, color: '#c1e8f0' }),
  meteor: Object.freeze({ id: 'meteor', name: 'Meteor', description: 'Mark a distant area with your staff or wand. A meteor falls after a delay, blasting the area and leaving burning ground.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 40, cooldown: 7, damageMultiplier: 3.4, color: '#ef946a' }),
  siphon: Object.freeze({ id: 'siphon', name: 'Soul Siphon', description: 'Cast a hungry spirit from your staff or wand, restoring life from the damage it deals on impact.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 30, cooldown: 4.5, damageMultiplier: 1.65, color: '#dba3c3' }),
});

const REQUIREMENT_LABELS: Readonly<Record<SkillRequirement, string>> = Object.freeze({
  any: 'Any weapon', melee: 'Melee weapon', blade: 'Sword, axe or dagger', heavy: 'Axe or mace', dagger: 'Dagger', bow: 'Bow', magic: 'Staff or wand', shield: 'Equipped shield',
});
export function skillRequirementLabel(requirement: SkillRequirement): string { return REQUIREMENT_LABELS[requirement]; }

/** A dual-wield skill uses the matching hand's actual profile; the main hand wins when both qualify. */
export function skillWeapon(id: SkillId, equipment: Equipment): WeaponDefinition | null {
  const requirement = SKILL_DEFINITIONS[id].requirement;
  if (requirement === 'shield') return equipment.offHand?.kind === 'shield' && equipment.mainHand.hands === 1 ? equipment.mainHand : null;
  const eligible = (weapon: WeaponDefinition) => {
    const family = weapon.family;
    switch (requirement) {
      case 'any': return true;
      case 'melee': return family === 'sword' || family === 'axe' || family === 'mace' || family === 'dagger';
      case 'blade': return family === 'sword' || family === 'axe' || family === 'dagger';
      case 'heavy': return family === 'axe' || family === 'mace';
      case 'dagger': return family === 'dagger';
      case 'bow': return family === 'bow';
      case 'magic': return weapon.attackKind === 'bolt';
    }
  };
  if (eligible(equipment.mainHand)) return equipment.mainHand;
  const off = equipment.offHand;
  return equipment.mainHand.hands === 1 && off?.kind === 'weapon' && off.weapon.hands === 1 && eligible(off.weapon) ? off.weapon : null;
}
/** Slot assignment is retained when gear changes; incompatible equipped weapons cannot cast. */
export function canUseSkill(id: SkillId, equipment: Equipment): boolean { return skillWeapon(id, equipment) !== null; }
