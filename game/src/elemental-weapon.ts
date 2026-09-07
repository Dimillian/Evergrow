import type { ItemAffix, StatKey } from './character-types.ts';
import type { DamageType, WeaponDefinition } from './model.ts';

export type MeleeElement = 'fire' | 'frost' | 'lightning';
export const ELEMENT_COLORS: Readonly<Partial<Record<DamageType, string>>> = Object.freeze({
  fire: '#f7995c', frost: '#91d4ee', lightning: '#bcb0ff', arcane: '#a5b9ff',
});
export const ELEMENTAL_AFFIXES: readonly { name: string; stat: StatKey; element: MeleeElement; base: number; growth: number }[] = Object.freeze([
  Object.freeze({ name: 'Kindling', stat: 'fireDamage', element: 'fire', base: 4, growth: .52 }),
  Object.freeze({ name: 'Rime', stat: 'frostDamage', element: 'frost', base: 4, growth: .52 }),
  Object.freeze({ name: 'Stormbound', stat: 'lightningDamage', element: 'lightning', base: 4, growth: .52 }),
]);
export const isElementalAffix = (stat: string) => ELEMENTAL_AFFIXES.some(a => a.stat === stat);
/** One weapon-local enchantment. Intelligence/spell bonuses scale its damage; it never adds damage to the other hand or spells. */
export function meleeEnchantment(affixes: readonly ItemAffix[]): WeaponDefinition['enchantment'] {
  const affix = affixes.find(a => isElementalAffix(a.stat));
  const definition = affix && ELEMENTAL_AFFIXES.find(a => a.stat === affix.stat);
  return definition && affix ? { element: definition.element, damage: affix.value } : undefined;
}
export function weaponImpactStyle(weapon: WeaponDefinition) {
  return weapon.enchantment?.element ?? (weapon.damageType === 'physical' ? undefined : weapon.damageType);
}
