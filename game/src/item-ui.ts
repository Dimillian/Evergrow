import { weaponActionRate, basicAttackManaCost } from './equipment.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemTier } from './character-types.ts';
import { TIER_COLORS, TIER_NAMES, STAT_LABELS, itemModifiers, formatStatValue, itemDisplayName } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { previewEquipmentChange, type PreviewStat } from './equipment-preview.ts';
import { escapeUI } from './ui-components.ts';

const TIER_RANK: Record<ItemTier, number> = { common: 1, magic: 2, rare: 3, epic: 4, legendary: 5 };
const number = (n: number, decimals = 1) => n.toLocaleString('en-US', { maximumFractionDigits: decimals });
export interface ItemPresentation {
  sheet: CharacterSheet; level: number; equipped?: boolean; sourceIndex?: number; targetSlot?: EquipmentSlot;
  /** Optional functional context, e.g. a vendor's price. Always escaped. */
  context?: string;
}
export const CHANGE_LABELS: Record<PreviewStat, string> = {
  damage: 'Main-hand damage', cadence: 'Main-hand actions / s', offDamage: 'Off-hand damage', offCadence: 'Off-hand attacks / s',
  maxHp: 'Maximum life', maxMana: 'Maximum mana', armor: 'Armor', blockChance: 'Block chance', blockReduction: 'Blocked damage reduction',
  critChance: 'Critical chance', critMultiplier: 'Critical damage', lifeRegeneration: 'Life / s', manaRegeneration: 'Mana / s',
  moveSpeedMultiplier: 'Movement speed', manaCostReduction: 'Mana cost reduction', cooldownReduction: 'Cooldown reduction', lifeOnHit: 'Life on hit',
  attackSpeedMultiplier: 'Attack speed', castSpeedMultiplier: 'Cast speed', spellDamageMultiplier: 'Spell damage',
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
};
export const PREVIEW_PERCENT = new Set<PreviewStat>(['blockChance', 'blockReduction', 'critChance', 'critMultiplier', 'moveSpeedMultiplier',
  'manaCostReduction', 'cooldownReduction', 'attackSpeedMultiplier', 'castSpeedMultiplier', 'spellDamageMultiplier']);

export function itemSlotMarkup(item: Item, size = 44): string {
  return `${itemIconSVG(item, size)}${item.recipe.enhancement ? `<span class="ui-item-enhancement">+${item.recipe.enhancement}</span>` : ''}<span class="ui-item-level">${number(item.itemLevel, 0)}</span><span class="ui-item-tier" aria-hidden="true">${'<i></i>'.repeat(TIER_RANK[item.tier])}</span>`;
}
export function updateItemSlot(cell: HTMLButtonElement, item: Item | null, options: { level: number; emptyMarkup: string; label: string; draggable?: boolean }): void {
  cell.classList.add('ui-item-slot');
  const signature = item ? JSON.stringify(item) : options.emptyMarkup;
  if (cell.dataset.signature !== signature) {
    cell.dataset.signature = signature; cell.innerHTML = item ? itemSlotMarkup(item) : options.emptyMarkup;
    cell.style.setProperty('--item-color', item ? TIER_COLORS[item.tier] : 'var(--ui-silver-dim)');
    cell.dataset.enhancement = String(item?.recipe.enhancement ?? 0);
    cell.dataset.filled = String(Boolean(item)); cell.dataset.tier = item?.tier ?? '';
  }
  cell.draggable = Boolean(item && options.draggable);
  cell.classList.toggle('is-locked', Boolean(item && item.requiredLevel > options.level));
  cell.setAttribute('aria-label', options.label);
}

/** Item data and effective equipment changes are distinct; no inventory DOM location is required. */
export function itemTooltipMarkup(item: Item, view: ItemPresentation): string {
  const rows = Object.entries(itemModifiers(item)).map(([key, value]) =>
    `<div class="ui-item-property"><span>${escapeUI(STAT_LABELS[key as keyof typeof STAT_LABELS])}</span><strong>${formatStatValue(key as keyof typeof STAT_LABELS, value)}</strong></div>`);
  let weapon = '';
  if (item.weapon) {
    const w = item.weapon;
    weapon = `<div class="ui-item-weapon"><div><strong>${number(w.damage)}</strong><span>${escapeUI(w.damageType)} damage</span></div><div><strong>${number(weaponActionRate(w), 2)}</strong><span>${w.family === 'staff' ? 'Casts' : 'Attacks'} / second</span></div></div><p class="ui-item-comparison">${w.hands === 2 ? 'Two-handed' : 'One-handed'} · ${escapeUI(w.family)} · ${number(w.reach)} reach${w.family === 'staff' ? ` · ${basicAttackManaCost(w, { manaCostMultiplier: 1 })} base mana / bolt` : ''}</p>`;
  }
  if (item.shield) weapon = `<div class="ui-item-weapon"><div><strong>${number(item.shield.blockChance)}%</strong><span>Block chance</span></div><div><strong>${number(item.shield.blockReduction)}%</strong><span>Damage blocked</span></div></div>`;
  let comparison = '';
  if (!view.equipped) {
    const preview = previewEquipmentChange(view.sheet, item, view.level, { sourceIndex: view.sourceIndex, slot: view.targetSlot });
    if (!preview.ok) comparison = `<div class="ui-item-comparison is-loss">${escapeUI(preview.message)}</div>`;
    else {
      const changes = preview.changes.map(change => {
        const difference = change.after - change.before, percentage = PREVIEW_PERCENT.has(change.key);
        const delta = difference * (percentage ? 100 : 1);
        return `<div class="ui-item-change"><span>${CHANGE_LABELS[change.key]}</span><strong class="${delta > 0 ? 'is-gain' : 'is-loss'}">${delta > 0 ? '+' : ''}${number(delta, 2)}${percentage ? '%' : ''}</strong></div>`;
      }).join('');
      comparison = `<div class="ui-item-comparison"><span>On equip</span>${changes || '<p>No stat change</p>'}${preview.displaced.length ? `<p>Replaces ${preview.displaced.map(entry => escapeUI(entry.item.name)).join(' + ')}</p>` : ''}</div>`;
    }
  }
  return `<div class="ui-item-heading"><div><span class="ui-item-class"><span class="ui-rarity-badge" data-tier="${item.tier}"><span aria-hidden="true">${['I', 'II', 'III', 'IV', 'V'][TIER_RANK[item.tier] - 1]}</span>${escapeUI(TIER_NAMES[item.tier])}</span><span>${escapeUI(item.baseName)}</span></span><h4>${escapeUI(itemDisplayName(item))}</h4></div></div>
    <div class="ui-item-meta"><span>Item level ${number(item.itemLevel, 0)}</span><span class="${item.requiredLevel > view.level ? 'is-loss' : ''}">Requires level ${number(item.requiredLevel, 0)}</span>${view.equipped ? '<span class="ui-item-equipped">Equipped</span>' : ''}</div>
    ${item.recipe.enhancement ? `<div class="ui-item-upgrade">Enhancement +${item.recipe.enhancement} / 10 · +${item.recipe.enhancement * 5}% item stats</div>` : ''}
    ${weapon}<div class="ui-item-properties">${rows.join('')}</div>
    ${item.affixes.length ? `<div class="ui-item-affixes">${item.affixes.map(a => escapeUI(a.name)).join(' · ')}</div>` : ''}
    ${comparison}${view.context ? `<div class="ui-item-comparison">${escapeUI(view.context)}</div>` : ''}`;
}
