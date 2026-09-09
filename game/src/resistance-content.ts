import type { DamageType, ProjectileStyle } from './model.ts';
import type { StatModifiers } from './character-types.ts';
import type { AffixDefinition } from './equipment-affix-content.ts';

export type Element = Exclude<DamageType, 'physical'>;
export type ResistanceStat = `${Element}Resistance` | 'allResistance';
export const ELEMENTS = ['fire', 'frost', 'lightning', 'arcane'] as const satisfies readonly Element[];
export const RESISTANCE_STATS = ['fireResistance', 'frostResistance', 'lightningResistance', 'arcaneResistance', 'allResistance'] as const;
export const RESISTANCE_LABELS: Readonly<Record<ResistanceStat, string>> = Object.freeze({
  fireResistance: 'Fire resistance', frostResistance: 'Frost resistance', lightningResistance: 'Lightning resistance',
  arcaneResistance: 'Arcane resistance', allResistance: 'All elemental resistances',
});
export const RESISTANCE_RULES = Object.freeze({ cap: .75, singleAffixCap: 24, allAffixCap: 8 });
export const RESISTANCE_AFFIXES: readonly AffixDefinition[] = Object.freeze([
  { name: 'Cinderskin', stat: 'fireResistance', base: 10, growth: .12, weight: .15 },
  { name: 'Rimeward', stat: 'frostResistance', base: 10, growth: .12, weight: .15 },
  { name: 'Stormward', stat: 'lightningResistance', base: 10, growth: .12, weight: .15 },
  { name: 'Spellward', stat: 'arcaneResistance', base: 10, growth: .12, weight: .15 },
  { name: 'Sanctuary', stat: 'allResistance', base: 3, growth: .035, weight: .1 },
].map(a => Object.freeze(a)) as AffixDefinition[]);
export const isResistanceStat = (stat: string): stat is ResistanceStat => RESISTANCE_STATS.includes(stat as ResistanceStat);
export const resistanceAffixLimit = (stat: ResistanceStat) => stat === 'allResistance' ? RESISTANCE_RULES.allAffixCap : RESISTANCE_RULES.singleAffixCap;
export function boundResistanceRoll(stat: string, value: number): number {
  return isResistanceStat(stat) ? Math.min(resistanceAffixLimit(stat), value) : value;
}
export function deriveResistances(modifiers: StatModifiers): Record<Element, number> {
  const resistance = (element: Element) => Math.max(0, Math.min(RESISTANCE_RULES.cap,
    ((modifiers[`${element}Resistance`] ?? 0) + (modifiers.allResistance ?? 0)) / 100));
  return { fire: resistance('fire'), frost: resistance('frost'), lightning: resistance('lightning'), arcane: resistance('arcane') };
}
/** Spirit is a visual style of arcane magic, not a fifth damage element. */
const PROJECTILE_DAMAGE: Record<ProjectileStyle, DamageType> = Object.freeze({
  arrow: 'physical', fire: 'fire', frost: 'frost', lightning: 'lightning', arcane: 'arcane', spirit: 'arcane',
});
export const projectileDamageType = (style: ProjectileStyle): DamageType => PROJECTILE_DAMAGE[style];
