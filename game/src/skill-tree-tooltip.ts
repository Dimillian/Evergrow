import { skillMechanicFacts } from './skill-mechanic-facts.ts';
import { nodeDescription, nodeMechanicDetails } from './skill-node-explanation.ts';
import { TECHNIQUE_SUMMARIES } from './technique-summaries.ts';
import { effectText, statTerm, spellweaveNodeMarkup } from './effect-terms.ts';
import { scaleTreeDefenses } from './skill-tree-balance.ts';
import { previewSkillVariant } from './skill-variant-preview.ts';
import { skillDamageSuffix, skillUtilityLabel } from './skill-execution-content.ts';
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
  level?: number; sheet?: CharacterSheet; costStats?: DerivedCharacterStats;
  routes: ReadonlyMap<string, SkillRouteStep>;
}

/** A clear reading order: identity, affected skill, effects, cost, allocation. */
export function skillTooltipMarkup(node: SkillNode, view: SkillTooltipView): string {
  const skill = node.skill ? SKILL_DEFINITIONS[node.skill] : undefined, owner = skillNodeOwner(node);
  const owned = view.allocated.has(node.id);
  const costs = skill ? resolveSkill(skill.id, view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 }, view.sheet) : undefined;
  const bonuses = Object.entries(scaleTreeDefenses(node.bonuses, view.level ?? 1)) as [StatKey, number][];
  const rows = bonuses.map(([key, value]) => `<div class="skill-tip-stat"><span>${statTerm(key, STAT_LABELS[key]) || escapeUI(STAT_LABELS[key])}${key==='armor'?' (scales with level)':''}</span><b>${escapeUI(formatStatValue(key, value))}</b></div>`).join('');
  const cost = previewSkillRoute(view.routes, node.id).filter(id => !view.allocated.has(id)).length;
  const selected = node.specialization && owner && view.sheet?.skillSpecializations[owner.id] === node.specialization;
  const state = selected ? 'Selected' : owned ? node.specialization ? 'Unlocked' : 'Allocated' : cost ? `${cost} ${cost === 1 ? 'point' : 'points'} to unlock` : 'Not connected';
  return `<header class="skill-tip-heading"><small>${escapeUI(skillNodeRole(node))} <span>· ${node.domain}</span></small><h3>${escapeUI(node.name)}</h3>
    ${owner && !skill ? `<p class="skill-tip-owner">${escapeUI(owner.name)}</p>` : ''}</header>
    <section class="skill-tip-effects">${node.doctrine&&!node.bonuses.spellweavePercent?`<p>${nodeDescription(node)}</p>`:''}${rows || `<p>${nodeDescription(node)}${node.skill && costs?.variant ? `</p><p>${effectText(TECHNIQUE_SUMMARIES[costs.variant.id])}` : ''}</p>`}
    ${nodeMechanicDetails(node, view.sheet)}
    ${spellweaveNodeMarkup(node.bonuses.spellweavePercent ?? 0, node.id === 'keystone:borrowed-flame')}
    ${node.specialization && view.sheet ? specializationPreviewMarkup(node.specialization, view.costStats ?? { manaCostMultiplier: 1, cooldownMultiplier: 1 }, view.sheet) : ''}
    ${node.specialization ? '<small>Unlocks a selectable variant. One active per skill.</small>' : ''}</section>
    ${costs && skill ? `<section class="skill-tip-facts"><div><b>${costs.reservation?`${costs.reservation}%`:costs.mana}</b><small>${costs.reservation?'Reserved mana':'Mana'}</small></div><div><b>${costs.reservation?'On skill bar':costs.cooldown ? `${Number(costs.cooldown.toFixed(2))}s` : 'None'}</b><small>${costs.reservation?'Auto active':'Cooldown'}</small></div>
      ${costs.damageMultiplier ? `<div class="skill-tip-wide"><b>${Math.round(costs.damageMultiplier * 100)}%</b><small>Weapon damage${skillDamageSuffix(skill.id, costs.recipe)}</small></div>` : costs.recipe.kind === 'guard' ? `<div class="skill-tip-wide"><b>${Number(costs.recipe.duration.toFixed(2))}s · ${Math.round(costs.recipe.reduction * 100)}%</b><small>Guard · damage blocked</small></div>` : `<div class="skill-tip-wide"><b>${skillUtilityLabel(skill.id,costs.recipe)}</b></div>`}
      ${costs.damageMultiplier&&skillUtilityLabel(skill.id,costs.recipe)?`<div class="skill-tip-wide"><b>${skillUtilityLabel(skill.id,costs.recipe)}</b></div>`:''}
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
    : !r.damageMultiplier ? skillUtilityLabel(after.variant!.skill,r.recipe) : `${Math.round(r.damageMultiplier * 100)}% damage${skillDamageSuffix(after.variant!.skill, r.recipe)}`;
  const utility = after.damageMultiplier ? skillMechanicFacts(after.variant!.skill, after.recipe) : '';
  return `<div class="ui-well skill-variant-preview"><small>Current → this Technique · Rank ${after.rank}${after.bonusRanks ? ` + ${after.bonusRanks} gear` : ''}</small>
    <p>${effectText(potency(before))} → <b>${effectText(potency(after))}</b></p>${utility ? `<details><summary>Effect values</summary><p>${effectText(utility)}</p></details>` : ''}
    <p class="ui-muted">${before.mana} → <b>${after.mana}</b> mana · ${Number(before.cooldown.toFixed(2))} → <b>${Number(after.cooldown.toFixed(2))}s</b> cooldown${after.upkeep ? ` · ${before.upkeep} → <b>${after.upkeep}</b> mana / s` : ''}</p></div>`;
}
