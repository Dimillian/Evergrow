import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, EQUIPMENT_SLOTS, generateItem } from '../src/items.ts';
import { addInventoryItem, allocateAttribute, equipItem, moveInventoryItem, unequipItem } from '../src/inventory.ts';
import type { CharacterSheet, EquipmentSlot } from '../src/character-types.ts';

const ids = (sheet: CharacterSheet) => [...sheet.inventory, ...Object.values(sheet.equipped)].filter(item => item !== null).map(item => item.id).sort();
function fillBag(sheet: CharacterSheet): void {
  for (let index = 0; index < sheet.inventory.length; index++) if (!sheet.inventory[index]) sheet.inventory[index] = generateItem(10000 + index, 1);
}

test('equipping swaps into the original cell even with a full inventory', () => {
  const sheet = createCharacterSheet(); fillBag(sheet);
  const before = ids(sheet), incoming = sheet.inventory[0], previous = sheet.equipped.weapon;
  assert.ok(equipItem(sheet, 0, 1).ok);
  assert.equal(sheet.equipped.weapon, incoming); assert.equal(sheet.inventory[0], previous);
  assert.deepEqual(ids(sheet), before);
});

test('wrong slots, unmet levels and invalid indices never partially mutate inventory', () => {
  const sheet = createCharacterSheet(); sheet.inventory[4] = generateItem(919, 20, 'head');
  const before = structuredClone(sheet);
  assert.equal(equipItem(sheet, 4, 1).ok, false);
  assert.equal(equipItem(sheet, 4, 100, 'weapon').ok, false);
  assert.equal(equipItem(sheet, 4, NaN).ok, false);
  assert.equal(equipItem(sheet, 4, 100, 'unknown' as EquipmentSlot).ok, false);
  assert.equal(equipItem(sheet, -1, 100).ok, false);
  assert.equal(equipItem(sheet, 48, 100).ok, false);
  assert.equal(equipItem(sheet, 4.5, 100).ok, false);
  assert.equal(equipItem(sheet, 5, 100).ok, false);
  assert.deepEqual(sheet, before);
});

test('rings choose free slots and allow an explicit ring replacement', () => {
  const sheet = createCharacterSheet();
  sheet.inventory[4] = generateItem(678, 1, 'ring'); sheet.inventory[5] = generateItem(679, 1, 'ring');
  assert.ok(equipItem(sheet, 2, 1).ok); const ring1 = sheet.equipped.ring1;
  assert.ok(equipItem(sheet, 4, 1).ok); const ring2 = sheet.equipped.ring2;
  assert.notEqual(ring1, ring2); assert.ok(ring1 && ring2);
  assert.ok(equipItem(sheet, 5, 1, 'ring2').ok);
  assert.equal(sheet.inventory[5], ring2); assert.equal(sheet.equipped.ring1, ring1);
});

test('unequipping fails atomically when full or targeted cell is occupied', () => {
  const sheet = createCharacterSheet(); fillBag(sheet); const before = structuredClone(sheet);
  assert.equal(unequipItem(sheet, 'head').ok, false);
  assert.equal(unequipItem(sheet, 'head', 1).ok, false);
  assert.equal(unequipItem(sheet, 'head', Infinity).ok, false);
  assert.deepEqual(sheet, before);
  sheet.inventory[7] = null; const helmet = sheet.equipped.head;
  assert.ok(unequipItem(sheet, 'head', 7).ok);
  assert.equal(sheet.inventory[7], helmet); assert.equal(sheet.equipped.head, null);
});

test('bag moves swap occupants and never create or duplicate items', () => {
  const sheet = createCharacterSheet(), before = ids(sheet);
  const first = sheet.inventory[0], second = sheet.inventory[1];
  assert.ok(moveInventoryItem(sheet, 0, 1).ok); assert.equal(sheet.inventory[1], first); assert.equal(sheet.inventory[0], second);
  assert.ok(moveInventoryItem(sheet, 1, 47).ok); assert.equal(sheet.inventory[47], first); assert.equal(sheet.inventory[1], null);
  assert.equal(moveInventoryItem(sheet, 1, 3).ok, false);
  assert.equal(moveInventoryItem(sheet, 47, -1).ok, false);
  assert.ok(moveInventoryItem(sheet, 47, 47).ok);
  assert.deepEqual(ids(sheet), before);
});

test('pickup rejects duplicate identities in gear or bag and never overwrites a full pack', () => {
  const sheet = createCharacterSheet();
  assert.equal(addInventoryItem(sheet, sheet.equipped.weapon!), false);
  assert.equal(addInventoryItem(sheet, structuredClone(sheet.inventory[0]!)), false);
  const loot = generateItem(192819, 5, 'chest');
  assert.ok(addInventoryItem(sheet, loot)); assert.equal(sheet.inventory[4], loot);
  fillBag(sheet); const before = ids(sheet);
  assert.equal(addInventoryItem(sheet, generateItem(987891, 5)), false);
  assert.deepEqual(ids(sheet), before);
});

test('attribute allocation consumes exactly one earned point and rejects malformed pools', () => {
  const sheet = createCharacterSheet();
  assert.equal(allocateAttribute(sheet, 'strength').ok, false);
  sheet.statPoints = 5;
  for (let count = 0; count < 5; count++) assert.ok(allocateAttribute(sheet, 'strength').ok);
  assert.equal(sheet.attributes.strength, 15); assert.equal(sheet.statPoints, 0);
  assert.equal(allocateAttribute(sheet, 'strength').ok, false);
  for (const invalid of [NaN, Infinity, -1, 1.5]) {
    sheet.statPoints = invalid; assert.equal(allocateAttribute(sheet, 'vitality').ok, false); assert.equal(sheet.attributes.vitality, 10);
  }
});

test('mixed equipment and bag transactions conserve every item identity across repeated swaps', () => {
  const sheet = createCharacterSheet(); fillBag(sheet); const original = ids(sheet);
  let state = 145;
  const random = (max: number) => { state = Math.imul(state, 1664525) + 1013904223 | 0; return (state >>> 0) % max; };
  for (let operation = 0; operation < 1000; operation++) {
    const type = random(3), index = random(48), slot = EQUIPMENT_SLOTS[random(EQUIPMENT_SLOTS.length)];
    if (type === 0) equipItem(sheet, index, 100, slot);
    else if (type === 1) unequipItem(sheet, slot, index);
    else moveInventoryItem(sheet, index, random(48));
    assert.deepEqual(ids(sheet), original);
    assert.equal(new Set(ids(sheet)).size, original.length);
  }
});
