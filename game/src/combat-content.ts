import type { EnemyKind, Projectile } from './model.ts';

/** Authored balance is immutable; each simulation owns its mutable actor state. */
export const COMBAT_TIMING = Object.freeze({
  fixedStep: 1 / 120, hitFlashDuration: .16, inputBuffer: .11, attackBuffer: .22,
  hurtGuard: .3, knockbackDecay: .065, staggerDuration: .16, interruptedRecovery: .3,
});

export const PLAYER_DEFAULTS = Object.freeze({ maxHp: 100, maxMana: 100, manaRegeneration: 9, radius: 9 });
export const BASIC_ATTACK_PHASES = Object.freeze({ activeStart: .19, activeEnd: .45 });
export const PLAYER_ABILITIES = Object.freeze({
  basicAttack: Object.freeze({ ...BASIC_ATTACK_PHASES, bladeHalfAngle: .055 }),
  ember: Object.freeze({ manaCost: 20, cooldown: .45, duration: .22, releaseRemaining: .145 }),
  dodge: Object.freeze({ charges: 2, recharge: 1.8, duration: .22, speed: 360,
    invulnerabilityStart: .02, invulnerabilityEnd: .18 }),
  heal: Object.freeze({ charges: 2, restore: 42, cooldown: .8, flashDuration: .5, killsPerCharge: 8 }),
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
  ember: Object.freeze({ owner: 'player', speed: 360, life: 1.4, radius: 5, damage: 36 } as const),
  hex: Object.freeze({ owner: 'enemy', speed: 145, life: 2, radius: 5, damage: 13 } as const),
}) satisfies Readonly<Record<string, ProjectileDefinition>>;

interface EnemyBaseDefinition {
  readonly name: string;
  readonly hp: number;
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
}

/** A new enemy chooses a supported attack behavior instead of adding kind checks. */
export type EnemyDefinition = EnemyBaseDefinition & (
  { readonly attack: 'melee'; readonly arc: number; readonly lungeSpeed: number }
  | { readonly attack: 'projectile'; readonly projectile: ProjectileDefinition;
    readonly minAttackDistance: number; readonly maxAttackDistance: number; readonly retreatDistance: number }
);

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyKind, EnemyDefinition>> = Object.freeze({
  stalker: Object.freeze({ name: 'Hollow Stalker', hp: 48, radius: 10, speed: 112,
    windup: .32, active: .18, recovery: .65, range: 28, damage: 8, aimLock: .16,
    attack: 'melee', arc: Math.PI * .7, lungeSpeed: 48,
    knockbackDistance: 14, interruptible: true, attackGroup: 'pack' }),
  brute: Object.freeze({ name: 'Gravebound Brute', hp: 138, radius: 17, speed: 69,
    windup: .75, active: .13, recovery: .9, range: 48, damage: 22, aimLock: .3,
    attack: 'melee', arc: Math.PI * 1.25, lungeSpeed: 0,
    knockbackDistance: 5, interruptible: false, attackGroup: 'special' }),
  caster: Object.freeze({ name: 'Mire Hexer', hp: 56, radius: 11, speed: 82,
    windup: .65, active: .15, recovery: .7, range: 240, damage: PROJECTILE_DEFINITIONS.hex.damage, aimLock: .43,
    attack: 'projectile', projectile: PROJECTILE_DEFINITIONS.hex,
    minAttackDistance: 100, maxAttackDistance: 215, retreatDistance: 125,
    knockbackDistance: 14, interruptible: true, attackGroup: 'special' }),
});

export const LOOT_RULES = Object.freeze({
  maxPickups: 32, life: 20, radius: 4, healthEveryKills: 3, healthValue: 12, manaValue: 16,
  collectDistance: 18, magnetDistance: 55, magnetSpeed: 100,
});
