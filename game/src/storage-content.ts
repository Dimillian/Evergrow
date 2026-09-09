import type { CharacterSheet } from './character-types.ts';

export const STASH_CAPACITY = 96;
export const STORAGE_TAB_PRICES = Object.freeze([10_000, 50_000, 200_000, 750_000]);
export const MAX_STORAGE_TABS = STORAGE_TAB_PRICES.length + 1;
export const storageTabCount = (sheet: Pick<CharacterSheet, 'stash'>): number => sheet.stash ? sheet.stash.length / STASH_CAPACITY : 1;
export const hasStorageTab = (sheet: Pick<CharacterSheet, 'stash'>, tab: number): boolean => Number.isInteger(tab) && tab >= 0 && tab < storageTabCount(sheet);
export const storageTabItems = (sheet: Pick<CharacterSheet, 'stash'>, tab: number) => (sheet.stash ?? []).slice(tab * STASH_CAPACITY, (tab + 1) * STASH_CAPACITY);
export const nextStorageTabPrice = (sheet: Pick<CharacterSheet, 'stash'>): number | null => STORAGE_TAB_PRICES[storageTabCount(sheet) - 1] ?? null;
