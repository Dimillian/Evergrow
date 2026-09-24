import { titleLocation, titlePlayTime } from './title-character-summary.ts';
import type { CharacterSave } from './character-save.ts';
import type { EquipmentSlot, DerivedCharacterStats } from './character-types.ts';
import { goldBalance } from './wallet.ts';
import { equippedGearPower } from './leaderboard.ts';
import { escapeUI, uiIcon } from './ui-components.ts';
import { emptySlotIcon } from './equipment-slot-art.ts';
import { itemSlotMarkup } from './item-ui.ts';
import { TIER_COLORS } from './items.ts';

export const TITLE_GEAR: ReadonlyArray<readonly [EquipmentSlot, string]> = [
  ['weapon', 'Main hand'], ['offhand', 'Off hand'], ['head', 'Head'], ['chest', 'Chest'],
  ['gloves', 'Gloves'], ['legs', 'Legs'], ['boots', 'Boots'], ['cloak', 'Cloak'],
  ['amulet', 'Amulet'], ['ring1', 'Ring I'], ['ring2', 'Ring II'],
];
const number = (n: number) => Math.round(n).toLocaleString('en-US');
/** Reserve the same responsive sections without inventing character stats or actions. */
export function titleCharacterLoading(tab: 'gear' | 'attributes'): string {
  const line = '<i class="title-skeleton-line"></i>';
  return `<div class="title-selection-heading" aria-hidden="true"><h3>${line}</h3><div class="title-character-actions"><span class="ui-button ui-button--icon title-skeleton-slot"></span></div></div>
    <div class="title-location" aria-hidden="true">${uiIcon('map')}<div><strong>${line}</strong><span>${line}</span></div></div>
    <div class="title-summary-band" aria-hidden="true"><div class="title-build-stats"><div><span>Level</span><strong>${line}</strong></div><div><span>Gear power</span><strong>${line}</strong></div></div><div class="title-gold">${uiIcon('gold')}<div><span>Gold</span><strong>${line}</strong></div></div></div>
    <div class="title-detail-tabs" aria-hidden="true"><button disabled>Gear</button><button disabled>Attributes</button></div>
    <div class="title-detail-body" data-detail="${tab}" aria-hidden="true"><section class="title-gear"><h4>Equipped gear</h4><div class="title-gear-grid">${TITLE_GEAR.map(([, label]) => `<div class="title-gear-cell"><div class="ui-slot title-skeleton-slot"></div><span>${label}</span></div>`).join('')}</div></section>
      <section class="title-attributes"><h4>Attributes <small>Effective totals</small></h4><dl>${['Strength', 'Dexterity', 'Intelligence', 'Vitality'].map(label => `<div><dt>${label}</dt><dd>${line}</dd></div>`).join('')}</dl></section></div>
    <div class="title-save-meta" aria-hidden="true"><div><span>Time played</span><strong>${line}</strong></div><div><span>Last played</span><strong>${line}</strong></div></div>
    <div class="ui-button title-enter title-skeleton-slot" aria-hidden="true">${line}</div>`;
}
export function titleCharacterDetails(record: CharacterSave, derived: DerivedCharacterStats, tab: 'gear' | 'attributes', canEditAppearance = false): string {
  const sheet = record.checkpoint.character, location = titleLocation(record);
  const twoHanded = sheet.equipped.weapon?.weapon?.hands === 2;
  const attributes = Object.entries(derived.attributes), maximum = Math.max(1, ...attributes.map(([, n]) => n));
  return `<div class="title-selection-heading"><h3>${escapeUI(record.name)}</h3><div class="title-character-actions">${canEditAppearance ? `<button class="ui-button ui-button--quiet ui-button--icon" data-action="appearance" aria-label="Edit appearance" data-tooltip="Edit appearance" data-tooltip-align="end" data-tooltip-placement="below">${uiIcon('palette')}</button>` : ''}<button class="ui-button ui-button--quiet ui-button--icon" data-action="delete" aria-label="Delete character" data-tooltip="Delete character" data-tooltip-align="end" data-tooltip-placement="below">${uiIcon('trash')}</button></div></div>
    <div class="title-location" aria-label="Current location">${uiIcon('map')}<div><strong>${escapeUI(location.name)}</strong><span>${escapeUI(location.detail)}</span></div></div>
    <div class="title-summary-band"><div class="title-build-stats"><div><span>Level</span><strong>${number(record.checkpoint.level)}</strong></div><div data-tooltip="Average equipped item power. Two-handed weapons count for both hands."><span>Gear power</span><strong>${number(equippedGearPower(sheet))}</strong></div></div><div class="title-gold">${uiIcon('gold')}<div><span>Gold</span><strong>${number(goldBalance(sheet))}</strong></div></div></div>
    <div class="title-detail-tabs" role="tablist" aria-label="Character details"><button role="tab" id="title-tab-gear" aria-controls="title-gear" data-detail-tab="gear" aria-selected="${tab === 'gear'}" tabindex="${tab === 'gear' ? 0 : -1}">Gear</button><button role="tab" id="title-tab-attributes" aria-controls="title-attributes" data-detail-tab="attributes" aria-selected="${tab === 'attributes'}" tabindex="${tab === 'attributes' ? 0 : -1}">Attributes</button><span class="title-detail-pad">X · Switch</span></div>
    <div class="title-detail-body" data-detail="${tab}"><section class="title-gear" id="title-gear" aria-label="Equipped gear"><h4>Equipped gear</h4><div class="title-gear-grid">${TITLE_GEAR.map(([key, label]) => {
      const item = sheet.equipped[key], reserved = key === 'offhand' && twoHanded;
      return `<div class="title-gear-cell"><button class="ui-slot ui-item-slot" ${item ? `data-title-item="${key}"` : 'disabled'} data-filled="${!!item}" data-tier="${item?.tier ?? ''}" style="--item-color:${item ? TIER_COLORS[item.tier] : '#779099'}" aria-label="${escapeUI(`${label}: ${item?.name ?? (reserved ? 'Reserved by two-handed weapon' : 'Empty')}`)}">${item ? itemSlotMarkup(item, 56) : reserved ? '<span class="title-reserved">2H</span>' : emptySlotIcon(key)}</button><span>${label}</span></div>`;
    }).join('')}</div></section><section class="title-attributes" id="title-attributes" aria-label="Attributes"><h4>Attributes <small>Effective totals</small></h4><dl>${attributes.map(([key, value]) => `<div data-attribute="${key}"><dt>${key[0].toUpperCase() + key.slice(1)}</dt><dd><span class="title-attribute-track" aria-hidden="true"><i style="width:${value / maximum * 100}%"></i></span><strong>${number(value)}</strong></dd></div>`).join('')}</dl></section></div>
    <div class="title-save-meta"><div><span>Time played</span><strong>${titlePlayTime(record.checkpoint.time)}</strong></div><div><span>Last played</span><time datetime="${new Date(record.updatedAt).toISOString()}">${escapeUI(new Date(record.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time></div></div>
    <button class="ui-button ui-button--primary title-enter" data-action="continue"><span><kbd class="title-continue-pad">A</kbd>Continue</span>${uiIcon('chevron')}</button>`;
}
