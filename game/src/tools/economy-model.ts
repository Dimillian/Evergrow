import { BIOMES, type BiomeId } from '../biomes.ts';
import { ENEMY_DEFINITIONS } from '../combat-content.ts';
import { rollEnemyGold } from '../gold.ts';
import { ENEMY_LOOT_YIELD } from '../loot-content.ts';
import { rollEnemyLoot } from '../loot.ts';
import { itemPrice, improvementPrice } from '../commerce.ts';
import { deriveItem, generateItem } from '../items.ts';
import { nextEnhancementLevel } from '../item-improvement.ts';
import { itemMaterialPool, type ItemMaterialId } from '../item-materials.ts';
import { eventRewards } from '../poi-rewards.ts';
import { xpForNextLevel, xpLevelFactor } from '../progression.ts';
import { scaledEnemyStats } from '../zone-progression.ts';
import { worldDifficulty, difficultyEnemyStats, validWorldDifficulty, type WorldDifficulty } from '../world-difficulty.ts';
import { isBossKind } from '../wilderness-boss-content.ts';
import type { EnemyKind } from '../model.ts';
import type { Item, ItemTier } from '../character-types.ts';
import type { EnemyRank } from '../progression-content.ts';

export const ECONOMY_KINDS = (Object.keys(ENEMY_DEFINITIONS) as EnemyKind[]).filter(kind => !isBossKind(kind));
export const ECONOMY_ACTIVITIES = { camp: 'Camp cache', ruinedChapel: 'Chapel trial', beastDen: 'Beast den trial', cursedChest: 'Cursed chest' } as const;
export interface EconomyConfig {
  seed: number; player: number; area: number; biome: BiomeId; kind: EnemyKind; difficulty: WorldDifficulty;
  champion: number; elite: number; goblins: number; killsPerMinute: number; minutes: number;
  goldFind: number; xpBonus: number; collect: number; sell: number;
  activity: keyof typeof ECONOMY_ACTIVITIES; activitiesPerHour: number; waves: number;
  itemLevel: number; itemKind: 'weapon' | 'shield' | 'chest' | 'charm'; tier: Exclude<ItemTier, 'unique'>; material: ItemMaterialId; rank: number;
}
export const DEFAULT_ECONOMY: Readonly<EconomyConfig> = Object.freeze({seed:7319,player:5,area:5,biome:'deadwood',kind:'stalker',difficulty:'normal',
  champion:0,elite:0,goblins:0,killsPerMinute:4,minutes:15,goldFind:0,xpBonus:0,collect:100,sell:50,
  activity:'camp',activitiesPerHour:0,waves:4,itemLevel:5,itemKind:'weapon',tier:'rare',material:'iron',rank:0});
const numeric = {seed:[0,4294967295],player:[1,1e6],area:[1,1e6],champion:[0,100],elite:[0,100],goblins:[0,100],
  killsPerMinute:[0,60],minutes:[1,120],goldFind:[0,100],xpBonus:[0,50],collect:[0,100],sell:[0,100],activitiesPerHour:[0,60],waves:[1,20],itemLevel:[1,1e6],rank:[0,10]} as const;
