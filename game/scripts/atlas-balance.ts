/** Deterministic, save-free balance probes. Run from the repository root. */
import { writeFileSync } from 'node:fs';
import { ATLAS_BENCHMARK_LEVELS, ATLAS_BENCHMARK_BUILDS, atlasBenchmarkSheet } from '../src/atlas-benchmark.ts';
import { SkillStudy, studyWeapons } from '../src/tools/skill-scene.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
function run(s:SkillStudy){while(s.elapsed<s.duration&&!s.simulation.player.dead)s.step();return {damage:Math.round(s.damage),dps:Math.round(s.damage/s.elapsed),casts:s.casts,manaSpent:Math.round(s.manaSpent),manaLeft:Math.round(s.simulation.player.mana),damageTaken:s.damageTaken,absorbed:s.absorbed,lifeLeft:s.simulation.player.hp};}
const builds=ATLAS_BENCHMARK_LEVELS.flatMap(level=>ATLAS_BENCHMARK_BUILDS.map(build=>{
 const sheet=atlasBenchmarkSheet(level,build),base={skill:build.skill,weapon:build.weapon,rank:3,specialization:'',facing:0,enemy:'brute' as const,x:0,y:0,level};
 const single=new SkillStudy(world,{...base,scenario:'sustain',targets:'single'},sheet),stats=single.simulation.player.derived;
 return {level,build:build.name,pointsSpent:sheet.allocatedNodes.length-1+Object.values(sheet.skillRanks).reduce((sum,r)=>sum+r-1,0),unspent:sheet.skillPoints,allocated:sheet.allocatedNodes,
  maxHp:stats.maxHp,maxMana:stats.maxMana,manaRegen:stats.manaRegeneration,physicalReduction:stats.damageReduction,
  single:run(single),pack:run(new SkillStudy(world,{...base,scenario:'sustain',targets:'fan'},sheet)),baseline:run(new SkillStudy(world,{...base,scenario:'sustain',targets:'single',baseline:true},sheet))};
}));
const skills=Object.values(SKILL_DEFINITIONS).map(skill=>{
 const base={skill:skill.id,weapon:studyWeapons(skill.id)[0].id,rank:3,specialization:'',facing:0,enemy:'brute' as const,x:0,y:0,level:50};
 return {skill:skill.id,followup:run(new SkillStudy(world,{...base,scenario:'followup',targets:'single'})),baseline:run(new SkillStudy(world,{...base,scenario:'followup',targets:'single',baseline:true})),defense:run(new SkillStudy(world,{...base,scenario:'defense',targets:'single'})),unprotected:run(new SkillStudy(world,{...base,scenario:'defense',targets:'single',baseline:true})),sustain:run(new SkillStudy(world,{...base,scenario:'sustain',targets:'single'}))};
});
writeFileSync(process.argv[2]??'/tmp/atlas-balance.json',JSON.stringify({nodes:SKILL_TREE.nodes.length,edges:SKILL_TREE.edges.length,clusters:SKILL_TREE.clusters.length,skills:skills.length,techniques:SKILL_SPECIALIZATIONS.length,
 assumptions:['Matched levels 10/25/50/100, same seeded Rare item budgets, up to rank 3, 3 offensive + 2 Vitality attribute points per level; one shield on one-handed fixtures, no charms or enhancement.',
 'All skill points spent on connected routes using disclosed weights in atlas-benchmark.ts. This is one reproducible build heuristic, not exhaustive optimization.',
 '30 seconds of real 120 Hz actions, finite starting mana and passive recovery; cooldown/mana rejection falls back to basics. No potions, kills, enemy AI, pickups or player movement.',
 'Single dummy or seven stationary dummies in a frontal fan. Skill range, target caps, armor/crit and actual projectile contacts apply. No claim about boss time-to-kill or survivability.',
 'Separate all-skill probes use level-50 common weapons, free isolated unlocks and no tree passives, with 12-second follow-up/physical-pressure comparisons. No saved characters or browser gameplay.'],builds,skillProbes:skills},null,2)+'\n');
