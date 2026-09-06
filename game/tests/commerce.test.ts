import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem, deriveItem, ITEM_KINDS, STARTER_LOADOUTS, createStarterLoadout, TIER_AFFIXES } from '../src/items.ts';
import { vendorStock, quoteService, planService, improvementPrice, itemPrice, type ServiceRequest } from '../src/commerce.ts';
import { improveItem, ITEM_TIERS } from '../src/item-improvement.ts';
import { buildingNPC, canInteractNPC, focusNPC, type TownNPC } from '../src/npcs.ts';
import { World } from '../src/world.ts';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { executeService } from '../src/commerce-command.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { validItem } from '../src/item-validation.ts';
import type { CharacterSheet } from '../src/character-types.ts';

const smith: TownNPC = { id: 'town:7319:0:building:0:blacksmith', buildingId: 'town:7319:0:building:0', role: 'blacksmith', name: 'Edda', seed: 7, x: 0, y: 0, level: 10 };
const jeweler: TownNPC = { ...smith, role: 'jeweler', id: 'town:7319:0:building:1:jeweler' };
const enchanter: TownNPC = { ...smith, role: 'enchanter', id: 'town:7319:0:building:3:enchanter' };
const sheet = () => { const c = createCharacterSheet(); c.gold = 1e9; return c; };
function quoted(c: CharacterSheet, npc: TownNPC, request: ServiceRequest, level = 10) {
  const q = quoteService(c, npc, level, request); assert.ok(q.ok, q.ok ? '' : q.message); return q.quote;
}
function trade(c: CharacterSheet, npc: TownNPC, request: ServiceRequest, level = 10) {
  const result = planService(c, npc, level, quoted(c, npc, request, level)); assert.ok(result.ok, result.ok ? '' : result.message); return result;
}
test('stock is deterministic, visible jewelry only, varied equipment and distinct issuance per vendor/epoch', () => {
  const c = sheet(), stock = vendorStock(c, smith, 10);
  assert.equal(stock.length, 12); assert.deepEqual(stock, vendorStock(c, smith, 12));
  assert.equal(stock[0]!.weapon!.family, 'sword'); assert.equal(stock[1]!.weapon!.family, 'bow'); assert.equal(stock[2]!.weapon!.family, 'staff');
  assert.ok(stock.every(i => i?.itemLevel === 10 && validItem(i)));
  const jewelry = vendorStock(c, jeweler, 10); assert.equal(jewelry.length, 8);
  assert.equal(jewelry.filter(i => i!.kind === 'ring').length, 4); assert.equal(jewelry.filter(i => i!.kind === 'amulet').length, 2);
  assert.ok(!vendorStock(c, smith, 13).some(i => stock.some(j => j!.id === i!.id)));
  assert.deepEqual(vendorStock(c, enchanter, 10), []);
});
test('buy/sell/buyback transfers one exact instance and replayed quotes cannot charge twice', () => {
  const c = sheet(), original = JSON.stringify(c), q = quoted(c, smith, { type: 'buy', slot: 0 });
  const bought = planService(c, smith, 10, q); assert.ok(bought.ok); assert.equal(JSON.stringify(c), original);
  assert.equal(bought.character.gold, c.gold! - q.price); assert.equal(vendorStock(bought.character, smith, 10)[0], null);
  assert.equal(planService(bought.character, smith, 10, q).ok, false);
  const sold = trade(bought.character, smith, { type: 'sell', source: { bag: 0 } });
  assert.equal(sold.character.inventory[0], null); assert.equal(sold.character.commerce.buyback[0].item.id, bought.item.id);
  const back = trade(sold.character, jeweler, { type: 'buyback', id: bought.item.id });
  assert.deepEqual(back.item, bought.item); assert.equal(back.character.commerce.buyback.length, 0);
  assert.equal(back.character.gold, bought.character.gold);
});
test('capacity, insufficient funds, forged price, stale source and unsupported services leave original state untouched', () => {
  const c = sheet(), q = quoted(c, smith, { type: 'buy', slot: 0 });
  const original = JSON.stringify(c);
  assert.equal(planService(c, smith, 10, { ...q, price: 0 }).ok, false);
  assert.equal(planService(c, enchanter, 10, q).ok, false);
  c.gold = 0; assert.equal(planService(c, smith, 10, q).ok, false);
  c.gold = 1e9; c.inventory = Array.from({ length: 64 }, (_, i) => generateItem(i, 1));
  assert.equal(planService(c, smith, 10, q).ok, false);
  const sell = quoted(c, smith, { type: 'sell', source: { bag: 0 } }); c.inventory[0] = generateItem(999, 1);
  const before = JSON.stringify(c); assert.equal(planService(c, smith, 10, sell).ok, false); assert.equal(JSON.stringify(c), before);
  assert.equal(quoteService(c, smith, 10, { type: 'sell', source: { equipped: 'weapon' } }).ok, false);
  assert.notEqual(JSON.stringify(c), original);
});
test('restocking uses character level epochs; reload and town reconstruction never refill purchases', () => {
  const bought = trade(sheet(), smith, { type: 'buy', slot: 2 });
  const restored = JSON.parse(JSON.stringify(bought.character));
  assert.equal(vendorStock(restored, { ...smith }, 12)[2], null);
  assert.notEqual(vendorStock(restored, smith, 13)[2], null);
  const next = trade(restored, smith, { type: 'buy', slot: 1 }, 13);
  assert.equal(next.character.commerce.epoch, 4); assert.equal(next.character.commerce.sold[smith.id], 2);
});
test('buyback keeps last twelve exact sales and never refunds crafting investments', () => {
  let c = sheet();
  for (let i = 0; i < 13; i++) { c.inventory[0] = generateItem(i, 1); c = trade(c, smith, { type: 'sell', source: { bag: 0 } }).character; }
  assert.equal(c.commerce.buyback.length, 12); assert.equal(c.commerce.buyback[0].item.seed, 12); assert.equal(c.commerce.buyback[11].item.seed, 1);
  const item = generateItem(15, 10, 'ring', undefined, 'rare');
  assert.equal(itemPrice(improveItem(item, 'enhance', 10, 1), 'sell'), itemPrice(item, 'sell'));
  assert.ok(itemPrice(item, 'sell') < itemPrice(item, 'buy'));
});
test('all item kinds derive consistently and +10 is bounded without compounding rounded stats', () => {
  for (const kind of ITEM_KINDS) {
    const item = generateItem(190, 10, kind, undefined, 'rare');
    assert.deepEqual(deriveItem(item), item);
    let enhanced = item;
    for (let n = 1; n <= 10; n++) { enhanced = improveItem(enhanced, 'enhance', 10, n); assert.equal(enhanced.recipe.enhancement, n); assert.ok(validItem(enhanced)); }
    assert.equal(enhanced.id, item.id); assert.deepEqual(enhanced.recipe.rolls, item.recipe.rolls);
    assert.throws(() => improveItem(enhanced, 'enhance', 10, 1));
  }
  for (const choice of STARTER_LOADOUTS) {
    const loadout = createStarterLoadout(choice.id);
    if (loadout.offhand) {
      assert.deepEqual(deriveItem(loadout.offhand), loadout.offhand, 'starter off-hand keeps its authored bonuses during derivation');
      const improved = improveItem(loadout.offhand, 'enhance', 1, 1);
      assert.ok(validItem(improved));
      for (const [stat, value] of Object.entries(loadout.offhand.implicit)) assert.ok(improved.implicit[stat as keyof typeof improved.implicit]! >= value!);
    }
    const item = loadout.weapon, next = improveItem(item, 'enhance', 1, 1);
    assert.equal(next.weapon!.damage, Math.round(item.weapon!.damage * 1.05)); assert.equal(next.weapon!.baseAttacksPerSecond, item.weapon!.baseAttacksPerSecond);
  }
});
test('enhancement, rarity and level preserve roll quality and commute to equivalent final stats', () => {
  const item = generateItem(89, 10, 'weapon', 'storm-staff', 'magic');
  const a = improveItem(improveItem(improveItem(item, 'enhance', 10, 1), 'rarity', 10, 34), 'relevel', 30, 1);
  const b = improveItem(improveItem(improveItem(item, 'relevel', 30, 1), 'rarity', 30, 34), 'enhance', 30, 1);
  assert.deepEqual(a, b); assert.equal(a.recipe.rolls[0], item.recipe.rolls[0]); assert.equal(a.requiredLevel, 28);
  assert.equal(a.affixes[0].stat, item.affixes[0].stat); assert.equal(a.recipe.profileId, 'storm-staff');
});
test('rarity progresses exactly once with no duplicate affixes; targeted reroll preserves all other properties', () => {
  let item = generateItem(43, 20, 'shield', 'vigil-kite', 'common');
  for (const tier of ITEM_TIERS.slice(1)) { item = improveItem(item, 'rarity', 20, 16); assert.equal(item.tier, tier); assert.equal(item.affixes.length, TIER_AFFIXES[tier]); assert.ok(validItem(item)); }
  assert.throws(() => improveItem(item, 'rarity', 20, 1));
  const next = improveItem(item, 'rerollOne', 20, 983, 1);
  assert.notEqual(next.affixes[1].stat, item.affixes[1].stat);
  assert.deepEqual(next.affixes.filter((_, i) => i !== 1), item.affixes.filter((_, i) => i !== 1));
  assert.equal(next.recipe.targetedRolls, 1); assert.equal(next.recipe.fullRolls, 0);
  assert.deepEqual(next.implicit, item.implicit); assert.deepEqual(next.appearance, item.appearance);
  const all = improveItem(next, 'rerollAll', 20, 456);
  assert.equal(all.affixes.length, 4); assert.equal(new Set(all.affixes.map(a => a.stat)).size, 4); assert.equal(all.recipe.fullRolls, 1);
  assert.equal(all.recipe.targetedRolls, 1); assert.ok(validItem(all));
});
test('prices match the specification, rise with repeat use and reject numeric overflow', () => {
  const item = generateItem(51, 10, 'weapon', 'longsword', 'rare');
  assert.equal(improvementPrice(item, 'enhance', 10), 855); assert.equal(improvementPrice(item, 'rarity', 10), 5472);
  assert.equal(improvementPrice(item, 'relevel', 15), 4950); assert.equal(improvementPrice(item, 'rerollOne', 10), 4275);
  assert.equal(improvementPrice(item, 'rerollAll', 10), 1425);
  const c = sheet(); c.inventory[0] = { ...item, recipe: { ...item.recipe, targetedRolls: 10000 } };
  assert.equal(quoteService(c, enchanter, 10, { type: 'improve', source: { bag: 0 }, operation: 'rerollOne', affix: 0 }).ok, false);
  for (let i = 1; i <= 100; i++) {
    const base = generateItem(i, i * 10, 'weapon', 'longsword', 'common');
    const raised = improveItem(base, 'rarity', base.itemLevel, 1);
    assert.ok(itemPrice(raised, 'sell') - itemPrice(base, 'sell') < improvementPrice(base, 'rarity', base.itemLevel));
  }
});
test('relevel is zone-based and rejects invalid equipped requirements before payment', () => {
  const c = sheet(); c.equipped.weapon = generateItem(1, 1, 'weapon');
  assert.equal(quoteService(c, enchanter, 1, { type: 'improve', source: { equipped: 'weapon' }, operation: 'relevel' }).ok, false);
  c.inventory[0] = c.equipped.weapon; c.equipped.weapon = null;
  const q = quoted(c, enchanter, { type: 'improve', source: { bag: 0 }, operation: 'relevel' }, 1);
  const plan = planService(c, enchanter, 1, q); assert.ok(plan.ok); assert.equal(plan.item.itemLevel, 10);
  assert.equal(plan.item.requiredLevel, 8);
});
test('real towns have stable reachable NPCs at all three service buildings without geometry mutations', () => {
  const world = new World(7319);
  const buildings = world.getBuildings(-2000, -2400, 4000, 2000), before = JSON.stringify(buildings);
  const npcs = buildings.flatMap(b => { const npc = buildingNPC(b); return npc ? [npc] : []; });
  assert.ok(npcs.some(n => n.role === 'blacksmith')); assert.ok(npcs.some(n => n.role === 'jeweler')); assert.ok(npcs.some(n => n.role === 'enchanter'));
  for (const npc of npcs) {
    assert.equal(world.blocked(npc.x, npc.y, 9), false);
    assert.ok(canInteractNPC(npc, { x: npc.x, y: npc.y + 24 }, world));
    assert.equal(focusNPC([npc], { x: npc.x, y: npc.y + 24 }, world)?.id, npc.id);
    assert.equal(canInteractNPC(npc, { x: npc.x + 100, y: npc.y }, world), false);
    assert.equal(canInteractNPC(npc, { x: npc.x, y: npc.y, dead: true }, world), false);
  }
  assert.equal(JSON.stringify(buildings), before); world.dispose();
});
test('save-backed trade commits exactly once, preserves resources and rolls back on failed storage', () => {
  const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false }); const p = sim.player;
  p.x = 0; p.y = 0; p.character.gold = 10000; p.hp = 40; p.mana = 20;
  const npc = { ...smith, level: 1 }, data = new Map<string, string>(); let reject = false;
  const session = new CharacterSession(new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (reject) throw new Error('quota'); data.set(k, v); } }), 7319, 4);
  assert.ok(session.create(0, 'Mara', sim.captureCheckpoint(), 'trade-character', 1));
  const persist = (character: CharacterSheet, hp: number, mana: number) => ({ ok: session.save({ ...sim.captureCheckpoint(), character, hp, mana }, 2), message: session.error });
  const q = quoted(p.character, npc, { type: 'buy', slot: 0 }, 1), before = JSON.stringify(p);
  reject = true; assert.equal(executeService(p, npc, world, q, persist).ok, false); assert.equal(JSON.stringify(p), before);
  reject = false; assert.ok(executeService(p, npc, world, q, persist).ok); assert.equal(p.hp, 40); assert.equal(p.mana, 20);
  const record = session.repository.read(0).record!; assert.deepEqual(record.checkpoint.character, p.character);
  assert.equal(executeService(p, npc, world, q, persist).ok, false);
  const duplicate = JSON.parse(JSON.stringify(record)); duplicate.checkpoint.character.commerce.buyback.push({ item: p.character.inventory[0], price: 1 });
  assert.equal(decodeCharacterSave(JSON.stringify(duplicate)), null);
  const malformed = JSON.parse(JSON.stringify(record)); malformed.checkpoint.character.inventory[0].recipe.enhancement = 11;
  assert.equal(decodeCharacterSave(JSON.stringify(malformed)), null);
});

