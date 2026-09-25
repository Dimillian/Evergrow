import type { CharacterSheet, GroundItem, Item } from './character-types.ts';
import type { Expeditions } from './dungeon-state.ts';
import { cloneData } from './data-clone.ts';

export const LOOT_LOG_LIMIT = 100;
export interface LootLogEntry {
  /** A detached item snapshot; never an inventory record or an equip target. */
  item: Item;
  time: number;
  location: string;
  sold?: true;
}

/** Keep the first pickup snapshot and position for each retained item identity. */
export function recordLoot(log: LootLogEntry[], item: Item, time: number, location: string): void {
  const existing = log.find(entry => entry.item.id === item.id);
  if (existing) { delete existing.sold; return; }
  log.push({ item: cloneData(item), time, location });
  if (log.length > LOOT_LOG_LIMIT) log.splice(0, log.length - LOOT_LOG_LIMIT);
}

/** Collapse earlier duplicate receipts on a saved copy, retaining the latest sale state. */
export function deduplicateLootLog(log: readonly LootLogEntry[]): LootLogEntry[] {
  const entries = new Map<string, LootLogEntry>();
  for (const entry of log) {
    const first = entries.get(entry.item.id);
    if (!first) entries.set(entry.item.id, { ...entry });
    else if (entry.sold) first.sold = true;
    else delete first.sold;
  }
  return [...entries.values()];
}

const ownedIds = (sheet: CharacterSheet) => new Set([
  ...sheet.inventory, ...Object.values(sheet.equipped), ...(sheet.stash ?? []),
].filter((item): item is Item => !!item).map(item => item.id));

/** Stage alongside the commerce checkpoint, including bulk sales beyond the buyback limit. */
export function lootLogAfterTrade(log: readonly LootLogEntry[], before: CharacterSheet, after: CharacterSheet, selling: boolean): LootLogEntry[] {
  const previous = ownedIds(before), current = ownedIds(after);
  return log.map(entry => {
    if (selling && previous.has(entry.item.id) && !current.has(entry.item.id)) return { ...entry, sold: true };
    if (entry.sold && current.has(entry.item.id)) { const { sold: _, ...rest } = entry; return rest; }
    return entry;
  });
}

export function lootLogLocation(entry: LootLogEntry, sheet: CharacterSheet, ground: readonly GroundItem[], expeditions?: Expeditions): string {
  const id = entry.item.id;
  const equipped = Object.entries(sheet.equipped).find(([, item]) => item?.id === id);
  if (equipped) return `Equipped · ${EQUIPMENT_LABELS[equipped[0]] ?? equipped[0]}`;
  if (sheet.inventory.some(item => item?.id === id)) return entry.item.kind === 'charm' ? 'In inventory · Charm grid' : 'In inventory';
  if (sheet.stash?.some(item => item?.id === id)) return 'In personal storage';
  if (ground.some(drop => drop.item.id === id) || expeditions?.surface?.groundItems.some(drop => drop.item.id === id)
    || expeditions?.runs.some(run => run.contents.groundItems.some(drop => drop.item.id === id))) return 'On the ground';
  if (entry.sold || sheet.commerce.buyback.some(record => record.item.id === id)) return 'Sold · Town merchant';
  return 'No longer carried';
}

const EQUIPMENT_LABELS: Record<string, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves',
  legs: 'Legs', boots: 'Boots', cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring 1', ring2: 'Ring 2',
};

/** Character play time keeps offline time and pauses from aging the history. */
export function lootLogAge(time: number, now: number): string {
  const seconds = Math.max(0, Math.floor(now - time));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} days ago`;
}
