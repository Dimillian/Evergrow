/** Read-only, save-free balance audit. Uses the real gear, tree and combat pipeline. */
import { writeFileSync } from 'node:fs';
import { atlasBenchmarkSheet, ATLAS_BENCHMARK_BUILDS } from '../src/atlas-benchmark.ts';
import { SkillStudy, studyWeapons } from '../src/skill-showcase.ts';
import { generateItem, EQUIPMENT_SLOTS } from '../src/items.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { SKILL_TREE, getTreeBonuses } from '../src/skill-tree.ts';
import type { ItemKind, StatKey } from '../src/character-types.ts';

const world = { blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}) };
const fixtures = [
  { name:'Greatblade / Cleave', base:0, weapon:'greatblade' },
  { name:'Shortbow / Ricochet', base:1, weapon:'thorn-shortbow' },
  { name:'Longbow / Ricochet', base:1, weapon:'warden-longbow' },
  { name:'Staff / Arc Lightning', base:2, weapon:'ember-staff' },
  { name:'Wand + grimoire / Arc Lightning', base:2, weapon:'cinder-wand', offhand:'ember-codex', kind:'grimoire' },
  { name:'Wand + orb / Arc Lightning', base:2, weapon:'cinder-wand', offhand:'cinder-orb', kind:'orb' },
] as const;
function run(study:SkillStudy) {
  // High-level cleaves exceed the interactive study's one-million-life dummies.
  // Keep them alive so deaths/kill rewards cannot distort sustained comparisons.
  const targetLife=1e9;
  for(const enemy of study.simulation.enemies)enemy.hp=enemy.maxHp=targetLife;
  while(study.elapsed<study.duration&&!study.simulation.player.dead)study.step();
  if(study.simulation.enemies.some(enemy=>enemy.hp<=0))throw new Error('Audit target life exhausted');
  const damage=study.simulation.enemies.reduce((sum,enemy)=>sum+targetLife-enemy.hp,0);
  return {dps:damage/study.elapsed,casts:study.casts,manaSpent:study.manaSpent};
}
const rows=[];
for(const level of [10,25,50,100]) for(const fixture of fixtures) {
  const build=ATLAS_BENCHMARK_BUILDS[fixture.base], template=atlasBenchmarkSheet(level,build);
  for(const tier of ['rare','epic'] as const) for(let sample=0;sample<12;sample++) {
    const sheet=structuredClone(template), seed=7319+sample*1009;
    for(const [index,slot] of EQUIPMENT_SLOTS.entries()) {
      if(slot==='offhand') {sheet.equipped.offhand='offhand' in fixture ? generateItem(seed+index*73,level,fixture.kind,fixture.offhand,tier) : null; continue;}
      const kind:ItemKind=slot==='ring1'||slot==='ring2'?'ring':slot;
      const armor=['head','chest','gloves','legs','boots'].includes(kind);
      sheet.equipped[slot]=generateItem(seed+index*73,level,kind,slot==='weapon'?fixture.weapon:undefined,tier,
        armor?(build.style==='caster'?'cloth':'leather'):undefined);
    }
    const options={skill:build.skill,weapon:fixture.weapon,rank:3,specialization:'',facing:0,enemy:'brute' as const,x:0,y:0,level,scenario:'sustain' as const};
    const single=new SkillStudy(world,{...options,targets:'single'},sheet),p=single.simulation.player;
    rows.push({level,tier,sample,build:fixture.name,tree:getTreeBonuses(sheet.allocatedNodes),
      mana:p.maxMana,regen:p.derived.manaRegeneration,physical:p.derived.attackDamageMultiplier,spell:p.derived.spellDamageMultiplier,
      crit:p.derived.critChance,critDamage:p.derived.critMultiplier,armor:p.derived.armor,
      single:run(single),fan:run(new SkillStudy(world,{...options,targets:'fan'},sheet))});
  }
}
const variants=[];
for(const skill of Object.values(SKILL_DEFINITIONS).filter(s=>s.damageMultiplier>0)) {
  for(const specialization of ['',...SKILL_SPECIALIZATIONS.filter(s=>s.skill===skill.id).map(s=>s.id)]) {
    const options={skill:skill.id,weapon:studyWeapons(skill.id)[0].id,rank:3,specialization,facing:0,enemy:'brute' as const,x:0,y:0,level:50,scenario:'sustain' as const};
    variants.push({skill:skill.id,specialization,single:run(new SkillStudy(world,{...options,targets:'single'})),fan:run(new SkillStudy(world,{...options,targets:'fan'}))});
  }
}
const stats:StatKey[]=['damagePercent','spellDamagePercent','attackSpeedPercent','castSpeedPercent','strength','intelligence','dexterity','manaRegen','manaOnKill'];
const tree=Object.fromEntries(stats.map(stat=>{const nodes=SKILL_TREE.nodes.filter(n=>(n.bonuses[stat]??0)>0);return [stat,{nodes:nodes.length,total:nodes.reduce((sum,n)=>sum+(n.bonuses[stat]??0),0)}]}));
writeFileSync(process.argv[2]??'/tmp/physical-caster-audit.json',JSON.stringify({
  assumptions:[
    'Current local rules including reduced non-spell skill costs. No saved characters, cloud access or browser gameplay.',
    'Levels 10/25/50/100; 12 paired seeds; Rare and Epic; no enhancements, charms or Uniques. Physical leather vs caster linen intentionally samples offensive armor identities.',
    'All level-earned tree points spent using existing disclosed atlas-benchmark heuristic; rank up to 3, three Strength/Intelligence plus two Vitality per level. Fixed routes per archetype, not optimized for each gear sample.',
    '30 seconds of real 120 Hz attacks, passive recovery, finite mana and free-basic fallback. One or seven stationary immortal targets in a frontal fan; no AI pressure, kills, potions, pickups or player movement.',
    'Melee fan places seven enemies within melee range; ranged fan at 140 units. This favors melee contact and is not a simulation of real clear speed or survivability.',
    'Separate variant probes use level-50 Common weapons, rank 3, isolated unlocks and no passive investments. They diagnose actions, not compare fully built characters.',
    'Tree totals are catalog coverage, not attainable one-build budgets. Gear is unselected random loot, not best-in-slot.'
  ],tree,rows,variants},null,2)+'\n');
