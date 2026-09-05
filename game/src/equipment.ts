import type { CharacterStats, Equipment, WeaponDefinition } from './model.ts';
export type { CharacterStats, Equipment, WeaponDefinition, WeaponVisual } from './model.ts';

export interface DerivedAttackStats {
  attacksPerSecond: number;
  damage: number;
  range: number;
  arc: number;
}

export const STARTING_SWORD: Readonly<WeaponDefinition> = Object.freeze({
  id: 'weathered-sword',
  name: 'Weathered Sword',
  family: 'sword', hands: 2, attackKind: 'melee', damageType: 'physical',
  baseAttacksPerSecond: 2,
  damage: 24,
  reach: 60,
  arc: 135 * Math.PI / 180,
  visual: Object.freeze({ kind: 'sword', length: 30, width: 3.4, metal: '#86b3a3', edge: '#f7e8b8', grip: '#715332', gripLength: 12, guard: '#dba25b' }),
});

export function createBaseStats(): CharacterStats {
  return { castSpeedMultiplier: 1, attackSpeedMultiplier: 1, attackDamageMultiplier: 1, spellDamageMultiplier: 1 };
}

export function createStartingEquipment(): Equipment {
  return { mainHand: { ...STARTING_SWORD, visual: { ...STARTING_SWORD.visual } }, offHand: null };
}

export type WeaponGrip = 'two-handed' | 'one-handed';
export function getWeaponGrip(equipment: Equipment): WeaponGrip {
  return equipment.mainHand.hands === 2 ? 'two-handed' : 'one-handed';
}

export function getGripLength(visual = STARTING_SWORD.visual): number {
  const length = visual.gripLength ?? 12;
  return Math.max(8, Math.min(20, Number.isFinite(length) ? length : 12));
}

/** Support hand sits behind the lead hand and ahead of the pommel. */
export function getSupportGripOffset(visual = STARTING_SWORD.visual): number {
  return -Math.max(5, Math.min(8, getGripLength(visual) * .55));
}

const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;

/** One derivation path for weapons now and item-provided stat modifiers later. */
export function deriveAttackStats(stats: CharacterStats, weapon: WeaponDefinition): DerivedAttackStats {
  // Keep even extreme debug gear within a readable, resolvable 120 Hz attack window.
  const attacksPerSecond = Math.min(12, Math.max(.25,
    positive(weapon.baseAttacksPerSecond, STARTING_SWORD.baseAttacksPerSecond) * positive(weapon.family === 'staff' ? stats.castSpeedMultiplier : stats.attackSpeedMultiplier, 1)));
  return {
    attacksPerSecond,
    // Finite item values can still overflow when multiplied; never emit Infinity damage.
    damage: Math.max(1, Math.min(Number.MAX_SAFE_INTEGER,
      Math.round(positive(weapon.damage, STARTING_SWORD.damage) * positive(weapon.attackKind === 'bolt' ? stats.spellDamageMultiplier : stats.attackDamageMultiplier, 1)))),
    range: positive(weapon.reach, STARTING_SWORD.reach),
    arc: Math.min(Math.PI * 2, positive(weapon.arc, STARTING_SWORD.arc)),
  };
}

export const UNARMED_WEAPON: WeaponDefinition = {
  id: 'unarmed', name: 'Unarmed', family: 'unarmed', hands: 1, attackKind: 'melee', damageType: 'physical', damage: 5, baseAttacksPerSecond: 1.8, reach: 24, arc: Math.PI / 2,
  visual: { ...STARTING_SWORD.visual, kind: 'unarmed', length: 0, width: 0 },
};