export function validateEconomy(config: EconomyConfig): void {
  for(const [key,[min,max]] of Object.entries(numeric)) {
    const value=config[key as keyof typeof numeric];
    if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${key} must be between ${min} and ${max}.`);
  }
  for(const key of ['seed','player','area','itemLevel','rank','waves'] as const)if(!Number.isInteger(config[key]))throw new RangeError(`${key} must be a whole number.`);
  if(config.champion+config.elite>100)throw new RangeError('Champion and Elite shares must total at most 100%.');
  if(!ECONOMY_KINDS.includes(config.kind)||!Object.hasOwn(BIOMES,config.biome)||!validWorldDifficulty(config.difficulty)
    ||!Object.hasOwn(ECONOMY_ACTIVITIES,config.activity)||!['weapon','shield','chest','charm'].includes(config.itemKind)
    ||!['common','magic','rare','epic','legendary'].includes(config.tier))throw new RangeError('Unknown economy selection.');
  if(config.itemKind!=='charm'&&!itemMaterialPool(config.itemKind,'sword').some(m=>m.id===config.material))throw new RangeError('Choose a material supported by this item.');
}
export function economyConfig(params: URLSearchParams): EconomyConfig {
  const config={...DEFAULT_ECONOMY};
  for(const key of Object.keys(config) as (keyof EconomyConfig)[]) {
    if(!params.has(key))continue;
    Object.assign(config,{[key]:typeof config[key]==='number'?Number(params.get(key)):params.get(key)});
  }
  validateEconomy(config);return config;
}
export interface Income { coins: number; sales: number; xp: number; }
const empty = ():Income => ({coins:0,sales:0,xp:0});
const add = (a:Income,b:Income,weight=1) => {a.coins+=b.coins*weight;a.sales+=b.sales*weight;a.xp+=b.xp*weight;};
const seedAt = (seed:number,i:number) => (seed ^ Math.imul(i+1,0x9e3779b1))>>>0;

/** Mirrors reward rounding boundaries, consuming runtime generators; no simulation or save access. */
export function economyKill(config:EconomyConfig,kind:EnemyKind,rank:EnemyRank,seed:number):Income {
  const source=difficultyEnemyStats(scaledEnemyStats(kind,config.area,rank),config.difficulty);
  const goldMultiplier=(1+config.goldFind/100);
  const gold=rollEnemyGold(seed,config.area,rank)*(ENEMY_LOOT_YIELD[kind]??1);
  // Gold difficulty is applied together with gold-find, before runtime rounding.
  const coins=Math.round(gold*goldMultiplier*worldDifficulty(config.difficulty).gold)*config.collect/100;
  const items=rollEnemyLoot({seed,level:config.area,playerLevel:config.player,rank,kind,biome:config.biome,difficulty:config.difficulty,encounter:kind==='goblinChief'?'boss':undefined});
  return {coins,sales:items.reduce((sum,item)=>sum+itemPrice(item,'sell'),0)*config.sell/100,
    xp:Math.max(1,Math.round(source.xpReward*xpLevelFactor(config.player,config.area)*(1+config.xpBonus/100)))};
}
export function economyActivity(config:EconomyConfig,seed:number):Income {
  const reward=eventRewards({id:'economy-fixture',name:'Economy fixture',x:0,y:0,seed,biome:config.biome,level:config.area,
    kind:config.activity,difficulty:config.difficulty,phase:'completed',choice:null,delivered:0,wavesCleared:config.waves,bonusGranted:false},config.player);
  return {coins:Math.round(reward.gold*(1+config.goldFind/100))*config.collect/100,
    sales:reward.items.reduce((sum,item)=>sum+itemPrice(item,'sell'),0)*config.sell/100,
    xp:Math.round(reward.xp*xpLevelFactor(config.player,config.area)*(1+config.xpBonus/100))};
}
export interface EconomyEstimate {
  kill:Income; activity:Income; perMinute:Income; session:Income; minutesPerLevel:number|null; goldPerLevel:number|null;
  killSamples:number; activitySamples:number;
}
/** Finite deterministic stratified sampling: the chosen mix is exact, loot rolls are sampled. */
export function estimateEconomy(config:EconomyConfig,samples=2048):EconomyEstimate {
  validateEconomy(config);
  if(!Number.isInteger(samples)||samples<1||samples>8192)throw new RangeError('Sample count must be 1–8192.');
  const kill=empty(),activity=empty();let killSamples=0,activitySamples=0;
  const ranks:readonly [EnemyRank,number][]=[['normal',(100-config.champion-config.elite)/100],['veteran',config.champion/100],['elite',config.elite/100]];
  const kinds:readonly [EnemyKind,number][]=[[config.kind,1-config.goblins/100],['goblin',config.goblins/100]];
  if(config.killsPerMinute>0)for(const [kind,share] of kinds)for(const [rank,weight] of ranks) {
    if(!share||!weight)continue;
    for(let i=0;i<samples;i++){add(kill,economyKill(config,kind,rank,seedAt(config.seed,i)),share*weight/samples);killSamples++;}
  }
  if(config.activitiesPerHour>0)for(let i=0;i<Math.min(samples,512);i++) {
    add(activity,economyActivity(config,seedAt(config.seed^0x4312,i)),1/Math.min(samples,512));activitySamples++;
  }
  const perMinute=empty();add(perMinute,kill,config.killsPerMinute);add(perMinute,activity,config.activitiesPerHour/60);
  const session=empty();add(session,perMinute,config.minutes);
  const minutesPerLevel=perMinute.xp>0?xpForNextLevel(config.player)/perMinute.xp:null;
  return {kill,activity,perMinute,session,minutesPerLevel,goldPerLevel:minutesPerLevel===null?null:minutesPerLevel*(perMinute.coins+perMinute.sales),killSamples,activitySamples};
}
export function economyItem(config:EconomyConfig):Item {
  validateEconomy(config);
  const item=generateItem(config.seed,config.itemLevel,config.itemKind,config.itemKind==='weapon'?'longsword':undefined,config.tier,config.itemKind==='charm'?undefined:config.material);
  return deriveItem({...item,recipe:{...item.recipe,enhancement:config.rank}});
}
export interface EnhancementCost { from:number; to:number; fee:number; cumulative:number; minutes:number|null; }
/** Sequential useful upgrades, including the production free-skip rule. Each useful step is guaranteed. */
export function enhancementCosts(item:Item,goldPerMinute:number):EnhancementCost[] {
  if(!Number.isFinite(goldPerMinute)||goldPerMinute<0)throw new RangeError('Income must be finite and non-negative.');
  let current=item,cumulative=0;const rows:EnhancementCost[]=[];
  for(let count=0;count<10;count++) {
    const to=nextEnhancementLevel(current);if(to===null)break;
    const fee=improvementPrice(current,'enhance',current.itemLevel);
    cumulative+=fee;rows.push({from:current.recipe.enhancement,to,fee,cumulative,minutes:goldPerMinute>0?fee/goldPerMinute:null});
    current=deriveItem({...current,recipe:{...current.recipe,starter:false,enhancement:to}});
  }
  return rows;
}
