import { effectTerm, effectText } from './effect-terms.ts';
import type { UniqueDefinition } from './unique-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { skillIconSVG } from './skill-icon.ts';
import { escapeUI } from './ui-components.ts';

/** Shared skill-first signature presentation for equipment and the collection. */
export function uniquePowerMarkup(unique: UniqueDefinition): string {
  const skill = SKILL_DEFINITIONS[unique.skill];
  return `<section class="ui-unique-power"><div class="ui-unique-power-skill"><span aria-hidden="true">${skillIconSVG(unique.skill, 28)}</span><strong>${escapeUI(skill.name)}</strong></div><p>${effectText(unique.power)} ${effectTerm(`unique:${unique.id}`, 'Details')}</p></section>`;
}
