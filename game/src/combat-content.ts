import type { EnemyKind, Projectile } from './model.ts';

/** Authored balance is immutable; each simulation owns its mutable actor state. */
export const COMBAT_TIMING = Object.freeze({
  fixedStep: 1 / 120, hitFlashDuration: .16, inputBuffer: .11, attackBuffer: .22,
  hurtGuard: .3, knockbackDecay: .065, staggerDuration: .16, interruptedRecovery: .3,
});

export const PLAYER_DEFAULTS = Object.freeze({ maxHp: 100, maxMana: 100, manaRegeneration: 9, radius: 9 });
export const SKILL_CAST_MOTION = Object.freeze({ duration: .22, releaseRemaining: .145 });
export const BASIC_ATTACK_PHASES = Object.freeze({ activeStart: .19, activeEnd: .45 });
export const PLAYER_ABILITIES = Object.freeze({
  basicAttack: Object.freeze({ ...BASIC_ATTACK_PHASES, bladeHalfAngle: .055 }),
  dodge: Object.freeze({ charges: 2, recharge: 1.8, duration: .22, speed: 360,
    invulnerabilityStart: .02, invulnerabilityEnd: .18 }),
  heal: Object.freeze({ charges: 2, restoreFraction: .42, cooldown: .8, flashDuration: .5, killsPerCharge: 8 }),
});

export const PLAYER_MOVEMENT = Object.freeze({
  speed: 165, stopThreshold: .4, gaitDistance: 22, castMultiplier: .88,
  response: Object.freeze({ stop: .025, reverse: .028, accelerate: .045 }),
  attackMultiplier: Object.freeze({ windup: .92, active: .87, recovery: .96 }),
});

export interface ProjectileDefinition {
  readonly owner: Projectile['owner'];
  readonly speed: number;
  readonly life: number;
  readonly radius: number;
  readonly damage: number;
}

export const PROJECTILE_DEFINITIONS = Object.freeze({
  hex: Object.freeze({ owner: 'enemy', speed: 145, life: 2.7, radius: 5, damage: 13 } as const),
  boneArrow: Object.freeze({ owner: 'enemy', speed: 235, life: 2.3, radius: 3, damage: 11 } as const),
}) satisfies Readonly<Record<string, ProjectileDefinition>>;

interface EnemyBaseDefinition {
  readonly name: string;
  readonly hp: number;
  readonly xpReward: number;
  readonly radius: number;
  readonly speed: number;
  readonly windup: number;
  readonly active: number;
  readonly recovery: number;
  readonly range: number;
  readonly damage: number;
  readonly aimLock: number;
  readonly knockbackDistance: number;
  readonly interruptible: boolean;
  readonly attackGroup: 'pack' | 'special';
  readonly awarenessDistance: number;
  readonly preferredDistance: number;
  readonly role: 'flanker' | 'heavy' | 'skirmisher' | 'ranged';
}

/** A new enemy chooses a supported attack behavior instead of adding kind checks. */
export type EnemyDefinition = EnemyBaseDefinition & (
  { readonly attack: 'melee'; readonly arc: number; readonly lungeSpeed: number; readonly engageDistance?: number }
  | { readonly attack: 'projectile'; readonly projectile: ProjectileDefinition;
    readonly maxAttackDistance: number; readonly retreatDistance: number;
    readonly projectileStyle: 'spirit' | 'arrow'; readonly shotOffsets: readonly number[] }
  | { readonly attack: 'ground'; readonly blastRadius: number; readonly maxAttackDistance: number; readonly retreatDistance: number }
);

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyKind, EnemyDefinition>> = Object.freeze({
  stalker: Object.freeze({ name: 'Hollow Stalker', hp: 48, xpReward: 20, radius: 10, speed: 104,
    windup: .42, active: .18, recovery: .78, range: 28, damage: 8, aimLock: .17,
    attack: 'melee', arc: Math.PI * .7, lungeSpeed: 48,
    awarenessDistance: 235, preferredDistance: 48, role: 'flanker',
    knockbackDistance: 14, interruptible: true, attackGroup: 'pack' }),
  brute: Object.freeze({ name: 'Gravebound Brute', hp: 138, xpReward: 50, radius: 17, speed: 65,
    windup: .95, active: .18, recovery: 1.2, range: 53, damage: 22, aimLock: .32,
    attack: 'melee', arc: Math.PI * 1.15, lungeSpeed: 0,
    awarenessDistance: 245, preferredDistance: 55, role: 'heavy',
    knockbackDistance: 5, interruptible: false, attackGroup: 'special' }),
  caster: Object.freeze({ name: 'Mire Hexer', hp: 56, xpReward: 30, radius: 11, speed: 76,
    windup: .9, active: .15, recovery: 1.15, range: 280, damage: PROJECTILE_DEFINITIONS.hex.damage, aimLock: .34,
    attack: 'projectile', projectile: PROJECTILE_DEFINITIONS.hex, projectileStyle: 'spirit', shotOffsets: Object.freeze([0, -.22, .22]),
    maxAttackDistance: 255, retreatDistance: 130,
    awarenessDistance: 295, preferredDistance: 205, role: 'ranged',
    knockbackDistance: 14, interruptible: true, attackGroup: 'special' }),
  hound: Object.freeze({ name: 'Briar Hound', hp: 37, xpReward: 22, radius: 10, speed: 124,
    windup: .68, active: .28, recovery: .95, range: 23, damage: 10, aimLock: .22,
    attack: 'melee', arc: Math.PI * .48, lungeSpeed: 320, engageDistance: 112,
    awarenessDistance: 265, preferredDistance: 105, role: 'skirmisher',
    knockbackDistance: 17, interruptible: true, attackGroup: 'pack' }),
  archer: Object.freeze({ name: 'Ashen Ranger', hp: 45, xpReward: 28, radius: 10, speed: 96,
    windup: .95, active: .12, recovery: .95, range: 335, damage: PROJECTILE_DEFINITIONS.boneArrow.damage, aimLock: .32,
    attack: 'projectile', projectile: PROJECTILE_DEFINITIONS.boneArrow, projectileStyle: 'arrow', shotOffsets: Object.freeze([0]),
    maxAttackDistance: 290, retreatDistance: 160,
    awarenessDistance: 320, preferredDistance: 245, role: 'ranged',
    knockbackDistance: 15, interruptible: true, attackGroup: 'special' }),
  wisp: Object.freeze({ name: 'Lantern Wisp', hp: 39, xpReward: 32, radius: 9, speed: 73,
    windup: 1.3, active: .15, recovery: 1.4, range: 275, damage: 17, aimLock: .22,
    attack: 'ground', blastRadius: 52, maxAttackDistance: 245, retreatDistance: 115,
    awarenessDistance: 285, preferredDistance: 210, role: 'ranged',
    knockbackDistance: 18, interruptible: true, attackGroup: 'special' }),
});

/** Sensing/steering budgets and pacing never scale with monster level. */
export const ENEMY_AI_RULES = Object.freeze({
  senseInterval: .12, awarenessSeconds: .28, hearingDistance: 72, loseSightAfter: 3.4,
  tetherDistance: 470, returnStopDistance: 12, patrolRadius: 36, patrolSpeed: .28,
  separationPadding: 13, flankAngle: .6, supportDistance: 80,
});

export const LOOT_RULES = Object.freeze({
  maxGroundItems: 96, equipmentCollectDistance: 30,
  maxPickups: 32, life: 20, radius: 4, healthEveryKills: 3, healthFraction: .12, manaFraction: .16,
  collectDistance: 18, magnetDistance: 55, magnetSpeed: 100,
});
