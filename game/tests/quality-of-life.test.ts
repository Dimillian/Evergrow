import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteBulkSale, planBulkSale, BULK_SALE_CHOICES } from '../src/commerce-bulk.ts';
import { itemPrice } from '../src/commerce.ts';
import { executeService } from '../src/commerce-command.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { ITEM_TIERS } from '../src/item-improvement.ts';
import { assignableSkills } from '../src/skill-assignment.ts';
import { executeCharacterCommand, executeEmptySkillAssignment } from '../src/character-commands.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { refreshCharacter } from '../src/character.ts';
import { Simulation } from '../src/simulation.ts';
import { inventoryGridSources, matchesInventoryFilter, sortedItemIndices } from '../src/inventory-tools.ts';
import type { ItemTier, SkillId } from '../src/character-types.ts';
import type { TownNPC } from '../src/npcs.ts';
import type { WorldQuery } from '../src/model.ts';
import { getHUDSkillRect, isHUDPoint } from '../src/hud-layout.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const npc: TownNPC = { id: 'town:7319:0:building:0:blacksmith', buildingId: 'town:7319:0:building:0', role: 'blacksmith', name: 'Edda', seed: 7, x: 0, y: 0, level: 1 };
const populated = () => {
  const sheet = createCharacterSheet('sword-shield');
  ITEM_TIERS.forEach((tier, index) => { sheet.inventory[index * 3] = generateItem(6000 + index, 1, 'head', undefined, tier); });
  return sheet;
};
function quote(sheet: ReturnType<typeof populated>, ceiling: ItemTier) {
  const result = quoteBulkSale(sheet, npc, 1, ceiling); assert.ok(result.ok); return result.quote;
}

test('each sale ceiling includes exactly its rarity and lower, never equipped gear', () => {
  assert.deepEqual(BULK_SALE_CHOICES.map(choice => choice.label), ['All Common', 'Magic and lower', 'Rare and lower', 'Epic and lower', 'All']);
  for (const [index, tier] of ITEM_TIERS.entries()) {
    const sheet = populated(), before = structuredClone(sheet), q = quote(sheet, tier);
    assert.equal(q.items.length, index + 1);
    const result = planBulkSale(sheet, npc, 1, q); assert.ok(result.ok);
    assert.equal(result.character.gold, (sheet.gold ?? 0) + q.price);
    assert.equal(q.price, sheet.inventory.reduce((sum, item) => sum + (item && ITEM_TIERS.indexOf(item.tier) <= index ? itemPrice(item, 'sell') : 0), 0));
    assert.equal(result.character.inventory.filter(Boolean).length, 4 - index);
    assert.deepEqual(result.character.equipped, before.equipped);
    assert.deepEqual(sheet, before, 'planning must not mutate live ownership');
    assert.equal(result.character.commerce.revision, sheet.commerce.revision + 1);
    assert.equal(planBulkSale(result.character, npc, 1, q).ok, false, 'a batch cannot be applied twice');
  }
});

test('bulk sales reject stale ownership, prices, revisions, unsupported service and wallet overflow', () => {
  const base = populated(), q = quote(base, 'epic');
  for (const change of [
    (sheet: typeof base) => { sheet.inventory[0] = null; },
    (sheet: typeof base) => { sheet.inventory[1] = generateItem(7777, 1, 'ring', undefined, 'common'); },
    (sheet: typeof base) => { sheet.inventory[0]!.recipe.revision++; },
    (sheet: typeof base) => { sheet.commerce.revision++; },
    (sheet: typeof base) => { [sheet.inventory[0], sheet.inventory[3]] = [sheet.inventory[3], sheet.inventory[0]]; },
    (sheet: typeof base) => { sheet.gold = Number.MAX_SAFE_INTEGER; },
  ]) {
    const sheet = structuredClone(base); change(sheet); const before = structuredClone(sheet);
    assert.equal(planBulkSale(sheet, npc, 1, q).ok, false); assert.deepEqual(sheet, before);
  }
  assert.equal(planBulkSale(base, npc, 1, { ...q, price: 1 }).ok, false);
  assert.equal(planBulkSale(base, { ...npc, id: 'another-shop' }, 1, q).ok, false);
  assert.equal(quoteBulkSale(base, { ...npc, role: 'enchanter' }, 1, 'common').ok, false);
  assert.equal(quoteBulkSale(base, npc, 1, 'invalid' as ItemTier).ok, false);
  assert.equal(quoteBulkSale(createCharacterSheet(), npc, 1, 'legendary').ok, false);
});

