import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { planEquipmentChange } from '../src/inventory.ts';
import { previewEquipmentChange } from '../src/equipment-preview.ts';
import { itemTooltipMarkup, itemSlotMarkup } from '../src/item-ui.ts';
const put = (player: ReturnType<typeof initialPlayer>, index: number, profile: string, shield = false) => {
  player.character.inventory[index] = generateItem(1010 + index, 1, shield ? 'shield' : 'weapon', profile, 'common');
  assert.ok(executeCharacterCommand(player, { type: 'equip', index }).ok);
};

test('two-handed preview includes shield armor/block losses and matches the committed full build', () => {
  const p = initialPlayer(0, 0); put(p, 0, 'longsword'); put(p, 1, 'iron-buckler', true);
  const incoming = generateItem(1200, 1, 'weapon', 'ember-staff', 'common'); p.character.inventory[2] = incoming;
  const before = structuredClone(p);
  const preview = previewEquipmentChange(p.character, incoming, p.level, { sourceIndex: 2 });
  assert.ok(preview.ok); assert.deepEqual(p, before, 'preview must be pure');
  assert.equal(preview.displaced.length, 2);
  assert.equal(preview.changes.find(c => c.key === 'armor')!.after - before.derived.armor, -7);
  assert.equal(preview.changes.find(c => c.key === 'blockChance')!.after, 0);
  assert.ok(executeCharacterCommand(p, { type: 'equip', index: 2 }).ok);
  assert.deepEqual(p.character.equipped, preview.equipped); assert.deepEqual(p.character.inventory, preview.inventory);
  assert.equal(p.derived.armor, preview.changes.find(c => c.key === 'armor')!.after);
});

test('full-pack preview and commit reject the same hand conflict without mutation', () => {
  const p = initialPlayer(0, 0); put(p, 0, 'longsword'); put(p, 1, 'iron-buckler', true);
  p.character.inventory = p.character.inventory.map((_, i) => generateItem(2000 + i, 1, 'head'));
  const item = generateItem(2200, 1, 'weapon', 'ember-staff'); p.character.inventory[2] = item;
  const before = structuredClone(p);
  const preview = previewEquipmentChange(p.character, item, p.level, { sourceIndex: 2 });
  assert.equal(preview.ok, false);
  assert.deepEqual(executeCharacterCommand(p, { type: 'equip', index: 2 }), preview);
  assert.deepEqual(p, before);
});

test('external items preview without a bag index, while duplicate and stale owned identities fail', () => {
  const p = initialPlayer(0, 0), item = generateItem(2400, 1, 'head');
  const before = structuredClone(p);
  assert.ok(previewEquipmentChange(p.character, item, 1).ok); assert.deepEqual(p, before);
  assert.equal(planEquipmentChange(p.character, item, 1, { sourceIndex: 0 }).ok, false);
  assert.equal(planEquipmentChange(p.character, p.character.equipped.head!, 1).ok, false);
  assert.equal(planEquipmentChange(p.character, item, 1, { slot: 'weapon' }).ok, false);
  assert.equal(planEquipmentChange(p.character, generateItem(2401, 20, 'head'), 1).ok, false);
});

test('off-hand and explicit ring previews use their real target and displacement rules', () => {
  const p = initialPlayer(0, 0); put(p, 0, 'longsword');
  const dagger = generateItem(2500, 1, 'weapon', 'rondel-dagger'); p.character.inventory[2] = dagger;
  const dual = previewEquipmentChange(p.character, dagger, 1, { sourceIndex: 2, slot: 'offhand' });
  assert.ok(dual.ok); assert.equal(dual.equipped.weapon, p.character.equipped.weapon);
  assert.ok(dual.changes.some(c => c.key === 'offDamage' && c.after > 0));
  assert.ok(executeCharacterCommand(p, { type: 'equip', index: 2, slot: 'offhand' }).ok);
  assert.deepEqual(p.character.equipped, dual.equipped);
  const ring = generateItem(2501, 1, 'ring'); p.character.inventory[3] = ring;
  const secondRing = previewEquipmentChange(p.character, ring, 1, { sourceIndex: 3, slot: 'ring2' });
  assert.ok(secondRing.ok); assert.equal(secondRing.slot, 'ring2'); assert.equal(secondRing.equipped.ring1, null);
});

test('shared tooltip distinguishes effective changes from item values, escapes context and hides previews for equipped items', () => {
  const p = initialPlayer(0, 0); put(p, 0, 'longsword'); put(p, 1, 'iron-buckler', true);
  const item = generateItem(2600, 1, 'weapon', 'ember-staff', 'common');
  item.name = '<script>bad</script>';
  const markup = itemTooltipMarkup(item, { sheet: p.character, level: 1, context: '<buy> 400 Gold' });
  assert.ok(markup.includes('On equip')); assert.ok(markup.includes('-7'));
  assert.ok(markup.includes('Block chance')); assert.ok(markup.includes('Replaces'));
  assert.ok(markup.includes('&lt;script&gt;')); assert.ok(markup.includes('&lt;buy&gt;'));
  assert.ok(!markup.includes('<script>'));
  assert.ok(!itemTooltipMarkup(item, { sheet: p.character, level: 1, equipped: true }).includes('On equip'));
  assert.ok(itemSlotMarkup(item).includes('ui-item-tier'));
});
