import type { FocusDefinition, WeaponVisual } from './model.ts';
import { FOCUS_PROFILES } from './focus-content.ts';

const astralGlow = FOCUS_PROFILES.find(profile => profile.id === 'astral-grimoire')!.visual.glow;

/** Inscribed light is an Arcane presentation, never an additional damage channel. */
export const RADIANT_COLORS = Object.freeze({ core: '#fff6d9', light: '#e8d69d', gold: '#b6a16c', shadow: '#6c735e' });
export const isRadiantWand = (v: WeaponVisual) => v.kind === 'wand' && v.element === 'arcane';
// Only replace the ordinary profile glow; Unique foci own their authored palette.
export const isRadiantGrimoire = (v: FocusDefinition['visual']) => v.kind === 'grimoire' && v.motif === 'astral' && v.glow === astralGlow;
// Resolve presentation on read so existing Star Wands share the new art without rewriting items.
export const weaponGlowColor = (v: WeaponVisual) => isRadiantWand(v) ? RADIANT_COLORS.light : v.glow;
export const focusGlowColor = (v: FocusDefinition['visual']) => isRadiantGrimoire(v) ? RADIANT_COLORS.light : v.glow;