test('a full bag sells in one durable transaction, retains only latest 12 buybacks, and rolls back failures', async () => {
  const sim = new Simulation(world, { spawn: false }), player = sim.player;
  player.x = player.y = 0;
  player.character.inventory = Array.from({ length: 64 }, (_, index) => generateItem(7000 + index, 1, 'head', undefined, 'common'));
  const q = quote(player.character, 'common'), before = structuredClone(player);
  let calls = 0;
  assert.equal((await executeService(player, npc, world, q, async () => { calls++; return { ok: false, message: 'Disk full' }; })).ok, false);
  assert.equal(calls, 1); assert.deepEqual(player, before);
  await assert.rejects(executeService(player, npc, world, q, async () => { throw new Error('Storage unavailable'); }));
  assert.deepEqual(player, before);
  assert.equal((await executeService(player, npc, { ...world, blocked: () => true }, q, async () => { throw new Error('Must not save'); })).ok, false);
  const result = await executeService(player, npc, world, q, async staged => {
    assert.deepEqual(player, before, 'live state waits for durable storage');
    assert.equal(staged.inventory.filter(Boolean).length, 0); calls++; return { ok: true };
  });
  assert.ok(result.ok); assert.equal(calls, 2);
  assert.equal(player.character.commerce.buyback.length, 12);
  assert.deepEqual(player.character.commerce.buyback.map(entry => entry.item.id), before.character.inventory.slice(-12).reverse().map(item => item!.id));
  assert.equal(player.hp, before.hp); assert.equal(player.mana, before.mana);
});

function skilled() {
  const player = new Simulation(world, { spawn: false }).player;
  player.character = createCharacterSheet('sword-shield');
  player.character.allocatedNodes = ['origin', ...Object.keys(SKILL_DEFINITIONS).map(id => `skill:${id}`)];
  refreshCharacter(player); return player;
}

test('quick skill choices exclude locked/assigned/incompatible skills and include usable off-hand skills', () => {
  const player = skilled();
  player.character.skillSlots[0] = 'cleave'; player.mana = 0; player.skillCooldowns.bulwark = 5;
  assert.deepEqual(new Set(assignableSkills(player)), new Set(['lunge', 'whirlwind', 'shieldBash', 'bulwark']));
  player.character.allocatedNodes = player.character.allocatedNodes.filter(id => id !== 'skill:bulwark');
  assert.ok(!assignableSkills(player).includes('bulwark'));
  player.character.equipped.offhand = generateItem(8888, 1, 'weapon', 'cinder-wand', 'common'); refreshCharacter(player);
  const hybrid = assignableSkills(player);
  assert.ok(hybrid.includes('fireball')); assert.ok(hybrid.includes('whirlwind')); assert.ok(!hybrid.includes('shieldBash'));
  player.character.equipped.weapon = generateItem(8889, 1, 'weapon', 'thorn-shortbow', 'common'); player.character.equipped.offhand = null; refreshCharacter(player);
  assert.deepEqual(new Set(assignableSkills(player)), new Set(['volley', 'piercingShot', 'ricochet', 'rainOfArrows']));
  player.character.allocatedNodes = ['origin']; assert.deepEqual(assignableSkills(player), []);
});

test('empty-slot assignment revalidates the slot and candidates, and saves without casting or resource changes', async () => {
  const player = skilled(); player.character.skillSlots[0] = 'cleave'; player.hp = 21; player.mana = 3; player.skillCooldowns.bulwark = 5;
  for (const [slot, skill] of [[0, 'whirlwind'], [1, 'cleave'], [1, 'fireball'], [5, 'whirlwind'], [-1, 'whirlwind']] as [number, SkillId][]) {
    const before = structuredClone(player);
    assert.equal(executeCharacterCommand(player, { type: 'assignEmptySkill', slot, skill }).ok, false); assert.deepEqual(player, before);
  }
  const before = structuredClone(player);
  assert.equal((await executeEmptySkillAssignment(player, 1, 'bulwark', async () => ({ ok: false, message: 'Save failed' }))).ok, false);
  assert.deepEqual(player, before);
  await assert.rejects(executeEmptySkillAssignment(player, 1, 'bulwark', async () => { throw new Error('Save failed'); }));
  assert.deepEqual(player, before);
  assert.ok((await executeEmptySkillAssignment(player, 1, 'bulwark', async staged => {
    assert.deepEqual(player, before); assert.deepEqual(staged.skillSlots, ['cleave', 'bulwark', null, null, null]); return { ok: true };
  })).ok);
  assert.equal(player.hp, 21); assert.equal(player.mana, 3); assert.deepEqual(player.skillCooldowns, before.skillCooldowns);
  assert.deepEqual(player.attack, before.attack); assert.equal(player.castTime, before.castTime);
});

test('sorting and multi-filtering preserve source identities and exact rarity semantics', () => {
  const items = [generateItem(90, 1, 'ring', undefined, 'magic'), null, generateItem(91, 1, 'head', undefined, 'rare'), generateItem(92, 1, 'weapon', 'longsword', 'common')];
  const before = structuredClone(items), order = sortedItemIndices(items, 'rarity');
  assert.deepEqual(order, [2, 0, 3, 1]); assert.deepEqual(items, before);
  assert.deepEqual(inventoryGridSources(items, new Set(['armor', 'jewelry']), new Set(['magic'])), [0, 1, null, null]);
  assert.equal(matchesInventoryFilter(items[2], new Set(), new Set(['magic'])), false);
});

test('empty skill targets use the same rendered HUD coordinates at wide and narrow sizes', () => {
  for (const [width, height] of [[1280, 720], [540, 450], [900, 680]]) {
    let previous = -Infinity;
    for (let slot = 0; slot < 5; slot++) {
      const rect = getHUDSkillRect(slot, width, height);
      assert.ok(rect.x > previous); assert.ok(rect.width > 0 && rect.height > 0);
      assert.ok(isHUDPoint(rect.x + rect.width / 2, rect.y + rect.height / 2, width, height)); previous = rect.x;
    }
  }
});
