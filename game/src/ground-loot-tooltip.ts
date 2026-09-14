import type { EquipmentSlot, Item } from './character-types.ts';
import { previewEquipmentChange, type EquipmentStatChange } from './equipment-preview.ts';
import { CHANGE_LABELS, PREVIEW_PERCENT, itemTooltipMarkup, type ItemPresentation } from './item-ui.ts';
import { TIER_COLORS } from './items.ts';
import { escapeUI } from './ui-components.ts';

const slots: Record<EquipmentSlot, string> = {
  weapon: 'main hand', offhand: 'off hand', head: 'head', chest: 'chest', gloves: 'gloves',
  legs: 'legs', boots: 'boots', cloak: 'cloak', amulet: 'amulet', ring1: 'ring 1', ring2: 'ring 2',
};
const resistances = ['fireResistance', 'frostResistance', 'lightningResistance', 'arcaneResistance'];
export interface GroundComparisonRow { key: string; label: string; delta: number; percent: boolean; }

/** Group only equal net changes: capped or unequal resistances remain individually accurate. */
export function groundComparisonRows(changes: readonly EquipmentStatChange[]): GroundComparisonRow[] {
  const rows = changes.map(c => ({ key: c.key as string, label: CHANGE_LABELS[c.key],
    delta: (c.after - c.before) * (PREVIEW_PERCENT.has(c.key) ? 100 : 1),
    percent: PREVIEW_PERCENT.has(c.key) || ['areaPercent', 'potionPercent', 'spellweavePercent', 'afterguardPercent'].includes(c.key) }));
  const resistanceRows = rows.filter(row => resistances.includes(row.key));
  if (resistanceRows.length === 4 && resistanceRows.every(row => Math.abs(row.delta - resistanceRows[0].delta) < .00001)) {
    return [...rows.filter(row => !resistances.includes(row.key)),
      { key: 'allResistance', label: 'All elemental resistances', delta: resistanceRows[0].delta, percent: true }];
  }
  return rows;
}
const priorities = ['damage', 'offDamage', 'maxHp', 'armor', 'allResistance', ...resistances,
  'blockChance', 'cadence', 'offCadence', 'maxMana', 'manaRegeneration'];
export function groundSummaryRows(rows: readonly GroundComparisonRow[]): GroundComparisonRow[] {
  const priority = (row: GroundComparisonRow) => { const i = priorities.indexOf(row.key); return i < 0 ? priorities.length : i; };
  return [...rows].sort((a, b) => priority(a) - priority(b)).slice(0, 4);
}
function rowMarkup(row: GroundComparisonRow): string {
  const value = row.delta.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `<div class="ui-item-property ground-equip-change"><span>${escapeUI(row.label)}</span><strong class="${row.delta > 0 ? 'is-gain' : 'is-loss'}">${row.delta > 0 ? '+' : ''}${value}${row.percent ? '%' : ''}</strong></div>`;
}

/** Ground-only progressive disclosure; ordinary inventory/vendor comparison is unchanged. */
export function groundLootCards(item: Item, view: ItemPresentation, expanded = false): string[] {
  const preview = item.kind === 'riftKey' ? null : previewEquipmentChange(view.sheet, item, view.level, { slot: view.targetSlot });
  const rows = groundComparisonRows(preview?.ok ? preview.changes : []);
  const replaced = preview?.ok ? preview.displaced.map(entry => entry.item.kind === 'shield' ? 'shield' : slots[entry.slot]).join(' + ') : '';
  const summary = preview ? `<div class="ui-item-comparison ground-equip-summary"><div class="ground-comparison-title">${item.kind === 'charm' ? 'On pickup' : 'On equip'}</div>${preview.ok
    ? `${replaced ? `<p>Replaces ${escapeUI(replaced)}</p>` : ''}${groundSummaryRows(rows).map(rowMarkup).join('')}${!rows.length ? '<p>No stat change</p>' : ''}`
    : `<p class="is-loss">${escapeUI(preview.message)}</p>`}</div>` : '';
  const alternate = item.kind === 'ring' || item.kind === 'weapon' && item.weapon?.hands === 1;
  const hint = preview?.ok ? `<div class="ground-comparison-hint"><kbd>Alt</kbd> ${expanded ? 'Release to collapse' : 'Full comparison'}${alternate ? ' · <kbd>Shift</kbd> Other slot' : ''}</div>` : '';
  const candidate = `<section class="ui-item-hover-card ground-loot-candidate" data-tier="${item.tier}" style="--item-color:${TIER_COLORS[item.tier]}">${itemTooltipMarkup(item, { ...view, compare: false, hideEnhancementDetails: true })}${summary}${hint}</section>`;
  if (!expanded || !preview?.ok) return [candidate];
  const equipped = preview.displaced.map(entry => `<section class="ground-equipped-item" style="--item-color:${TIER_COLORS[entry.item.tier]}"><div class="ground-comparison-title">Equipped · ${escapeUI(slots[entry.slot])}</div>${itemTooltipMarkup(entry.item, { sheet: view.sheet, level: view.level, equipped: true, compare: false, hideEnhancementDetails: true })}</section>`).join('');
  return [candidate, `<section class="ui-item-hover-card ground-loot-details"><div class="ground-comparison-title">All changes · ${item.kind === 'charm' ? 'on pickup' : 'on equip'}</div>${rows.map(rowMarkup).join('') || '<p>No stat change</p>'}${equipped}</section>`];
}

/** Alt only controls ground disclosure. Blur clears it; callbacks also repaint a stationary hover. */
export class GroundComparisonInput {
  expanded = false;
  constructor(target: EventTarget, changed: () => void, signal: AbortSignal) {
    const set = (value: boolean) => { if (this.expanded !== value) { this.expanded = value; changed(); } };
    const isAlt = (event: KeyboardEvent) => event.key === 'Alt' || event.code === 'AltLeft' || event.code === 'AltRight';
    target.addEventListener('keydown', event => { if (isAlt(event as KeyboardEvent)) set(true); }, { signal, capture: true });
    target.addEventListener('keyup', event => { if (isAlt(event as KeyboardEvent)) set((event as KeyboardEvent).altKey); }, { signal, capture: true });
    // Rebuilding the card can synthesize pointer boundary events with stale modifier
    // flags. Only keyboard edges may release Alt; otherwise opening can close itself.
    target.addEventListener('blur', () => set(false), { signal });
  }
}
