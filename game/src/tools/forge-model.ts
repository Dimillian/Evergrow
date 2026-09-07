import { generateItem, deriveItem, ITEM_KINDS } from '../items.ts';
import type { ItemKind, ItemTier } from '../character-types.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import { jewelryProfiles } from '../jewelry-content.ts';
import { FOCUS_PROFILES } from '../focus-content.ts';
import { itemMaterialPool, type ItemMaterialId } from '../item-materials.ts';
export interface ForgeRecipe { seed:number; level:number; kind:ItemKind; profile:string; tier:ItemTier; material:string; enhancement:number; }
export function forgeProfiles(kind: ItemKind) {
  return kind==='weapon'?WEAPON_PROFILES:kind==='shield'?SHIELD_PROFILES:kind==='ring'||kind==='amulet'?jewelryProfiles(kind):FOCUS_PROFILES.filter(p=>p.visual.kind===kind);
}
export function forgeMaterials(kind: ItemKind, profile: string) {return itemMaterialPool(kind,WEAPON_PROFILES.find(p=>p.id===profile)?.family);}
export function forgeItem(recipe: ForgeRecipe) {
  if(!Number.isInteger(recipe.seed)||recipe.seed<0||recipe.seed>4294967295||!Number.isInteger(recipe.level)||recipe.level<1||recipe.level>1000000||!Number.isInteger(recipe.enhancement)||recipe.enhancement<0||recipe.enhancement>10||!ITEM_KINDS.includes(recipe.kind))throw new Error('Invalid item recipe bounds.');
  if(recipe.profile&&!forgeProfiles(recipe.kind).some(p=>p.id===recipe.profile))throw new Error('Choose a profile matching the item kind.');
  if(recipe.material&&!forgeMaterials(recipe.kind,recipe.profile).some(m=>m.id===recipe.material))throw new Error('Choose a material matching this item.');
  const item=generateItem(recipe.seed,recipe.level,recipe.kind,recipe.profile||undefined,recipe.tier,(recipe.material||undefined) as ItemMaterialId|undefined);
  item.recipe.enhancement=recipe.enhancement;return deriveItem(item);
}
