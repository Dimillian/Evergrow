import { difficultyLootWeights, type WorldDifficulty } from './world-difficulty.ts';
import { RIFT_RULES, riftBonus, riftRandom, createRiftKey, riftRewardItemCount } from './rift-content.ts';
import { withUniqueChance } from './unique-content.ts';
import { rollEnemyLoot, selectLootWeight } from './loot.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { Item, ItemTier } from './character-types.ts';
export function riftRewardItems(entrance:DungeonEntrance,playerLevel:number,difficulty?:WorldDifficulty):Item[]{
  const tag=entrance.rift!,random=riftRandom(entrance.seed^0x793ba189),luck=1+riftBonus(tag,'fortune')/100;
  const weights=withUniqueChance({rare:60,epic:35*luck,legendary:5*luck});
  const items=Array.from({length:riftRewardItemCount(tag)-1},()=>rollEnemyLoot({playerLevel,seed:Math.floor(random()*4294967296),level:entrance.level,rank:'normal',kind:'stalker',biome:entrance.biome,encounter:'bossChest',firstKill:true,tierOverride:selectLootWeight(difficultyLootWeights(weights,difficulty),random()) as ItemTier})[0]);
  // Key progression is independent of gear count, charm eligibility and rarity rolls.
  const keyRandom=riftRandom(entrance.seed^0x51c9a2bd),current=tag.keyTier??1;
  const tier=Math.min(RIFT_RULES.maximumKeyTier,current+(keyRandom()<RIFT_RULES.keyUpgradeChance?1:0));
  items.push(createRiftKey(Math.floor(keyRandom()*4294967296),entrance.level,tier));return items;
}
