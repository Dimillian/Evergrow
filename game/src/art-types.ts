import type { WeaponVisual, WeaponGrip } from './equipment.ts';
import type { EnemyKind, FocusDefinition, ShieldDefinition } from './model.ts';

/** Procedural art only: every cached image below is drawn from geometry. */
export interface Sprite {
  image: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  /** Independently moving crown layers. The primary image remains the rooted trunk. */
  foliage?: readonly HTMLCanvasElement[];
}

export interface ArmorMaterial {
  readonly base: string;
  readonly shadow: string;
  readonly edge: string;
  readonly trim: string;
}

/** Geometry style and material are independent, so equipment needs no textures. */
export interface ArmorPiece {
  readonly style: 'plate' | 'leather';
  readonly seed: number;
  readonly material: ArmorMaterial;
}

export interface CloakPiece {
  readonly base: string;
  readonly shadow: string;
  readonly highlight: string;
  readonly trim: string;
  readonly seed: number;
}

export interface CharacterOutfit {
  readonly head: ArmorPiece | null;
  readonly chest: ArmorPiece | null;
  readonly shoulders: ArmorPiece | null;
  readonly hands: ArmorPiece | null;
  readonly legs: ArmorPiece | null;
  readonly boots: ArmorPiece | null;
  readonly cloak: CloakPiece | null;
}

export interface CharacterPose {
  kind: 'player' | EnemyKind;
  command?: 'rush' | 'surround' | 'rout';
  commandWarning?: boolean;
  /** Canvas radians: zero faces right, PI / 2 faces down. */
  angle: number;
  /** Elapsed animation time in seconds. */
  time: number;
  /** Optional frozen clock for decorative equipment effects. */
  effectTime?: number;
  /** Radians accumulated from distance travelled, independent of idle/cape time. */
  gaitPhase?: number;
  /** Movement direction, independent of where the weapon is aimed. */
  moveAngle?: number;
  moving: number;
  /** Normalized swing progress; negative values are an enemy's windup progress. */
  attack: number;
  attackAngle: number;
  attackKind?: 'melee' | 'ranged';
  attackHand?: 'main' | 'off';
  gesture?: 'thrust' | 'slam' | 'bash';
  /** Normalized active-window boundaries from the simulation's attack recipe. */
  attackStart?: number;
  attackEnd?: number;
  attackArc?: number;
  /** Casting release/regrip strength. Zero means the support hand holds the weapon. */
  cast?: number;
  weapon?: WeaponVisual;
  grip?: WeaponGrip;
  offHand?: { kind: 'weapon'; visual: WeaponVisual } | { kind: 'shield'; visual: ShieldDefinition['visual'] } | { kind: 'focus'; visual: FocusDefinition['visual'] } | null;
  guard?: number;
  castColor?: string;
  slow?: number;
  burning?: number;
  /** Slots can be replaced or set to null independently, without altering the rig. */
  outfit?: Partial<CharacterOutfit>;
  /** Remaining bright-hit timer in seconds (0.16 seconds at impact). */
  hitFlash: number;
  /** Normalized remaining impact animation, from one at contact to zero at rest. */
  impact?: number;
  /** Direction away from the attacker; recoil never moves the ground anchor. */
  impactAngle?: number;
  dodging: boolean;
  /** Normalized dodge progress, from launch through recovery. */
  dodgeProgress?: number;
  dead?: boolean;
}
