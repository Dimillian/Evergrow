import { previewSkillVariant } from './skill-variant-preview.ts';
import { skillDamageSuffix, skillRepeatHitLabel } from './skill-execution-content.ts';
import { resolveSkill } from './skill-progression.ts';
import type { SkillNode } from './skill-tree.ts';
import type { CharacterSheet, DerivedCharacterStats, StatKey } from './character-types.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { SKILL_DEFINITIONS, skillRequirementLabel } from './skill-content.ts';
import { skillNodeOwner, skillNodeRole } from './skill-node-presentation.ts';
import { previewSkillRoute, type SkillRouteStep } from './skill-tree-routes.ts';
import { escapeUI } from './ui-components.ts';

interface SkillTooltipView {
  allocated: ReadonlySet<string>; reachable: ReadonlySet<string>;
  sheet?: CharacterSheet; costStats?: DerivedCharacterStats;
  routes: ReadonlyMap<string, SkillRouteStep>;
}

/** A clear reading order: identity, affected skill, effects, cost, allocation. */
export function skillTooltipMarkup(node: SkillNode, view: SkillTooltipView): string {
  const skill = node.skill ? SKILL_DEFINITIONS[node.skill] : undefined, owner = skillNodeOwner(node);
  const owned = view.allocated.has(node.id);
  const costs = skill ? resolveSkill(skill.id, view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 }, view.sheet) : undefined;
  const bonuses = Object.entries(node.bonuses) as [StatKey, number][];
  const rows = bonuses.map(([key, value]) => `<div class="skill-tip-stat"><span>${escapeUI(STAT_LABELS[key])}</span><b>${escapeUI(formatStatValue(key, value))}</b></div>`).join('');
  const cost = previewSkillRoute(view.routes, node.id).filter(id => !view.allocated.has(id)).length;
  const selected = node.specialization && owner && view.sheet?.skillSpecializations[owner.id] === node.specialization;
  const state = selected ? 'Selected' : owned ? node.specialization ? 'Unlocked' : 'Allocated' : cost ? `${cost} ${cost === 1 ? 'point' : 'points'} to unlock` : 'Not connected';
  return `<header class="skill-tip-heading"><small>${escapeUI(skillNodeRole(node))} <span>· ${node.domain}</span></small><h3>${escapeUI(node.name)}</h3>
    ${owner && !skill ? `<p class="skill-tip-owner">${escapeUI(owner.name)}</p>` : ''}</header>
    <section class="skill-tip-effects">${rows || `<p>${escapeUI(node.description)}${node.skill && costs?.variant ? `</p><p>${escapeUI(costs.variant.description)}` : ''}</p>`}
    ${node.specialization && view.sheet ? specializationPreviewMarkup(node.specialization, view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 }, view.sheet) : ''}
    ${node.specialization ? '<small>Unlocks a selectable variant. One active per skill.</small>' : node.improvement ? '<small>Applies to all variants of this skill.</small>' : ''}</section>
    ${costs && skill ? `<section class="skill-tip-facts"><div><b>${costs.mana}</b><small>Mana</small></div><div><b>${costs.cooldown ? `${Number(costs.cooldown.toFixed(2))}s` : 'None'}</b><small>Cooldown</small></div>
      ${skillRepeatHitLabel(costs.recipe) ? `<div class="skill-tip-wide"><small>${skillRepeatHitLabel(costs.recipe)}</small></div>` : ''}${costs.damageMultiplier ? `<div class="skill-tip-wide"><b>${Math.round(costs.damageMultiplier * 100)}%</b><small>Weapon damage${skillDamageSuffix(skill.id, costs.recipe)}</small></div>` : costs.recipe.kind === 'guard' ? `<div class="skill-tip-wide"><b>${Number(costs.recipe.duration.toFixed(2))}s · ${Math.round(costs.recipe.reduction * 100)}%</b><small>Guard · damage blocked</small></div>` : ''}
      ${costs.upkeep ? `<div class="skill-tip-wide"><b>${costs.upkeep}</b><small>Mana / second</small></div>` : ''}
      <p class="skill-tip-wide">${escapeUI(skillRequirementLabel(skill.requirement))}${owned ? ` · Rank ${costs.rank}${costs.bonusRanks ? ` + ${costs.bonusRanks} gear` : ''}` : ''}</p>
      ${costs.variant ? `<p class="skill-tip-wide">${escapeUI(costs.variant.name)}</p>` : ''}</section>` : ''}
    <footer class="skill-tip-state ${owned ? 'is-owned' : ''}">${state}</footer>`;
}

/** Shared alternate-selection preview for the hover card and details pane. */
export function specializationPreviewMarkup(id: string, stats: Parameters<typeof previewSkillVariant>[1], sheet: CharacterSheet): string {
  const preview = previewSkillVariant(id, stats, sheet);
  if (!preview) return '';
  const { before, after } = preview;
  const potency = (r: typeof before) => r.recipe.kind === 'guard'
    ? `${Number(r.recipe.duration.toFixed(2))}s · ${Math.round(r.recipe.reduction * 100)}% block`
    : `${Math.round(r.damageMultiplier * 100)}% damage${skillDamageSuffix(after.variant!.skill, r.recipe)}${skillRepeatHitLabel(r.recipe) ? ` · ${skillRepeatHitLabel(r.recipe)}` : ''}`;
  return `<div class="ui-well skill-variant-preview"><small>Current → with this specialization and required passives</small>
    <div class="ui-stat"><span>Mana</span><b>${before.mana} → ${after.mana}</b></div>
    <div class="ui-stat"><span>Cooldown</span><b>${Number(before.cooldown.toFixed(2))}s → ${Number(after.cooldown.toFixed(2))}s</b></div>
    <div class="ui-stat"><span>${potency(before)}</span><b>→ ${potency(after)}</b></div>
    ${after.upkeep ? `<div class="ui-stat"><span>Mana / second</span><b>${before.upkeep} → ${after.upkeep}</b></div>` : ''}</div>`;
}
