import type { CharacterSheet, DerivedCharacterStats, SkillId } from './character-types.ts';

export interface WorldQuery {
  blocked(x: number, y: number, radius: number): boolean;
  /** Settlements suppress hostile spawns and protect the player's occupied position. */
  isSanctuary?(x: number, y: number): boolean;
  move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number };
}

export interface Input {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
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

export type WeaponFamily = 'sword' | 'axe' | 'mace' | 'dagger' | 'bow' | 'staff' | 'unarmed';
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
  burnDuration?: number; burnDps?: number;
}

export interface Equipment {
  mainHand: WeaponDefinition;
  offHand: { kind: 'weapon'; weapon: WeaponDefinition } | { kind: 'shield'; shield: ShieldDefinition } | null;
}

export interface Player {
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

export type EnemyKind = 'stalker' | 'brute' | 'caster';
export type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'dead';

export interface Enemy {
  id: number;
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
  id: number; kind: 'meteor' | 'arrowRain'; x: number; y: number; radius: number;
  delay: number; duration: number; interval: number; tick: number;
  damage: number; skill: SkillId;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: 'health' | 'mana';
  value: number;
  life: number;
  radius: number;
}

export type CombatEventType = 'swing' | 'hit' | 'kill' | 'cast' | 'hurt' | 'dodge' | 'heal' | 'pickup' | 'spawn' | 'loot' | 'level' | 'blast' | 'chain' | 'block' | 'ground';

export interface CombatEvent {
  type: CombatEventType;
  x: number;
  y: number;
  angle?: number;
  value?: number;
  /** Enemy identity for attached hit reactions or death effects. */
  targetId?: number;
  /** Target health immediately after a damaging event. */
  remainingHp?: number;
  enemyKind?: EnemyKind;
  heavy?: boolean;
  skill?: SkillId;
  text?: string;
  color?: string;
  style?: ProjectileStyle;
  radius?: number;
  duration?: number;
  toX?: number;
  toY?: number;
}

export interface SimulationOptions {
  seed?: number;
  spawn?: boolean;
  startX?: number;
  startY?: number;
}
