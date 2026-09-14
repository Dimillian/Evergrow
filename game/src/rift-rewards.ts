import { RIFT_RULES, riftBonus, riftRandom, createRiftKey } from './rift-content.ts';
import { withUniqueChance } from './unique-content.ts';
import { rollEnemyLoot, selectLootWeight } from './loot.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { Item, ItemTier } from './character-types.ts';
export function riftRewardItems(entrance:DungeonEntrance,playerLevel:number):Item[]{
  const tag=entrance.rift!,random=riftRandom(entrance.seed^0x793ba189),luck=1+riftBonus(tag,'fortune')/100;
  const weights=withUniqueChance({rare:60,epic:35*luck,legendary:5*luck});
  const items=Array.from({length:RIFT_RULES.rewards+riftBonus(tag,'bounty')},()=>rollEnemyLoot({playerLevel,seed:Math.floor(random()*4294967296),level:entrance.level,rank:'normal',kind:'stalker',biome:entrance.biome,encounter:'bossChest',firstKill:true,tierOverride:selectLootWeight(weights,random()) as ItemTier})[0]);
  const current=tag.keyTier??1,tier=Math.max(1,Math.min(5,current+(random()<.35?1:0)));
  items.push(createRiftKey(Math.floor(random()*4294967296),entrance.level,tier));return items;
}
