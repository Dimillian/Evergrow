import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem, ITEM_KINDS } from '../src/items.ts';
import { itemIconSVG, outfitFromEquipment } from '../src/item-art.ts';

test('every equipment family generates distinct vector art without external resources', () => {
  const icons = ITEM_KINDS.map(kind => itemIconSVG(generateItem(419, 1, kind)));
  assert.equal(new Set(icons).size, ITEM_KINDS.length);
  for (const icon of icons) {
    assert.ok(icon.startsWith('<svg ')); assert.ok(icon.endsWith('</svg>'));
    assert.ok(!/<image|href=|data:|NaN|Infinity/.test(icon));
    assert.match(icon, /viewBox="0 0 48 48"/);
  }
});

test('icon metadata and material attributes cannot inject markup', () => {
  const item = generateItem(4, 1, 'head');
  item.name = '<script>alert("x")</script>'; item.id = '"><svg/onload=alert(1)';
  item.appearance.base = '" onload="alert(1)';
  const icon = itemIconSVG(item, Infinity);
  assert.ok(!icon.includes('<script>')); assert.ok(!icon.includes(' onload='));
  assert.match(icon, /width="48"/); assert.ok(icon.includes('&lt;script&gt;'));
});

test('equipped art follows actual material changes and empties all removed layers explicitly', () => {
  const sheet = createCharacterSheet(), before = outfitFromEquipment(sheet);
  assert.ok(before.head && before.chest && before.shoulders && before.hands && before.cloak);
  const chest = generateItem(819, 3, 'chest'); sheet.equipped.chest = chest;
  const after = outfitFromEquipment(sheet);
  assert.equal(after.chest!.material.base, chest.appearance.base);
  assert.equal(after.shoulders!.material.base, chest.appearance.base);
  chest.appearance.base = '#000000';
  assert.notEqual(after.chest!.material.base, '#000000');
  sheet.equipped.chest = null; sheet.equipped.cloak = null;
  const unequipped = outfitFromEquipment(sheet);
  assert.equal(unequipped.chest, null); assert.equal(unequipped.shoulders, null); assert.equal(unequipped.cloak, null);
  assert.ok(unequipped.head);
});
