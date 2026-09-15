import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { sortInventory, sortStorage } from '../src/inventory-tools.ts';
import { validPackLayout, PACK_CELLS } from '../src/inventory-grid.ts';
import { STASH_CAPACITY, storageTabItems } from '../src/storage-content.ts';
import type { Item, ItemKind, ItemTier } from '../src/character-types.ts';

const item = (seed: number, level: number, kind: ItemKind, profile?: string, tier: ItemTier = 'common'): Item => {
  const result = generateItem(seed, level, kind, profile, tier);
  return result;
};

test('auto-sort compacts and orders by rarity, kind, and item level descending', () => {
  const sheet = createCharacterSheet();
  const legWeapon = item(101, 50, 'weapon', 'greatblade', 'legendary');
  const rareWeaponHigh = item(102, 45, 'weapon', 'greatblade', 'rare');
  const rareWeaponLow = item(103, 15, 'weapon', 'greatblade', 'rare');
  const magicWeapon = item(104, 30, 'weapon', 'greatblade', 'magic');
  const comWeapon = item(105, 10, 'weapon', 'greatblade', 'common');

  // Insert in scrambled order
  for (const it of [rareWeaponLow, comWeapon, legWeapon, magicWeapon, rareWeaponHigh]) {
    assert.ok(addInventoryItem(sheet, it));
  }

  const result = sortInventory(sheet, 'compact');
  assert.ok(result.ok);

  const nonNull = sheet.inventory.filter((i): i is Item => i !== null);
  // All have 2x4 greatblade footprint, so rarity takes precedence, then level
  assert.equal(nonNull[0].id, legWeapon.id);
  assert.equal(nonNull[1].id, rareWeaponHigh.id);
  assert.equal(nonNull[2].id, rareWeaponLow.id);
  assert.equal(nonNull[3].id, magicWeapon.id);
  assert.equal(nonNull[4].id, comWeapon.id);

  assert.ok(validPackLayout(sheet.inventory, sheet.inventoryLayout));
});

test('locked items retain their locked status through inventory sorting', () => {
  const sheet = createCharacterSheet();
  const sword = item(201, 20, 'weapon', 'longsword', 'rare');
  sword.locked = true;
  const helm = item(202, 25, 'head', undefined, 'magic');

  assert.ok(addInventoryItem(sheet, sword));
  assert.ok(addInventoryItem(sheet, helm));

  assert.ok(sortInventory(sheet, 'compact').ok);

  const foundSword = sheet.inventory.find(i => i?.id === sword.id);
  assert.ok(foundSword);
  assert.equal(foundSword.locked, true);
  assert.ok(validPackLayout(sheet.inventory, sheet.inventoryLayout));
});

test('storage tab sorting orders vault items compactly and stays within capacity', () => {
  const sheet = createCharacterSheet();
  sheet.stash = Array.from({ length: STASH_CAPACITY }, () => null);

  const rareRing = item(301, 30, 'ring', undefined, 'rare');
  const epicSword = item(302, 40, 'weapon', 'greatblade', 'epic');
  const commonHelm = item(303, 10, 'head', undefined, 'common');

  sheet.stash[10] = commonHelm;
  sheet.stash[25] = rareRing;
  sheet.stash[40] = epicSword;

  const result = sortStorage(sheet, 0);
  assert.ok(result.ok);

  const sorted = storageTabItems(sheet, 0).filter((i): i is Item => i !== null);
  assert.equal(sorted.length, 3);
  // Compact prioritizes rarity first (epic sword > rare ring > common helm)
  assert.equal(sorted[0].id, epicSword.id);
  assert.equal(sorted[1].id, rareRing.id);
  assert.equal(sorted[2].id, commonHelm.id);
});

test('charms in the charm pouch are packed into charm cells without corrupting regular bag layout', () => {
  const sheet = createCharacterSheet();
  const charmA = item(401, 1, 'charm', 'jade-monolith');
  const charmB = item(402, 1, 'charm', 'amber-pebble');
  const chest = item(403, 20, 'chest', undefined, 'rare');

  assert.ok(addInventoryItem(sheet, chest));
  assert.ok(addInventoryItem(sheet, charmA));
  assert.ok(addInventoryItem(sheet, charmB));

  assert.ok(sortInventory(sheet, 'compact').ok);
  assert.ok(validPackLayout(sheet.inventory, sheet.inventoryLayout));

  const layout = sheet.inventoryLayout!;
  // Charms should be in cell indices >= PACK_CELLS
  assert.ok(layout[charmA.id] >= PACK_CELLS);
  assert.ok(layout[charmB.id] >= PACK_CELLS);
  // Chest gear should be in regular bag cells < PACK_CELLS
  assert.ok(layout[chest.id] < PACK_CELLS);
});
