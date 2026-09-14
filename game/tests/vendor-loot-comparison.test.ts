import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { previewEquipmentChange } from '../src/equipment-preview.ts';
import { itemHoverCards } from '../src/item-ui.ts';
import { INVENTORY_CELLS } from '../src/inventory-grid.ts';

const equipItem = (player: ReturnType<typeof initialPlayer>, index: number, profile: string, shield = false) => {
  player.character.inventory[index] = generateItem(1010 + index, 1, shield ? 'shield' : 'weapon', profile, 'common');
  assert.ok(executeCharacterCommand(player, { type: 'equip', index }).ok);
};

test('ground loot inspection displays equipped comparison cards by default', () => {
  const p = initialPlayer(0, 0);
  equipItem(p, 0, 'longsword');
  const incoming = generateItem(1200, 1, 'weapon', 'ember-staff', 'rare');
  const before = structuredClone(p);

  // Default comparison produces cards for incoming item and both displaced hands
  const cards = itemHoverCards(incoming, { sheet: p.character, level: p.level });
  assert.equal(cards.length, 2);
  assert.match(cards[0], /ember-staff|Staff/i);
  assert.match(cards[1], /Equipped · Main hand/);
  assert.deepEqual(p, before, 'inspection must not mutate character');

  // Explicitly passing compare: false keeps single card behavior
  const single = itemHoverCards(incoming, { sheet: p.character, level: p.level, compare: false });
  assert.equal(single.length, 1);
});

test('external item preview succeeds and includes displaced gear even with a full inventory pack', () => {
  const p = initialPlayer(0, 0);
  equipItem(p, 0, 'longsword');

  // Fill all inventory slots completely
  p.character.inventory = Array.from({ length: INVENTORY_CELLS }, (_, i) => generateItem(3000 + i, 1, 'head'));
  assert.equal(p.character.inventory.includes(null), false, 'pack should be completely full');

  const vendorWeapon = generateItem(4000, 1, 'weapon', 'ember-staff', 'epic');
  const preview = previewEquipmentChange(p.character, vendorWeapon, p.level);
  assert.ok(preview.ok, 'external preview must succeed even when pack is full');
  assert.equal(preview.displaced.length, 1);
  assert.equal(preview.displaced[0]?.slot, 'weapon');

  const cards = itemHoverCards(vendorWeapon, { sheet: p.character, level: p.level });
  assert.equal(cards.length, 2, 'hover cards must include displaced equipped item');
  assert.match(cards[1], /Equipped · Main hand/);
});

test('ring inspection targets ring1 by default and ring2 when targetSlot is specified', () => {
  const p = initialPlayer(0, 0);
  p.character.equipped.ring1 = generateItem(5001, 1, 'ring', 'garnet-band', 'magic');
  p.character.equipped.ring2 = generateItem(5002, 1, 'ring', 'sapphire-ring', 'rare');

  const vendorRing = generateItem(5003, 1, 'ring', 'moonstone-ring', 'epic');

  const cardsDefault = itemHoverCards(vendorRing, { sheet: p.character, level: p.level });
  assert.equal(cardsDefault.length, 2);
  assert.match(cardsDefault[1], /Equipped · Ring 1/);

  const cardsRing2 = itemHoverCards(vendorRing, { sheet: p.character, level: p.level, targetSlot: 'ring2' });
  assert.equal(cardsRing2.length, 2);
  assert.match(cardsRing2[1], /Equipped · Ring 2/);
});
