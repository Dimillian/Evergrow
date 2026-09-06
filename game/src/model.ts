import type { CharacterSheet, DerivedCharacterStats, SkillId, Item } from './character-types.ts';
import type { BiomeId } from './biomes.ts';
import type { EnemyCamp } from './wilderness-sites.ts';
import type { EnemyRank } from './progression-content.ts';

export interface WorldQuery {
  readonly seed?: number;
  blocked(x: number, y: number, radius: number): boolean;
  /** Settlements suppress hostile spawns and protect the player's occupied position. */
  isSanctuary?(x: number, y: number): boolean;
  getEnemyCamps?(x: number, y: number, width: number, height: number): readonly EnemyCamp[];
  sampleBiome?(x: number, y: number): { id: BiomeId };
  move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number };
}

export interface Input {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  /** Optional body-height corrected ranged aim; ground skills retain aimX/aimY. */
  rangedAim?: { x: number; y: number };
  attack: boolean;
  dodge: boolean;
  heal: boolean;
  skillSlot: number | null;
}

export interface Attack {
  kind: 'melee' | 'ranged';
  weapon: WeaponDefinition;
  hand: 'main' | 'off';
  elapsed: number;
  duration: number;
  activeStart: number;
  activeEnd: number;
  angle: number;
  range: number;
  arc: number;
  damage: number;
  hitIds: Set<number>;
  projectile?: ProjectileEffects;
  released?: boolean;
}

export interface CharacterStats {
  /** 1 is normal speed; 1.25 means 25% more attacks per second. */
  attackSpeedMultiplier: number;
  castSpeedMultiplier: number;
  /** Multiplies the equipped weapon's base damage. */
  attackDamageMultiplier: number;
  spellDamageMultiplier: number;
}

export interface WeaponVisual {
  kind: WeaponFamily;
  element?: DamageType;
  length: number;
  width: number;
  metal: string;
  edge: string;
  grip: string;
  /** Length behind the lead-hand anchor; both hands can mount along this hilt. */
  gripLength?: number;
  guard: string;
  glow?: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  family: WeaponFamily;
  hands: 1 | 2;
  attackKind: 'melee' | 'arrow' | 'bolt';
  damageType: DamageType;
  baseAttacksPerSecond: number;
  damage: number;
  reach: number;
  /** Full horizontal damage arc in radians. */
  arc: number;
  visual: WeaponVisual;
}

export type WeaponFamily = 'sword' | 'axe' | 'mace' | 'dagger' | 'bow' | 'staff' | 'wand' | 'unarmed';
export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'arcane';
export type ProjectileStyle = 'arrow' | 'fire' | 'frost' | 'lightning' | 'arcane' | 'spirit';
export interface ShieldDefinition {
  id: string; name: string; blockChance: number; blockReduction: number;
  visual: { kind: 'buckler' | 'kite' | 'tower'; base: string; edge: string; trim: string; shadow: string };
}
/** Payload snapshots travel with a projectile; equipment changes cannot rewrite it in flight. */
export interface ProjectileEffects {
  style: ProjectileStyle;
  pierce?: number; chain?: number; chainRange?: number; blastRadius?: number;
  slowFactor?: number; slowDuration?: number; lifeSteal?: number;
  burnDuration?: number; burnDps?: number; groundDuration?: number;
}

export interface FocusDefinition {
  id: string; name: string;
  visual: { kind: 'grimoire' | 'orb'; motif: 'ember' | 'rime' | 'astral'; base: string; edge: string; trim: string; shadow: string; glow: string };
}

export interface Equipment {
  mainHand: WeaponDefinition;
  offHand: { kind: 'weapon'; weapon: WeaponDefinition } | { kind: 'shield'; shield: ShieldDefinition } | { kind: 'focus'; focus: FocusDefinition } | null;
}

export interface Player {
  name?: string;
  x: number;
  y: number;
  /** Position at the beginning of the most recently completed simulation tick. */
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  /** Experience earned toward the next level; overflow carries on level-up. */
  xp: number;
  character: CharacterSheet;
  derived: DerivedCharacterStats;
  skillCooldowns: Partial<Record<SkillId, number>>;
  activeSkill: SkillId | null;
  nextAttackHand: 'main' | 'off';
  guardTime: number;
  guardReduction: number;
  dash: { angle: number; remaining: number; speed: number; damage: number; radius: number; skill: SkillId; hitIds: Set<number> } | null;
  stats: CharacterStats;
  equipment: Equipment;
  attack: Attack | null;
  /** Remaining dodge animation time in seconds. */
  dodgeTime: number;
  dodgeAngle: number;
  dodgeCharges: number;
  /** Elapsed recharge time toward the next charge (1.8 seconds). */
  dodgeRecharge: number;
  /** Positive while damage protection is active. */
  invulnerable: number;
  flasks: number;
  healCooldown: number;
  castTime: number;
  /** Snapshotted action duration used by recovery and the casting pose. */
  castDuration: number;
  castAngle: number;
  healFlash: number;
  /** Time remaining for an actual damage reaction, independent of invulnerability. */
  hitFlash: number;
  /** Incoming impact travel direction, used to recoil away from the attacker. */
  hitAngle: number;
  walkTime: number;
  radius: number;
  dead: boolean;
}

