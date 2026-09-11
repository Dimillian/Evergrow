import { MANA_RULES } from './mana-content.ts';
import { LAIR_RULES } from './wilderness-boss-content.ts';
import type { Enemy, EnemyKind, Projectile, ProjectileStyle } from './model.ts';

/** Authored balance is immutable; each simulation owns its mutable actor state. */
export const COMBAT_TIMING = Object.freeze({
  fixedStep: 1 / 120, hitFlashDuration: .16, inputBuffer: .11, attackBuffer: .22,
  hurtGuard: .3, knockbackDecay: .065, staggerDuration: .16, interruptedRecovery: .3,
});

export const PLAYER_DEFAULTS = Object.freeze({ maxHp: 100, maxMana: 100, manaRegeneration: 1, radius: 9 });
export const SKILL_CAST_MOTION = Object.freeze({ releaseRemainingFraction: .145 / .22 });
export const RANGED_BASIC_ATTACK_PHASES = Object.freeze({ activeStart: .42, activeEnd: .5 });
export const BASIC_ATTACK_PHASES = Object.freeze({ activeStart: .19, activeEnd: .45 });
export const PLAYER_ABILITIES = Object.freeze({
  basicAttack: Object.freeze({ ...BASIC_ATTACK_PHASES, bladeHalfAngle: .055 }),
  dodge: Object.freeze({ charges: 2, recharge: 1.8, duration: .22, speed: 360,
    invulnerabilityStart: .02, invulnerabilityEnd: .18 }),
  potion: Object.freeze({ charges: 2, lifeFraction: .42, manaFraction: .4, cooldown: .8, flashDuration: .5, killsPerCharge: 8 }),
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
  readonly awarenessDistance: number;
  readonly preferredDistance: number;
  readonly role: 'flanker' | 'heavy' | 'skirmisher' | 'ranged';
}

/** A new enemy chooses a supported attack behavior instead of adding kind checks. */
export type EnemyDefinition = EnemyBaseDefinition & (
  { readonly attack: 'melee'; readonly arc: number; readonly lungeSpeed: number; readonly engageDistance?: number }
  | { readonly attack: 'projectile'; readonly projectile: ProjectileDefinition;
    readonly maxAttackDistance: number; readonly retreatDistance: number;
    readonly warning?: boolean; readonly projectileStyle: ProjectileStyle; readonly shotOffsets: readonly number[] }
  | { readonly attack: 'ground'; readonly blastStyle?: ProjectileStyle; readonly blastRadius: number; readonly maxAttackDistance: number; readonly retreatDistance: number }
);

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyKind, EnemyDefinition>> = Object.freeze({
  thornReaver: Object.freeze({ name: 'Thorn Reaver', hp: 76, xpReward: 32, radius: 13, speed: 93,
    windup: .45, active: .2, recovery: .66, range: 39, damage: 12, aimLock: .23,
    attack: 'melee', arc: Math.PI * .7, lungeSpeed: 45, awarenessDistance: 370, preferredDistance: 35,
    role: 'flanker', knockbackDistance: 10, interruptible: true }),
  mireSpitter: Object.freeze({ name: 'Mire Spitter', hp: 61, xpReward: 31, radius: 13, speed: 67,
    windup: .7, active: .14, recovery: .8, range: 290, damage: 12, aimLock: .25,
    attack: 'projectile', projectile: Object.freeze({ owner: 'enemy', speed: 170, life: 2.1, radius: 5, damage: 12 }),
    projectileStyle: 'spirit', shotOffsets: Object.freeze([0]), maxAttackDistance: 250, retreatDistance: 70,
    awarenessDistance: 390, preferredDistance: 180, role: 'ranged', knockbackDistance: 12, interruptible: true }),
  frostRevenant: Object.freeze({ name: 'Rime Revenant', hp: 115, xpReward: 43, radius: 15, speed: 74,
    windup: .72, active: .2, recovery: .86, range: 44, damage: 17, aimLock: .40,
    attack: 'melee', arc: Math.PI * .85, lungeSpeed: 20, awarenessDistance: 370, preferredDistance: 40,
    role: 'heavy', knockbackDistance: 7, interruptible: false }),
  emberAcolyte: Object.freeze({ name: 'Ember Acolyte', hp: 54, xpReward: 34, radius: 11, speed: 87,
    windup: .7, active: .14, recovery: .75, range: 315, damage: 14, aimLock: .25,
    attack: 'projectile', projectile: Object.freeze({ owner: 'enemy', speed: 190, life: 2, radius: 5, damage: 14 }),
    projectileStyle: 'fire', shotOffsets: Object.freeze([0]), maxAttackDistance: 270, retreatDistance: 90,
    awarenessDistance: 410, preferredDistance: 220, role: 'ranged', knockbackDistance: 16, interruptible: true }),
  duneScuttler: Object.freeze({ name: 'Dune Scuttler', hp: 43, xpReward: 25, radius: 10, speed: 120,
    windup: .44, active: .16, recovery: .64, range: 29, damage: 9, aimLock: .22,
    attack: 'melee', arc: Math.PI * .65, lungeSpeed: 55, awarenessDistance: 370, preferredDistance: 24,
    role: 'flanker', knockbackDistance: 15, interruptible: true }),
  stormSentinel: Object.freeze({ name: 'Storm Sentinel', hp: 82, xpReward: 39, radius: 13, speed: 72,
    windup: .75, active: .14, recovery: .85, range: 320, damage: 15, aimLock: .24,
    attack: 'projectile', projectile: Object.freeze({ owner: 'enemy', speed: 175, life: 2.2, radius: 4, damage: 15 }),
    projectileStyle: 'lightning', shotOffsets: Object.freeze([0]), maxAttackDistance: 270, retreatDistance: 100,
    awarenessDistance: 420, preferredDistance: 225, role: 'ranged', knockbackDistance: 8, interruptible: true }),
  briarMatriarch: Object.freeze({ name: 'Briar Matriarch', hp: 1450, xpReward: 160, radius: 27, speed: 88, windup: .85, active: .28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 21, aimLock: 0, attack: 'melee', arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: 'heavy', knockbackDistance: 0, interruptible: false }),
  ashColossus: Object.freeze({ name: 'Ashbound Colossus', hp: 1900, xpReward: 160, radius: 27, speed: 57, windup: .85, active: .28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 26, aimLock: 0, attack: 'melee', arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: 'heavy', knockbackDistance: 0, interruptible: false }),
  graveMarshal: Object.freeze({ name: 'Grave Marshal', hp: 1650, xpReward: 160, radius: 27, speed: 75, windup: .85, active: .28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 23, aimLock: 0, attack: 'melee', arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: 'heavy', knockbackDistance: 0, interruptible: false }),
  warden: Object.freeze({ name: 'The Hollow Warden', hp: 1800, xpReward: 120, radius: 24, speed: 66, windup: .9, active: .22, recovery: 0.8, range: 125, damage: 18, aimLock: .1, attack: 'melee', arc: Math.PI * 1.3, lungeSpeed: 0, awarenessDistance: 700, preferredDistance: 100, role: 'heavy', knockbackDistance: 0, interruptible: false }),
  goblin: Object.freeze({ name: 'Scrap Goblin', hp: 22, xpReward: 6, radius: 6, speed: 132,
    windup: .38, active: .15, recovery: 0.48, range: 22, damage: 5, aimLock: .18,
    attack: 'melee', arc: Math.PI * .55, lungeSpeed: 70,
    awarenessDistance: 350, preferredDistance: 30, role: 'flanker',
    knockbackDistance: 22, interruptible: true }),
  goblinChief: Object.freeze({ name: 'Goblin War Chief', hp: 170, xpReward: 65, radius: 13, speed: 86,
    windup: .78, active: .2, recovery: 0.72, range: 43, damage: 17, aimLock: .46,
    attack: 'melee', arc: Math.PI * .95, lungeSpeed: 35,
    awarenessDistance: 410, preferredDistance: 55, role: 'heavy',
    knockbackDistance: 7, interruptible: false }),
  stalker: Object.freeze({ name: 'Hollow Stalker', hp: 48, xpReward: 20, radius: 10, speed: 104,
    windup: .42, active: .18, recovery: 0.624, range: 28, damage: 8, aimLock: .20,
    attack: 'melee', arc: Math.PI * .7, lungeSpeed: 48,
    awarenessDistance: 330, preferredDistance: 48, role: 'flanker',
    knockbackDistance: 14, interruptible: true }),
  brute: Object.freeze({ name: 'Gravebound Brute', hp: 138, xpReward: 50, radius: 17, speed: 65,
    windup: .95, active: .18, recovery: 0.96, range: 53, damage: 22, aimLock: .60,
    attack: 'melee', arc: Math.PI * 1.15, lungeSpeed: 0,
    awarenessDistance: 340, preferredDistance: 55, role: 'heavy',
    knockbackDistance: 5, interruptible: false }),
  caster: Object.freeze({ name: 'Mire Hexer', hp: 56, xpReward: 30, radius: 11, speed: 76,
    windup: .75, active: .15, recovery: .8, range: 280, damage: PROJECTILE_DEFINITIONS.hex.damage, aimLock: .34,
    attack: 'projectile', projectile: PROJECTILE_DEFINITIONS.hex, projectileStyle: 'spirit', shotOffsets: Object.freeze([0, -.22, .22]),
    maxAttackDistance: 255, retreatDistance: 130,
    awarenessDistance: 400, preferredDistance: 205, role: 'ranged',
    knockbackDistance: 14, interruptible: true }),
  hound: Object.freeze({ name: 'Briar Hound', hp: 37, xpReward: 22, radius: 10, speed: 124,
    windup: .68, active: .28, recovery: 0.76, range: 23, damage: 10, aimLock: .22,
    attack: 'melee', arc: Math.PI * .48, lungeSpeed: 320, engageDistance: 112,
    awarenessDistance: 370, preferredDistance: 105, role: 'skirmisher',
    knockbackDistance: 17, interruptible: true }),
  archer: Object.freeze({ name: 'Ashen Ranger', hp: 45, xpReward: 28, radius: 10, speed: 96,
    windup: .7, active: .12, recovery: .68, range: 335, damage: PROJECTILE_DEFINITIONS.boneArrow.damage, aimLock: .32,
    attack: 'projectile', projectile: PROJECTILE_DEFINITIONS.boneArrow, projectileStyle: 'arrow', shotOffsets: Object.freeze([0]),
    maxAttackDistance: 290, retreatDistance: 160,
    awarenessDistance: 430, preferredDistance: 245, role: 'ranged',
    knockbackDistance: 15, interruptible: true }),
  wisp: Object.freeze({ name: 'Lantern Wisp', hp: 39, xpReward: 32, radius: 9, speed: 73,
    windup: 1.3, active: .15, recovery: 1.12, range: 275, damage: 17, aimLock: .22,
    attack: 'ground', blastRadius: 52, maxAttackDistance: 245, retreatDistance: 115,
    awarenessDistance: 390, preferredDistance: 210, role: 'ranged',
    knockbackDistance: 18, interruptible: true }),
});

export const REGIONAL_ENEMY_KINDS = Object.freeze(['thornReaver', 'mireSpitter', 'frostRevenant', 'emberAcolyte', 'duneScuttler', 'stormSentinel'] as const);
export type RegionalEnemyKind = typeof REGIONAL_ENEMY_KINDS[number];
export function isRegionalEnemy(kind: EnemyKind): kind is RegionalEnemyKind { return (REGIONAL_ENEMY_KINDS as readonly EnemyKind[]).includes(kind); }

/** Signature actions use the same commitment, contact and rendering definitions as basic attacks.
 * Damage is a ratio of the actor's original geographic damage, never the player's level. */
export const ENEMY_SIGNATURE_ATTACKS: Readonly<Partial<Record<EnemyKind, EnemyDefinition>>> = Object.freeze({
  thornReaver: Object.freeze({ ...ENEMY_DEFINITIONS.thornReaver, attack: 'melee', arc: Math.PI * 1.3,
    lungeSpeed: 0, range: 70, damage: 19, windup: .95, aimLock: .60, active: .24, recovery: 1.1 }),
  mireSpitter: Object.freeze({ ...ENEMY_DEFINITIONS.mireSpitter, attack: 'ground', blastRadius: 60,
    blastStyle: 'spirit', maxAttackDistance: 250, retreatDistance: 0, damage: 19, windup: 1.25, aimLock: .2, recovery: 1.1 }),
  frostRevenant: Object.freeze({ ...ENEMY_DEFINITIONS.frostRevenant, attack: 'ground', blastRadius: 65,
    blastStyle: 'frost', range: 180, maxAttackDistance: 180, retreatDistance: 0, damage: 25, windup: 1.25, aimLock: .25, recovery: 1.15 }),
  emberAcolyte: Object.freeze({ ...ENEMY_DEFINITIONS.emberAcolyte, attack: 'ground', blastRadius: 76,
    blastStyle: 'fire', maxAttackDistance: 270, retreatDistance: 0, damage: 23, windup: 1.4, aimLock: .25, recovery: 1.2 }),
  duneScuttler: Object.freeze({ ...ENEMY_DEFINITIONS.duneScuttler, attack: 'melee', arc: Math.PI * .45,
    lungeSpeed: 340, engageDistance: 140, range: 30, damage: 16, windup: .85, aimLock: .2, active: .32, recovery: .95 }),
  stormSentinel: Object.freeze({ ...ENEMY_DEFINITIONS.stormSentinel, attack: 'projectile',
    projectile: Object.freeze({ owner: 'enemy', speed: 210, life: 1.7, radius: 5, damage: 11 }),
    projectileStyle: 'lightning', shotOffsets: Object.freeze([-.44,-.22,0,.22,.44]), warning: true,
    maxAttackDistance: 270, retreatDistance: 70, damage: 11, windup: 1.25, aimLock: .2, recovery: 1.3 }),
});
/** Elite basics trade individual hit strength for quicker, narrower pressure. Ground
 * blasts and pounces keep their escape windows; heavy basics remain every third turn. */
export const ELITE_QUICK_ATTACKS: Readonly<Partial<Record<EnemyKind, EnemyDefinition>>> = Object.freeze(
  Object.fromEntries(Object.entries(ENEMY_DEFINITIONS)
    .filter(([kind,d]) => !['warden','briarMatriarch','ashColossus','graveMarshal'].includes(kind)
      && d.attack !== 'ground' && !(d.attack === 'melee' && d.engageDistance))
    .map(([kind,d]) => {
      const windup = d.attack === 'melee' ? Math.min(d.windup,.5) : .6;
      const quick: EnemyDefinition = d.attack === 'melee'
        ? {...d,windup,aimLock:Math.max(0,windup-.22),active:Math.min(d.active,.18),
          recovery:Math.min(d.recovery,.6),damage:d.damage*.75,arc:Math.min(d.arc,Math.PI*.8)}
        : d.attack === 'projectile' ? {...d,windup,aimLock:.3,recovery:Math.min(d.recovery,.65),damage:d.damage*.75,
          projectile:Object.freeze({...d.projectile,damage:d.damage*.75}),shotOffsets:Object.freeze([0])} : d;
      return [kind,Object.freeze(quick)];
    })));

export function enemyAttackVariant(enemy: Pick<Enemy,'kind'|'rank'|'attackTurns'>): 0 | 1 | 2 {
  if ((enemy.attackTurns ?? 0) % 3 === 2) return ENEMY_SIGNATURE_ATTACKS[enemy.kind] ? 1 : 0;
  return enemy.rank === 'elite' && ELITE_QUICK_ATTACKS[enemy.kind] ? 2 : 0;
}

export function enemyAttackDefinition(enemy: Pick<Enemy, 'kind' | 'attackVariant'>): EnemyDefinition {
  return (enemy.attackVariant === 2 ? ELITE_QUICK_ATTACKS[enemy.kind]
    : enemy.attackVariant === 1 ? ENEMY_SIGNATURE_ATTACKS[enemy.kind] : undefined) ?? ENEMY_DEFINITIONS[enemy.kind];
}

/** Sensing/steering budgets and pacing never scale with monster level. */
export const ENEMY_AI_RULES = Object.freeze({
  senseInterval: .12, awarenessSeconds: .16, hearingDistance: 72, loseSightAfter: 4.5,
  tetherDistance: 650, returnStopDistance: 12, patrolRadius: 36, patrolSpeed: .28,
  arrivalResponse: 3, locomotionTurnSpeed: 5,
  separationPadding: 9, flankAngle: .45, pursuitSpeedMultiplier: 1.15,
});

export const LOOT_RULES = Object.freeze({
  maxGroundItems: 1024, equipmentCollectDistance: 30,
  maxPickups: 32, life: 20, radius: 4, healthEveryKills: 3, healthFraction: .12, manaFraction: MANA_RULES.vialMaxFraction,
  collectDistance: 18, magnetDistance: 55, magnetSpeed: 100,
});
