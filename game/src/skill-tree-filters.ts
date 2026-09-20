import { SKILL_DEFINITIONS, canUseSkill } from './skill-content.ts';
import { WEAPON_PROFILES } from './weapon-content.ts';
import type { Equipment } from './model.ts';
import type { SkillNode } from './skill-tree.ts';

export const ATLAS_WEAPON_FILTERS = [
  ['all', 'All weapons'], ['equipped', 'Equipped gear'], ['sword', 'Sword'], ['axe', 'Axe'],
  ['mace', 'Mace'], ['dagger', 'Dagger'], ['bow', 'Bow'], ['staff', 'Staff'], ['wand', 'Wand'], ['shield', 'Shield'],
] as const;
export type AtlasWeaponFilter = typeof ATLAS_WEAPON_FILTERS[number][0];

/** Match actual skill unlocks; passive paths remain on the map for route planning. */
export function matchesAtlasSkillFilter(node: SkillNode, skillsOnly: boolean, weapon: AtlasWeaponFilter, equipment: Equipment): boolean {
  if (!skillsOnly && weapon === 'all') return true;
  if (!node.skill) return false;
  if (weapon === 'all') return true;
  if (weapon === 'equipped') return canUseSkill(node.skill, equipment);
  if (weapon === 'shield') return ['any', 'shield'].includes(SKILL_DEFINITIONS[node.skill].requirement);
  return WEAPON_PROFILES.some(profile => profile.family === weapon && canUseSkill(node.skill!, { mainHand: profile, offHand: null }));
}
