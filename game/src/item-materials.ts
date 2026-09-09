import type { EnemyRank } from './progression-content.ts';
import type { Item, ItemKind } from './character-types.ts';
import type { WeaponFamily } from './model.ts';
import type { GearMaterial } from './gear-material-content.ts';

/** Base construction is independent of affix rarity, level and elemental enchantments. */
export type ItemMaterialId = 'leather' | 'iron' | 'steel' | 'silver' | 'gold' | 'crystal' | 'ashwood' | 'runewood' | 'glass' | 'quartz' | 'astralite' | 'cloth' | 'silk' | 'velvet' | 'starweave';
interface MaterialDefinition { name:string; surface:GearMaterial; base:string; shadow:string; edge:string; trim:string; value:number }
const material=(name:string,surface:GearMaterial,base:string,shadow:string,edge:string,trim:string,value=1):Readonly<MaterialDefinition>=>Object.freeze({name,surface,base,shadow,edge,trim,value});
export const ITEM_MATERIALS:Readonly<Record<ItemMaterialId,Readonly<MaterialDefinition>>>=Object.freeze({
  leather:material('Leather','leather','#78604e','#322a29','#b49a75','#b3986b'),
  iron:material('Iron','iron','#7b8388','#343e48','#bcc5ca','#9d896a'),
  steel:material('Steel','steel','#8a9cab','#354957','#e0ebf0','#a3aeb4',1.15),
  silver:material('Silver','silver','#bdcbd5','#596b82','#f5fcff','#899fb8',2),
  gold:material('Gold','gold','#d6ac52','#735020','#ffedb1','#a87435',3.5),
  crystal:material('Crystal','gem','#87cfd8','#305a78','#e8ffff','#a0a6db',6),
  ashwood:material('Ashwood','wood','#93734c','#463525','#cbb78d','#a08b65'),
  runewood:material('Runewood','wood','#556d62','#293c38','#a1c7ab','#b1a5ce',1.2),
  glass:material('Glass','glass','#77979f','#304752','#d0e7eb','#879da9'),
  quartz:material('Quartz','gem','#b7abd0','#655477','#f2eaff','#b5acc5',1.2),
  astralite:material('Astralite','gem','#7492cf','#333b77','#dce8ff','#bda5e9',3),
  silk:material('Silk','silk','#8b86ad','#41405c','#d7d0e9','#b8a17b',1.75),
  velvet:material('Velvet','velvet','#825267','#382436','#c699a9','#b79872',2.5),
  starweave:material('Starweave','starweave','#577eaf','#293852','#c1d9fa','#bbc8e7',4),
  cloth:material('Linen','cloth','#596257','#29352f','#97a490','#a08d64'),
});
export interface MaterialRoll { readonly id:ItemMaterialId; readonly weight:number; readonly baseScale:number }
const pool=(...entries:readonly [ItemMaterialId,number,number][]):readonly MaterialRoll[]=>Object.freeze(entries.map(([id,weight,baseScale])=>Object.freeze({id,weight,baseScale})));
export const MATERIAL_POOLS=Object.freeze({
  melee:pool(['iron',58,1],['steel',36,1.1],['silver',4.5,1.25],['gold',1.2,1.4],['crystal',.3,1.55]),
  armor:pool(['cloth',21,.7],['silk',6,.9],['velvet',2.5,1.05],['starweave',.5,1.3],['leather',35,1],['iron',19,1.1],['steel',12,1.2],['silver',3.2,1.4],['gold',.8,1.6]),
  metal:pool(['iron',60,1],['steel',35,1.1],['silver',4,1.25],['gold',1,1.4]),
  caster:pool(['ashwood',70,1],['runewood',24,1.1],['silver',4,1.25],['gold',1.5,1.4],['crystal',.5,1.55]),
  bow:pool(['ashwood',80,1],['runewood',19,1.1],['crystal',1,1.35]),
  book:pool(['leather',70,1],['runewood',24,1.1],['silver',4,1.2],['gold',1.5,1.3],['crystal',.5,1.4]),
  orb:pool(['glass',65,1],['quartz',29,1.1],['astralite',5,1.25],['crystal',1,1.4]),
  cloth:pool(['cloth',100,1]),
});
export function itemMaterialPool(kind:ItemKind,family?:WeaponFamily):readonly MaterialRoll[] {
  if(kind==='weapon')return family==='bow'?MATERIAL_POOLS.bow:family==='staff'||family==='wand'?MATERIAL_POOLS.caster:MATERIAL_POOLS.melee;
  if(kind==='grimoire')return MATERIAL_POOLS.book;
  if(kind==='orb')return MATERIAL_POOLS.orb;
  if(kind==='cloak')return MATERIAL_POOLS.cloth;
  if(kind==='shield'||kind==='ring'||kind==='amulet')return MATERIAL_POOLS.metal;
  return MATERIAL_POOLS.armor;
}
export function rollItemMaterial(pool:readonly MaterialRoll[],roll:number):ItemMaterialId {
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw new RangeError('Material roll must be in [0, 1).');
  let remaining=roll*pool.reduce((sum,entry)=>sum+entry.weight,0);
  for(const entry of pool){remaining-=entry.weight;if(remaining<0)return entry.id;}
  return pool[pool.length-1].id;
}
/** An absent override denotes an ordinary, unmodified base. */
export function itemMaterialScale(item:Pick<Item,'kind'|'weapon'|'recipe'>):number {
  return item.recipe.materialId?itemMaterialPool(item.kind,item.weapon?.family).find(m=>m.id===item.recipe.materialId)!.baseScale:1;
}
export const itemMaterialValue=(item:Item):number=>item.recipe.materialId?ITEM_MATERIALS[item.recipe.materialId].value:1;
export const isClothMaterial=(id?:string):boolean=>id==='cloth'||id==='silk'||id==='velvet'||id==='starweave';
export function materialBaseName(kind:ItemKind,name:string,id:ItemMaterialId):string {
  const leather:Partial<Record<ItemKind,string>>={head:'Hood',chest:'Jerkin',gloves:'Gloves',legs:'Trousers',boots:'Boots'};
  const metal:Partial<Record<ItemKind,string>>={head:'Helm',chest:'Cuirass',gloves:'Gauntlets',legs:'Greaves',boots:'Sabatons'};
  const cloth:Partial<Record<ItemKind,string>>={head:'Cowl',chest:'Robe',gloves:'Handwraps',legs:'Leggings',boots:'Slippers'};
  const noun=(isClothMaterial(id)?cloth[kind]:id==='leather'?leather[kind]:metal[kind])??name.replace(/^Iron /,'');
  return `${ITEM_MATERIALS[id].name} ${noun}`;
}

