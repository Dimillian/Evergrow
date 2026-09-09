import type { BiomeId } from './biomes.ts';
import type { Building } from './settlements.ts';
export interface ArchitectureStyle {wall:string;stone:string;roof:readonly string[];cloth:string;trim:string;weather:'moss'|'snow'|'ash'|'sand'|'leaves'|'wind';}
const style=(wall:string,stone:string,roof:readonly string[],cloth:string,trim:string,weather:ArchitectureStyle['weather']):ArchitectureStyle=>({wall,stone,roof,cloth,trim,weather});
export const ARCHITECTURE:Readonly<Record<BiomeId,ArchitectureStyle>>={
 deadwood:style('#7c806b','#667978',['#34484d','#495d62','#61777a','#a7b1a0'],'#6c7969','#b5aa7b','moss'),
 verdant:style('#a39773','#728073',['#49533b','#66714b','#829161','#b6b988'],'#718267','#c9ba84','moss'),
 swamp:style('#777c68','#536d68',['#38483f','#536452','#748068','#a4ac85'],'#657e75','#b2b080','moss'),
 frostpine:style('#89918b','#778990',['#344d5b','#506979','#788e99','#c6d6d0'],'#77959f','#d0d1af','snow'),
 emberfall:style('#948374','#726966',['#483936','#604942','#805c4b','#bc9372'],'#925e48','#d4ae73','ash'),
 autumn:style('#b49d75','#8d8b72',['#65513a','#826443','#a37f53','#d2b584'],'#a28651','#d5c18b','leaves'),
 highlands:style('#918d80','#8a9295',['#494550','#625d6c','#85808b','#b6b2ad'],'#827891','#c2b799','wind'),
 steppe:style('#b09a72','#8d927c',['#63593e','#8b7d52','#af9d67','#d7c799'],'#aa955f','#ded0a5','wind'),
 sunscar:style('#c8b18a','#b6a383',['#836951','#a28662','#c0a376','#e3c99c'],'#c3aa81','#edcf96','sand'),
};
for(const v of Object.values(ARCHITECTURE)){Object.freeze(v.roof);Object.freeze(v);}Object.freeze(ARCHITECTURE);
export const architectureStyle=(b:Pick<Building,'biome'>)=>ARCHITECTURE[b.biome??'deadwood'];
export function roofVariant(b:Building):'gable'|'hipped'|'thatch'|'terrace'{
 if(b.kind==='noble'||b.kind==='chapel'||b.kind==='blacksmith')return 'gable';
 if(b.biome==='sunscar')return b.seed%3?'terrace':'hipped';
 if(b.biome==='steppe'||b.biome==='autumn')return b.seed%2?'thatch':'hipped';
 return b.seed%3===0?'hipped':'gable';
}
