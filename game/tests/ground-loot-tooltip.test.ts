import test from 'node:test';
import assert from 'node:assert/strict';
import { groundLootCards, groundComparisonRows, groundSummaryRows, GroundComparisonInput } from '../src/ground-loot-tooltip.ts';
import { initialPlayer } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { itemHoverCards } from '../src/item-ui.ts';
import type { EquipmentStatChange } from '../src/equipment-preview.ts';

test('ground two-handed inspection is one card, Alt combines both displaced hands into one extra panel', () => {
  const p = initialPlayer(0, 0);
  for (const [index, kind, profile] of [[0, 'weapon', 'longsword'], [1, 'shield', 'iron-buckler']] as const) {
    p.character.inventory[index] = generateItem(1010 + index, 1, kind, profile, 'common');
    assert.ok(executeCharacterCommand(p, { type: 'equip', index }).ok);
  }
  const incoming = generateItem(1200, 1, 'weapon', 'ember-staff', 'rare');
  const view = { sheet: p.character, level: p.level };
  const before = structuredClone(p);
  const compact = groundLootCards(incoming, view);
  assert.equal(compact.length, 1);
  assert.match(compact[0], /Replaces main hand \+ shield/);
  assert.match(compact[0], /Alt.*Full comparison/);
  assert.ok((compact[0].match(/class="ui-item-property ground-equip-change"/g) ?? []).length <= 4);
  const full = groundLootCards(incoming, view, true);
  assert.equal(full.length, 2);
  assert.equal((full[1].match(/class="ground-equipped-item"/g) ?? []).length, 2);
  assert.match(full[1], /Block chance/);
  assert.match(full[1], /Equipped · main hand/);
  assert.match(full[1], /Equipped · off hand/);
  assert.equal(itemHoverCards(incoming, view).length, 2, 'inventory/vendor comparison consolidates displaced hands');
  assert.deepEqual(p, before);
});

test('equal resistance losses collapse while capped/unequal losses remain exact', () => {
  const keys = ['fireResistance', 'frostResistance', 'lightningResistance', 'arcaneResistance'] as const;
  const changes: EquipmentStatChange[] = keys.map(key => ({ key, before: .06, after: 0 }));
  assert.deepEqual(groundComparisonRows(changes), [{ key: 'allResistance', label: 'All elemental resistances', delta: -6, percent: true }]);
  changes[0].before = .03;
  assert.equal(groundComparisonRows(changes).length, 4);
  assert.equal(groundComparisonRows(changes.slice(1)).length, 3);
});

test('summary prioritizes direct damage, life, armor and resistance with four rows maximum', () => {
  const changes: EquipmentStatChange[] = ['intelligence', 'maxMana', 'armor', 'damage', 'maxHp', 'fireResistance'].map(key => ({ key: key as EquipmentStatChange['key'], before: 1, after: 2 }));
  assert.deepEqual(groundSummaryRows(groundComparisonRows(changes)).map(row => row.key), ['damage', 'maxHp', 'armor', 'fireResistance']);
});

test('unusable items retain item data and failure reason without a misleading comparison', () => {
  const p = initialPlayer(0, 0), item = generateItem(1818, 50, 'head');
  const cards = groundLootCards(item, { sheet: p.character, level: 1 }, true);
  assert.equal(cards.length, 1);
  assert.match(cards[0], /Requires level/);
  assert.doesNotMatch(cards[0], /ground-equip-change/);
});

test('Alt disclosure updates on press/release, resets on blur and removes listeners on disposal', () => {
  const target = new EventTarget(), life = new AbortController();
  let changes = 0;
  const input = new GroundComparisonInput(target, () => changes++, life.signal);
  const key = (type: string, altKey: boolean) => target.dispatchEvent(Object.assign(new Event(type), { key: 'Alt', altKey }));
  key('keydown', true); assert.equal(input.expanded, true);
  target.dispatchEvent(Object.assign(new Event('pointerover'), { altKey: false }));
  assert.equal(input.expanded, true, 'layout-generated pointer entry cannot release a held key');
  key('keydown', true); assert.equal(changes, 1);
  key('keyup', false); assert.equal(input.expanded, false);
  key('keydown', true); target.dispatchEvent(new Event('blur')); assert.equal(input.expanded, false);
  life.abort(); key('keydown', true); assert.equal(input.expanded, false);
});
