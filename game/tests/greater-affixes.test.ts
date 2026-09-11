import test from 'node:test';
import assert from 'node:assert/strict';
import { hasGreaterAffix, isGreaterAffix } from '../src/item-roll-content.ts';
import { generateItem, deriveItem, itemDisplayName } from '../src/items.ts';
import { itemTooltipMarkup, itemSlotMarkup } from '../src/item-ui.ts';
import { createCharacterSheet } from '../src/items.ts';

test('greater quality follows saved percentile, including existing gear and charms, without changing stats', () => {
  for (const kind of ['gloves', 'charm'] as const) {
    const original = generateItem(555, 35, kind, kind === 'charm' ? 'storm-monolith' : undefined, 'legendary');
    original.recipe.rolls = original.recipe.rolls.map(() => .8999);
    const ordinary = deriveItem(original);
    assert.equal(hasGreaterAffix(ordinary), false);
    original.recipe.rolls[0] = .9;
    const greater = deriveItem(original), before = structuredClone(greater);
    assert.equal(isGreaterAffix(greater, 0), true);
    assert.ok(itemDisplayName(greater).endsWith(' ✦'));
    assert.deepEqual(greater, before);
    for (const q of [NaN, Infinity, -1, 1.1]) {
      greater.recipe.rolls[0] = q;
      assert.equal(isGreaterAffix(greater, 0), false);
    }
  }
});

test('discrete skill ranks and fixed pierce are not continuous greater rolls', () => {
  const item = generateItem(99, 80, 'weapon', 'ember-staff', 'legendary');
  item.affixes = [{name:'Piercing',stat:'projectilePierce',value:1}, {name:'Fireball',stat:'skill:fireball',value:5}];
  item.recipe.rolls = [1, 1];
  assert.equal(hasGreaterAffix(item), false);
  assert.equal(isGreaterAffix(item, 3), false);
});

test('name, tile and only qualifying affix rows carry the same quality distinction', () => {
  const item = generateItem(99, 35, 'weapon', 'ember-staff', 'legendary');
  item.recipe.rolls = item.recipe.rolls.map((_, i) => i === 0 || i === 2 ? .97 : .5);
  const gear = deriveItem(item);
  const content = itemTooltipMarkup(gear, {sheet:createCharacterSheet(), level:35, compare:false});
  assert.equal((content.match(/aria-label="Greater affix/g) ?? []).length, 3);
  assert.match(content, /<h4>Ashen Echo <span class="ui-greater-affix"/);
  assert.match(content, /<span class="ui-greater-affix".*?<\/span>Spell damage/);
  assert.match(content, /<span>Mana \/ 5 sec<\/span>/);
  assert.match(itemSlotMarkup(gear), /ui-item-greater/);
  gear.recipe.enhancement = 3;
  assert.equal(itemDisplayName(gear), 'Ashen Echo +3 ✦');
  gear.recipe.rolls.fill(.5);
  assert.doesNotMatch(itemSlotMarkup(gear), /ui-item-greater/);
});