/** A bounded source advantage; never depends on the player's level or kill count. */
export interface MaterialSource { readonly merchantBonus?:number; readonly level?:number; readonly rank?:EnemyRank; readonly encounter?:'boss'|'chest'|'bossChest'|'event' }
export function sourceMaterialPool(kind:ItemKind,family?:WeaponFamily,source:MaterialSource={}):readonly MaterialRoll[] {
  const level=Math.max(1,Math.min(1e6,Number.isFinite(source.level)?source.level!:1));
  const zone=1+2.5*(1-Math.exp(-(level-1)/35));
  const rank=source.rank==='elite'?1.75:source.rank==='veteran'?1.25:1;
  const encounter=source.encounter==='bossChest'?2.5:source.encounter==='boss'?2.25:source.encounter==='chest'?1.5:source.encounter==='event'?1.3:1;
  const advantage=Math.min(7,zone*rank*encounter*Math.max(1,Math.min(3,source.merchantBonus??1)));
  const weighted=itemMaterialPool(kind,family).map(m=>({...m,weight:m.weight*(['silver','gold','crystal','astralite','velvet','starweave'].includes(m.id)?advantage:['steel','runewood','quartz','silk'].includes(m.id)?Math.sqrt(advantage):1)}));
  const total=weighted.reduce((n,m)=>n+m.weight,0);
  return weighted.map(m=>({...m,weight:m.weight/total*100}));
}
/** Services charge a modest premium separately from the material's sale value. */
export const itemMaterialService=(item:Item):number=>1+(itemMaterialValue(item)-1)*.2;