test('vendor mask capacity never restores sold items and worst-case bounded commerce fits a checkpoint', () => {
  const c = sheet();
  for (let i = 0; i < 2048; i++) c.commerce.sold[`town:7319:${i}:building:0:blacksmith`] = 1;
  c.commerce.epoch = 3;
  assert.equal(vendorStock(c, smith, 10)[0], null);
  assert.deepEqual(vendorStock(c, { ...smith, id: 'town:7319:2049:building:0:blacksmith' }, 10), []);
  assert.equal(vendorStock(c, smith, 13).length, 12);
  const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false });
  sim.player.level = 10; sim.player.character = c; c.statPoints = 45; c.skillPoints = 9;
  c.inventory = Array.from({ length: 64 }, (_, i) => generateItem(9000 + i, 10, undefined, undefined, 'legendary'));
  c.commerce.buyback = Array.from({ length: 12 }, (_, i) => ({ item: generateItem(10000 + i, 10, undefined, undefined, 'legendary'), price: 100 }));
  const data = new Map<string, string>(), repo = new CharacterRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const session = new CharacterSession(repo, 7319, 4);
  const checkpoint = sim.captureCheckpoint();
  checkpoint.groundItems = Array.from({ length: 96 }, (_, i) => ({ id: i + 1, x: 0, y: 0, item: generateItem(11000 + i, 10, undefined, undefined, 'legendary') }));
  assert.ok(session.create(0, 'Capacity', checkpoint, 'capacity-test', 1), session.error);
  const record = repo.read(0).record!; assert.ok(JSON.stringify(record).length < 700000);
  const inconsistent = JSON.parse(JSON.stringify(record));
  const stock = vendorStock(sheet(), smith, 10)[1]!; inconsistent.checkpoint.character.inventory[0] = stock;
  assert.equal(decodeCharacterSave(JSON.stringify(inconsistent)), null, 'available stock cannot simultaneously be owned');
});
test('stale writer and blocked NPC reject transactions before publishing any player changes', () => {
  const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false }); const p = sim.player; p.x = 0; p.y = 0; p.character.gold = 9999;
  const npc = { ...smith, level: 1 }, q = quoted(p.character, npc, { type: 'buy', slot: 0 }, 1), before = JSON.stringify(p);
  let persisted = false;
  assert.equal(executeService(p, npc, { ...world, blocked: () => true }, q, () => { persisted = true; return { ok: true }; }).ok, false);
  assert.equal(persisted, false); assert.equal(JSON.stringify(p), before);
  assert.equal(executeService(p, npc, world, q, () => ({ ok: false, message: 'Changed in another tab' })).ok, false);
  assert.equal(JSON.stringify(p), before);
});


