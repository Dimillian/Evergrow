import { benchmarkSheet, type BenchmarkStyle } from './resource-benchmark.ts';
import { allocateSkillRoute, buildSkillRoutes, previewSkillRoute } from './skill-tree-routes.ts';
import { SKILL_TREE, SKILL_NODES } from './skill-tree.ts';
import { generateItem } from './items.ts';
import { SHIELD_PROFILES } from './weapon-content.ts';
import type { SkillId, StatKey, StatModifiers } from './character-types.ts';
export const ATLAS_BENCHMARK_LEVELS = [10,25,50,100] as const;
export const ATLAS_BENCHMARK_BUILDS = [
  { name:'Greatblade', style:'melee', skill:'cleave', weapon:'greatblade', shield:false },
  { name:'Bow', style:'bow', skill:'ricochet', weapon:'thorn-shortbow', shield:false },
  { name:'Staff', style:'caster', skill:'arcLightning', weapon:'ember-staff', shield:false },
  { name:'Shield', style:'melee', skill:'shieldBash', weapon:'longsword', shield:true },
  { name:'Dagger', style:'melee', skill:'backstab', weapon:'rondel-dagger', shield:true },
] as const satisfies readonly {name:string;style:BenchmarkStyle;skill:SkillId;weapon:string;shield:boolean}[];
/** Spend every point on connected routes. A disclosed heuristic, not a claimed optimal build. */
export function atlasBenchmarkSheet(level:number,build:typeof ATLAS_BENCHMARK_BUILDS[number]) {
  const sheet=benchmarkSheet(level,build.style,'ordinary');
  sheet.allocatedNodes=['origin'];sheet.skillPoints=level-1;sheet.skillRanks={};sheet.activeSkillRanks={};sheet.skillSpecializations={};sheet.skillSlots=[build.skill,null,null,null,null];
  if(!allocateSkillRoute(sheet,`skill:${build.skill}`).ok)throw Error('Benchmark level cannot afford its skill');
  const rank=Math.min(3,1+sheet.skillPoints);sheet.skillRanks[build.skill]=rank;sheet.skillPoints-=rank-1;
  sheet.equipped.weapon=generateItem(7319,level,'weapon',build.weapon,'rare');
  sheet.equipped.offhand=build.shield?generateItem(7757,level,'shield',SHIELD_PROFILES[0].id,'rare'):null;
  const weights:Partial<Record<StatKey,number>>={strength:build.style==='caster'?0:1.5,intelligence:build.style==='caster'?2:.3,
    dexterity:.6,vitality:.6,maxHp:.08,armor:.08,allResistance:.7,fireResistance:.15,frostResistance:.15,lightningResistance:.15,arcaneResistance:.15,
    damagePercent:build.style==='caster'?0:1,spellDamagePercent:build.style==='caster'?1:0,attackSpeedPercent:build.style==='caster'?0:1.3,castSpeedPercent:build.style==='caster'?1.3:0,
    manaRegen:1.8,maxMana:.12,manaCostPercent:1.2,manaOnKill:.4,critChance:1,critDamage:.4,lifeOnHit:.6,lifeRegen:.4,areaPercent:.2,potionPercent:.2,
    blockChance:build.shield?.6:0,blockReduction:build.shield?.2:0};
  const value=(bonuses:StatModifiers)=>Object.entries(bonuses).reduce((sum,[key,amount])=>sum+amount*(weights[key as StatKey]??0),0);
  while(sheet.skillPoints){
    const owned=new Set(sheet.allocatedNodes),routes=buildSkillRoutes(owned);
    const candidates=SKILL_TREE.nodes.filter(n=>!owned.has(n.id)&&!n.skill&&!n.specialization&&!n.keystone&&routes.has(n.id)&&routes.get(n.id)!.cost<=sheet.skillPoints)
      .map(n=>{const path=previewSkillRoute(routes,n.id).filter(id=>!owned.has(id));return {id:n.id,score:path.reduce((sum,id)=>sum+value(SKILL_NODES.get(id)!.bonuses),0)/path.length};})
      .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    if(!candidates.length||!allocateSkillRoute(sheet,candidates[0].id).ok)throw Error('Benchmark failed to spend a connected budget');
  }
  return sheet;
}
