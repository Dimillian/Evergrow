import type { ActionResult, CharacterSheet, Item, ItemTier } from './character-types.ts';
import { EQUIPMENT_SLOTS, ITEM_KINDS } from './items.ts';
import { itemFitsSlot, planEquipmentChange } from './inventory.ts';

export type InventorySort = 'rarity' | 'type' | 'recent';
export type InventoryFilter = 'weapons' | 'armor' | 'jewelry' | 'offhand';
const tiers: ItemTier[] = ['common', 'magic', 'rare', 'epic', 'legendary'];
export const INVENTORY_SORT_PRIORITY: Readonly<Record<InventorySort, readonly InventorySort[]>> = {
  rarity: ['rarity', 'type', 'recent'], type: ['type', 'rarity', 'recent'], recent: ['recent', 'rarity', 'type'],
};

export function matchesInventoryFilter(item: Item | null, filters: ReadonlySet<InventoryFilter>, rarities: ReadonlySet<ItemTier>): boolean {
  if (!item || rarities.size && !rarities.has(item.tier)) return false;
  return filters.size === 0 || [...filters].some(filter => filter === 'weapons' ? item.kind === 'weapon'
    : filter === 'jewelry' ? item.kind === 'ring' || item.kind === 'amulet'
    : filter === 'offhand' ? itemFitsSlot(item, 'offhand')
    : ['head', 'chest', 'gloves', 'legs', 'boots', 'cloak'].includes(item.kind));
}

/** Presentation-only source indices: matching items, real empty cells, then inert grid fillers.
 * Excluded items remain owned; fillers must never be treated as empty bag destinations. */
export function inventoryGridSources(inventory: CharacterSheet['inventory'], filters: ReadonlySet<InventoryFilter>, rarities: ReadonlySet<ItemTier>): Array<number | null> {
  if (!filters.size && !rarities.size) return inventory.map((_, index) => index);
  const matches: number[] = [], empty: number[] = [];
  inventory.forEach((item, index) => {
    if (!item) empty.push(index);
    else if (matchesInventoryFilter(item, filters, rarities)) matches.push(index);
  });
  const sources: Array<number | null> = [...matches, ...empty];
  return [...sources, ...Array<null>(inventory.length - sources.length).fill(null)];
}

/** Explicit organization changes bag order; acquisition history is independent of cells. */
export function sortInventory(sheet: CharacterSheet, mode: InventorySort): ActionResult {
  if (!['rarity', 'type', 'recent'].includes(mode)) return { ok: false, message: 'Unknown inventory sort.' };
  const recency = new Map((sheet.recentItems ?? []).map((id, index) => [id, index]));
  sheet.inventory = [...sheet.inventory].sort((a, b) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    const comparisons: Record<InventorySort, number> = {
      rarity: tiers.indexOf(b.tier) - tiers.indexOf(a.tier),
      type: ITEM_KINDS.indexOf(a.kind) - ITEM_KINDS.indexOf(b.kind),
      recent: (recency.get(a.id) ?? recency.size) - (recency.get(b.id) ?? recency.size),
    };
    for (const priority of INVENTORY_SORT_PRIORITY[mode]) if (comparisons[priority]) return comparisons[priority];
    return 0;
  });
  return { ok: true };
}

/** Item power is an estimate, including the shared enhancement multiplier. */
const equipBestScore = (item: Item | null) => item?.power ?? -1;

export type EquipBestChoice = 'check' | 'replace' | 'keep';
export type BestEquipmentPlan = { ok: false; message: string } | {
  ok: true; inventory: CharacterSheet['inventory']; equipped: CharacterSheet['equipped']; count: number;
  weaponChange: { current: Item; next: Item } | null;
};

/** Pure complete plan used by both the warning dialog and the command. */
export function planBestEquipment(sheet: CharacterSheet, level: number, keepWeapon = false): BestEquipmentPlan {
  const draft = { ...sheet, inventory: [...sheet.inventory], equipped: { ...sheet.equipped } };
  let count = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === 'weapon' && keepWeapon) continue;
    const current = draft.equipped[slot];
    const candidates = draft.inventory.map((item, index) => ({ item, index }))
      .filter((entry): entry is { item: Item; index: number } => !!entry.item && itemFitsSlot(entry.item, slot))
      .filter(({ item }) => {
        if (equipBestScore(item) <= equipBestScore(current)) return false;
        if (slot === 'offhand' && current) return item.kind === current.kind && (!current.weapon || item.weapon?.family === current.weapon.family);
        return true;
      }).sort((a, b) => equipBestScore(b.item) - equipBestScore(a.item) || a.index - b.index);
    for (const { item, index } of candidates) {
      const plan = planEquipmentChange(draft, item, level, { slot, sourceIndex: index });
      if (!plan.ok || slot !== 'weapon' && plan.displaced.some(displaced => displaced.slot !== slot)) continue;
      draft.inventory = plan.inventory; draft.equipped = plan.equipped; count++; break;
    }
  }
  if (!count) return { ok: false, message: 'No higher-power equipment available.' };
  const current = sheet.equipped.weapon, next = draft.equipped.weapon;
  const weaponChange = current?.weapon && next?.weapon && current.id !== next.id
    && (current.weapon.family !== next.weapon.family || current.weapon.hands !== next.weapon.hands) ? { current, next } : null;
  return { ok: true, inventory: draft.inventory, equipped: draft.equipped, count, weaponChange };
}

/** A type-changing weapon replacement requires the player's explicit choice. */
export function equipBest(sheet: CharacterSheet, level: number, choice: EquipBestChoice = 'check'): ActionResult {
  if (!['check', 'replace', 'keep'].includes(choice)) return { ok: false, message: 'Unknown equipment choice.' };
  const plan = planBestEquipment(sheet, level, choice === 'keep');
  if (!plan.ok) return plan;
  if (plan.weaponChange && choice === 'check') return { ok: false, message: 'The best weapon changes your weapon type. Choose whether to replace or keep your current weapon.' };
  sheet.inventory = plan.inventory; sheet.equipped = plan.equipped;
  return { ok: true, message: `Upgraded ${plan.count} equipment ${plan.count === 1 ? 'slot' : 'slots'}.` };
}
