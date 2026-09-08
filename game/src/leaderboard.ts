import type { CharacterSheet } from './character-types.ts';
import { deriveItem } from './items.ts';
export type LeaderboardOrder = 'level' | 'gear';
export interface LeaderboardEntry { rank: number; name: string; level: number; gearPower: number | null; updatedAt: number; mine: boolean; }
export interface LeaderboardSnapshot { entries: LeaderboardEntry[]; own: LeaderboardEntry[]; signedIn: boolean; total: number; }
/** Eleven occupied slot equivalents. A two-handed weapon fills both hand slots;
 * empty slots contribute zero. Rebuild recipe scores instead of trusting stored power. */
export function equippedGearPower(sheet: Pick<CharacterSheet, 'equipped'>): number {
  let total=0;
  for(const [slot,item] of Object.entries(sheet.equipped)) {
    if(!item)continue;
    total+=deriveItem(item).power*(slot==='weapon'&&item.weapon?.hands===2?2:1);
  }
  return Math.round(total/11);
}
