import { difficultyEnemyStats } from './world-difficulty.ts';
import type { Enemy } from './model.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { riftBonus, riftEnemyStats } from './rift-content.ts';
const TRAITS=Object.freeze([
  Object.freeze({id:'swift',color:'#7ce4ed',label:'Swift',name:'Swift',description:'+15% movement speed',speed:1.15,recovery:1,damage:1,control:1}),
  Object.freeze({id:'relentless',color:'#ffc774',label:'Relentless',name:'Relentless',description:'20% shorter attack recovery',speed:1,recovery:.8,damage:1,control:1}),
  Object.freeze({id:'savage',color:'#f8799a',label:'Savage',name:'Savage',description:'+10% damage',speed:1,recovery:1,damage:1.1,control:1}),
  Object.freeze({id:'resolute',color:'#caa4fc',label:'Resolute',name:'Resolute',description:'25% shorter control effects',speed:1,recovery:1,damage:1,control:.75}),
]);
type Source=Pick<Enemy,'kind'|'rank'> & Partial<Pick<Enemy,'lootSeed'|'rift'|'difficulty'|'rewardDifficulty'>>;
const EMPTY:readonly typeof TRAITS[number][]=Object.freeze([]);
const SETS=Array.from({length:8},(_,i)=>Object.freeze(i<4?[TRAITS[i]]:[TRAITS[i-4],TRAITS[(i-4+1)%4]]));
export function enemyModifiers(e:Source):readonly typeof TRAITS[number][]{
  if(e.rank==='normal'||isBossKind(e.kind)||e.lootSeed===undefined)return EMPTY;
  let n=Math.imul(e.lootSeed^(e.lootSeed>>>16),0x45d9f3b);n=(n^(n>>>16))>>>0;
  return SETS[n%4+(e.rank==='elite'?4:0)];
}
export function enemyMovementMultiplier(e:Source):number{return enemyModifiers(e).reduce((n,m)=>n*m.speed,1)*(1+riftBonus(e.rift,'swift')/100);}
export function enemyVisualScale(e:Source):number{return isBossKind(e.kind)?1:e.rank==='elite'?1.28:e.rank==='veteran'?1.14:1;}

/** Spawn and save restoration must apply the same snapshotted combat modifiers. */
export function applyEnemyModifiers<T extends {maxHp:number;damage:number}>(stats:T, source:Source):T {
  const result=difficultyEnemyStats(riftEnemyStats(stats,source.rift),source.difficulty,source.rewardDifficulty??source.difficulty);
  return {...result,damage:Math.round(result.damage*enemyModifiers(source).reduce((value,trait)=>value*trait.damage,1))};
}
