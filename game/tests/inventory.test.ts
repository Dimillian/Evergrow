import { characterWithTestLoot } from './fixtures/character-pack.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT_SLOTS, generateItem } from '../src/items.ts';
import { addInventoryItem, allocateAttribute, equipItem, moveInventoryItem, unequipItem } from '../src/inventory.ts';
import type { CharacterSheet, EquipmentSlot } from '../src/character-types.ts';

const ids = (sheet: CharacterSheet) => [...sheet.inventory, ...Object.values(sheet.equipped)].filter(item => item !== null).map(item => item.id).sort();
function fillBag(sheet: CharacterSheet): void {
  for (let index = 0; index < sheet.inventory.length; index++) if (!sheet.inventory[index]) sheet.inventory[index] = generateItem(10000 + index, 1);
}

test('equipping swaps into the original cell even with a full inventory', () => {
  const sheet = characterWithTestLoot(); sheet.equipped.weapon = generateItem(915,1,'weapon','longsword'); fillBag(sheet);
  const before = ids(sheet), incoming = sheet.inventory[0], previous = sheet.equipped.weapon;
  assert.ok(equipItem(sheet, 0, 1).ok);
  assert.equal(sheet.equipped.weapon, incoming); assert.equal(sheet.inventory[0], previous);
  assert.deepEqual(ids(sheet), before);
});

test('wrong slots, unmet levels and invalid indices never partially mutate inventory', () => {
  const sheet = characterWithTestLoot(); sheet.inventory[4] = generateItem(919, 20, 'head');
  const before = structuredClone(sheet);
  assert.equal(equipItem(sheet, 4, 1).ok, false);
  assert.equal(equipItem(sheet, 4, 100, 'weapon').ok, false);
  assert.equal(equipItem(sheet, 4, NaN).ok, false);
  assert.equal(equipItem(sheet, 4, 100, 'unknown' as EquipmentSlot).ok, false);
  assert.equal(equipItem(sheet, -1, 100).ok, false);
  assert.equal(equipItem(sheet, 64, 100).ok, false);
  assert.equal(equipItem(sheet, 4.5, 100).ok, false);
  assert.equal(equipItem(sheet, 63, 100).ok, false);
  assert.deepEqual(sheet, before);
});

test('rings choose free slots and allow an explicit ring replacement', () => {
  const sheet = characterWithTestLoot();
  sheet.inventory[4] = generateItem(678, 1, 'ring'); sheet.inventory[5] = generateItem(679, 1, 'ring');
  assert.ok(equipItem(sheet, 2, 1).ok); const ring1 = sheet.equipped.ring1;
  assert.ok(equipItem(sheet, 4, 1).ok); const ring2 = sheet.equipped.ring2;
  assert.notEqual(ring1, ring2); assert.ok(ring1 && ring2);
  assert.ok(equipItem(sheet, 5, 1, 'ring2').ok);
  assert.equal(sheet.inventory[5], ring2); assert.equal(sheet.equipped.ring1, ring1);
});

test('unequipping fails atomically when full or targeted cell is occupied', () => {
  const sheet = characterWithTestLoot(); fillBag(sheet); const before = structuredClone(sheet);
  assert.equal(unequipItem(sheet, 'head').ok, false);
  assert.equal(unequipItem(sheet, 'head', 1).ok, false);
  assert.equal(unequipItem(sheet, 'head', Infinity).ok, false);
  assert.deepEqual(sheet, before);
  sheet.inventory = Array(64).fill(null); sheet.inventoryLayout = {}; const helmet = sheet.equipped.head;
  assert.ok(unequipItem(sheet, 'head', 7).ok);
  assert.equal(sheet.inventory[0], helmet); assert.equal(sheet.inventoryLayout![helmet!.id], 7); assert.equal(sheet.equipped.head, null);
});

test('bag movement changes footprint positions without changing item ownership', () => {
  const sheet = characterWithTestLoot();
  sheet.inventory = Array(64).fill(null);
  const first = generateItem(61,1,'ring'), second = generateItem(62,1,'ring');
  sheet.inventory[0]=first; sheet.inventory[1]=second;
  assert.ok(moveInventoryItem(sheet,0,1).ok);
  assert.equal(sheet.inventoryLayout![first.id],1); assert.equal(sheet.inventoryLayout![second.id],0);
  assert.ok(moveInventoryItem(sheet,0,59).ok); assert.equal(sheet.inventoryLayout![first.id],59);
  const stable=structuredClone(sheet);
  assert.equal(moveInventoryItem(sheet,2,3).ok,false); assert.equal(moveInventoryItem(sheet,0,-1).ok,false);
  assert.deepEqual(sheet,stable); assert.ok(moveInventoryItem(sheet,0,59).ok);
  assert.equal(sheet.inventory[0],first); assert.equal(sheet.inventory[1],second);
});

