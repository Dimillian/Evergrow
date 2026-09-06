import { generateItem } from './items.ts';
import { ENEMY_LOOT_TABLES } from './loot-content.ts';
import { siteHash } from './wilderness-sites.ts';
import type { ItemTier } from './character-types.ts';
import type { EventRecord } from './poi-content.ts';
import { scaledEnemyStats } from './zone-progression.ts';
/** Independent per-component seeds make partial delivery and reload deterministic. */
export function eventRewards(site: EventRecord) {
  const random = (salt: number) => siteHash(site.seed, salt, 0x37518) / 4294967296;
  const count = site.kind === 'camp' || site.kind === 'graveyard' ? 1 : site.kind === 'caravan' && site.choice === 'goods' ? 2
    : site.kind === 'reliquary' && random(1) < .25 ? 1 : 0;
  const veteran = site.kind === 'graveyard', weights = ENEMY_LOOT_TABLES[veteran ? 'veteran' : 'normal'].tierWeights;
  const items = Array.from({ length: count }, (_, i) => {
    let roll = random(10 + i) * 100, tier: ItemTier = 'common';
    for (const [key, weight] of Object.entries(weights) as [
      ItemTier,
      number
    ][]) {
      roll -= weight;
      if (roll < 0) {
        tier = key;
        break;
      }
    }
    const item = generateItem(siteHash(site.seed, i, 497), Math.min(1e6, site.level + Number(veteran)), site.kind === 'caravan' ? (i === 0 ? 'weapon' : 'chest') : undefined, undefined, tier);
    item.id = `poi:${site.id}:${i}`;
    return item;
  });
  const range = site.kind === 'camp' ? [8, 14] : site.kind === 'reliquary' ? [4, 8] : site.kind === 'caravan' && site.choice === 'coin' ? [22, 34] : [0, 0];
  const gold = Math.round((range[0] + Math.floor(random(80) * (range[1] - range[0] + 1))) * (1 + .1 * (site.level - 1)));
  const xp = site.kind === 'graveyard' || site.kind === 'standingStones' ? Math.round(scaledEnemyStats('stalker', site.level, 'normal').xpReward / 2) : 0;
  return { items, gold, xp };
}
