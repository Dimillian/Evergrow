import { SKILL_EXECUTION, groundEffectPulseCount } from './skill-execution-content.ts';
import type { SkillId } from './character-types.ts';
import type { Equipment, WeaponDefinition } from './model.ts';

export type SkillRequirement = 'melee' | 'blade' | 'heavy' | 'dagger' | 'bow' | 'magic' | 'shield';
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
  meteor: Object.freeze({ id: 'meteor', name: 'Meteor', description: 'Mark a distant area with your staff or wand. A meteor falls after a delay, blasting and igniting it.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 40, cooldown: 7, damageMultiplier: 3.4, color: '#ef946a' }),
  siphon: Object.freeze({ id: 'siphon', name: 'Soul Siphon', description: 'Cast a hungry spirit from your staff or wand, restoring life from the damage it deals on impact.', requirement: 'magic', domain: 'Arcana', tier: 'advanced', manaCost: 30, cooldown: 4.5, damageMultiplier: 1.65, color: '#dba3c3' }),
});

const REQUIREMENT_LABELS: Readonly<Record<SkillRequirement, string>> = Object.freeze({
  melee: 'Melee weapon', blade: 'Sword, axe or dagger', heavy: 'Axe or mace', dagger: 'Dagger', bow: 'Bow', magic: 'Staff or wand', shield: 'Equipped shield',
});
export function skillRequirementLabel(requirement: SkillRequirement): string { return REQUIREMENT_LABELS[requirement]; }

/** A dual-wield skill uses the matching hand's actual profile; the main hand wins when both qualify. */
export function skillWeapon(id: SkillId, equipment: Equipment): WeaponDefinition | null {
  const requirement = SKILL_DEFINITIONS[id].requirement;
  if (requirement === 'shield') return equipment.offHand?.kind === 'shield' && equipment.mainHand.hands === 1 ? equipment.mainHand : null;
  const eligible = (weapon: WeaponDefinition) => {
    const family = weapon.family;
    switch (requirement) {
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

const SKILL_PATHS: Readonly<Record<SkillId, string>> = Object.freeze({
  cataclysm: '<path d="M5 3 15 15M20 1 24 10M35 5 29 18M4 34l8-12 8 14 9-17 8 16M3 38h34"/><circle cx="20" cy="20" r="5"/>',
  tempest: '<circle cx="20" cy="20" r="16"/><path d="m23 3-14 20 12-4-4 18 15-23-11 5M2 12l6 2M32 27l6 2"/>',
  absoluteZero: '<circle cx="20" cy="20" r="17"/><path d="M20 2v36M4 10l32 20M4 30l32-20M14 7l6 6 6-6M14 33l6-6 6 6M7 16l6 4-6 4M33 16l-6 4 6 4"/>',
  cleave: '<path d="M8 27 25 6l3 2-16 23-5 2Z"/><path d="m6 23 12 9M17 6C32 4 39 16 31 27M23 4c13 3 17 14 10 22"/>',
  lunge: '<path d="m7 30 20-21 5-2-2 6-20 20ZM5 25l8 8M3 15l10-3M3 21l7-2M18 4l-3 5"/>',
  whirlwind: '<path d="M9 12C16 2 32 7 33 20c1 11-11 18-21 12C4 27 4 18 9 12Zm1-7-1 7 7-1M29 35l3-8-8 2M15 24l10-12 3-1-1 4-10 11Zm-3-3 8 7M15 25l-4 5"/>',
  earthshatter: '<path d="m18 4 12 8-5 8-12-8ZM16 15 6 31l4 3 11-16M4 35l10-3 5 5 3-9 5 5 9-2M30 19l5 5M8 17l-5 6M27 29l4-5"/>',
  shieldBash: '<path d="M17 5 29 10v12c0 6-6 11-12 14C11 33 5 28 5 22V10ZM17 11v18M10 18h14M31 10l5-3M33 18h5M31 26l5 3M10 24l7 5 7-5"/>',
  bulwark: '<path d="M20 4 34 10v11c0 8-8 14-14 17C14 35 6 29 6 21V10ZM20 10l8 5v9l-8 7-8-7v-9ZM20 14v12M15 20h10M2 15v14M38 15v14"/>',
  volley: '<path d="m20 4 4 12-4-2-4 2ZM7 11l11 6-4 2-1 4ZM33 11l-6 12-1-4-4-2ZM20 16v19M14 24l-7 9M26 24l7 9"/>',
  piercingShot: '<path d="M5 31 31 5M24 6l9-3-3 9M4 25l6 6-1 6M10 20l10 10M17 13l10 10M24 6l10 10M15 6l3 3M31 28l4 3"/>',
  ricochet: '<path d="M5 31 14 12l12 15 9-20M29 8l7-3 1 8M10 12h8M22 27h8M5 26l-2 8 8-3"/><circle cx="14" cy="12" r="4"/><circle cx="26" cy="27" r="4"/>',
  rainOfArrows: '<path d="M8 4v22M4 21l4 7 4-7M20 8v21M16 24l4 7 4-7M32 3v21M28 19l4 7 4-7M3 35c10-5 24-5 34 0M5 8h6M17 12h6M29 7h6"/>',
  backstab: '<path d="m11 27 14-18 7-6-3 10-14 18ZM7 24l12 10M11 29l-5 7M5 34l3 4M24 22c7-2 12 3 11 9M24 27l-2-6 6-1M7 8l4 4M16 3v6"/>',
  fireball: '<path d="M34 5C22 5 18 13 12 15 4 18 3 28 9 33c7 7 18 2 20-6 1-7 2-12 5-22ZM17 18c-7 6-5 13 2 12 5-1 6-7 3-10l-1 5M10 5l7 4M5 11l7 2M30 32l5-2"/>',
  arcLightning: '<path d="m25 2-15 20 11-3-5 19 15-22-11 4ZM4 10l5 4M31 29l5 3M33 6l4 2M3 29l5-1M29 4l3 1"/>',
  iceNova: '<circle cx="20" cy="20" r="13"/><path d="M20 3v34M5 11l30 18M5 29l30-18M16 5l4 4 4-4M16 35l4-4 4 4M5 16l6-1-1-6M30 31l-1-6 6-1M5 24l6 1-1 6M30 9l-1 6 6 1"/>',
  frostLance: '<path d="m5 34 9-21L34 4 25 25ZM5 34 34 4M14 13l11 12M3 21l7 1M19 31l1 6M21 3l1 6M31 19l6 1M10 31l3 6"/>',
  meteor: '<path d="M29 3 17 13M36 8 26 19M18 3l-5 7M34 19l-4 6M17 12c-8-1-14 8-11 15 3 8 14 10 20 3 7-8-1-17-9-18ZM14 17l7 2 2 7-6 4-7-5ZM3 37l9-3 7 3 8-5 10 3"/>',
  siphon: '<path d="M28 6C15 2 4 12 8 25c3 10 17 11 24 2-7 4-16 1-16-7 0-6 6-9 12-7l-5 4 12-3-4-11Z"/><path d="M19 25c-5-4 0-10 3-5 3-5 8 0 3 4l-3 3Z"/>',
});

/** Inline, scalable code-defined art; no external asset or browser dependency. */
export function skillIconSVG(id: SkillId, size = 36): string {
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 36;
  return `<svg aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SKILL_PATHS[id]}</svg>`;
}
