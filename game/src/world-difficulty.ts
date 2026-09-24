import type { ItemTier } from './character-types.ts';

export const WORLD_DIFFICULTIES = Object.freeze([
  Object.freeze({id:'normal', name:'Normal', subtitle:'The untamed frontier', health:1, damage:1, experience:1, gold:1, quality:1, color:'#a9c9bc', metal:'#91aaa5'}),
  Object.freeze({id:'veteran', name:'Veteran', subtitle:'For a proven adventurer', health:1.6, damage:1.25, experience:1.2, gold:1.25, quality:1.2, color:'#dfbd7b', metal:'#bda67d'}),
  Object.freeze({id:'nightmare', name:'Nightmare', subtitle:'Where the shadows hunger', health:2.6, damage:1.55, experience:1.45, gold:1.6, quality:1.45, color:'#bb9cec', metal:'#9c92b9'}),
  Object.freeze({id:'cataclysm', name:'Cataclysm', subtitle:'The world fights back', health:4, damage:1.9, experience:1.75, gold:2, quality:1.75, color:'#ee8ca4', metal:'#bc8797'}),
] as const);
export type WorldDifficulty = typeof WORLD_DIFFICULTIES[number]['id'];
export function validWorldDifficulty(value:unknown):value is WorldDifficulty {
  return WORLD_DIFFICULTIES.some(d=>d.id===value);
}
export function worldDifficulty(id:WorldDifficulty|undefined) { return WORLD_DIFFICULTIES.find(d=>d.id===id)??WORLD_DIFFICULTIES[0]; }
/** Rewards cannot be upgraded by changing difficulty after an encounter has started. */
export function lesserDifficulty(a:WorldDifficulty|undefined,b:WorldDifficulty|undefined):WorldDifficulty {
  return WORLD_DIFFICULTIES[Math.min(WORLD_DIFFICULTIES.indexOf(worldDifficulty(a)),WORLD_DIFFICULTIES.indexOf(worldDifficulty(b)))].id;
}
export function difficultyEnemyStats<T extends {maxHp:number;damage:number;xpReward?:number}>(stats:T,id:WorldDifficulty|undefined,rewardId:WorldDifficulty|undefined=id):T {
  const difficulty=worldDifficulty(id),reward=worldDifficulty(rewardId);
  return {...stats,maxHp:stats.maxHp*difficulty.health,damage:Math.round(stats.damage*difficulty.damage),...(stats.xpReward===undefined?{}:{xpReward:Math.round(stats.xpReward*reward.experience)})};
}
/** Store health in Normal-equivalent units, preserving exact wounds across tier changes. */
export function storedDifficultyHealth(enemy:{hp:number;maxHp:number;difficulty?:WorldDifficulty}):number {
  const divisor=worldDifficulty(enemy.difficulty).health;
  // Base health is integral. Avoid e.g. 48 * 1.6 / 1.6 becoming 48.00000000000001,
  // which would reject a valid full-health actor at the save boundary.
  return Math.min(Math.round(enemy.maxHp/divisor),Math.max(0,enemy.hp)/divisor);
}
export function difficultyLootWeights(weights:Readonly<Record<ItemTier,number>>,id:WorldDifficulty|undefined):Readonly<Record<ItemTier,number>> {
  const quality=worldDifficulty(id).quality;
  if(quality===1)return weights;
  return {...weights,epic:weights.epic*quality,legendary:weights.legendary*quality,unique:weights.unique*quality};
}
