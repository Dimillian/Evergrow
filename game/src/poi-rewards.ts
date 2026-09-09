import { isTrialKind } from './event-recipes.ts';
import { generateRewardItem } from './items.ts';
import { ENEMY_LOOT_TABLES } from './loot-content.ts';
import { siteHash } from './wilderness-sites.ts';
import type { ItemTier } from './character-types.ts';
import type { EventRecord } from './poi-content.ts';
import { scaledEnemyStats } from './zone-progression.ts';
/** Independent per-component seeds make partial delivery and reload deterministic. */
export function eventRewards(site: EventRecord) {
  const random = (salt: number) => siteHash(site.seed, salt, 0x37518) / 4294967296;
  const count = site.kind==='bossLair'?3:site.kind === 'cursedChest' ? Math.min(10, Math.floor(site.wavesCleared / 2) + Number(site.wavesCleared>0)) : isTrialKind(site.kind)&&!['graveyard','standingStones'].includes(site.kind) ? 2 : site.kind === 'camp' || site.kind === 'graveyard' ? 1 : site.kind === 'caravan' && site.choice === 'goods' ? 2
    : site.kind === 'reliquary' && random(1) < .25 ? 1 : 0;
  const veteran = site.kind==='bossLair'||isTrialKind(site.kind), weights = ENEMY_LOOT_TABLES[veteran ? 'veteran' : 'normal'].tierWeights;
  const items = Array.from({ length: count }, (_, i) => {
    const table=site.kind==='bossLair'&&i===0?{rare:94,epic:5.7,legendary:.3}:weights;
    let roll = random(10 + i) * 100, tier: ItemTier = 'common';
    for (const [key, weight] of Object.entries(table) as [
      ItemTier,
      number
    ][]) {
      roll -= weight;
      if (roll < 0) {
        tier = key;
        break;
      }
    }
    const kind = site.kind==='caravan' ? (i===0?'weapon':'chest') : site.kind==='ruinedChapel' ? (i%2?'amulet':'grimoire') : site.kind==='beastDen' ? (i%2?'boots':'chest') : site.kind==='quarry' ? (i%2?'chest':'weapon') : site.kind==='corruptedGrove' ? (i%2?'orb':'weapon') : undefined;
    const material = site.kind==='beastDen' ? 'leather' as const : undefined;
    const item = generateRewardItem(siteHash(site.seed, i, 497), Math.min(1e6, site.level + Number(veteran)), kind, site.kind==='corruptedGrove'&&kind==='weapon'?'ember-staff':undefined, tier, material, {level:site.level,encounter:site.kind==='bossLair'?'bossChest':isTrialKind(site.kind)||site.kind==='camp'?'event':undefined});
    item.id = `poi:${site.id}:${i}`;
    return item;
  });
  const range = site.kind==='bossLair'?[65,100]:site.kind === 'cursedChest' ? [site.wavesCleared*10,site.wavesCleared*15] : isTrialKind(site.kind)&&!['graveyard','standingStones'].includes(site.kind) ? [20,35] : site.kind === 'camp' ? [8, 14] : site.kind === 'reliquary' ? [4, 8] : site.kind === 'caravan' && site.choice === 'coin' ? [22, 34] : [0, 0];
  const gold = Math.round((range[0] + Math.floor(random(80) * (range[1] - range[0] + 1))) * (1 + .1 * (site.level - 1)));
  const xp = isTrialKind(site.kind) ? Math.round(scaledEnemyStats('stalker', site.level, 'normal').xpReward / 2) : 0;
  return { items, gold, xp };
}

export function eventRewardMask(site:EventRecord):number { const r=eventRewards(site);return (1<<r.items.length)-1 | (r.gold?1<<r.items.length:0); }
