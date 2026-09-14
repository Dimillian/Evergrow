import { planEquipmentChange } from '../src/inventory.ts';
import { comparisonSlot, ItemComparisonInput } from '../src/item-comparison.ts';
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

test('vendor inspection displays equipped comparison cards by default', () => {
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

test('ring inspection compares both equipped rings by default and targets a specific ring when targetSlot is specified', () => {
  const p = initialPlayer(0, 0);
  p.character.equipped.ring1 = generateItem(5001, 1, 'ring', 'garnet-band', 'magic');
  p.character.equipped.ring2 = generateItem(5002, 1, 'ring', 'sapphire-ring', 'rare');

  const vendorRing = generateItem(5003, 1, 'ring', 'moonstone-ring', 'epic');

  const cardsDefault = itemHoverCards(vendorRing, { sheet: p.character, level: p.level });
  assert.equal(cardsDefault.length, 3);
  assert.match(cardsDefault[1], /Equipped · Ring 1/);
  assert.match(cardsDefault[2], /Equipped · Ring 2/);

  const cardsRing2 = itemHoverCards(vendorRing, { sheet: p.character, level: p.level, targetSlot: 'ring2' });
  assert.equal(cardsRing2.length, 2);
  assert.match(cardsRing2[1], /Equipped · Ring 2/);
});

test('external preview does not weaken actual equip storage validation or mutate the bag', () => {
  const p = initialPlayer(0, 0);
  equipItem(p, 0, 'longsword'); equipItem(p, 1, 'iron-buckler', true);
  p.character.inventory = Array.from({ length: INVENTORY_CELLS }, (_, i) => generateItem(6000 + i, 1, 'head'));
  const before = structuredClone(p.character);
  const incoming = generateItem(9000, 1, 'weapon', 'ember-staff', 'epic');
  const preview = previewEquipmentChange(p.character, incoming, p.level);
  assert.equal(preview.ok, true);
  if (preview.ok) assert.deepEqual(preview.displaced.map(d => d.slot), ['weapon', 'offhand']);
  assert.equal(planEquipmentChange(p.character, incoming, p.level).ok, false);
  assert.deepEqual(p.character, before);
});

test('ring comparison follows empty slots and Shift chooses the alternate actual destination', () => {
  const p = initialPlayer(0, 0), ring = generateItem(9500, 1, 'ring');
  for (const [first, second, expected] of [[false,false,'ring1'],[true,false,'ring2'],[false,true,'ring1'],[true,true,'ring1']] as const) {
    p.character.equipped.ring1 = first ? generateItem(9501, 1, 'ring') : null;
    p.character.equipped.ring2 = second ? generateItem(9502, 1, 'ring') : null;
    assert.equal(comparisonSlot(p.character, ring), expected);
    assert.equal(comparisonSlot(p.character, ring, true), expected === 'ring1' ? 'ring2' : 'ring1');
  }
  assert.equal(comparisonSlot(p.character, generateItem(9503, 1, 'weapon', 'longsword'), true), 'offhand');
  assert.equal(comparisonSlot(p.character, generateItem(9504, 1, 'weapon', 'ember-staff'), true), 'weapon');
});

test('stationary Shift switches comparisons immediately and releases never latch', () => {
  const target = new EventTarget(), abort = new AbortController();
  let changes = 0;
  const input = new ItemComparisonInput(target, () => changes++, abort.signal);
  const key = (type: string, code: string, shiftKey: boolean) => target.dispatchEvent(Object.assign(new Event(type), { code, shiftKey }));
  key('keydown', 'ShiftLeft', true); assert.equal(input.alternate, true); assert.equal(changes, 1);
  key('keydown', 'ShiftLeft', true); assert.equal(changes, 1);
  key('keydown', 'ShiftRight', true); key('keyup', 'ShiftLeft', true); assert.equal(input.alternate, true);
  key('keyup', 'ShiftRight', false); assert.equal(input.alternate, false);
  key('keydown', 'ShiftLeft', true); target.dispatchEvent(new Event('blur')); assert.equal(input.alternate, false);
  abort.abort(); key('keydown', 'ShiftLeft', true); assert.equal(input.alternate, false);
});
