import type { GroundItem } from './character-types.ts';
import { LOOT_RULES } from './combat-content.ts';

/** Saved array order is drop order: retain the newest equipment, oldest out first. */
export function addGroundItem(items: GroundItem[], drop: GroundItem): void {
  const overflow = items.length - LOOT_RULES.maxGroundItems + 1;
  if (overflow > 0) items.splice(0, overflow);
  items.push(drop);
}
