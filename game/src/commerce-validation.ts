import type { CommerceState } from './character-types.ts';
import { COMMERCE_LIMITS, stockEpoch } from './commerce.ts';
import { object, integer, text, validItem } from './item-validation.ts';
export function validCommerce(v: unknown, level: number): v is CommerceState {
  return object(v) && integer(v.epoch, 0, stockEpoch(level)) && integer(v.revision) && integer(v.operations)
    && object(v.sold) && Object.keys(v.sold).length <= COMMERCE_LIMITS.vendors
    && Object.entries(v.sold).every(([key, mask]) => text(key, 140) && /^town:[0-9]+:-?[0-9]+:building:[0-9]+:(blacksmith|jeweler)$/.test(key)
      && integer(mask, 0, key.endsWith(':jeweler') ? 63 : 4095))
    && Array.isArray(v.buyback) && v.buyback.length <= COMMERCE_LIMITS.buyback
    && v.buyback.every(b => object(b) && validItem(b.item) && integer(b.price));
}
