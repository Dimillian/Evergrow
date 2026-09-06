import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem, ITEM_KINDS } from '../src/items.ts';
import { itemIconSVG, itemDropShapes, outfitFromEquipment } from '../src/item-art.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { armorShapes } from '../src/armor-shapes.ts';

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

test('ground gear has bounded profile-specific geometry cached only for its item lifetime', () => {
  const items = [...ITEM_KINDS.map(kind => generateItem(819, 3, kind)),
    ...WEAPON_PROFILES.map(profile => generateItem(819, 3, 'weapon', profile.id)),
    ...SHIELD_PROFILES.map(profile => generateItem(819, 3, 'shield', profile.id))];
  for (const item of items) {
    const shapes = itemDropShapes(item);
    assert.ok(shapes.length > 0 && shapes.length < 100, `${item.name} has bounded procedural geometry`);
    assert.equal(itemDropShapes(item), shapes, 'unchanged field loot does not regenerate every frame');
    for (const shape of shapes) for (const [x, y] of shape.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(Math.abs(x) <= 11.001 && Math.abs(y) <= 11.001, 'every family fits the drop presentation envelope');
    }
  }
  const weapons = WEAPON_PROFILES.map(profile => itemDropShapes(generateItem(819, 3, 'weapon', profile.id)));
  assert.equal(new Set(weapons.map(shapes => JSON.stringify(shapes.map(shape => shape.points)))).size, WEAPON_PROFILES.length,
    'every weapon profile retains its actual silhouette on the ground');
});

test('helmet and cuirass icons reuse the actual equipped plate geometry', () => {
  for (const kind of ['head', 'chest'] as const) {
    const item = generateItem(8901, 7, kind), { style, base, shadow, edge, trim } = item.appearance;
    const actual = armorShapes(kind, { style, seed: item.seed, material: { base, shadow, edge, trim } });
    for (const size of [48, 120]) {
      const icon = itemIconSVG(item, size);
      for (const shape of actual.filter(shape => size >= 96 || !shape.fine)) {
        const points = shape.points.map(p => p.map(v => Math.round(v * 100) / 100).join(',')).join(' ');
        assert.ok(icon.includes(`points="${points}"`), `${kind} icon preserves its mounted geometry at ${size}px`);
      }
    }
  }
});
