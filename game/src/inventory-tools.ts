import { hasStorageTab, storageTabItems, STASH_CAPACITY } from './storage-content.ts';
import { resolvePackLayout, compactPackLayout, storageGridLayout, itemFootprint, type PackLayout } from './inventory-grid.ts';
import type { ActionResult, CharacterSheet, Item, ItemTier } from './character-types.ts';
import { EQUIPMENT_SLOTS, ITEM_KINDS } from './items.ts';
import { itemFitsSlot, planEquipmentChange } from './inventory.ts';

export type InventorySort = 'rarity' | 'type' | 'recent' | 'compact';
type SortPriority = Exclude<InventorySort, 'compact'>;
export type InventoryFilter = 'weapons' | 'armor' | 'jewelry' | 'offhand' | 'charms';
const tiers: ItemTier[] = ['common', 'magic', 'rare', 'epic', 'legendary', 'unique'];
export const INVENTORY_SORT_PRIORITY: Readonly<Record<InventorySort, readonly SortPriority[]>> = {
  compact: ['type', 'rarity', 'recent'],
  rarity: ['rarity', 'type', 'recent'], type: ['type', 'rarity', 'recent'], recent: ['recent', 'rarity', 'type'],
};

export function matchesInventoryFilter(item: Item | null, filters: ReadonlySet<InventoryFilter>, rarities: ReadonlySet<ItemTier>): boolean {
  if (!item || rarities.size && !rarities.has(item.tier)) return false;
  return filters.size === 0 || [...filters].some(filter => filter === 'weapons' ? item.kind === 'weapon'
    : filter === 'jewelry' ? item.kind === 'ring' || item.kind === 'amulet'
    : filter === 'charms' ? item.kind === 'charm'
    : filter === 'offhand' ? itemFitsSlot(item, 'offhand')
    : ['head', 'chest', 'gloves', 'legs', 'boots', 'cloak'].includes(item.kind));
}

function orderedItems(sheet: CharacterSheet, items: Array<Item | null>, mode: InventorySort): Array<Item | null> {
  const recency = new Map((sheet.recentItems ?? []).map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    if (mode === 'compact') {
      const sa = itemFootprint(a), sb = itemFootprint(b);
      const size = sb.height - sa.height || sb.width - sa.width;
      if (size) return size;
    }
    const comparisons: Record<SortPriority, number> = {
      rarity: tiers.indexOf(b.tier) - tiers.indexOf(a.tier),
      type: ITEM_KINDS.indexOf(a.kind) - ITEM_KINDS.indexOf(b.kind),
      recent: (recency.get(a.id) ?? recency.size) - (recency.get(b.id) ?? recency.size),
    };
    for (const priority of INVENTORY_SORT_PRIORITY[mode]) if (comparisons[priority]) return comparisons[priority];
    return 0;
  });
}

/** Explicit organization changes bag order; acquisition history is independent of cells. */
export function sortInventory(sheet: CharacterSheet, mode: InventorySort): ActionResult {
  if (!['rarity', 'type', 'recent', 'compact'].includes(mode)) return { ok: false, message: 'Unknown inventory sort.' };
  const inventory = orderedItems(sheet, sheet.inventory, mode);
  const before = resolvePackLayout(sheet);
  let layout = resolvePackLayout({ inventory });
  if(mode==='compact'||Object.keys(layout).length<Object.keys(before).length){
    const packed=compactPackLayout(inventory);
    if(Object.keys(packed).length>=Object.keys(layout).length)layout=packed;
  }
  for(const charm of [false,true]){
    const overflowBefore=sheet.inventory.filter(item=>item&&(item.kind==='charm')===charm&&before[item.id]===undefined).length;
    const overflowAfter=inventory.filter(item=>item&&(item.kind==='charm')===charm&&layout[item.id]===undefined).length;
    if(overflowAfter>overflowBefore)return {ok:false,message:'This arrangement needs more space. Your pack is unchanged.'};
  }
  sheet.inventory = inventory; sheet.inventoryLayout = layout;
  return { ok: true };
}

/** Sort storage independently, keeping exact item records and its full capacity. */
export function sortStorage(sheet: CharacterSheet, tab = 0): ActionResult {
  if (!hasStorageTab(sheet,tab)) return {ok:false,message:'This storage tab is locked.'};
  if (!sheet.stash) return { ok: true };
  const items = storageTabItems(sheet,tab), ordered = orderedItems(sheet, items, 'compact');
  if (storageGridLayout(ordered).rows > storageGridLayout(items).rows)
    return { ok: false, message: 'This arrangement needs more space. Your storage is unchanged.' };
  sheet.stash = [...sheet.stash];
  sheet.stash.splice(tab * STASH_CAPACITY, STASH_CAPACITY, ...ordered);
  return { ok: true };
}

/** Item power is an estimate, including the shared enhancement multiplier. */
const equipBestScore = (item: Item | null) => item?.power ?? -1;

export type EquipBestChoice = 'check' | 'replace' | 'keep';
export type BestEquipmentPlan = { ok: false; message: string } | {
  ok: true; inventory: CharacterSheet['inventory']; equipped: CharacterSheet['equipped']; count: number;
  inventoryLayout: PackLayout;
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
      draft.inventory = plan.inventory; draft.equipped = plan.equipped; draft.inventoryLayout = plan.inventoryLayout; count++; break;
    }
  }
  if (!count) return { ok: false, message: 'No higher-power equipment available.' };
  const current = sheet.equipped.weapon, next = draft.equipped.weapon;
  const weaponChange = current?.weapon && next?.weapon && current.id !== next.id
    && (current.weapon.family !== next.weapon.family || current.weapon.hands !== next.weapon.hands) ? { current, next } : null;
  return { ok: true, inventory: draft.inventory, equipped: draft.equipped, inventoryLayout: resolvePackLayout(draft), count, weaponChange };
}

/** A type-changing weapon replacement requires the player's explicit choice. */
export function equipBest(sheet: CharacterSheet, level: number, choice: EquipBestChoice = 'check'): ActionResult {
  if (!['check', 'replace', 'keep'].includes(choice)) return { ok: false, message: 'Unknown equipment choice.' };
  const plan = planBestEquipment(sheet, level, choice === 'keep');
  if (!plan.ok) return plan;
  if (plan.weaponChange && choice === 'check') return { ok: false, message: 'The best weapon changes your weapon type. Choose whether to replace or keep your current weapon.' };
  sheet.inventory = plan.inventory; sheet.equipped = plan.equipped; sheet.inventoryLayout = plan.inventoryLayout;
  return { ok: true, message: `Upgraded ${plan.count} equipment ${plan.count === 1 ? 'slot' : 'slots'}.` };
}