test('pickup rejects duplicate identities in gear or bag and never overwrites a full pack', () => {
  const sheet = characterWithTestLoot();
  assert.equal(addInventoryItem(sheet, sheet.equipped.weapon!), false);
  assert.equal(addInventoryItem(sheet, structuredClone(sheet.inventory[0]!)), false);
  const loot = generateItem(192819, 5, 'chest');
  const empty = sheet.inventory.findIndex(item => item === null);
  assert.ok(addInventoryItem(sheet, loot)); assert.equal(sheet.inventory[empty], loot);
  fillBag(sheet); const before = ids(sheet);
  assert.equal(addInventoryItem(sheet, generateItem(987891, 5)), false);
  assert.deepEqual(ids(sheet), before);
});

test('attribute allocation consumes exactly one earned point and rejects malformed pools', () => {
  const sheet = characterWithTestLoot();
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
  const sheet = characterWithTestLoot(); fillBag(sheet); const original = ids(sheet);
  let state = 145;
  const random = (max: number) => { state = Math.imul(state, 1664525) + 1013904223 | 0; return (state >>> 0) % max; };
  for (let operation = 0; operation < 1000; operation++) {
    const type = random(3), index = random(64), slot = EQUIPMENT_SLOTS[random(EQUIPMENT_SLOTS.length)];
    if (type === 0) equipItem(sheet, index, 100, slot);
    else if (type === 1) unequipItem(sheet, slot, index);
    else moveInventoryItem(sheet, index, random(64));
    assert.deepEqual(ids(sheet), original);
    assert.equal(new Set(ids(sheet)).size, original.length);
  }
});


test('one-handed melee weapons and shields occupy the offhand while ranged and two-handed items cannot', () => {
  const sheet = characterWithTestLoot();
  assert.ok(equipItem(sheet, 0, 1).ok);
  const sword = sheet.equipped.weapon;
  assert.ok(equipItem(sheet, 7, 1, 'offhand').ok);
  assert.equal(sheet.equipped.offhand!.weapon!.family, 'dagger');
  assert.equal(sheet.equipped.weapon, sword);
  assert.ok(equipItem(sheet, 4, 1).ok);
  assert.equal(sheet.equipped.offhand!.kind, 'shield');
  assert.equal(sheet.inventory[4]!.weapon!.family, 'dagger');
  const before = structuredClone(sheet);
  assert.equal(equipItem(sheet, 5, 1, 'offhand').ok, false);
  assert.equal(equipItem(sheet, 6, 1, 'offhand').ok, false);
  assert.deepEqual(sheet, before);
});

test('two-handed equipment stows an offhand atomically, rejecting a full bag without losing either item', () => {
  const sheet = characterWithTestLoot();
  assert.ok(equipItem(sheet, 0, 1).ok); assert.ok(equipItem(sheet, 4, 1).ok);
  sheet.inventory[10] = generateItem(847, 1, 'weapon', 'greatblade'); fillBag(sheet);
  const before = structuredClone(sheet), beforeIds = ids(sheet), shield = sheet.equipped.offhand;
  assert.equal(equipItem(sheet, 10, 1).ok, false); assert.deepEqual(sheet, before);
  const removed = sheet.inventory.filter((item, index) => item && index >= 8 && index !== 10).map(item => item!.id);
  sheet.inventory = sheet.inventory.map((item,index) => index >= 8 && index !== 10 ? null : item);
  assert.ok(equipItem(sheet, 10, 1).ok);
  assert.equal(sheet.equipped.weapon!.weapon!.hands, 2); assert.equal(sheet.equipped.offhand, null);
  assert.ok(sheet.inventory.includes(shield));
  assert.deepEqual(ids(sheet), beforeIds.filter(id => !removed.includes(id)));
});

test('an offhand needs enough physical room to stow a larger two-handed weapon', () => {
  const sheet = characterWithTestLoot(); fillBag(sheet);
  const before = structuredClone(sheet), sword = sheet.equipped.weapon, shield = sheet.inventory[4];
  assert.equal(equipItem(sheet,4,1).ok,false); assert.deepEqual(sheet,before);
  sheet.inventory=sheet.inventory.map((item,index)=>index===4?item:null);
  const beforeIds=ids(sheet);
  assert.ok(equipItem(sheet, 4, 1).ok);
  assert.equal(sheet.equipped.weapon, null); assert.equal(sheet.equipped.offhand, shield);
  assert.equal(sheet.inventory[4], sword); assert.deepEqual(ids(sheet), beforeIds);
});

test('hand conflict resolution can reuse the source cell when the receiving hand was empty', () => {
  const sheet = characterWithTestLoot();
  assert.ok(equipItem(sheet, 4, 1).ok); // Shield stows the starting two-handed sword.
  fillBag(sheet); const before = ids(sheet);
  assert.ok(equipItem(sheet, 4, 1).ok);
  assert.equal(sheet.equipped.weapon!.weapon!.hands, 2); assert.equal(sheet.equipped.offhand, null);
  assert.equal(sheet.inventory[4]!.kind, 'shield'); assert.deepEqual(ids(sheet), before);
});
