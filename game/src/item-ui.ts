import { AFFIX_DESCRIPTIONS, SPECIAL_AFFIX_LABELS, SKILL_STATS, isSkillStat, type SkillStat } from './equipment-affix-content.ts';
import { ELEMENTAL_AFFIXES, ELEMENT_COLORS } from './elemental-weapon.ts';
import { weaponActionRate, basicAttackManaCost } from './equipment.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemTier, StatKey } from './character-types.ts';
import { TIER_COLORS, TIER_NAMES, STAT_LABELS, itemModifiers, formatStatValue, itemDisplayName } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { previewEquipmentChange, type EquipmentStatChange, type PreviewStat } from './equipment-preview.ts';
import { escapeUI } from './ui-components.ts';

const TIER_RANK: Record<ItemTier, number> = { common: 1, magic: 2, rare: 3, epic: 4, legendary: 5 };
const number = (n: number, decimals = 1) => n.toLocaleString('en-US', { maximumFractionDigits: decimals });
export interface ItemPresentation {
  sheet: CharacterSheet; level: number; equipped?: boolean; sourceIndex?: number; targetSlot?: EquipmentSlot;
  /** Optional functional context, e.g. a vendor's price. Always escaped. */
  context?: string;
  /** Hover comparisons name displaced gear in adjacent cards instead. */
  adjacentComparison?: boolean;
}
export const CHANGE_LABELS: Record<PreviewStat, string> = {
  ...SPECIAL_AFFIX_LABELS, ...SKILL_STATS,
  damage: 'Main-hand damage', cadence: 'Main-hand actions / s', offDamage: 'Off-hand damage', offCadence: 'Off-hand attacks / s',
  maxHp: 'Maximum life', maxMana: 'Maximum mana', armor: 'Armor', blockChance: 'Block chance', blockReduction: 'Blocked damage reduction',
  critChance: 'Critical chance', critMultiplier: 'Critical damage', lifeRegeneration: 'Life / s', manaRegeneration: 'Mana / s',
  moveSpeedMultiplier: 'Movement speed', manaCostReduction: 'Mana cost reduction', cooldownReduction: 'Cooldown reduction', lifeOnHit: 'Life on hit',
  attackSpeedMultiplier: 'Attack speed', castSpeedMultiplier: 'Cast speed', spellDamageMultiplier: 'Spell damage',
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
};
export const PREVIEW_PERCENT = new Set<PreviewStat>(['blockChance', 'blockReduction', 'critChance', 'critMultiplier', 'moveSpeedMultiplier',
  'manaCostReduction', 'cooldownReduction', 'attackSpeedMultiplier', 'castSpeedMultiplier', 'spellDamageMultiplier']);

/** Only match like-for-like stats; damage bonuses feed separate derived hand damage rows. */
const MODIFIER_PREVIEW: Record<Exclude<StatKey, SkillStat>, PreviewStat | null> = {
  strength: 'strength', dexterity: 'dexterity', intelligence: 'intelligence', vitality: 'vitality',
  maxHp: 'maxHp', maxMana: 'maxMana', armor: 'armor', damagePercent: null,
  attackSpeedPercent: 'attackSpeedMultiplier', castSpeedPercent: 'castSpeedMultiplier',
  critChance: 'critChance', critDamage: 'critMultiplier', moveSpeedPercent: 'moveSpeedMultiplier',
  spellDamagePercent: 'spellDamageMultiplier', manaRegen: 'manaRegeneration', lifeRegen: 'lifeRegeneration',
  manaCostPercent: 'manaCostReduction', cooldownPercent: 'cooldownReduction', lifeOnHit: 'lifeOnHit',
  blockChance: 'blockChance', blockReduction: 'blockReduction', manaOnKill: 'manaOnKill',
  areaPercent: 'areaPercent', potionPercent: 'potionPercent', projectilePierce: 'projectilePierce',
  spellweavePercent: 'spellweavePercent', afterguardPercent: 'afterguardPercent',
  fireDamage: null, frostDamage: null, lightningDamage: null,
};

