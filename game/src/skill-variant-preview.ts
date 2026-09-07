import type { CharacterSheet } from './character-types.ts';
import { SKILL_SPECIALIZATIONS, resolveSkill, specializationNode, specializationPassiveNode } from './skill-progression.ts';

/** Preview an alternate leaf including its two required passives, without buying or selecting it. */
export function previewSkillVariant(id: string, stats: Parameters<typeof resolveSkill>[1], sheet: CharacterSheet) {
  const variant = SKILL_SPECIALIZATIONS.find(v => v.id === id);
  if (!variant) return null;
  const required = [`skill:${variant.skill}`, specializationNode(id), specializationPassiveNode(id, 'potency'), specializationPassiveNode(id, 'efficiency')];
  const projected = { ...sheet, allocatedNodes: [...new Set([...sheet.allocatedNodes, ...required])],
    skillSpecializations: { ...sheet.skillSpecializations, [variant.skill]: id } };
  return { before: resolveSkill(variant.skill, stats, sheet), after: resolveSkill(variant.skill, stats, projected) };
}
