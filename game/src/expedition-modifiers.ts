/** Shared expedition recipes. Composition changes use ordinary enemy combat and loot rules. */
export const EXPEDITION_MODIFIERS = Object.freeze({
  elite: { name: 'Elite guard', description: 'Every fourth chamber guard is Elite.' },
  ranged: { name: 'Firing lines', description: 'Every third chamber guard is an archer.' },
  peril: { name: 'Deep peril', description: 'All enemies and rewards are 2 levels higher.' },
  veterans: { name: 'Battle hardened', description: 'Every second chamber guard is at least a Veteran.' },
  brutes: { name: 'Heavy company', description: 'Every third chamber guard is a brute.' },
  coven: { name: 'Witch coven', description: 'Every third chamber guard is a spellcaster.' },
  hunt: { name: 'Hunting pack', description: 'Every third chamber guard is a charging hound.' },
  retinue: { name: 'Royal retinue', description: 'The boss’s four reinforcements are Elite.' },
});
export type ExpeditionModifier = keyof typeof EXPEDITION_MODIFIERS;
export const EXPEDITION_MODIFIER_IDS = Object.freeze(Object.keys(EXPEDITION_MODIFIERS) as ExpeditionModifier[]);
