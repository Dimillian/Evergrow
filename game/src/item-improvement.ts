import type { Item } from './character-types.ts';
import { affixConflicts, rollAffix, itemAffixPool, TIER_AFFIXES, deriveItem, randomSource } from './items.ts';
export type AffixFocus='any'|'offense'|'defense'|'utility';
export const AFFIX_FOCUSES:readonly AffixFocus[]=['any','offense','defense','utility'];
export function affixCategory(stat:string):Exclude<AffixFocus,'any'>{
  if(['maxHp','armor','vitality','lifeRegen','blockChance','blockReduction','afterguardPercent','potionPercent'].includes(stat))return 'defense';
  if(['maxMana','manaRegen','manaOnKill','manaCostPercent','cooldownPercent','moveSpeedPercent'].includes(stat))return 'utility';
  return 'offense';
}
export function rerollPool(item:Item,index?:number,focus:AffixFocus='any'){
  const occupied=index===undefined?[]:item.affixes.filter((_,i)=>i!==index).map(a=>a.stat);
  return itemAffixPool(item).filter(a=>a.stat!==(index===undefined?undefined:item.affixes[index]?.stat)&&!affixConflicts(a.stat,occupied))
    .map(a=>({...a,weight:(a.weight??1)*(focus!=='any'&&affixCategory(a.stat)===focus?3:1)}));
}
export type Improvement = 'enhance' | 'rarity' | 'rerollOne' | 'rerollAll' | 'relevel';
export const ITEM_TIERS = ['common', 'magic', 'rare', 'epic', 'legendary'] as const;
export function improvementProblem(item: Item, operation: Improvement, zoneLevel: number, affix?: number): string | null {
  if (item.recipe.revision >= Number.MAX_SAFE_INTEGER) return 'This item cannot be improved further.';
  if (operation === 'enhance' && item.recipe.enhancement >= 10) return 'Maximum enhancement reached.';
  if (operation === 'rarity' && item.tier === 'legendary') return 'Maximum rarity reached.';
  if ((operation === 'rerollOne' || operation === 'rerollAll') && !item.affixes.length) return 'This item has no affixes.';
  if (operation === 'rerollOne' && (!Number.isInteger(affix) || affix! < 0 || affix! >= item.affixes.length)) return 'Choose an affix.';
  if (operation === 'relevel' && zoneLevel <= item.itemLevel) return 'Already at or above this zone’s level.';
  return null;
}
export function improveItem(item: Item, operation: Improvement, zoneLevel: number, seed: number, affix?: number, focus:AffixFocus='any'): Item {
  const problem = improvementProblem(item, operation, zoneLevel, affix);
  if (problem) throw new RangeError(problem);
  const next = { ...item, recipe: { ...item.recipe, rolls: [...item.recipe.rolls], revision: item.recipe.revision + 1 }, affixes: [...item.affixes] };
  const random = randomSource(seed), definitions = [...itemAffixPool(item)];
  const roll = (index: number, excluded?: string) => {
    const occupied = new Set(next.affixes.filter((_, i) => i !== index).map(a => a.stat));
    const pool = definitions.filter(a => a.stat !== excluded && !affixConflicts(a.stat, [...occupied]));
    const definition = rollAffix(pool.map(a=>({...a,weight:(a.weight??1)*(focus!=='any'&&affixCategory(a.stat)===focus?3:1)})), random);
    next.affixes[index] = { name: definition.name, stat: definition.stat, value: 0 };
    next.recipe.rolls[index] = random();
  };
  switch (operation) {
    case 'enhance': next.recipe.enhancement++; break;
    case 'rarity':
      next.tier = ITEM_TIERS[ITEM_TIERS.indexOf(item.tier) + 1];
      while (next.affixes.length < TIER_AFFIXES[next.tier]) roll(next.affixes.length);
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