function equipChangeCell(change: EquipmentStatChange | undefined, emptyLabel = 'No change'): string {
  if (!change) return `<td class="ui-item-stat-empty" aria-label="${emptyLabel}">—</td>`;
  const percentage = PREVIEW_PERCENT.has(change.key);
  const delta = (change.after - change.before) * (percentage ? 100 : 1);
  const wholePercent = ['areaPercent', 'potionPercent', 'spellweavePercent', 'afterguardPercent'].includes(change.key);
  return `<td class="${delta > 0 ? 'is-gain' : 'is-loss'}">${delta > 0 ? '+' : ''}${number(delta, 2)}${percentage || wholePercent ? '%' : ''}</td>`;
}

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
  const preview = view.equipped ? null : previewEquipmentChange(view.sheet, item, view.level,
    { sourceIndex: view.sourceIndex, slot: view.targetSlot });
  const changes = new Map(preview?.ok ? preview.changes.map(change => [change.key, change]) : []);
  const rows = Object.entries(itemModifiers(item)).map(([stat, value]) => {
    const key = stat as StatKey;
    const element = ELEMENTAL_AFFIXES.find(a => a.stat === key)?.element;
    const description = AFFIX_DESCRIPTIONS[key];
    const label = `${escapeUI(STAT_LABELS[key])}${element ? ` · ${{ fire: 'Burn', frost: 'Chill', lightning: 'Interrupt' }[element]}` : ''}`;
    const color = element ? ` style="color:${ELEMENT_COLORS[element]}"` : '';
    const note = description ? `<p class="ui-item-affix-note">${escapeUI(description)}</p>` : '';
    if (!preview?.ok) return `<div class="ui-item-property"${color}><span>${label}</span><strong>${formatStatValue(key, value)}</strong></div>${note}`;
    const previewKey = isSkillStat(key) ? key : MODIFIER_PREVIEW[key];
    const change = previewKey ? changes.get(previewKey) : undefined;
    if (previewKey) changes.delete(previewKey);
    return `<tr><th scope="row"${color}>${label}${note}</th><td${color}>${formatStatValue(key, value)}</td>${equipChangeCell(change, previewKey ? 'No change' : 'Included in derived changes')}</tr>`;
  });
  for (const change of changes.values()) rows.push(`<tr><th scope="row">${escapeUI(CHANGE_LABELS[change.key])}</th><td class="ui-item-stat-empty" aria-label="Not an item bonus">—</td>${equipChangeCell(change)}</tr>`);
  const properties = preview?.ok
    ? `<table class="ui-item-stat-table" aria-label="Item bonuses and net changes on equip"><thead><tr><th scope="col">Stat</th><th scope="col">Item</th><th scope="col">On equip</th></tr></thead><tbody>${rows.join('')}</tbody></table>${!preview.changes.length ? '<p class="ui-item-description">No stat change</p>' : ''}`
    : `<div class="ui-item-properties">${rows.join('')}</div>`;
  const skillNote = item.affixes.some(a => isSkillStat(a.stat)) ? '<p class="ui-item-affix-note">Bonus ranks require the skill unlocked. No extra mana or cooldown.</p>' : '';
  let weapon = '';
  if (item.weapon) {
    const w = item.weapon;
    weapon = `<div class="ui-item-weapon"><div><strong>${number(w.damage)}</strong><span>${escapeUI(w.damageType)} damage</span></div><div><strong>${number(weaponActionRate(w), 2)}</strong><span>${w.attackKind === 'bolt' ? 'Casts' : 'Attacks'} / second</span></div></div><p class="ui-item-description">${w.hands === 2 ? 'Two-handed' : 'One-handed'} · ${escapeUI(w.family)} · ${number(w.reach)} reach${w.attackKind === 'bolt' ? ` · ${basicAttackManaCost(w, { manaCostMultiplier: 1 })} base mana / bolt` : ''}</p>`;
  }
  if (item.focus) weapon = `<p class="ui-item-description">Off-hand · ${item.kind === 'grimoire' ? 'Grimoire · Mana & spell sustain' : 'Orb · Spell potency'}<br>Pairs with a one-handed weapon</p>`;
  if (item.shield) weapon = `<div class="ui-item-weapon"><div><strong>${number(item.shield.blockChance)}%</strong><span>Block chance</span></div><div><strong>${number(item.shield.blockReduction)}%</strong><span>Damage blocked</span></div></div>`;
  let comparison = '';
  if (preview) {
    if (!preview.ok) comparison = `<div class="ui-item-comparison is-loss">${escapeUI(preview.message)}</div>`;
    else if (preview.displaced.length && !view.adjacentComparison)
      comparison = `<div class="ui-item-comparison"><p>Replaces ${preview.displaced.map(entry => escapeUI(entry.item.name)).join(' + ')}</p></div>`;
  }
  return `<div class="ui-item-heading"><div><span class="ui-item-class"><span class="ui-rarity-badge" data-tier="${item.tier}">${escapeUI(TIER_NAMES[item.tier])}</span><span>${escapeUI(item.baseName)}</span></span><h4>${escapeUI(itemDisplayName(item))}</h4></div></div>
    <div class="ui-item-meta"><span>Item level ${number(item.itemLevel, 0)}</span><span class="${item.requiredLevel > view.level ? 'is-loss' : ''}">Requires level ${number(item.requiredLevel, 0)}</span>${view.equipped ? '<span class="ui-item-equipped">Equipped</span>' : ''}</div>
    ${item.recipe.enhancement ? `<div class="ui-item-upgrade">Enhancement +${item.recipe.enhancement} / 10 · +${item.recipe.enhancement * 5}% scalable item stats</div>` : ''}
    ${weapon}${properties}${skillNote}
    ${item.affixes.length ? `<div class="ui-item-affixes">${item.affixes.map(a => escapeUI(a.name)).join(' · ')}</div>` : ''}
    ${comparison}${view.context ? `<div class="ui-item-comparison">${escapeUI(view.context)}</div>` : ''}`;
}

const EQUIPPED_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves',
  legs: 'Legs', boots: 'Boots', cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring 1', ring2: 'Ring 2',
};

/** Use the real equip transaction's displacement, including hand conflicts and ring targets. */
export function itemHoverCards(item: Item, view: ItemPresentation): string[] {
  const preview = view.equipped ? null : previewEquipmentChange(view.sheet, item, view.level,
    { sourceIndex: view.sourceIndex, slot: view.targetSlot });
  const displaced = preview?.ok ? preview.displaced : [];
  const card = (gear: Item, content: string, label = '') =>
    `<section class="ui-item-hover-card" data-tier="${gear.tier}" style="--item-color:${TIER_COLORS[gear.tier]}">${label ? `<div class="ui-item-section-label ui-item-comparison-label">Equipped · ${label}</div>` : ''}${content}</section>`;
  return [card(item, itemTooltipMarkup(item, { ...view, adjacentComparison: displaced.length > 0 })),
    ...displaced.map(({ item: gear, slot }) => card(gear,
      itemTooltipMarkup(gear, { sheet: view.sheet, level: view.level, equipped: true }), EQUIPPED_LABELS[slot]))];
}
