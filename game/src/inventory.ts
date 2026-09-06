import type { ActionResult, Attribute, CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { EQUIPMENT_SLOTS } from './items.ts';

const success = (): ActionResult => ({ ok: true });
const fail = (message: string): ActionResult => ({ ok: false, message });
const validIndex = (sheet: CharacterSheet, index: number) => Number.isInteger(index) && index >= 0 && index < sheet.inventory.length;
export function itemFitsSlot(item: Item, slot: EquipmentSlot): boolean {
  if (item.kind === 'ring') return slot === 'ring1' || slot === 'ring2';
  if (item.kind === 'shield' || item.kind === 'grimoire' || item.kind === 'orb') return slot === 'offhand';
  if (item.kind === 'weapon') return slot === 'weapon' || slot === 'offhand' && item.weapon?.hands === 1 && item.weapon.attackKind === 'melee';
  return item.kind === slot;
}

export type EquipmentPlan = { ok: false; message: string } | {
  ok: true; slot: EquipmentSlot; inventory: CharacterSheet['inventory']; equipped: CharacterSheet['equipped'];
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
  const slot: EquipmentSlot = target.slot ?? (item.kind === 'ring'
    ? !sheet.equipped.ring1 ? 'ring1' : !sheet.equipped.ring2 ? 'ring2' : 'ring1'
    : (item.kind === 'shield' || item.kind === 'grimoire' || item.kind === 'orb') ? 'offhand' : item.kind);
  if (!EQUIPMENT_SLOTS.includes(slot) || !itemFitsSlot(item, slot)) return reject('This item does not fit that equipment slot.');
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(item.requiredLevel) || item.requiredLevel < 1 || level < item.requiredLevel)
    return reject(`Requires level ${item.requiredLevel}.`);
  if (item.kind === 'weapon' && !item.weapon) return reject('This weapon has no attack profile.');
  if ((item.kind === 'grimoire' || item.kind === 'orb') && !item.focus) return reject('This focus has no equipment profile.');
  if (item.kind === 'shield' && !item.shield) return reject('This shield has no defense profile.');
  const inventory = [...sheet.inventory], equipped = { ...sheet.equipped };
  const displaced: Array<{ slot: EquipmentSlot; item: Item }> = [];
  if (source !== undefined) inventory[source] = null;
  if (equipped[slot]) displaced.push({ slot, item: equipped[slot]! });
  equipped[slot] = item;
  const conflict = slot === 'weapon' && item.weapon?.hands === 2 && equipped.offhand ? 'offhand'
    : slot === 'offhand' && equipped.weapon?.weapon?.hands === 2 ? 'weapon' : null;
  if (conflict) { displaced.push({ slot: conflict, item: equipped[conflict]! }); equipped[conflict] = null; }
  for (let i = 0; i < displaced.length; i++) {
    const index = i === 0 && source !== undefined ? source : inventory.findIndex(existing => existing === null);
    if (index < 0) return reject('Your pack needs an empty cell to stow displaced equipment.');
    inventory[index] = displaced[i].item;
  }
  return { ok: true, slot, inventory, equipped, displaced };
}

/** Commit only a fully validated plan; failures preserve every container. */
export function equipItem(sheet: CharacterSheet, inventoryIndex: number, level: number, targetSlot?: EquipmentSlot): ActionResult {
  if (!validIndex(sheet, inventoryIndex)) return fail('Choose an item in your pack.');
  const item = sheet.inventory[inventoryIndex];
  if (!item) return fail('That inventory cell is empty.');
  const plan = planEquipmentChange(sheet, item, level, { sourceIndex: inventoryIndex, slot: targetSlot });
  if (!plan.ok) return plan;
  sheet.inventory = plan.inventory; sheet.equipped = plan.equipped;
  return success();
}

export function unequipItem(sheet: CharacterSheet, slot: EquipmentSlot, targetIndex?: number): ActionResult {
  if (!EQUIPMENT_SLOTS.includes(slot) || !sheet.equipped[slot]) return fail('That equipment slot is empty.');
  const index = targetIndex ?? sheet.inventory.findIndex(item => item === null);
  if (!validIndex(sheet, index)) return fail('Your pack is full.');
  if (sheet.inventory[index]) return fail('Choose an empty inventory cell.');
  sheet.inventory[index] = sheet.equipped[slot];
  sheet.equipped[slot] = null;
  return success();
}

export function moveInventoryItem(sheet: CharacterSheet, from: number, to: number): ActionResult {
  if (!validIndex(sheet, from) || !validIndex(sheet, to)) return fail('Choose a cell inside your pack.');
  if (!sheet.inventory[from]) return fail('That inventory cell is empty.');
  if (from === to) return success();
  [sheet.inventory[from], sheet.inventory[to]] = [sheet.inventory[to], sheet.inventory[from]];
  return success();
}

export function addInventoryItem(sheet: CharacterSheet, item: Item): boolean {
  if (sheet.inventory.some(existing => existing?.id === item.id) || EQUIPMENT_SLOTS.some(slot => sheet.equipped[slot]?.id === item.id)) return false;
  const index = sheet.inventory.findIndex(existing => existing === null);
  if (index < 0) return false;
  sheet.inventory[index] = item;
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
