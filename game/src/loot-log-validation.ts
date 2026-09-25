import { LOOT_LOG_LIMIT, type LootLogEntry } from './loot-log.ts';
import { number, object, text, validItem } from './item-validation.ts';

/** Validate archived item snapshots without treating them as owned inventory. */
export function validLootLog(value: unknown, time: number): value is LootLogEntry[] {
  return Array.isArray(value) && value.length <= LOOT_LOG_LIMIT && value.every((entry, index) =>
    object(entry) && validItem(entry.item) && number(entry.time, 0, time) && text(entry.location, 180)
    && (entry.sold === undefined || entry.sold === true) && (index === 0 || entry.time >= value[index - 1].time));
}
