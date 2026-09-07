import type { Player, ProjectileStyle } from './model.ts';
import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
export interface AffixBuffs { melee: number; spell: number; guard: number }
export function advanceAffixBuffs(p: Player, dt: number): void {
  const b = p.affixBuffs; if (!b) return;
  b.melee = p.dead || !p.derived.spellweavePercent ? 0 : Math.max(0, b.melee - dt);
  b.spell = p.dead || !p.derived.spellweavePercent ? 0 : Math.max(0, b.spell - dt);
  b.guard = p.dead || !p.derived.afterguardPercent || p.equipment.offHand?.kind !== 'shield' ? 0 : Math.max(0, b.guard - dt);
}
export function primeSpellweave(p: Player, melee: boolean, style?: ProjectileStyle): void {
  if (p.dead || !p.derived.spellweavePercent || !melee && (!style || style === 'arrow')) return;
  const b = p.affixBuffs ??= { melee: 0, spell: 0, guard: 0 };
  if (melee) b.spell = AFFIX_COMBAT_RULES.weaveDuration;
  else b.melee = AFFIX_COMBAT_RULES.weaveDuration;
}
/** Consume only after an action has passed validation. Its multiplier travels with the attack. */
export function consumeSpellweave(p: Player, kind: 'melee' | 'spell' | 'other'): number {
  if (kind === 'other' || !p.affixBuffs || p.affixBuffs[kind] <= 0 || p.dead) return 1;
  p.affixBuffs[kind] = 0;
  return 1 + p.derived.spellweavePercent / 100;
}
export function primeAfterguard(p: Player): void {
  if (!p.derived.afterguardPercent || p.dead) return;
  (p.affixBuffs ??= { melee: 0, spell: 0, guard: 0 }).guard = AFFIX_COMBAT_RULES.guardDuration;
}
export function effectiveArmor(p: Player): number {
  return p.derived.armor * (1 + (p.affixBuffs?.guard && p.equipment.offHand?.kind === 'shield' ? p.derived.afterguardPercent / 100 : 0));
}
