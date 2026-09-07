import type { SkillNode } from './skill-tree.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_SPECIALIZATIONS } from './skill-progression.ts';

/** Ownership is shared by search, hover, details and branch highlighting. */
export function skillNodeOwner(node: SkillNode) {
  const id = node.skill ?? node.developmentSkill ?? node.mastery
    ?? SKILL_SPECIALIZATIONS.find(s => s.id === node.specialization)?.skill;
  return id ? SKILL_DEFINITIONS[id] : undefined;
}
export function skillNodeRole(node: SkillNode): string {
  if (node.specialization) return 'Specialization';
  if (node.improvement) return 'Skill improvement';
  if (node.mastery) return 'Skill mastery';
  if (node.skill) return SKILL_DEFINITIONS[node.skill].tier === 'ultimate' ? 'Ultimate skill' : 'Active skill';
  if (node.keystone) return 'Keystone';
  if (node.kind === 'origin') return 'Origin';
  if (node.role === 'travel') return 'Travel';
  return node.kind === 'notable' ? 'Notable passive' : 'Passive';
}
