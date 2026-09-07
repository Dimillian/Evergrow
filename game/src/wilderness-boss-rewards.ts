import type { Enemy } from './model.ts';
import type { EventState } from './poi-content.ts';
import { isWildernessBoss, BOSS_NAMES } from './wilderness-boss-content.ts';
/** Kill commitment stages a durable hoard; the normal event transaction delivers it exactly once. */
export function completeBossLair(enemy: Enemy, state: EventState): void {
  if(!isWildernessBoss(enemy.kind)||!enemy.campId||!enemy.campId.includes(':lair:')||state.sites[enemy.campId]||state.claimed?.includes(enemy.campId))return;
  state.sites[enemy.campId]={id:enemy.campId,kind:'bossLair',name:BOSS_NAMES[enemy.kind],x:enemy.homeX,y:enemy.homeY+155,
    seed:enemy.lootSeed,biome:enemy.biome,level:enemy.level,phase:'completed',choice:null,delivered:0,wavesCleared:0,bonusGranted:false};
}
