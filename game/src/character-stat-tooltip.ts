import type { StatDetail, StatSource } from './character-stat-details.ts';
import { effectText, statTerm } from './effect-terms.ts';
import { escapeUI, uiIcon, type UIIconName } from './ui-components.ts';
import { emptySlotIcon } from './equipment-slot-art.ts';
import type { EquipmentSlot } from './character-types.ts';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest',
  gloves: 'Gloves', legs: 'Legs', boots: 'Boots', cloak: 'Cloak',
  amulet: 'Amulet', ring1: 'Ring I', ring2: 'Ring II',
};

function sourceLabel(source: StatSource): string {
  const icon = source.slot ? `<span class="stat-source-slot" role="img" aria-label="${SLOT_LABELS[source.slot]}" title="${SLOT_LABELS[source.slot]}">${emptySlotIcon(source.slot, 22)}</span>` : '';
  return `${icon}<span>${escapeUI(source.label)}</span>`;
}

const SOURCE_GROUPS = [
  { category: 'base', title: 'Base & allocated', icon: 'character' },
  { category: 'equipment', title: 'Equipment', icon: 'armor' },
  { category: 'charms', title: 'Charms', icon: 'diamond' },
  { category: 'skills', title: 'Skill tree', icon: 'skilltree' },
  { category: 'effects', title: 'Active effects', icon: 'star' },
] as const satisfies readonly { category: StatSource['category']; title: string; icon: UIIconName }[];

/** Source categories come from the stat owner, never from parsing item names. */
export function characterStatTooltip(detail: StatDetail): string {
  const groups = SOURCE_GROUPS.map(group => {
    const sources = detail.sources.filter(source => source.category === group.category);
    if (!sources.length) return '';
    if (group.category === 'skills' && sources.length === 1) {
      return `<section class="stat-source-group stat-source-group--skills"><h4>${uiIcon(group.icon)}<span>${group.title}</span><span class="stat-source-total">${escapeUI(sources[0].value)}</span></h4></section>`;
    }
    return `<section class="stat-source-group stat-source-group--${group.category}"><h4>${uiIcon(group.icon)}<span>${group.title}</span></h4><dl>${sources.map(source => `<div><dt>${sourceLabel(source)}</dt><dd>${escapeUI(source.value)}</dd></div>`).join('')}</dl></section>`;
  }).join('');
  const term = statTerm(detail.id, 'Details');
  const calculation = detail.calculation ? `<div class="stat-calculation">${detail.calculation.split('\n').map(line => `<span>${escapeUI(line)}</span>`).join('')}</div>` : '';
  return `<header><strong>${escapeUI(detail.label)}</strong><b>${escapeUI(detail.value)}</b></header><p>${effectText(detail.description)}</p>${groups || '<small>No bonuses.</small>'}${calculation}${term ? `<p class="stat-detail-link">${term}</p>` : ''}`;
}