export type EnemyKind = 'stalker' | 'brute' | 'caster' | 'hound' | 'archer' | 'wisp' | 'goblin' | 'goblinChief';
export type EnemyState = 'idle' | 'patrol' | 'return' | 'chase' | 'windup' | 'attack' | 'recover' | 'dead';

export interface Enemy {
  /** Ephemeral orders; camp membership and casualties own persistent identity. */
  commanderId?: number;
  commandClock?: number;
  attackDamage?: number;
  warband?: { order: 'rush' | 'surround' | 'rout'; remaining: number; warning: boolean };
  id: number;
  readonly level: number;
  readonly rank: EnemyRank;
  readonly biome: BiomeId;
  readonly lootSeed: number;
  /** Spawn-time offense and reward snapshots; crossing an area edge never rescales a living enemy. */
  readonly damage: number;
  readonly xpReward: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Impact velocity, integrated separately from enemy intent. */
  knockbackX: number;
  knockbackY: number;
  angle: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  state: EnemyState;
  stateTime: number;
  stateDuration: number;
  attackAngle: number;
  /** Ground casts and ranged aim commit to the advertised location after aimLock. */
  attackTargetX: number;
  attackTargetY: number;
  homeX: number;
  homeY: number;
  awareness: number;
  lostSightTime: number;
  lastSeenX: number;
  lastSeenY: number;
  senseTime: number;
  seesPlayer: boolean;
  patrolPhase: number;
  campId?: string;
  campMemberId?: string;
  hitFlash: number;
  hitAngle: number;
  radius: number;
  stagger: number;
  attackHit: boolean;
  interrupted: boolean;
  slowTime: number;
  slowFactor: number;
  burnTime: number;
  burnDps: number;
  burnTick: number;
}

export interface Projectile {
  id: number;
  readonly sourceLevel: number;
  readonly sourceKind?: EnemyKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  owner: 'player' | 'enemy';
  skill?: SkillId;
  effects?: ProjectileEffects;
  hitIds: Set<number>;
}

export interface GroundEffect {
  id: number; kind: 'meteor' | 'arrowRain' | 'storm' | 'frost' | 'embers'; x: number; y: number; radius: number;
  delay: number; duration: number; interval: number; tick: number;
  damage: number; skill: SkillId; style: ProjectileStyle;
  slow?: { duration: number; factor: number }; stun?: number; follow?: boolean; upkeep?: number;
  burn?: { readonly duration: number; readonly dps: number };
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: 'health' | 'mana';
  restoreFraction: number;
  life: number;
  radius: number;
}

/** Shared presentation hints do not replace the required payload of each event. */
interface EventAppearance {
  readonly x: number; readonly y: number;
  readonly color?: string; readonly style?: ProjectileStyle; readonly skill?: SkillId;
}
export type CombatEvent = EventAppearance & (
  | { readonly type: 'swing'; readonly angle: number }
  | { readonly type: 'hit'; readonly angle: number; readonly value: number; readonly targetId: number;
      readonly remainingHp: number; readonly enemyKind: EnemyKind; readonly heavy: boolean }
  | { readonly type: 'kill'; readonly angle: number; readonly facing: number; readonly targetId: number; readonly remainingHp: 0; readonly enemyKind: EnemyKind }
  | { readonly type: 'cast'; readonly angle: number; readonly enemyKind?: EnemyKind }
  | { readonly type: 'hurt'; readonly angle: number; readonly value: number; readonly remainingHp: number;
      readonly enemyKind?: EnemyKind; readonly heavy: boolean }
  | { readonly type: 'dodge'; readonly angle: number }
  | { readonly type: 'heal'; readonly value: number }
  | { readonly type: 'potion'; readonly life: number; readonly mana: number }
  | { readonly type: 'pickup'; readonly value: number; readonly heavy: boolean }
  | { readonly type: 'spawn'; readonly enemyKind: EnemyKind }
  | { readonly type: 'gold'; readonly amount: number; readonly balance: number }
  | { readonly type: 'experience'; readonly amount: number }
  | { readonly type: 'loot'; readonly item: Item }
  | { readonly type: 'level'; readonly level: number; readonly skillPoints: number; readonly statPoints: number }
  | { readonly type: 'notice'; readonly message: string }
  | { readonly type: 'blast'; readonly radius: number; readonly duration?: number; readonly enemyKind?: EnemyKind }
  | { readonly type: 'chain'; readonly toX: number; readonly toY: number; readonly duration?: number }
  | { readonly type: 'block'; readonly angle: number; readonly value: number }
  | { readonly type: 'ground'; readonly radius: number; readonly duration: number; readonly style: ProjectileStyle; readonly skill: SkillId }
);
export type CombatEventType = CombatEvent['type'];

export interface SimulationOptions {
  seed?: number;
  spawn?: boolean;
  startX?: number;
  startY?: number;
}