test('equipped upgrades persist in place with an empty bag and immediately refresh live stats', () => {
  const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false }), p = sim.player;
  p.x = 0; p.y = 0; p.level = 10; p.character.gold = 1e7; p.character.statPoints = 45; p.character.skillPoints = 9;
  p.character.equipped.weapon = generateItem(650, 1, 'weapon', 'longsword', 'common');
  p.character.equipped.offhand = generateItem(651, 1, 'shield', 'vigil-kite', 'common');
  refreshCharacter(p); p.hp = 30; p.mana = 15;
  const data = new Map<string, string>(), session = new CharacterSession(new CharacterRepository({
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); },
  }), 7319, 4);
  assert.ok(session.create(0, 'Worn upgrades', sim.captureCheckpoint(), 'equipped-upgrades', 1));
  const persist = (character: CharacterSheet, hp: number, mana: number) => ({ ok: session.save({ ...sim.captureCheckpoint(), character, hp, mana }, 2), message: session.error });
  for (const slot of ['weapon', 'offhand'] as const) {
    const original = p.character.equipped[slot]!, id = original.id;
    for (const operation of ['enhance', 'rarity', 'rerollOne', 'rerollAll', 'relevel'] as const) {
      const npc = operation === 'enhance' ? smith : enchanter;
      const q = quoted(p.character, npc, { type: 'improve', source: { equipped: slot }, operation, affix: 0 });
      assert.ok(executeService(p, npc, world, q, persist).ok, operation);
      assert.equal(p.character.equipped[slot]!.id, id);
      assert.ok(p.character.inventory.every(i => i === null));
      assert.equal(p.hp, 30); assert.equal(p.mana, 15);
      assert.deepEqual(session.repository.read(0).record!.checkpoint.character, p.character);
      assert.equal(executeService(p, npc, world, q, persist).ok, false);
    }
    assert.equal(p.character.equipped[slot]!.recipe.enhancement, 1);
    assert.equal(p.character.equipped[slot]!.itemLevel, 10);
    assert.ok(p.character.equipped[slot]!.weapon?.damage! > original.weapon?.damage! || slot === 'offhand');
  }
  const projection = JSON.stringify({ derived: p.derived });
  refreshCharacter(p);
  assert.equal(JSON.stringify({ derived: p.derived }), projection);
});
