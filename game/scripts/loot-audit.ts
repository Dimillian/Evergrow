/** Reproducible, save-free loot audit. Run with Node --experimental-strip-types.
 * Optional output path defaults to /tmp/evergrow-loot-audit-level50.json. */
import { writeFileSync } from 'node:fs';
import { rollEnemyLoot } from '../src/loot.ts';
import { ENEMY_ITEM_KIND_WEIGHTS } from '../src/loot-content.ts';
import { riftRewardItems } from '../src/rift-rewards.ts';
import { createCharacterSheet, generateItem, deriveItem, itemAffixPool, STAT_LABELS, formatStatValue } from '../src/items.ts';
import { isGreaterAffix } from '../src/item-roll-content.ts';
import { isClothMaterial } from '../src/item-materials.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { isBossKind } from '../src/wilderness-boss-content.ts';
import { UNIQUES } from '../src/unique-content.ts';
import { validItem } from '../src/item-validation.ts';
import type { BiomeId } from '../src/biomes.ts';
import type { Item, CharacterSheet, EquipmentSlot } from '../src/character-types.ts';
import type { EnemyKind } from '../src/model.ts';
import type { DungeonEntrance } from '../src/dungeon.ts';
const level=50, killsPerRank=50000, rifts=20000;
const biomes:BiomeId[]=['deadwood','verdant','swamp','frostpine','emberfall','autumn','highlands','steppe','sunscar'];
// Stratified archetype/biome coverage, not a predicted player's kill mixture.
const kinds=(Object.keys(ENEMY_ITEM_KIND_WEIGHTS) as EnemyKind[]).filter(kind=>!isBossKind(kind));
const seed=(i:number,salt:number)=>(Math.imul(i+1,0x9e3779b9)^salt)>>>0;
const round=(x:number)=>Math.round(x*100)/100;
const quantile=(values:number[],q:number)=>values[Math.floor((values.length-1)*q)]??0;
type Style='melee'|'caster'|'bow';
function sheet(style:Style):CharacterSheet {
 const s=createCharacterSheet();for(const slot of Object.keys(s.equipped) as EquipmentSlot[])s.equipped[slot]=null;
 s.attributes.vitality+=98;s.attributes[style==='caster'?'intelligence':style==='bow'?'dexterity':'strength']+=147;
 s.equipped.weapon=generateItem(7331,level,'weapon',style==='caster'?'ember-staff':style==='bow'?'warden-longbow':'longsword','common');
 return s;
}
const sheets={melee:sheet('melee'),caster:sheet('caster'),bow:sheet('bow')};
function measure(item:Item,style:Style,slot:EquipmentSlot){
 const s=sheets[style],previous=s.equipped[slot];s.equipped[slot]=item;
 const stats=deriveCharacterStats(s,{},level),attack=deriveAttackStats(stats,s.equipped.weapon!.weapon!);
 s.equipped[slot]=previous;
 return {dps:attack.damage*attack.attacksPerSecond*(1+stats.critChance*(stats.critMultiplier-1)),hit:attack.damage,rate:attack.attacksPerSecond,
  hp:stats.maxHp,armor:stats.armor,physicalEhp:stats.maxHp/(1-stats.damageReduction)/(1-stats.blockChance*stats.blockReduction),
  mana:stats.maxMana,regen:stats.manaRegeneration,costMultiplier:stats.manaCostMultiplier};
}
type Metrics=ReturnType<typeof measure>;
const definitions=[
 {id:'melee1h',label:'One-handed melee',style:'melee',slot:'weapon',matches:(i:Item)=>!!i.weapon&&i.weapon.attackKind==='melee'&&i.weapon.hands===1,metric:'dps'},
 {id:'melee2h',label:'Two-handed melee',style:'melee',slot:'weapon',matches:(i:Item)=>!!i.weapon&&i.weapon.attackKind==='melee'&&i.weapon.hands===2,metric:'dps'},
 {id:'bow',label:'Bow',style:'bow',slot:'weapon',matches:(i:Item)=>i.weapon?.family==='bow',metric:'dps'},
 {id:'wand',label:'Wand',style:'caster',slot:'weapon',matches:(i:Item)=>i.weapon?.family==='wand',metric:'dps'},
 {id:'staff',label:'Staff',style:'caster',slot:'weapon',matches:(i:Item)=>i.weapon?.family==='staff',metric:'dps'},
 {id:'robe',label:'Caster robe — damage',style:'caster',slot:'chest',matches:(i:Item)=>i.kind==='chest'&&isClothMaterial(i.recipe.materialId),metric:'dps'},
 {id:'robeSustain',label:'Caster robe — mana sustain',style:'caster',slot:'chest',matches:(i:Item)=>i.kind==='chest'&&isClothMaterial(i.recipe.materialId),metric:'sustain'},
 {id:'plate',label:'Metal body armor',style:'melee',slot:'chest',matches:(i:Item)=>i.kind==='chest'&&!isClothMaterial(i.recipe.materialId)&&i.recipe.materialId!=='leather',metric:'physicalEhp'},
 {id:'leather',label:'Leather body armor',style:'bow',slot:'chest',matches:(i:Item)=>i.kind==='chest'&&i.recipe.materialId==='leather',metric:'dps'},
 {id:'shield',label:'Shield',style:'melee',slot:'offhand',matches:(i:Item)=>i.kind==='shield',metric:'physicalEhp'},
 {id:'gloves',label:'Melee gloves',style:'melee',slot:'gloves',matches:(i:Item)=>i.kind==='gloves',metric:'dps'},
 {id:'orb',label:'Caster orb',style:'caster',slot:'offhand',matches:(i:Item)=>i.kind==='orb',metric:'dps'},
] as const;
// Orbs are evaluated beside a wand, never an invalid staff + offhand combination.
const wandBaseline=generateItem(7331,level,'weapon','cinder-wand','common');
const rows=definitions.map(d=>({...d,values:[] as number[],epic:[] as number[],legendary:[] as number[],top:[] as {item:Item;source:string;sourceSeed:number;score:number;metrics:Metrics}[],coherentTop:[] as {item:Item;source:string;sourceSeed:number;score:number;metrics:Metrics}[],count:0,ga:0,threeGa:0}));
const sources:Record<string,{events:number;items:number;tiers:Record<string,number>;gaItems:number;uniques:Record<string,number>}>={};
const kindCounts:Record<string,number>={},skillRanks:Record<string,number>={};
const exceptional: {item:Item;source:string;sourceSeed:number}[]=[];
let invalid=0,highMelee=0,pureMeleeCasterRolls=0,fourGaEquipment=0;
function collect(items:Item[],source:string,sourceSeed:number){
 const stats=sources[source]??={events:0,items:0,tiers:{},gaItems:0,uniques:{}};stats.events++;
 for(const item of items){
  if(item.kind==='riftKey')continue;
  stats.items++;stats.tiers[item.tier]=(stats.tiers[item.tier]??0)+1;kindCounts[item.kind]=(kindCounts[item.kind]??0)+1;
  if(!validItem(item))invalid++;
  const greater=item.affixes.filter((_,i)=>isGreaterAffix(item,i)).length;if(greater)stats.gaItems++;
  if(item.kind!=='charm'&&greater===4){fourGaEquipment++;exceptional.push({item,source,sourceSeed});}
  for(const a of item.affixes)if(a.stat.startsWith('skill:'))skillRanks[a.value]=(skillRanks[a.value]??0)+1;
  if(item.tier==='unique'){const id=item.recipe.uniqueId!;stats.uniques[id]=(stats.uniques[id]??0)+1;continue;}
  if(item.weapon?.attackKind==='melee'&&!item.weapon.enchantment&&['epic','legendary'].includes(item.tier)){
   highMelee++;if(item.affixes.some(a=>['intelligence','spellDamagePercent'].includes(a.stat)))pureMeleeCasterRolls++;
  }
  for(const row of rows){
   if(!row.matches(item))continue;
   const old=sheets.caster.equipped.weapon;if(row.id==='orb')sheets.caster.equipped.weapon=wandBaseline;
   const metrics=measure(item,row.style,row.slot);sheets.caster.equipped.weapon=old;
   const score=row.metric==='sustain'?metrics.regen/metrics.costMultiplier:metrics[row.metric];
   row.count++;row.values.push(score);if(item.tier==='epic')row.epic.push(score);if(item.tier==='legendary')row.legendary.push(score);
   if(greater)row.ga++;if(greater>=3)row.threeGa++;
   const aligned=!(row.style==='melee'&&item.weapon?.attackKind==='melee'&&!item.weapon.enchantment&&item.affixes.some(a=>['intelligence','spellDamagePercent'].includes(a.stat)));
   if(aligned&&item.tier==='legendary'&&(row.coherentTop.length===0||score>row.coherentTop[0].score))row.coherentTop=[{item,source,sourceSeed,score,metrics}];
   if(row.top.length<3||score>row.top.at(-1)!.score){row.top.push({item,source,sourceSeed,score,metrics});row.top.sort((a,b)=>b.score-a.score);row.top.length=Math.min(row.top.length,3);}
  }
 }
}
for(const [rankIndex,rank]of (['normal','veteran','elite'] as const).entries()){
 for(let i=0;i<killsPerRank;i++){
  const n=seed(i,0x7319+rankIndex*997),biome=biomes[i%biomes.length],kind=kinds[Math.floor(i/biomes.length)%kinds.length];
  collect(rollEnemyLoot({seed:n,level,playerLevel:level,rank,biome,kind}),rank,n);
 }
 console.error(`Sampled ${killsPerRank} ${rank} kills`);
}
for(let i=0;i<rifts;i++){
 const n=seed(i,0x892731),entrance:DungeonEntrance={id:`audit:${n}`,name:'Audit',x:0,y:0,seed:n,level,biome:biomes[i%biomes.length],rift:{attempt:1,layout:'clearings'}};
 collect(riftRewardItems(entrance,level),'unkeyedRift',n);
}
function card(entry:typeof rows[number]['top'][number],row:typeof rows[number]){
 const {item}=entry,ceiling=deriveItem({...item,recipe:{...item.recipe,rolls:item.recipe.rolls.map(()=>1)}});
 const old=sheets.caster.equipped.weapon;if(row.id==='orb')sheets.caster.equipped.weapon=wandBaseline;
 const score=(candidate:Item)=>{const m=measure(candidate,row.style,row.slot);return row.metric==='sustain'?m.regen/m.costMultiplier:m[row.metric];};
 const noAffixes=score(deriveItem({...item,affixes:[],recipe:{...item.recipe,rolls:[]}}));
 const ceilingScore=score(ceiling);sheets.caster.equipped.weapon=old;
 return {sameBaseWithoutAffixes:round(noAffixes),sameAffixesMaxRollScore:round(ceilingScore),name:item.name,base:item.baseName,tier:item.tier,itemLevel:item.itemLevel,requiredLevel:item.requiredLevel,seed:item.seed,source:entry.source,sourceSeed:entry.sourceSeed,
  score:round(entry.score),metrics:Object.fromEntries(Object.entries(entry.metrics).map(([k,v])=>[k,round(v)])),
  weapon:item.weapon?{damage:item.weapon.damage,baseRate:item.weapon.baseAttacksPerSecond,element:item.weapon.damageType,hands:item.weapon.hands}:undefined,
  implicit:item.implicit,affixes:item.affixes.map((a,i)=>({stat:a.stat,label:STAT_LABELS[a.stat],value:a.value,text:formatStatValue(a.stat,a.value),greater:isGreaterAffix(item,i),percentile:round(item.recipe.rolls[i]*100),maximum:ceiling.affixes[i].value})),item};
}
const report={level,killsPerRank,rifts,invalid,sourceCommit:'e799bfa',assumptions:['Live reward functions; independent deterministic seeds; no rarity overrides, magic find, enhancement or rerolls.','Equal ranks, archetypes and biomes are stratified coverage, not a player farming forecast.','Monster level 50 yields item levels 50/51/52; rifts and Unique items are level 50.','DPS is expected stationary basic-attack throughput including crit, without target mitigation, skill-specific effects, mana downtime or unique powers.','245 attribute points: 147 Strength/Intelligence/Dexterity, 98 Vitality; no tree, auras, charms or other gear. Nonweapon comparisons use one fixed level-50 common weapon.','Armor ranks by physical EHP against level-50 hits; shield score includes expected block. This is not elemental survival.','Sustain robe score is mana regenerated per second / mana cost multiplier. It does not price max-mana, life or damage.'],sources,kindCounts,skillRanks,exceptional,highMelee,pureMeleeCasterRolls,fourGaEquipment,
 categories:rows.map(r=>{r.values.sort((a,b)=>a-b);r.epic.sort((a,b)=>a-b);r.legendary.sort((a,b)=>a-b);return {id:r.id,label:r.label,count:r.count,metric:r.metric,ga:r.ga,threeGa:r.threeGa,median:round(quantile(r.values,.5)),p99:round(quantile(r.values,.99)),epicMedian:round(quantile(r.epic,.5)),legendaryMedian:round(quantile(r.legendary,.5)),top:r.top.map(t=>card(t,r)),coherentTop:r.coherentTop.map(t=>card(t,r))};}),
 uniqueCatalog:UNIQUES.map(u=>({id:u.id,name:u.name,skill:u.skill,power:u.power})),
 pools:rows.map(r=>({category:r.id,base:r.top[0]?.item.baseName,eligible:r.top[0]?itemAffixPool(r.top[0].item).map(a=>a.stat):[]}))};
writeFileSync(process.argv[2]??'/tmp/evergrow-loot-audit-level50.json',JSON.stringify(report,null,2)+'\n');
console.error(`Done: ${Object.values(sources).reduce((s,x)=>s+x.items,0)} items; ${invalid} invalid.`);
