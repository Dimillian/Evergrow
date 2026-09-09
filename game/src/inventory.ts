import { INVENTORY_CELLS, resolvePackLayout, normalizePackLayout, packOccupancy, findPackSpace, footprintCells, type PackLayout } from './inventory-grid.ts';
import type { ActionResult, Attribute, CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { EQUIPMENT_SLOTS } from './items.ts';

const success = (): ActionResult => ({ ok: true });
const fail = (message: string): ActionResult => ({ ok: false, message });
const validIndex = (sheet: CharacterSheet, index: number) => Number.isInteger(index) && index >= 0 && index < sheet.inventory.length;
export function itemFitsSlot(item: Item, slot: EquipmentSlot): boolean {
  if (item.kind === 'ring') return slot === 'ring1' || slot === 'ring2';
  if (item.kind === 'shield' || item.kind === 'grimoire' || item.kind === 'orb') return slot === 'offhand';
  if (item.kind === 'weapon') return slot === 'weapon' || slot === 'offhand' && item.weapon?.hands === 1 && (item.weapon.attackKind === 'melee' || item.weapon.family === 'wand');
  return item.kind === slot;
}

export type EquipmentPlan = { ok: false; message: string } | {
  ok: true; slot: EquipmentSlot; inventory: CharacterSheet['inventory']; equipped: CharacterSheet['equipped'];
  inventoryLayout: PackLayout;
  displaced: Array<{ slot: EquipmentSlot; item: Item }>;
};
export interface EquipmentTarget { sourceIndex?: number; slot?: EquipmentSlot; }

/** Pure swap plan shared by commits, drag eligibility and external-item previews. */
export function planEquipmentChange(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget = {}): EquipmentPlan {
  const reject = (message: string): EquipmentPlan => ({ ok: false, message });
  const source = target.sourceIndex;
  if (source !== undefined && (!validIndex(sheet, source) || sheet.inventory[source]?.id !== item.id))
    return reject('That inventory item has changed.');
  if (source === undefined && [...sheet.inventory, ...Object.values(sheet.equipped)].some(owned => owned?.id === item.id))
    return reject('This item is already owned.');
  if (item.kind === 'charm') return reject('Place charms in the charm grid.');
  const slot: EquipmentSlot = target.slot ?? (item.kind === 'ring'
    ? !sheet.equipped.ring1 ? 'ring1' : !sheet.equipped.ring2 ? 'ring2' : 'ring1'
    : (item.kind === 'shield' || item.kind === 'grimoire' || item.kind === 'orb') ? 'offhand' : item.kind);
  if (!EQUIPMENT_SLOTS.includes(slot) || !itemFitsSlot(item, slot)) return reject('This item does not fit that equipment slot.');
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(item.requiredLevel) || item.requiredLevel < 1 || level < item.requiredLevel)
    return reject(`Requires level ${item.requiredLevel}.`);
  if (item.kind === 'weapon' && !item.weapon) return reject('This weapon has no attack profile.');
  if ((item.kind === 'grimoire' || item.kind === 'orb') && !item.focus) return reject('This focus has no equipment profile.');
  if (item.kind === 'shield' && !item.shield) return reject('This shield has no defense profile.');
  const inventory = [...sheet.inventory, ...Array(Math.max(0, INVENTORY_CELLS - sheet.inventory.length)).fill(null)], equipped = { ...sheet.equipped };
  const inventoryLayout = resolvePackLayout(sheet), preferredCell = inventoryLayout[item.id];
  const displaced: Array<{ slot: EquipmentSlot; item: Item }> = [];
  if (source !== undefined) inventory[source] = null;
  if (equipped[slot]) displaced.push({ slot, item: equipped[slot]! });
  equipped[slot] = item;
  const conflict = slot === 'weapon' && item.weapon?.hands === 2 && equipped.offhand ? 'offhand'
    : slot === 'offhand' && equipped.weapon?.weapon?.hands === 2 ? 'weapon' : null;
  if (conflict) { displaced.push({ slot: conflict, item: equipped[conflict]! }); equipped[conflict] = null; }
  for (let i = 0; i < displaced.length; i++) {
    const index = i === 0 && source !== undefined ? source : inventory.findIndex(existing => existing === null);
    const cell = findPackSpace(displaced[i].item, packOccupancy(inventory, inventoryLayout), i === 0 ? preferredCell : undefined);
    if (index < 0 || cell === null) return reject('Make room in your pack for the displaced equipment.');
    inventory[index] = displaced[i].item;
    inventoryLayout[displaced[i].item.id] = cell;
  }
  return { ok: true, slot, inventory, equipped, displaced, inventoryLayout: resolvePackLayout({ inventory, inventoryLayout }) };
}

