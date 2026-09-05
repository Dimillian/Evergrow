import type { ActionResult, Attribute, CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { EQUIPMENT_SLOTS } from './items.ts';

const success = (): ActionResult => ({ ok: true });
const fail = (message: string): ActionResult => ({ ok: false, message });
const validIndex = (sheet: CharacterSheet, index: number) => Number.isInteger(index) && index >= 0 && index < sheet.inventory.length;
export function itemFitsSlot(item: Item, slot: EquipmentSlot): boolean {
  return item.kind === 'ring' ? slot === 'ring1' || slot === 'ring2' : item.kind === slot;
}

/** A swap uses the source bag cell, so it is valid even with a completely full pack. */
export function equipItem(sheet: CharacterSheet, inventoryIndex: number, level: number, targetSlot?: EquipmentSlot): ActionResult {
  if (!validIndex(sheet, inventoryIndex)) return fail('Choose an item in your pack.');
  const item = sheet.inventory[inventoryIndex];
  if (!item) return fail('That inventory cell is empty.');
  const slot = targetSlot ?? (item.kind === 'ring' ? !sheet.equipped.ring1 ? 'ring1' : !sheet.equipped.ring2 ? 'ring2' : 'ring1' : item.kind);
  if (!EQUIPMENT_SLOTS.includes(slot) || !itemFitsSlot(item, slot)) return fail('This item does not fit that equipment slot.');
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(item.requiredLevel) || item.requiredLevel < 1 || level < item.requiredLevel) return fail(`Requires level ${item.requiredLevel}.`);
  if (item.kind === 'weapon' && !item.weapon) return fail('This weapon has no attack profile.');
  const previous = sheet.equipped[slot];
  sheet.equipped[slot] = item;
  sheet.inventory[inventoryIndex] = previous;
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
