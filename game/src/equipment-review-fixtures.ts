import { JEWELRY_PROFILES } from './jewelry-content.ts';
import { generateItem } from './items.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import { FOCUS_PROFILES } from './focus-content.ts';
import { ITEM_MATERIALS, sourceMaterialPool, type MaterialSource } from './item-materials.ts';
import type { WeaponFamily } from './model.ts';
import type { Item, ItemKind } from './character-types.ts';
export interface EquipmentExhibit { item:Item; name:string; group:string; material:string; chance:number; baseScale:number }
/** Every card is a real generated recipe available from the same loot pool. */
export function equipmentExhibits(level=8,source:MaterialSource={}):EquipmentExhibit[] {
  const entries:EquipmentExhibit[]=[];
  const add=(kind:ItemKind,group:string,profileId?:string,family?:WeaponFamily)=>{
    const pool=sourceMaterialPool(kind,family,{level,...source}), total=pool.reduce((sum,m)=>sum+m.weight,0);
    for(const m of pool){
      const item=generateItem(900+entries.length,level,kind,profileId,'common',m.id);
      entries.push({item,name:item.baseName,group,material:ITEM_MATERIALS[m.id].name,chance:m.weight/total*100,baseScale:m.baseScale});
    }
  };
  for(const p of WEAPON_PROFILES)add('weapon','Weapons',p.id,p.family);
  for(const p of SHIELD_PROFILES)add('shield','Shields',p.id);
  for(const kind of ['head','chest','gloves','legs','boots'] as const)add(kind,'Armor');
  for(const p of FOCUS_PROFILES)add(p.visual.kind,'Foci',p.id);
  add('cloak','Accessories');
  for(const p of JEWELRY_PROFILES)add(p.kind,'Accessories',p.id);
  return entries;
}
