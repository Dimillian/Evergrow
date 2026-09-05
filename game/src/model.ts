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
  cast: boolean;
  dodge: boolean;
  heal: boolean;
}

export interface Attack {
  elapsed: number;
  duration: number;
  activeStart: number;
  activeEnd: number;
  angle: number;
  range: number;
  arc: number;
  damage: number;
  hitIds: Set<number>;
}

export interface CharacterStats {
  /** 1 is normal speed; 1.25 means 25% more attacks per second. */
  attackSpeedMultiplier: number;
  /** Multiplies the equipped weapon's base damage. */
  attackDamageMultiplier: number;
}

export interface WeaponVisual {
  kind: 'sword';
  length: number;
  width: number;
  metal: string;
  edge: string;
  grip: string;
  guard: string;
  glow?: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  baseAttacksPerSecond: number;
  damage: number;
  reach: number;
  /** Full horizontal damage arc in radians. */
  arc: number;
  visual: WeaponVisual;
}

export interface Equipment {
  mainHand: WeaponDefinition;
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
  castCooldown: number;
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

export type CombatEventType = 'swing' | 'hit' | 'kill' | 'cast' | 'hurt' | 'dodge' | 'heal' | 'pickup' | 'spawn';

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
}

export interface SimulationOptions {
  seed?: number;
  spawn?: boolean;
  startX?: number;
  startY?: number;
}
