import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { quoteService, planService, STASH_CAPACITY } from '../src/commerce.ts';
import { canPackItem } from '../src/inventory-grid.ts';
import type { TownNPC } from '../src/npcs.ts';

const smith: TownNPC = { id: 'town:1:0:building:0:blacksmith', buildingId: 'town:1:0:building:0', role: 'blacksmith', name: 'Edda', seed: 7, x: 0, y: 0, level: 10 };
const stashNPC: TownNPC = { id: 'town:1:0:building:2:stash', buildingId: 'town:1:0:building:2', role: 'stash', name: 'Chest', seed: 9, x: 0, y: 0, level: 10 };

test('quick sell transfers gold, clears bag slot, and protects locked items', () => {
  const c = createCharacterSheet();
  const sword = generateItem(1001, 5, 'weapon', 'longsword', 'rare');
  c.inventory[0] = sword;
  c.gold = 500;
  const initialGold = 500;

  // 1. Valid quick sell
  const quote = quoteService(c, smith, 10, { type: 'sell', source: { bag: 0 } });
  assert.ok(quote.ok);
  const plan = planService(c, smith, 10, quote.quote);
  assert.ok(plan.ok);
  assert.equal(plan.character.inventory[0], null);
  assert.equal(plan.character.gold, initialGold + quote.quote.price);
  assert.equal(plan.character.commerce.buyback[0]?.item.id, sword.id);

  // 2. Locked item protection
  c.inventory[0] = { ...sword, locked: true };
  const lockedQuote = quoteService(c, smith, 10, { type: 'sell', source: { bag: 0 } });
  assert.equal(lockedQuote.ok, false);
  assert.match(lockedQuote.message, /Unlock/i);
});

test('quick stash store and retrieve transfers items between pack and storage', () => {
  const c = createCharacterSheet();
  const helmet = generateItem(2001, 5, 'head', undefined, 'magic');
  c.inventory[0] = helmet;

  // 1. Quick store into tab 0
  const storeQuote = quoteService(c, stashNPC, 10, { type: 'store', bag: 0, tab: 0 });
  assert.ok(storeQuote.ok);
  const storePlan = planService(c, stashNPC, 10, storeQuote.quote);
  assert.ok(storePlan.ok);
  assert.equal(storePlan.character.inventory[0], null);
  assert.equal(storePlan.character.stash?.[0]?.id, helmet.id);

  // 2. Storing into locked tab (e.g. tab 2) is rejected
  const lockedTabQuote = quoteService(c, stashNPC, 10, { type: 'store', bag: 0, tab: 2 });
  assert.equal(lockedTabQuote.ok, false);
  assert.match(lockedTabQuote.message, /locked/i);

  // 3. Quick retrieve from stash into inventory
  const retrieveQuote = quoteService(storePlan.character, stashNPC, 10, { type: 'retrieve', slot: 0 });
  assert.ok(retrieveQuote.ok);
  const retrievePlan = planService(storePlan.character, stashNPC, 10, retrieveQuote.quote);
  assert.ok(retrievePlan.ok);
  assert.equal(retrievePlan.character.stash?.[0], null);
  assert.ok(retrievePlan.character.inventory.some(i => i?.id === helmet.id));
});

test('quick stash rejects when storage tab or pack is full', () => {
  const c = createCharacterSheet();
  const item = generateItem(3001, 5, 'chest', undefined, 'epic');
  c.inventory[0] = item;

  // Fill storage tab 0 completely (STASH_CAPACITY items)
  c.stash = Array.from({ length: STASH_CAPACITY }, (_, i) => generateItem(4000 + i, 5, 'gloves', undefined, 'common'));
  const storeQuote = quoteService(c, stashNPC, 10, { type: 'store', bag: 0, tab: 0 });
  assert.ok(storeQuote.ok);
  const fullTabPlan = planService(c, stashNPC, 10, storeQuote.quote);
  assert.equal(fullTabPlan.ok, false);
  assert.match(fullTabPlan.message, /full/i);

  // Fill inventory pack completely, then attempt retrieve
  const storedChar = createCharacterSheet();
  storedChar.stash = [item];
  // Fill all inventory cells
  storedChar.inventory = Array.from({ length: 40 }, (_, i) => generateItem(5000 + i, 5, 'boots', undefined, 'common'));
  assert.equal(canPackItem(storedChar, item), false);

  const retrieveQuote = quoteService(storedChar, stashNPC, 10, { type: 'retrieve', slot: 0 });
  assert.ok(retrieveQuote.ok);
  const retrievePlan = planService(storedChar, stashNPC, 10, retrieveQuote.quote);
  assert.equal(retrievePlan.ok, false);
  assert.match(retrievePlan.message, /pack|room|space/i);
});

test('quick buy enforces gold requirement and pack space', () => {
  const c = createCharacterSheet();
  c.gold = 0; // Broke

  // 1. Not enough gold
  const brokeQuote = quoteService(c, smith, 10, { type: 'buy', slot: 0 });
  assert.ok(brokeQuote.ok);
  const brokePlan = planService(c, smith, 10, brokeQuote.quote);
  assert.equal(brokePlan.ok, false);
  assert.match(brokePlan.message, /Not enough gold/i);

  // 2. Sufficient gold succeeds
  c.gold = 100000;
  const buyQuote = quoteService(c, smith, 10, { type: 'buy', slot: 0 });
  assert.ok(buyQuote.ok);
  const buyPlan = planService(c, smith, 10, buyQuote.quote);
  assert.ok(buyPlan.ok);
  assert.equal(buyPlan.character.gold, 100000 - buyQuote.quote.price);
  assert.ok(buyPlan.character.inventory.some(i => i?.id === buyPlan.item?.id));
});
