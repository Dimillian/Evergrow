import { AURA_IDS, AURAS } from './aura-content.ts';
import type { SkillId } from './character-types.ts';
import type { Equipment, WeaponDefinition } from './model.ts';

export type SkillRequirement = 'any' | 'melee' | 'blade' | 'heavy' | 'dagger' | 'bow' | 'magic' | 'shield';
export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly requirement: SkillRequirement;
  readonly domain: 'Might' | 'Cunning' | 'Arcana';
  readonly tier: 'basic' | 'advanced' | 'ultimate' | 'aura';
  readonly manaCost: number;
  readonly cooldown: number;
  readonly damageMultiplier: number;
  readonly color: string;
}

/** Costs, potency and equipment requirements are shared by the atlas, HUD and combat. */
export const SKILL_DEFINITIONS: Readonly<Record<SkillId, Readonly<SkillDefinition>>> = Object.freeze({
  ...Object.fromEntries(AURA_IDS.map(id=>[id,Object.freeze({id,name:AURAS[id].name,description:AURAS[id].description,requirement:'any',domain:AURAS[id].domain,tier:'aura',manaCost:0,cooldown:0,damageMultiplier:0,color:AURAS[id].color})])) as Record<typeof AURA_IDS[number],Readonly<SkillDefinition>>,
  repulse: Object.freeze({ id: 'repulse', name: 'Repulse', description: 'Damage and stun enemies in a broad shield shockwave.', requirement: 'shield', domain: 'Might', tier: 'advanced', manaCost: 18, cooldown: 5, damageMultiplier: 1.65, color: '#e5bd80' }),
  ironCitadel: Object.freeze({ id: 'ironCitadel', name: 'Iron Citadel', description: 'Strike surrounding enemies, then gain damage reduction.', requirement: 'shield', domain: 'Might', tier: 'ultimate', manaCost: 34, cooldown: 28, damageMultiplier: 2.4, color: '#f0d5a2' }),
  smokeVeil: Object.freeze({ id: 'smokeVeil', name: 'Smoke Veil', description: 'Slow surrounding enemies and gain damage reduction. Deals no damage.', requirement: 'any', domain: 'Cunning', tier: 'advanced', manaCost: 15, cooldown: 9, damageMultiplier: 0, color: '#9bbfc6' }),
  nightReaping: Object.freeze({ id: 'nightReaping', name: 'Night Reaping', description: 'Strike nearby enemies with your dagger. Rear strikes deal more damage.', requirement: 'dagger', domain: 'Cunning', tier: 'ultimate', manaCost: 36, cooldown: 28, damageMultiplier: 2.2, color: '#b9e3d6' }),
  sidestep: Object.freeze({ id: 'sidestep', name: 'Sidestep', description: 'Step toward your aim. Terrain blocks movement; grants no invulnerability.', requirement: 'any', domain: 'Cunning', tier: 'advanced', manaCost: 6, cooldown: 3.5, damageMultiplier: 0, color: '#b5cbb8' }),
  brace: Object.freeze({ id: 'brace', name: 'Brace', description: 'Gain temporary damage reduction. No shield required.', requirement: 'any', domain: 'Might', tier: 'advanced', manaCost: 11, cooldown: 8, damageMultiplier: 0, color: '#cfb88f' }),
  runicWard: Object.freeze({ id: 'runicWard', name: 'Runic Ward', description: 'Create a Ward that absorbs incoming damage. Does not stack.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 17, cooldown: 10, damageMultiplier: 0, color: '#9ed6d5' }),
  vaultingShot: Object.freeze({ id: 'vaultingShot', name: 'Vaulting Shot', description: 'Fire an arrow while retreating. Grants no invulnerability.', requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 17, cooldown: 6, damageMultiplier: 1.2, color: '#a7c897' }),
  rallyOfIron: Object.freeze({ id: 'rallyOfIron', name: 'Rally of Iron', description: 'Gain damage reduction and empower your next melee actions.', requirement: 'melee', domain: 'Might', tier: 'ultimate', manaCost: 32, cooldown: 24, damageMultiplier: 0, color: '#d4a677' }),
  ghostHunt: Object.freeze({ id: 'ghostHunt', name: 'Ghost Hunt', description: 'Your next arrow actions release delayed echoes.', requirement: 'bow', domain: 'Cunning', tier: 'ultimate', manaCost: 30, cooldown: 24, damageMultiplier: 0, color: '#c5dbc7' }),
  cataclysm: Object.freeze({ id: 'cataclysm', name: 'Cataclysm', description: 'Meteors strike a wide area and leave burning ground.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 80, cooldown: 30, damageMultiplier: 2.8, color: '#ffa46b' }),
  tempest: Object.freeze({ id: 'tempest', name: 'Tempest', description: 'A moving storm strikes nearby enemies. Mana exhaustion ends it.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 35, cooldown: 24, damageMultiplier: .65, color: '#c4c4ff' }),
  absoluteZero: Object.freeze({ id: 'absoluteZero', name: 'Absolute Zero', description: 'Freezing waves damage and slow surrounding enemies.', requirement: 'magic', domain: 'Arcana', tier: 'ultimate', manaCost: 75, cooldown: 28, damageMultiplier: 2.4, color: '#b7efff' }),
  cleave: Object.freeze({ id: 'cleave', name: 'Crescent Cleave', description: 'Sweep a broad crescent, striking each enemy once.', requirement: 'melee', domain: 'Might', tier: 'basic', manaCost: 9, cooldown: 0, damageMultiplier: 1.8, color: '#e6bd7b' }),
  lunge: Object.freeze({ id: 'lunge', name: 'Rift Lunge', description: 'Dash forward, cutting enemies along your path.', requirement: 'blade', domain: 'Might', tier: 'advanced', manaCost: 18, cooldown: 4, damageMultiplier: 1.5, color: '#add9ca' }),
  whirlwind: Object.freeze({ id: 'whirlwind', name: 'Whirlwind', description: 'Sweep a full circle, striking surrounding enemies.', requirement: 'melee', domain: 'Might', tier: 'basic', manaCost: 9, cooldown: 0, damageMultiplier: 1.6, color: '#d8c28c' }),
  earthshatter: Object.freeze({ id: 'earthshatter', name: 'Earthshatter', description: 'Slam the ground to damage and stun nearby enemies.', requirement: 'heavy', domain: 'Might', tier: 'advanced', manaCost: 27, cooldown: 6, damageMultiplier: 2.6, color: '#d9a077' }),
  shieldBash: Object.freeze({ id: 'shieldBash', name: 'Shield Bash', description: 'Damage and stun enemies in front of your shield.', requirement: 'shield', domain: 'Might', tier: 'basic', manaCost: 8, cooldown: 0, damageMultiplier: 1.35, color: '#b7c9bf' }),
  bulwark: Object.freeze({ id: 'bulwark', name: 'Bulwark', description: 'Raise your shield to block incoming hits.', requirement: 'shield', domain: 'Might', tier: 'advanced', manaCost: 24, cooldown: 8, damageMultiplier: 0, color: '#b8ccdb' }),
  volley: Object.freeze({ id: 'volley', name: 'Thorn Volley', description: 'Fire arrows in a spreading fan.', requirement: 'bow', domain: 'Cunning', tier: 'basic', manaCost: 8, cooldown: 0, damageMultiplier: .8, color: '#a6ce9d' }),
  piercingShot: Object.freeze({ id: 'piercingShot', name: 'Piercing Shot', description: 'Fire a powerful arrow that pierces enemies in a line.', requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 21, cooldown: 3.5, damageMultiplier: 1.6, color: '#d0d7a1' }),
  ricochet: Object.freeze({ id: 'ricochet', name: 'Ricochet', description: 'Fire an arrow that rebounds between nearby enemies.', requirement: 'bow', domain: 'Cunning', tier: 'basic', manaCost: 9, cooldown: 0, damageMultiplier: 1.2, color: '#c0dca6' }),
  rainOfArrows: Object.freeze({ id: 'rainOfArrows', name: 'Rain of Arrows', description: 'Waves of arrows strike the targeted area after a delay.', requirement: 'bow', domain: 'Cunning', tier: 'advanced', manaCost: 27, cooldown: 6, damageMultiplier: .7, color: '#b7c49a' }),
  backstab: Object.freeze({ id: 'backstab', name: 'Backstab', description: 'Thrust your dagger. Rear strikes deal more damage.', requirement: 'dagger', domain: 'Cunning', tier: 'basic', manaCost: 8, cooldown: 0, damageMultiplier: 2.1, color: '#d1b2c3' }),
  fireball: Object.freeze({ id: 'fireball', name: 'Fireball', description: 'Explodes on impact, damaging and applying Burn to nearby enemies.', requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.45, color: '#f4a271' }),
  arcLightning: Object.freeze({ id: 'arcLightning', name: 'Arc Lightning', description: 'Lightning surges between nearby enemies with a brief travel time, weakening with each jump.', requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 12, cooldown: 0, damageMultiplier: 1.25, color: '#c4c4ff' }),
  iceNova: Object.freeze({ id: 'iceNova', name: 'Ice Nova', description: 'Damage and slow surrounding enemies with a frost nova.', requirement: 'magic', domain: 'Arcana', tier: 'basic', manaCost: 14, cooldown: 0, damageMultiplier: 1.5, color: '#a5dbe7' }),
  frostLance: Object.freeze({ id: 'frostLance', name: 'Frost Lance', description: 'Fire a piercing ice shard that slows its targets.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 28, cooldown: 1.8, damageMultiplier: 1.65, color: '#c1e8f0' }),
  meteor: Object.freeze({ id: 'meteor', name: 'Meteor', description: 'A delayed meteor explodes at your aim and leaves burning ground.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 40, cooldown: 7, damageMultiplier: 3.4, color: '#ef946a' }),
  siphon: Object.freeze({ id: 'siphon', name: 'Soul Siphon', description: 'Fire a spirit that restores life from actual impact damage.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 30, cooldown: 4.5, damageMultiplier: 1.65, color: '#dba3c3' }),
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
