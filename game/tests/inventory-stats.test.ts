import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { initialPlayer } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { characterStatDetails } from '../src/character-stat-details.ts';
import { generateItem } from '../src/items.ts';

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { InventoryStats } = await import('../src/inventory-stats.ts');
css.deregister();

// Real stat projection and commands; a small DOM boundary keeps tests save-free.
function setup() {
  const values = new Map<string, { textContent: string }>();
  const pane = () => ({ set innerHTML(markup: string) {
    for (const match of markup.matchAll(/data-inventory-stat="([^"]+)"/g)) values.set(match[1], { textContent: '' });
  } });
  const attributes = pane(), details = pane(), points = { textContent: '' };
  const element = {
    hidden: true, dataset: { canAllocate: 'true' },
    querySelector(selector: string) { return selector === '.inventory-stats-attributes' ? attributes : selector === '.inventory-stats-details' ? details : points; },
    querySelectorAll(selector: string) {
      return selector === '[data-inventory-stat]' ? [...values].map(([id, value]) => ({ dataset: { inventoryStat: id }, querySelector: () => value })) : [];
    },
  };
  const card = Object.assign(Object.create(InventoryStats.prototype), { element, details: new Map(), signature: '', player: null, tooltip: { hide() {} } }) as InstanceType<typeof InventoryStats>;
  return { card, element, values, points };
}

test('hidden inventory stats defer rendering and show every current attribute and substat on expansion', () => {
  const { card, values, points } = setup(), player = initialPlayer(0, 0);
  card.refresh(player); assert.equal(values.size, 0);
  player.character.statPoints = 3;
  card.setVisible(true);
  const expected = characterStatDetails(player).flatMap(group => group.rows);
  assert.deepEqual([...values].map(([id, value]) => [id, value.textContent]), expected.map(row => [row.id, row.value]));
  assert.equal(points.textContent, '3 available');
});

test('equipping and unequipping update the visible stats without rebuilding unchanged rows or healing', () => {
  const { card, values } = setup(), player = initialPlayer(0, 0);
  player.hp = 12; player.mana = 10;
  const armor = generateItem(722, 1, 'head', undefined, 'rare');
  player.character.inventory[0] = armor;
  card.refresh(player); card.setVisible(true);
  const before = values.get('armor')!.textContent, node = values.get('armor');
  assert.equal(executeCharacterCommand(player, { type: 'equip', index: 0, slot: 'head' }).ok, true);
  card.refresh(player);
  assert.notEqual(values.get('armor')!.textContent, before);
  assert.equal(values.get('armor'), node, 'stat focus targets survive ordinary equipment refreshes');
  assert.equal(executeCharacterCommand(player, { type: 'unequip', slot: 'head' }).ok, true);
  card.refresh(player);
  assert.equal(values.get('armor')!.textContent, characterStatDetails(player).flatMap(group => group.rows).find(row => row.id === 'armor')!.value);
  assert.equal(player.hp, 12); assert.equal(player.mana, 10);
});

test('allocation updates primary and derived values and collapsed cards catch up when reopened', () => {
  const { card, values, points } = setup(), player = initialPlayer(0, 0);
  player.character.statPoints = 2;
  card.refresh(player); card.setVisible(true);
  const life = values.get('maxHp')!.textContent;
  assert.equal(executeCharacterCommand(player, { type: 'allocateAttribute', attribute: 'vitality', amount: 10 }).ok, true);
  card.refresh(player);
  assert.equal(points.textContent, 'All assigned');
  assert.equal(values.get('vitality')!.textContent, '12');
  assert.notEqual(values.get('maxHp')!.textContent, life);
  card.setVisible(false); player.character.statPoints = 1;
  assert.equal(executeCharacterCommand(player, { type: 'allocateAttribute', attribute: 'strength' }).ok, true);
  card.refresh(player); assert.equal(values.get('strength')!.textContent, '10');
  card.setVisible(true); assert.equal(values.get('strength')!.textContent, '11');
});
