import { charmThematicStat } from './charm-content.ts';
import { isResistanceStat } from './resistance-content.ts';
import type { Item } from './character-types.ts';
import { affixConflicts, rollAffix, itemAffixPool, itemAffixCount, deriveItem, randomSource } from './items.ts';
export type AffixFocus='any'|'offense'|'defense'|'utility';
export const AFFIX_FOCUSES:readonly AffixFocus[]=['any','offense','defense','utility'];
export function affixCategory(stat:string):Exclude<AffixFocus,'any'>{
  if(isResistanceStat(stat)) return 'defense';
  if(['maxHp','armor','vitality','lifeRegen','blockChance','blockReduction','afterguardPercent','potionPercent'].includes(stat))return 'defense';
  if(['goldFindPercent','xpGainPercent','maxMana','manaRegen','manaOnKill','manaCostPercent','cooldownPercent','moveSpeedPercent'].includes(stat))return 'utility';
  return 'offense';
}
export function rerollPool(item:Item,index?:number,focus:AffixFocus='any'){
  const occupied=index===undefined?[]:item.affixes.filter((_,i)=>i!==index).map(a=>a.stat);
  const eligible=itemAffixPool(item).filter(a=>(item.kind!=='charm'||(index??0)!==0||charmThematicStat(item,a.stat))&&!affixConflicts(a.stat,occupied));
  const different=eligible.filter(a=>a.stat!==(index===undefined?undefined:item.affixes[index]?.stat));
  return (different.length?different:eligible).map(a=>({...a,weight:(a.weight??1)*(focus!=='any'&&affixCategory(a.stat)===focus?3:1)}));
}
export type Improvement = 'enhance' | 'rarity' | 'rerollOne' | 'rerollAll' | 'relevel';
export const ITEM_TIERS = ['common', 'magic', 'rare', 'epic', 'legendary'] as const;
export function improvementProblem(item: Item, operation: Improvement, zoneLevel: number, affix?: number): string | null {
  if(item.tier==='unique'&&operation!=='enhance')return 'Unique powers and affixes are fixed. Only enhancement is available.';
  if (item.recipe.revision >= Number.MAX_SAFE_INTEGER) return 'This item cannot be improved further.';
  if (operation === 'enhance' && item.recipe.enhancement >= 10) return 'Maximum enhancement reached.';
  if (operation === 'rarity' && item.tier === 'legendary') return 'Maximum rarity reached.';
  if ((operation === 'rerollOne' || operation === 'rerollAll') && !item.affixes.length) return 'This item has no affixes.';
  if (operation === 'rerollOne' && (!Number.isInteger(affix) || affix! < 0 || affix! >= item.affixes.length)) return 'Choose an affix.';
  if (operation === 'relevel' && zoneLevel <= item.itemLevel) return 'Already at or above this zone’s level.';
  if (operation === 'rarity' && nextRarityTier(item) === null) return 'No further stat increase. No gold will be spent.';
  if (operation === 'enhance' && nextEnhancementLevel(item) === null) return 'No further stat increase. No gold will be spent.';
  if (operation === 'relevel') {
    const next = deriveItem({...item,itemLevel:zoneLevel,
      recipe:{...item.recipe,starter:false,enhancement:item.recipe.enhancement}});
    if (actualItemBonuses(next) === actualItemBonuses(item)) return 'No stat increase at this step. No gold will be spent.';
  }
  return null;
}
/** Excludes labels, recipe counters and informational item power. */
function actualItemBonuses(item: Item): string {
  return JSON.stringify([item.implicit,item.affixes.map(a=>[a.stat,a.value]),item.weapon?.damage,item.shield?.blockChance,item.shield?.blockReduction]);
}

export function improveItem(item: Item, operation: Improvement, zoneLevel: number, seed: number, affix?: number, focus:AffixFocus='any'): Item {
  const problem = improvementProblem(item, operation, zoneLevel, affix);
  if (problem) throw new RangeError(problem);
  const next = { ...item, recipe: { ...item.recipe, starter: false, rolls: [...item.recipe.rolls], revision: item.recipe.revision + 1 }, affixes: [...item.affixes] };
  const random = randomSource(seed), definitions = [...itemAffixPool(item)];
  const roll = (index: number, excluded?: string) => {
    const occupied = new Set(next.affixes.filter((_, i) => i !== index).map(a => a.stat));
    const eligible = definitions.filter(a => (item.kind !== 'charm' || index !== 0 || charmThematicStat(item,a.stat)) && !affixConflicts(a.stat, [...occupied]));
    const different=eligible.filter(a=>a.stat!==excluded),pool=different.length?different:eligible;
    const definition = rollAffix(pool.map(a=>({...a,weight:(a.weight??1)*(focus!=='any'&&affixCategory(a.stat)===focus?3:1)})), random);
    next.affixes[index] = { name: definition.name, stat: definition.stat, value: 0 };
    next.recipe.rolls[index] = random();
  };
  switch (operation) {
    case 'enhance': next.recipe.enhancement = nextEnhancementLevel(item)!; break;
    case 'rarity':
      next.tier = nextRarityTier(item)!;
      while (next.affixes.length < itemAffixCount(next)) roll(next.affixes.length);
      break;
    case 'rerollOne': roll(affix!, item.affixes[affix!].stat); next.recipe.targetedRolls++; break;
    case 'rerollAll':
      next.affixes = []; next.recipe.rolls = [];
      for (let i = 0; i < item.affixes.length; i++) roll(i);
      next.recipe.fullRolls++; break;
    case 'relevel': next.itemLevel = zoneLevel; break;
  }
  return deriveItem(next);
}

/** Skip rounded-away ranks in one purchase, charging only for the current step. */
export function nextEnhancementLevel(item: Item): number | null {
  const before=actualItemBonuses(item);
  for(let enhancement=item.recipe.enhancement+1;enhancement<=10;enhancement++) {
    const next=deriveItem({...item,recipe:{...item.recipe,starter:false,enhancement}});
    if(actualItemBonuses(next)!==before)return enhancement;
  }
  return null;
}

/** Small stones can retain their affix count across tiers: skip tiers with no actual benefit. */
export function nextRarityTier(item: Item): Item['tier'] | null {
  if(item.tier==='unique')return null;
  for(const tier of ITEM_TIERS.slice(ITEM_TIERS.indexOf(item.tier as typeof ITEM_TIERS[number])+1)) {
    const next={...item,tier,recipe:{...item.recipe,starter:false}};
    if(itemAffixCount(next)>item.affixes.length||actualItemBonuses(deriveItem(next))!==actualItemBonuses(item))return tier;
  }
  return null;
}
