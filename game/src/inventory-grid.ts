import { charmProfile } from './charm-content.ts';
import type { CharacterSheet, Item } from './character-types.ts';

export const PACK_COLUMNS = 12;
export const PACK_ROWS = 6;
export const PACK_CELLS = PACK_COLUMNS * PACK_ROWS;
export const CHARM_ROWS = 4;
export const INVENTORY_CELLS = PACK_CELLS + PACK_COLUMNS * CHARM_ROWS;
export interface ItemFootprint { width: number; height: number; }
export type PackLayout = Record<string, number>;

/** Physical size follows the equipment silhouette, never rarity or rolled stats. */
export function itemFootprint(item: Item): ItemFootprint {
  if (item.kind === 'charm') { const size=charmProfile(item)?.size; return size ? {width:size.width,height:size.height} : {width:1,height:1}; }
  switch (item.kind) {
    case 'ring': case 'amulet': return { width: 1, height: 1 };
    case 'weapon':
      if (item.weapon?.hands === 2) return { width: 2, height: 4 };
      if (item.weapon?.family === 'wand' || item.weapon?.family === 'dagger') return { width: 1, height: 2 };
      return { width: 1, height: 3 };
    case 'chest': case 'cloak': case 'legs': case 'shield': return { width: 2, height: 3 };
    default: return { width: 2, height: 2 };
  }
}

export function footprintCells(item: Item, cell: number): number[] | null {
  const { width, height } = itemFootprint(item);
  if (!Number.isInteger(cell) || cell < 0 || cell >= INVENTORY_CELLS
    || cell % PACK_COLUMNS + width > PACK_COLUMNS || Math.floor(cell / PACK_COLUMNS) + height > (cell >= PACK_CELLS ? PACK_ROWS + CHARM_ROWS : PACK_ROWS)
    || (cell >= PACK_CELLS) !== (item.kind === 'charm')) return null;
  return Array.from({ length: width * height }, (_, i) => cell + i % width + Math.floor(i / width) * PACK_COLUMNS);
}
export function packOccupancy(inventory: CharacterSheet['inventory'], layout: PackLayout): Set<number> {
  return new Set(inventory.flatMap(item => item && layout[item.id] !== undefined ? footprintCells(item, layout[item.id]) ?? [] : []));
}
export function findPackSpace(item: Item, occupied: ReadonlySet<number>, preferred?: number): number | null {
  const charms = item.kind === 'charm';
  const fits = (cell: number) => footprintCells(item, cell)?.every(n => !occupied.has(n)) ?? false;
  if (preferred !== undefined && fits(preferred)) return preferred;
  for (let cell = charms ? PACK_CELLS : 0; cell < (charms ? INVENTORY_CELLS : PACK_CELLS); cell++) if (fits(cell)) return cell;
  return null;
}

/** Keep placed items fixed; older unpositioned items pack deterministically. Unfitted items remain owned in overflow. */
export function resolvePackLayout(sheet: Pick<CharacterSheet, 'inventory' | 'inventoryLayout'>): PackLayout {
  const result: PackLayout = {}, occupied = new Set<number>();
  for (const item of sheet.inventory) if (item && sheet.inventoryLayout?.[item.id] !== undefined) {
    const cell = sheet.inventoryLayout[item.id], cells = footprintCells(item, cell);
    if (cells && cells.every(n => !occupied.has(n))) { result[item.id] = cell; cells.forEach(n => occupied.add(n)); }
  }
  for (const item of sheet.inventory) if (item && result[item.id] === undefined) {
    const cell = findPackSpace(item, occupied);
    if (cell !== null) { result[item.id] = cell; footprintCells(item, cell)!.forEach(n => occupied.add(n)); }
  }
  return result;
}
export function normalizePackLayout(sheet: CharacterSheet): void { sheet.inventoryLayout = resolvePackLayout(sheet); }
export function validPackLayout(inventory: CharacterSheet['inventory'], value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const items = new Map(inventory.filter((item): item is Item => !!item).map(item => [item.id, item]));
  const occupied = new Set<number>();
  for (const [id, cell] of Object.entries(value)) {
    const item = items.get(id), cells = item && typeof cell === 'number' && footprintCells(item, cell);
    if (!cells || cells.some(n => occupied.has(n))) return false;
    cells.forEach(n => occupied.add(n));
  }
  return true;
}

export function canPackItem(sheet: Pick<CharacterSheet, 'inventory' | 'inventoryLayout'>, item: Item): boolean {
  if (!sheet.inventory.includes(null) && sheet.inventory.length >= INVENTORY_CELLS) return false;
  const layout = resolvePackLayout(sheet);
  return !sheet.inventory.some(owned => owned && (owned.kind === 'charm') === (item.kind === 'charm') && layout[owned.id] === undefined)
    && findPackSpace(item, packOccupancy(sheet.inventory, layout)) !== null;
}

/** Level-eligible stones in the dedicated charm grid grant bonuses; overflow and stash do not. */
export function activeCharms(sheet: Pick<CharacterSheet,'inventory'|'inventoryLayout'>, level = Infinity): Item[] {
  const layout=resolvePackLayout(sheet);
  return sheet.inventory.filter((item):item is Item=>!!item && item.kind==='charm' && item.requiredLevel<=level && layout[item.id]>=PACK_CELLS);
}
