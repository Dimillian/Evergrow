import { skillDamageSuffix } from './skill-execution-content.ts';
import { resolveSkill, learnedSkillRank } from './skill-progression.ts';
import type { SkillNode } from './skill-tree.ts';
import type { CharacterSheet, DerivedCharacterStats, StatKey } from './character-types.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { SKILL_DEFINITIONS, skillRequirementLabel } from './skill-content.ts';
import { SKILL_DOMAIN_COLORS } from './skill-tree-art.ts';
import { previewSkillRoute, type SkillRouteStep } from './skill-tree-routes.ts';
import { escapeUI } from './ui-components.ts';

interface SkillTooltipView {
  allocated: ReadonlySet<string>; reachable: ReadonlySet<string>;
  sheet?: CharacterSheet; costStats?: DerivedCharacterStats;
  routes: ReadonlyMap<string, SkillRouteStep>;
}

/** DOM details share the toolkit material; the atlas remains a culled Canvas. */
export function skillTooltipMarkup(node: SkillNode, view: SkillTooltipView): string {
  const rows: string[] = [];
  const add = (text: string, color: string, size = 14, gap = 5) => {
    const tag = rows.length ? 'p' : 'h3';
    rows.push(`<${tag} style="color:${color};font-size:${size}px;margin:0 0 ${gap}px">${escapeUI(text)}</${tag}>`);
  };
  const color = SKILL_DOMAIN_COLORS[node.domain];
  const skill = node.skill ? SKILL_DEFINITIONS[node.skill] : undefined;
  const owned = view.allocated.has(node.id);
  add(node.name, '#eee0bf', 17, 8);
  add(`${node.domain} · ${skill ? `${skill.tier === 'ultimate' ? 'Ultimate' : 'Active skill'}${view.sheet && owned ? ` · Rank ${learnedSkillRank(view.sheet, skill.id)}` : ''}` : node.kind === 'notable' ? 'Notable' : node.role === 'travel' ? 'Travel node' : node.kind === 'origin' ? 'Origin' : 'Passive'}`, color, 12, 12);
  for (const [key, value] of Object.entries(node.bonuses) as [StatKey, number][]) {
    add(`${formatStatValue(key, value)} ${STAT_LABELS[key]}`, '#d5e8ca', 15, 6);
  }
  if (skill) {
    add(view.sheet ? resolveSkill(skill.id, view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 }, view.sheet).variant?.description ?? skill.description : skill.description, '#b5c2ca', 13, 10);
    add(`Requires ${skillRequirementLabel(skill.requirement)}`, color, 12, 6);
    const stats = view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 };
    const costs = resolveSkill(skill.id, stats, view.sheet);
    if (costs.bonusRanks) add(`Rank ${costs.rank} + ${costs.bonusRanks} gear = ${costs.effectiveRank}`, color, 13, 6);
    if (costs.damageMultiplier) add(`${Math.round(costs.damageMultiplier * 100)}% weapon damage${skillDamageSuffix(skill.id, costs.recipe)}`, '#d5e8ca', 13, 6);
    if (costs.upkeep) add(`${costs.upkeep} mana / second while active`, '#cfc4df', 13, 6);
    add(`${costs.mana} mana · ${costs.cooldown ? `${Number(costs.cooldown.toFixed(2))}s cooldown` : 'No cooldown'}`, '#cfc4df', 13, 10);
  } else if (!Object.keys(node.bonuses).length) add(node.description, '#b5c2ca', 13, 10);
  const cost = previewSkillRoute(view.routes, node.id).filter(id => !view.allocated.has(id)).length;
  add(owned ? '◆ Allocated' : view.reachable.has(node.id) ? '◇ Available · 1 skill point' : cost ? `◇ ${cost} skill points along this path` : '◇ Not connected', '#b8ab8d', 12, 0);
  return rows.join('');
}
