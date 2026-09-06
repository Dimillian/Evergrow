import type { FocusDefinition } from './model.ts';
import type { StatModifiers } from './character-types.ts';

export interface FocusProfile extends FocusDefinition { readonly implicit: Readonly<StatModifiers>; }
const focus = (id: string, name: string, kind: 'grimoire' | 'orb', motif: 'ember' | 'rime' | 'astral', glow: string, implicit: StatModifiers): Readonly<FocusProfile> => Object.freeze({
  id, name, implicit: Object.freeze(implicit), visual: Object.freeze({ kind, motif, glow, base: '#566775', edge: '#dad3b1', trim: '#c8a56b', shadow: '#252b3a' }),
});
/** Grimoires sustain spellcasting; orbs trade that reserve for spell potency. */
export const FOCUS_PROFILES: readonly Readonly<FocusProfile>[] = Object.freeze([
  focus('ember-codex', 'Ember Codex', 'grimoire', 'ember', '#f5ad71', { maxMana: 14, manaRegen: .4 }),
  focus('rime-folio', 'Rime Folio', 'grimoire', 'rime', '#a5e0ec', { maxMana: 18, manaCostPercent: 3 }),
  focus('astral-grimoire', 'Astral Grimoire', 'grimoire', 'astral', '#c9b8f2', { maxMana: 12, cooldownPercent: 3 }),
  focus('cinder-orb', 'Cinder Reliquary', 'orb', 'ember', '#ffad73', { spellDamagePercent: 7, critDamage: 5 }),
  focus('rime-orb', 'Rimeglass Orb', 'orb', 'rime', '#a3e7ed', { spellDamagePercent: 5, castSpeedPercent: 3 }),
  focus('astral-orb', 'Astral Sphere', 'orb', 'astral', '#c4b5ff', { spellDamagePercent: 6, critChance: 1.5 }),
]);
