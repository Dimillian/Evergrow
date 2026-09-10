import { dungeonTheme, DUNGEON_THEME_IDS } from './dungeon-content.ts';
import { dungeonRandom, type DungeonEntrance } from './dungeon.ts';
import type { Item, ItemTier } from './character-types.ts';
import { rollEnemyLoot, selectLootWeight } from './loot.ts';
import type { Expeditions, DungeonRun } from './dungeon-state.ts';
export const EXPEDITION_RULES = Object.freeze({minimumLevel:20, stages:10});
export const EXPEDITION_MODIFIERS = Object.freeze({
  elite:{name:'Elite guard',description:'Every fourth chamber guard is Elite.'},
  ranged:{name:'Firing lines',description:'Every third chamber guard is an archer.'},
  peril:{name:'Deep peril',description:'All enemies and rewards are 2 levels higher.'},
});
export interface ExpeditionRoute {attempt:number;seed:number;base:number;cleared:number;choice:number|null;status:'active'|'failed'|'complete'}
export function newExpeditionRoute(worldSeed:number,level:number,attempt:number):ExpeditionRoute {
  return {attempt,seed:(worldSeed^Math.imul(attempt,0x9e3779b9))>>>0,base:Math.max(20,Math.min(999980,Math.floor(level))),cleared:0,choice:null,status:'active'};
}
export function expeditionChoices(route:ExpeditionRoute,point={x:0,y:0}):DungeonEntrance[] {
  if(route.status!=='active'||route.cleared>=10)return [];
  const random=dungeonRandom((route.seed+Math.imul(route.cleared+1,731991))>>>0);
  const count=random()<.65?2:1, first=Math.floor(random()*DUNGEON_THEME_IDS.length);
  return Array.from({length:count},(_,choice)=>{
    const theme=DUNGEON_THEME_IDS[(first+choice*(1+Math.floor(random()*5)))%DUNGEON_THEME_IDS.length];
    const modifier=(['elite','ranged','peril'] as const)[Math.floor(random()*3)];
    const level=route.base+route.cleared+(modifier==='peril'?2:0), seed=Math.floor(random()*4294967296)>>>0;
    const biome=theme==='rime'?'frostpine':theme==='ossuary'?'sunscar':theme==='foundry'?'emberfall':theme==='drowned'?'swamp':theme==='astral'?'highlands':'verdant';
    return {id:`dungeon:expedition:${route.attempt}:${route.cleared}:${choice}`,name:dungeonTheme(seed,theme).name,seed,theme,level,biome,...point,scaling:{base:level,min:Math.max(1,level-1),max:level+1},expedition:{attempt:route.attempt,stage:route.cleared,choice,modifier}};
  });
}
export function expeditionRewardItems(entrance:DungeonEntrance):Item[] {
  const grand=entrance.expedition?.stage===9, random=dungeonRandom(entrance.seed^0x47c593a1);
  const weights=grand?{rare:15,epic:65,legendary:20}:{rare:60,epic:35,legendary:5};
  return Array.from({length:grand?6:3},(_,i)=>{
    return rollEnemyLoot({tierOverride:selectLootWeight(weights,random()) as ItemTier,seed:(entrance.seed+Math.imul(i+1,0x6d2b79f5))>>>0,level:entrance.level+3,rank:'normal',biome:entrance.biome,kind:'stalker',firstKill:true,encounter:'bossChest'})[0];
  });
}
export function dungeonChestMask(run:DungeonRun,index:number):number {return index===2 ? run.entrance.expedition?.stage===9?127:15 : 9;}
export function completeExpeditionStage(state:Expeditions,run:DungeonRun):void {
  const route=state.route,tag=run.entrance.expedition;
  if(!route||!tag||route.status!=='active'||route.attempt!==tag.attempt||route.cleared!==tag.stage||route.choice!==tag.choice||run.chestMasks[2]!==dungeonChestMask(run,2))return;
  route.cleared++;route.choice=null;if(route.cleared===10)route.status='complete';
}
export function validExpeditionRoute(v:unknown):v is ExpeditionRoute {
  if(!v||typeof v!=='object')return false;
  const r=v as ExpeditionRoute;
  return Number.isSafeInteger(r.attempt)&&r.attempt>=1&&r.attempt<1e9&&Number.isInteger(r.seed)&&r.seed>=0&&r.seed<=4294967295
    &&Number.isInteger(r.base)&&r.base>=20&&r.base<=999980&&Number.isInteger(r.cleared)&&r.cleared>=0&&r.cleared<=10
    &&['active','failed','complete'].includes(r.status)&&(r.choice===null||Number.isInteger(r.choice)&&r.choice>=0&&r.choice<2)
    &&(r.status==='complete'?r.cleared===10&&r.choice===null:r.cleared<10)&&(r.status!=='failed'||r.choice===null)
    &&(r.choice===null||!!expeditionChoices(r)[r.choice]);
}
