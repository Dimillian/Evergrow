import type { SkillNode } from './skill-tree.ts';
import type { CharacterSheet } from './character-types.ts';
import { effectTerm, effectText } from './effect-terms.ts';
import { TECHNIQUE_SUMMARIES } from './technique-summaries.ts';

export function nodeDescription(node: SkillNode): string {
  return effectText(node.specialization ? TECHNIQUE_SUMMARIES[node.specialization] : node.bonuses.spellweavePercent ? 'Passive · Melee / magic synergy.' : node.description);
}
export function nodeMechanicDetails(node: SkillNode, sheet?: CharacterSheet): string {
  const terms: Record<string, string> = { 'keystone:borrowed-flame':'more', 'keystone:open-hand':'openHand', 'keystone:measured-force':'measuredForce', 'keystone:arcane-overload':'overload' };
  const term = terms[node.id];
  let result = term ? `<p>${effectTerm(term, 'Details')}</p>` : '';
  if (node.bonuses.afterguardPercent) result += `<p>Enables ${effectTerm('afterguard','Afterguard')} · 3s after blocking.</p>`;
  if (node.doctrine) result += `<p>Choose one · ${effectTerm('doctrine', 'Doctrine')}</p>`;
  if (node.specialization) result += `<p>${effectTerm(`technique:${node.specialization}`, 'Technique rules')}</p>`;
  if (node.id === 'keystone:open-hand' && sheet) {
    const main = sheet.equipped.weapon?.weapon;
    const fits = main?.hands === 1 && main.attackKind === 'melee' && !sheet.equipped.offhand;
    result += `<p class="effect-fit">${fits ? 'Current equipment qualifies: +20% weapon damage, +8% movement.' : 'Current equipment does not qualify: −10% weapon damage.'}</p>`;
  }
  return result;
}
