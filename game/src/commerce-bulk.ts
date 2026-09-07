import type { CharacterSheet, ItemTier } from './character-types.ts';
import { COMMERCE_LIMITS, itemPrice, stockEpoch } from './commerce.ts';
import { ITEM_TIERS } from './item-improvement.ts';
import type { TownNPC } from './npcs.ts';
import { creditGold } from './wallet.ts';

export const BULK_SALE_CHOICES = [
  { tier: 'common', label: 'All Common' }, { tier: 'magic', label: 'Magic and lower' },
  { tier: 'rare', label: 'Rare and lower' }, { tier: 'epic', label: 'Epic and lower' },
  { tier: 'legendary', label: 'All' },
] as const;
export interface BulkSaleQuote {
  type: 'bulkSale'; npcId: string; revision: number; epoch: number; ceiling: ItemTier; price: number;
  items: { index: number; id: string; revision: number; price: number }[];
}
type Failure = { ok: false; message: string };

/** The ceiling always applies to the whole bag, independently of browsing filters. */
export function quoteBulkSale(sheet: CharacterSheet, npc: TownNPC, level: number, ceiling: ItemTier): Failure | { ok: true; quote: BulkSaleQuote } {
  if (npc.role === 'enchanter') return { ok: false, message: 'This service is not available here.' };
  const ceilingIndex = ITEM_TIERS.indexOf(ceiling);
  if (ceilingIndex < 0) return { ok: false, message: 'Choose a sale rarity.' };
  const items = sheet.inventory.flatMap((item, index) => item && ITEM_TIERS.indexOf(item.tier) <= ceilingIndex
    ? [{ index, id: item.id, revision: item.recipe.revision, price: itemPrice(item, 'sell') }] : []);
  if (!items.length) return { ok: false, message: 'No matching items to sell.' };
  const price = items.reduce((total, item) => total + item.price, 0);
  if (!Number.isSafeInteger(price) || price < 0 || items.some(item => !Number.isSafeInteger(item.price) || item.price < 0)
    || sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER)
    return { ok: false, message: 'This transaction exceeds the supported limit.' };
  return { ok: true, quote: { type: 'bulkSale', npcId: npc.id, revision: sheet.commerce.revision, epoch: stockEpoch(level), ceiling, price, items } };
}

/** A single staged wallet/bag/buyback change and one durable checkpoint for the batch. */
export function planBulkSale(sheet: CharacterSheet, npc: TownNPC, level: number, quote: BulkSaleQuote): Failure | { ok: true; character: CharacterSheet; message: string } {
  const current = quoteBulkSale(sheet, npc, level, quote.ceiling);
  if (!current.ok) return current;
  if (JSON.stringify(current.quote) !== JSON.stringify(quote)) return { ok: false, message: 'The items changed. Open Sell… again.' };
  const character: CharacterSheet = { ...sheet, inventory: [...sheet.inventory], commerce: {
    ...sheet.commerce, epoch: stockEpoch(level), sold: sheet.commerce.epoch === stockEpoch(level) ? { ...sheet.commerce.sold } : {},
    revision: sheet.commerce.revision + 1, operations: sheet.commerce.operations + 1, buyback: [...sheet.commerce.buyback],
  } };
  if (!creditGold(character, quote.price)) return { ok: false, message: 'Gold limit reached.' };
  for (const entry of quote.items) {
    character.commerce.buyback.unshift({ item: character.inventory[entry.index]!, price: entry.price });
    character.inventory[entry.index] = null;
  }
  character.commerce.buyback.length = Math.min(COMMERCE_LIMITS.buyback, character.commerce.buyback.length);
  return { ok: true, character, message: `Sold ${quote.items.length} ${quote.items.length === 1 ? 'item' : 'items'} · +${quote.price} gold` };
}
