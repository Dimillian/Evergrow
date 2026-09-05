import type { CharacterSheet, Item, ItemTier, EquipmentSlot } from './character-types.ts';
import { generateItem, randomSource, itemDisplayName } from './items.ts';
import { creditGold, spendGold, goldBalance } from './wallet.ts';
import { hashService, type TownNPC } from './npcs.ts';
import { improveItem, improvementProblem, ITEM_TIERS, type Improvement } from './item-improvement.ts';

export const COMMERCE_LIMITS = { vendors: 2048, buyback: 12 } as const;
const RARITY_COST: Record<ItemTier, number> = { common: 1, magic: 2, rare: 5, epic: 12, legendary: 30 };
export const stockEpoch = (level: number) => Math.floor((level - 1) / 3);
const budget = (level: number) => 30 + 3 * (level - 1);
export function itemPrice(item: Item, mode: 'buy' | 'sell'): number {
  return mode === 'sell' ? Math.floor(.15 * budget(item.itemLevel) * RARITY_COST[item.tier])
    : Math.ceil(budget(item.itemLevel) * RARITY_COST[item.tier] * (item.kind === 'ring' || item.kind === 'amulet' ? 2.5 : 1));
}
export function improvementPrice(item: Item, operation: Improvement, zoneLevel: number): number {
  const r = item.recipe, base = budget(item.itemLevel) * RARITY_COST[item.tier], h = 1 + .1 * r.enhancement;
  switch (operation) {
    case 'enhance': return Math.ceil(3 * base * 1.65 ** r.enhancement);
    case 'rarity': return Math.ceil(8 * budget(item.itemLevel) * (RARITY_COST[ITEM_TIERS[ITEM_TIERS.indexOf(item.tier) + 1]] ?? Infinity) * h);
    case 'rerollOne': return Math.ceil(15 * base * h * 1.25 ** r.targetedRolls);
    case 'rerollAll': return Math.ceil(5 * base * h * 1.2 ** r.fullRolls);
    case 'relevel': return Math.ceil(3 * RARITY_COST[item.tier] * h * (zoneLevel - item.itemLevel)
      * (budget(item.itemLevel + 1) + budget(zoneLevel)) / 2);
  }
}
export function vendorStock(sheet: CharacterSheet, npc: TownNPC, level: number): Array<Item | null> {
  if (npc.role === 'enchanter') return [];
  const epoch = stockEpoch(level), state = sheet.commerce;
  const sold = state.epoch === epoch ? state.sold : {};
  if (!Object.hasOwn(sold, npc.id) && Object.keys(sold).length >= COMMERCE_LIMITS.vendors) return [];
  const count = npc.role === 'jeweler' ? 6 : 12;
  return Array.from({ length: count }, (_, slot) => {
    if ((sold[npc.id] ?? 0) & 1 << slot) return null;
    const id = `stock:${npc.id}:${epoch}:${slot}`, seed = hashService(id), random = randomSource(seed ^ 0x674af7c1), roll = random() * 100;
    const weights = npc.role === 'jeweler' ? [0, 60, 35, 4.8, .2] : [55, 35, 9, 1, 0];
    let total = 0; const tier = ITEM_TIERS[weights.findIndex(weight => { total += weight; return roll < total; })];
    const kind = npc.role === 'jeweler' ? slot < 4 ? 'ring' : 'amulet'
      : (['weapon', 'weapon', 'weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'weapon', 'shield'] as const)[slot];
    const profile = npc.role === 'blacksmith' ? ['longsword', 'thorn-shortbow', 'ember-staff'][slot] : undefined;
    const item = generateItem(seed, npc.level, kind, profile, tier); item.id = id;
    if (item.weapon) item.weapon.id = id;
    if (item.shield) item.shield.id = id;
    return item;
  });
}
export type ItemSource = { bag: number } | { equipped: EquipmentSlot };
export type ServiceRequest = { type: 'buy'; slot: number } | { type: 'sell'; source: ItemSource }
  | { type: 'buyback'; id: string } | { type: 'improve'; source: ItemSource; operation: Improvement; affix?: number };
export interface ServiceQuote { npcId: string; revision: number; epoch: number; itemId: string; itemRevision: number; price: number; request: ServiceRequest; }
export type QuoteResult = { ok: false; message: string } | { ok: true; quote: ServiceQuote; item: Item };
export function sourceItem(sheet: CharacterSheet, source: ItemSource): Item | null {
  return 'bag' in source ? Number.isInteger(source.bag) ? sheet.inventory[source.bag] ?? null : null : sheet.equipped[source.equipped] ?? null;
}
export function quoteService(sheet: CharacterSheet, npc: TownNPC, level: number, request: ServiceRequest): QuoteResult {
  let item: Item | null = null, price = 0;
  const fail = (message: string): QuoteResult => ({ ok: false, message });
  if (request.type === 'buy' || request.type === 'sell' || request.type === 'buyback') {
    if (npc.role === 'enchanter') return fail('This service is not available here.');
    if (request.type === 'buy') { item = vendorStock(sheet, npc, level)[request.slot] ?? null; if (item) price = itemPrice(item, 'buy'); }
    else if (request.type === 'buyback') { const entry = sheet.commerce.buyback.find(b => b.item.id === request.id); item = entry?.item ?? null; price = entry?.price ?? 0; }
    else { if ('equipped' in request.source) return fail('Unequip this item before selling.'); item = sourceItem(sheet, request.source); if (item) price = itemPrice(item, 'sell'); }
  } else {
    if (npc.role === 'jeweler' || (request.operation === 'enhance') !== (npc.role === 'blacksmith')) return fail('This service is not available here.');
    item = sourceItem(sheet, request.source);
    if (item) {
      const problem = improvementProblem(item, request.operation, npc.level, request.affix); if (problem) return fail(problem);
      if (request.operation === 'relevel' && 'equipped' in request.source && npc.level - 2 > level) return fail('Unequip first: the new level requirement exceeds your level.');
      price = improvementPrice(item, request.operation, npc.level);
    }
  }
  if (!item) return fail('This item is no longer available.');
  if (!Number.isSafeInteger(price) || price < 0 || sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER) return fail('This transaction exceeds the supported limit.');
  return { ok: true, item, quote: { npcId: npc.id, revision: sheet.commerce.revision, epoch: stockEpoch(level), itemId: item.id,
    itemRevision: item.recipe.revision, price, request: { ...request } } };
}
export type TradePlan = { ok: false; message: string } | { ok: true; character: CharacterSheet; message: string; item: Item };
/** No live mutation: the caller persists this complete sheet before publishing it. */
export function planService(sheet: CharacterSheet, npc: TownNPC, level: number, quote: ServiceQuote): TradePlan {
  const current = quoteService(sheet, npc, level, quote.request);
  if (!current.ok) return current;
  if (JSON.stringify(current.quote) !== JSON.stringify(quote)) return { ok: false, message: 'The offer changed. Select the item again.' };
  const character: CharacterSheet = { ...sheet, inventory: [...sheet.inventory], equipped: { ...sheet.equipped }, commerce: {
    ...sheet.commerce, sold: sheet.commerce.epoch === stockEpoch(level) ? { ...sheet.commerce.sold } : {},
    epoch: stockEpoch(level), revision: sheet.commerce.revision + 1, operations: sheet.commerce.operations + 1, buyback: [...sheet.commerce.buyback],
  } };
  const { request, price } = quote; let item = current.item, message = '';
  if (request.type !== 'sell' && goldBalance(sheet) < price) return { ok: false, message: 'Not enough gold.' };
  if ((request.type === 'buy' || request.type === 'buyback') && !character.inventory.includes(null)) return { ok: false, message: 'Inventory full.' };
  if (request.type === 'sell') {
    if (!creditGold(character, price)) return { ok: false, message: 'Gold limit reached.' };
    if ('bag' in request.source) character.inventory[request.source.bag] = null;
    character.commerce.buyback.unshift({ item, price }); character.commerce.buyback.length = Math.min(COMMERCE_LIMITS.buyback, character.commerce.buyback.length);
    message = `Sold ${itemDisplayName(item)} · +${price} gold`;
  } else {
    if (!spendGold(character, price)) return { ok: false, message: 'Not enough gold.' };
    if (request.type === 'buy' || request.type === 'buyback') {
      if ([...character.inventory, ...Object.values(character.equipped)].some(i => i?.id === item.id)) return { ok: false, message: 'This item is already owned.' };
      character.inventory[character.inventory.indexOf(null)] = item;
      if (request.type === 'buy') character.commerce.sold[npc.id] = (character.commerce.sold[npc.id] ?? 0) | 1 << request.slot;
      else character.commerce.buyback = character.commerce.buyback.filter(b => b.item.id !== item.id);
      message = `Bought ${itemDisplayName(item)}`;
    } else {
      item = improveItem(item, request.operation, npc.level, hashService(`${item.id}:${character.commerce.operations}:${item.recipe.revision}`), request.affix);
      if ('bag' in request.source) character.inventory[request.source.bag] = item; else character.equipped[request.source.equipped] = item;
      message = `${itemDisplayName(item)} improved`;
    }
  }
  return { ok: true, character, message, item };
}