/** Commit only a fully validated plan; failures preserve every container. */
export function equipItem(sheet: CharacterSheet, inventoryIndex: number, level: number, targetSlot?: EquipmentSlot): ActionResult {
  if (!validIndex(sheet, inventoryIndex)) return fail('Choose an item in your pack.');
  const item = sheet.inventory[inventoryIndex];
  if (!item) return fail('That inventory cell is empty.');
  const plan = planEquipmentChange(sheet, item, level, { sourceIndex: inventoryIndex, slot: targetSlot });
  if (!plan.ok) return plan;
  sheet.inventory = plan.inventory; sheet.equipped = plan.equipped; sheet.inventoryLayout = plan.inventoryLayout;
  return success();
}

export function unequipItem(sheet: CharacterSheet, slot: EquipmentSlot, targetCell?: number): ActionResult {
  if (!EQUIPMENT_SLOTS.includes(slot) || !sheet.equipped[slot]) return fail('That equipment slot is empty.');
  const item = sheet.equipped[slot]!, layout = resolvePackLayout(sheet);
  const occupied = packOccupancy(sheet.inventory, layout);
  const cell = targetCell === undefined ? findPackSpace(item, occupied) :
    footprintCells(item, targetCell)?.every(n => !occupied.has(n)) ? targetCell : null;
  const empty = sheet.inventory.findIndex(item => item === null);
  const index = empty >= 0 ? empty : sheet.inventory.length < INVENTORY_CELLS ? sheet.inventory.length : -1;
  if (index < 0 || cell === null) return fail('Make room in your pack for this item.');
  while (sheet.inventory.length < INVENTORY_CELLS) sheet.inventory.push(null);
  sheet.inventory[index] = item; sheet.equipped[slot] = null;
  sheet.inventoryLayout = { ...layout, [item.id]: cell }; normalizePackLayout(sheet);
  return success();
}

/** Move to a physical cell, or swap a single overlapping item when both footprints fit. */
export function planInventoryMove(sheet: CharacterSheet, from: number, to: number): PackLayout | null {
  if (!validIndex(sheet, from)) return null;
  const item = sheet.inventory[from]; if (!item) return null;
  const cells = footprintCells(item, to); if (!cells) return null;
  const layout = resolvePackLayout(sheet), sourceCell = layout[item.id];
  const hits = sheet.inventory.filter((other): other is Item => !!other && other.id !== item.id && layout[other.id] !== undefined
    && footprintCells(other, layout[other.id])!.some(n => cells.includes(n)));
  if (hits.length > 1 || hits.length && sourceCell === undefined) return null;
  const next = { ...layout, [item.id]: to };
  if (hits.length) next[hits[0].id] = sourceCell;
  const occupied = new Set<number>();
  for (const other of sheet.inventory) if (other && next[other.id] !== undefined) {
    const area = footprintCells(other, next[other.id]);
    if (!area || area.some(n => occupied.has(n))) return null;
    area.forEach(n => occupied.add(n));
  }
  return next;
}
export function moveInventoryItem(sheet: CharacterSheet, from: number, to: number): ActionResult {
  const layout = planInventoryMove(sheet, from, to);
  if (!layout) return fail('This item does not fit here.');
  sheet.inventoryLayout = layout; return success();
}

export function addInventoryItem(sheet: CharacterSheet, item: Item): boolean {
  if (sheet.inventory.some(existing => existing?.id === item.id) || EQUIPMENT_SLOTS.some(slot => sheet.equipped[slot]?.id === item.id)) return false;
  const layout = resolvePackLayout(sheet);
  if (sheet.inventory.some(existing => existing && (existing.kind === 'charm') === (item.kind === 'charm') && layout[existing.id] === undefined)) return false;
  const empty = sheet.inventory.findIndex(existing => existing === null);
  const index = empty >= 0 ? empty : sheet.inventory.length < INVENTORY_CELLS ? sheet.inventory.length : -1;
  const cell = findPackSpace(item, packOccupancy(sheet.inventory, layout));
  if (index < 0 || cell === null) return false;
  while (sheet.inventory.length < INVENTORY_CELLS) sheet.inventory.push(null);
  sheet.inventory[index] = item; sheet.inventoryLayout = { ...layout, [item.id]: cell };
  const owned = new Set([...sheet.inventory, ...Object.values(sheet.equipped)].filter((i): i is Item => i !== null).map(i => i.id));
  sheet.recentItems = [item.id, ...(sheet.recentItems ?? []).filter(id => id !== item.id && owned.has(id))];
  return true;
}

export function allocateAttribute(sheet: CharacterSheet, attribute: Attribute): ActionResult {
  if (!['strength', 'dexterity', 'intelligence', 'vitality'].includes(attribute)) return fail('Unknown attribute.');
  if (!Number.isSafeInteger(sheet.statPoints) || sheet.statPoints < 1) return fail('No attribute points available.');
  if (!Number.isSafeInteger(sheet.attributes[attribute]) || sheet.attributes[attribute] >= Number.MAX_SAFE_INTEGER) return fail('This attribute cannot increase further.');
  sheet.attributes[attribute]++;
  sheet.statPoints--;
  return success();
}
