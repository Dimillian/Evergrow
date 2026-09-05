import type { DamageType, ShieldDefinition, WeaponDefinition, WeaponFamily } from './model.ts';

interface WeaponRecipe {
  id: string; name: string; family: Exclude<WeaponFamily, 'unarmed'>; hands: 1 | 2;
  damage: number; speed: number; reach: number; arc: number;
  length: number; width: number; gripLength: number; damageType?: DamageType;
}
const ELEMENT_COLORS: Partial<Record<DamageType, string>> = { fire: '#f7995c', frost: '#91d4ee', lightning: '#bcb0ff' };
function weapon(recipe: WeaponRecipe): Readonly<WeaponDefinition> {
  const damageType = recipe.damageType ?? 'physical';
  return Object.freeze({ id: recipe.id, name: recipe.name, family: recipe.family, hands: recipe.hands,
    attackKind: recipe.family === 'bow' ? 'arrow' : recipe.family === 'staff' ? 'bolt' : 'melee', damageType,
    damage: recipe.damage, baseAttacksPerSecond: recipe.speed, reach: recipe.reach, arc: recipe.arc * Math.PI / 180,
    visual: Object.freeze({ kind: recipe.family, element: damageType, length: recipe.length, width: recipe.width, gripLength: recipe.gripLength,
      metal: '#86b3a3', edge: '#f7e8b8', grip: '#715332', guard: '#dba25b',
      ...(ELEMENT_COLORS[damageType] ? { glow: ELEMENT_COLORS[damageType] } : {}) }) });
}

/** Authored attack and silhouette profiles; item generation adds level, tier, affixes, and materials. */
export const WEAPON_PROFILES: readonly Readonly<WeaponDefinition>[] = Object.freeze([
  weapon({ id: 'longsword', name: 'Longsword', family: 'sword', hands: 1, damage: 19, speed: 2.2, reach: 54, arc: 128, length: 27, width: 3, gripLength: 8 }),
  weapon({ id: 'hand-axe', name: 'Warden Axe', family: 'axe', hands: 1, damage: 24, speed: 1.8, reach: 52, arc: 145, length: 24, width: 9, gripLength: 8 }),
  weapon({ id: 'flanged-mace', name: 'Flanged Mace', family: 'mace', hands: 1, damage: 26, speed: 1.65, reach: 48, arc: 122, length: 23, width: 7, gripLength: 8 }),
  weapon({ id: 'rondel-dagger', name: 'Rondel Dagger', family: 'dagger', hands: 1, damage: 13, speed: 3, reach: 40, arc: 110, length: 18, width: 2.5, gripLength: 8 }),
  weapon({ id: 'greatblade', name: 'Greatblade', family: 'sword', hands: 2, damage: 33, speed: 1.5, reach: 69, arc: 145, length: 37, width: 4.5, gripLength: 15 }),
  weapon({ id: 'greataxe', name: 'Greataxe', family: 'axe', hands: 2, damage: 39, speed: 1.3, reach: 67, arc: 160, length: 35, width: 13, gripLength: 16 }),
  weapon({ id: 'grave-maul', name: 'Grave Maul', family: 'mace', hands: 2, damage: 44, speed: 1.1, reach: 61, arc: 130, length: 33, width: 12, gripLength: 16 }),
  weapon({ id: 'thorn-shortbow', name: 'Thorn Shortbow', family: 'bow', hands: 2, damage: 18, speed: 2.2, reach: 420, arc: 12, length: 30, width: 12, gripLength: 9 }),
  weapon({ id: 'crescent-recurve', name: 'Crescent Recurve', family: 'bow', hands: 2, damage: 24, speed: 1.8, reach: 520, arc: 10, length: 35, width: 15, gripLength: 10 }),
  weapon({ id: 'warden-longbow', name: 'Warden Longbow', family: 'bow', hands: 2, damage: 31, speed: 1.4, reach: 600, arc: 8, length: 40, width: 14, gripLength: 11 }),
  weapon({ id: 'ember-staff', name: 'Ember Staff', family: 'staff', hands: 2, damageType: 'fire', damage: 28, speed: 1.5, reach: 480, arc: 12, length: 40, width: 7, gripLength: 18 }),
  weapon({ id: 'rime-staff', name: 'Rime Staff', family: 'staff', hands: 2, damageType: 'frost', damage: 24, speed: 1.65, reach: 440, arc: 12, length: 39, width: 8, gripLength: 18 }),
  weapon({ id: 'storm-staff', name: 'Storm Staff', family: 'staff', hands: 2, damageType: 'lightning', damage: 17, speed: 2.3, reach: 500, arc: 10, length: 41, width: 7, gripLength: 18 }),
]);

export const SHIELD_PROFILES: readonly Readonly<ShieldDefinition>[] = Object.freeze([
  Object.freeze({ id: 'iron-buckler', name: 'Iron Buckler', blockChance: 20, blockReduction: 55,
    visual: Object.freeze({ kind: 'buckler' as const, base: '#7a8f92', edge: '#d3d6bb', trim: '#c5a96e', shadow: '#34464c' }) }),
  Object.freeze({ id: 'vigil-kite', name: 'Vigil Kite Shield', blockChance: 28, blockReduction: 65,
    visual: Object.freeze({ kind: 'kite' as const, base: '#667a91', edge: '#cad6dc', trim: '#d0b47b', shadow: '#2d3e50' }) }),
  Object.freeze({ id: 'bastion-tower', name: 'Bastion Tower Shield', blockChance: 36, blockReduction: 75,
    visual: Object.freeze({ kind: 'tower' as const, base: '#837b70', edge: '#ded4b5', trim: '#ba9762', shadow: '#403d3e' }) }),
]);
