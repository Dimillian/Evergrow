import { execFileSync } from 'node:child_process';
import { ITEM_ROLL_RULES } from '../src/item-roll-content.ts';
import { SKILL_DAMAGE_RANK_RULES } from '../src/skill-progression.ts';
import { ATTRIBUTE_DAMAGE_BONUSES } from '../src/attribute-content.ts';
import { writeFileSync } from 'node:fs';
import { benchmarkPlayer, BENCHMARK_SKILLS, BENCHMARK_LEVELS } from '../src/resource-benchmark.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { characterModifierSources } from '../src/character-stats.ts';
import { getTreeBonuses } from '../src/skill-tree.ts';
import { refreshCharacter } from '../src/character.ts';
import { resolveSkill, SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { SkillStudy, studyWeapons } from '../src/tools/skill-scene.ts';
import { itemPowerScale, monsterHealthScale } from '../src/progression-content.ts';
import { generateItem, deriveItem, itemAffixPool, EQUIPMENT_SLOTS } from '../src/items.ts';
import type { SkillId, ItemKind, StatKey } from '../src/character-types.ts';
import type { EnemyKind } from '../src/model.ts';

const round=(n:number)=>Math.round(n*1000)/1000;
/** Uses the existing disposable skill study. Pinned high-life targets isolate contacts,
 * not survival or practical DPS. No saves, browser, cloud or production rule changes. */
function contactProbe(skill:SkillId,variant:string,targetCount:number,distance:number,kind:EnemyKind='warden') {
  const preferred=SKILL_DEFINITIONS[skill].requirement==='magic'?'ember-staff':
    SKILL_DEFINITIONS[skill].requirement==='bow'?'thorn-shortbow':studyWeapons(skill)[0].id;
  const study=new SkillStudy({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},
    {skill,rank:1,specialization:variant,weapon:preferred,facing:0,targets:'none',enemy:kind,x:0,y:0});
  const sim=study.simulation,p=sim.player;
  p.derived.critChance=0;
  // A large training weapon keeps per-contact integer rounding from hiding coefficients.
  p.equipment.mainHand.damage=1000;
  const attack=deriveAttackStats(p.stats,p.equipment.mainHand);
  const targets=Array.from({length:targetCount},(_,i)=>{
    const angle=(i-(targetCount-1)/2)*.12;
    const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance;
    const e=sim.spawnEnemy(kind,x,y)!;e.hp=e.maxHp=1e8;e.angle=Math.PI;
    return {e,x,y};
  });
  sim.drainEvents();let direct=0,periodic=0,contacts=0,casts=0;
  const perTarget:Record<number,{direct:number;periodic:number;contacts:number}>={};
  for(let tick=0;tick<2400;tick++) {
    for(const {e,x,y} of targets){e.x=x;e.y=y;e.stagger=60;e.knockbackX=e.knockbackY=0;}
    p.invulnerable=1;
    sim.update(1/120,{...study.input,aimX:distance,aimY:0,skillSlot:tick===0?0:null});
    for(const event of sim.drainEvents()) {
      if(event.type==='cast'||event.type==='swing')casts++;
      if(event.type!=='hit')continue;
      const entry=perTarget[event.targetId]??={direct:0,periodic:0,contacts:0};
      if(event.periodic){periodic+=event.value;entry.periodic+=event.value;}
      else {direct+=event.value;contacts++;entry.direct+=event.value;entry.contacts++;}
    }
  }
  if(casts!==1)throw new Error(`${skill}/${variant}: expected one cast, got ${casts}`);
  return {skill,variant:variant||'original',targetCount,distance,kind,weaponDamage:attack.damage,
    mana:study.resolved.mana,cooldown:study.resolved.cooldown,contacts,
    direct:round(direct/attack.damage),periodic:round(periodic/attack.damage),
    maximumTargetDirect:round(Math.max(0,...Object.values(perTarget).map(v=>v.direct))/attack.damage),
    perTarget:Object.values(perTarget).map(v=>({...v,direct:round(v.direct/attack.damage),periodic:round(v.periodic/attack.damage)}))};
}

const builds=BENCHMARK_LEVELS.flatMap(level=>(['melee','bow','caster'] as const).flatMap(style=>(['ordinary','strong'] as const).map(gear=>{
  const p=benchmarkPlayer(level,style,gear),skill=BENCHMARK_SKILLS[style];
  const attack=deriveAttackStats(p.stats,p.equipment.mainHand),r=resolveSkill(skill,p.derived,p.character);
  const expected=attack.damage*r.damageMultiplier*(1+p.derived.critChance*(p.derived.critMultiplier-1));
  const sources=characterModifierSources(p.character,getTreeBonuses(p.character.allocatedNodes),level);
  const original=structuredClone(p.character);
  const counterfactuals=Object.fromEntries(['noAllocatedOffense','noGearOffense','noCriticals','rankOne'].map(mode=>{
    p.character=structuredClone(original);
    if(mode==='noAllocatedOffense')p.character.attributes[style==='caster'?'intelligence':'strength']=10;
    if(mode==='noGearOffense') for(const item of Object.values(p.character.equipped))if(item){
      for(const key of ['strength','dexterity','intelligence','damagePercent','spellDamagePercent','critChance','critDamage','attackSpeedPercent','castSpeedPercent'] as const)delete item.implicit[key];
      item.affixes=item.affixes.filter(a=>!['strength','dexterity','intelligence','damagePercent','spellDamagePercent','critChance','critDamage','attackSpeedPercent','castSpeedPercent'].includes(a.stat)&&!a.stat.startsWith('skill:'));
    }
    if(mode==='rankOne'){p.character.skillRanks[skill]=1;p.character.activeSkillRanks[skill]=1;}
    refreshCharacter(p);
    const a=deriveAttackStats(p.stats,p.equipment.mainHand),s=resolveSkill(skill,p.derived,p.character);
    return [mode,round(a.damage*s.damageMultiplier*(mode==='noCriticals'?1:1+p.derived.critChance*(p.derived.critMultiplier-1)))];
  }));
  p.character=original;refreshCharacter(p);
  return {level,style,gear,skill,weapon:p.equipment.mainHand.name,rawWeaponDamage:p.equipment.mainHand.damage,
    attributes:p.derived.attributes,attackMultiplier:p.derived.attackDamageMultiplier,spellMultiplier:p.derived.spellDamageMultiplier,
    derivedWeaponDamage:attack.damage,skillMultiplier:r.damageMultiplier,rank:r.rank,bonusRanks:r.bonusRanks,
    critChance:p.derived.critChance,critMultiplier:p.derived.critMultiplier,actionsPerSecond:attack.attacksPerSecond,
    noncritical:round(attack.damage*r.damageMultiplier),expectedFirstHit:round(expected),expectedFirstTargetDps:round(expected*attack.attacksPerSecond),
    normalHp:scaledEnemyStats('stalker',level,'normal').maxHp,
    eliteHp:scaledEnemyStats('stalker',level+2,'elite').maxHp,
    eliteBruteHp:scaledEnemyStats('brute',level+2,'elite').maxHp,
    bossHp:scaledEnemyStats('warden',level+3,'normal').maxHp,counterfactuals,
    sources:sources.map(s=>({label:s.label,modifiers:s.modifiers}))};
})));
const contacts=Object.keys(SKILL_DEFINITIONS).flatMap(id=>{
  const skill=id as SkillId,near=['melee','blade','heavy','dagger','shield'].includes(SKILL_DEFINITIONS[skill].requirement);
  return ['',...SKILL_SPECIALIZATIONS.filter(s=>s.skill===skill).map(s=>s.id)].flatMap(variant=>
    [contactProbe(skill,variant,1,near?35:100),contactProbe(skill,variant,8,near?35:100)]);
});
const distances=(['fireball','volley','frostLance','meteor','cataclysm'] as SkillId[]).flatMap(skill=>
  ['',...SKILL_SPECIALIZATIONS.filter(s=>s.skill===skill).map(s=>s.id)].flatMap(v=>
    [35,100,300].flatMap(distance=>(['stalker','warden'] as EnemyKind[]).map(kind=>contactProbe(skill,v,1,distance,kind)))));
const scaling=[1,10,20,35,50,100].map(level=>({level,weapon:round(itemPowerScale(level)),monsterHp:round(monsterHealthScale(level)),
  casterWithThreeOffensePoints:round(itemPowerScale(level)*(1+3*ATTRIBUTE_DAMAGE_BONUSES.intelligence/100*(level-1))),
  physicalWithThreeOffensePoints:round(itemPowerScale(level)*(1+3*ATTRIBUTE_DAMAGE_BONUSES.strength/100*(level-1)))}));
const gearSamples=(['melee','bow','caster'] as const).map(style=>{
  const samples=Array.from({length:100},(_,sample)=>{
    const p=benchmarkPlayer(35,style,'strong'),skill=BENCHMARK_SKILLS[style];
    p.character.inventory=[];delete p.character.inventoryLayout;
    for(const slot of EQUIPMENT_SLOTS)p.character.equipped[slot]=null;
    const evaluate=()=>{
      refreshCharacter(p);
      const a=deriveAttackStats(p.stats,p.equipment.mainHand),s=resolveSkill(skill,p.derived,p.character);
      const hit=a.damage*s.damageMultiplier*(1+p.derived.critChance*(p.derived.critMultiplier-1));
      return {hit,noncritical:a.damage*s.damageMultiplier,dps:hit*a.attacksPerSecond,crit:p.derived.critChance,critMultiplier:p.derived.critMultiplier,rate:a.attacksPerSecond,bonusRanks:s.bonusRanks,
        intelligence:p.derived.attributes.intelligence,strength:p.derived.attributes.strength,rawWeapon:p.equipment.mainHand.damage,
        elementalShare:a.elementalDamage/a.damage};
    };
    for(const [slotIndex,slot] of EQUIPMENT_SLOTS.entries()) {
      if(slot==='offhand')continue;
      const kind:ItemKind=slot==='ring1'||slot==='ring2'?'ring':slot;
      const profiles=style==='melee'?['longsword','greatblade','hand-axe','greataxe']:style==='bow'?['thorn-shortbow','warden-longbow']:['ember-staff','storm-staff'];
      let best=-Infinity,winner=null;
      for(let choice=0;choice<8;choice++){
        let item=generateItem(100000+sample*1000+slotIndex*80+choice,35,kind,slot==='weapon'?profiles[choice%profiles.length]:undefined,'epic');
        item.recipe.enhancement=5;item=deriveItem(item);p.character.equipped[slot]=item;
        const score=evaluate().dps;if(score>best){best=score;winner=item;}
      }
      p.character.equipped[slot]=winner;
    }
    return evaluate();
  });
  const quantile=(key:keyof typeof samples[number],q:number)=>round(samples.map(s=>s[key]).sort((a,b)=>a-b)[Math.floor(q*(samples.length-1))]);
  return {style,count:samples.length,hit:{p10:quantile('hit',.1),median:quantile('hit',.5),p90:quantile('hit',.9)},
    dps:{p10:quantile('dps',.1),median:quantile('dps',.5),p90:quantile('dps',.9)},
    criticalChance:{median:quantile('crit',.5),max:quantile('crit',1)},criticalMultiplier:{median:quantile('critMultiplier',.5),max:quantile('critMultiplier',1)},
    rate:{median:quantile('rate',.5),max:quantile('rate',1)},maxBonusRanks:quantile('bonusRanks',1),
    noncriticalMedian:quantile('noncritical',.5),eliteOneShotWithoutCrit:samples.filter(s=>s.noncritical>=scaledEnemyStats('stalker',37,'elite').maxHp).length,
    medianIntelligence:quantile('intelligence',.5),medianStrength:quantile('strength',.5),medianRawWeapon:quantile('rawWeapon',.5),medianElementalShare:quantile('elementalShare',.5)};
});
// Isolated eligible affix budgets, not complete item/save fixtures.
const affixExamples=['pebble','monolith','head'].map(size=>{
  const item=size==='head'?generateItem(555,35,'head',undefined,'epic','cloth'):generateItem(555,35,'charm','storm-'+size,'rare');
  if(size==='head')item.recipe.enhancement=5;
  return {size,rolls:Object.fromEntries((['castSpeedPercent','intelligence','critChance','spellDamagePercent'] as StatKey[]).flatMap(stat=>{
    const a=itemAffixPool(item).find(a=>a.stat===stat);if(!a)return [];
    const copy=structuredClone(item);copy.affixes=[{name:a.name,stat,value:1}];copy.recipe.rolls=[.5];
    return [[stat,deriveItem(copy).affixes[0].value]];
  }))};
});
const bonusRankCases=[0,3,10].map(bonus=>{
  const p=benchmarkPlayer(35,'caster','strong');
  const r=resolveSkill('arcLightning',{...p.derived,skillBonuses:{arcLightning:bonus}},p.character);
  return {purchased:r.rank,bonus,effective:r.effectiveRank,damageMultiplier:r.damageMultiplier,mana:r.mana};
});
// Identical complete Legendary items; vary only their saved affix percentiles.
const itemUpgradeExamples = (['weapon','chest'] as const).map(slot => {
  const style = slot === 'weapon' ? 'caster' : 'melee';
  const template = generateItem(555,35,slot,slot==='weapon'?'ember-staff':undefined,'legendary',slot==='chest'?'iron':undefined);
  const stats: StatKey[] = slot === 'weapon' ? ['spellDamagePercent','intelligence','critChance','critDamage'] : ['maxHp','armor','vitality','lifeRegen'];
  const pool = itemAffixPool(template);
  template.affixes = stats.map(stat=>{const definition=pool.find(a=>a.stat===stat);if(!definition)throw new Error(`Invalid loot comparison: ${stat}`);return {name:definition.name,stat,value:1};});
  return {slot,style,level:35,tier:'legendary',enhancement:0,material:template.recipe.materialId,rolls:[0,.5,1].map(quantile=>{
    const item = deriveItem({...template,recipe:{...template.recipe,rolls:stats.map(()=>quantile)}});
    const p = benchmarkPlayer(35,style,'strong');p.character.equipped[slot]=item;refreshCharacter(p);
    const a=deriveAttackStats(p.stats,p.equipment.mainHand),skill=resolveSkill(BENCHMARK_SKILLS[style],p.derived,p.character);
    const expectedHit=a.damage*skill.damageMultiplier*(1+p.derived.critChance*(p.derived.critMultiplier-1));
    return {quantile,affixes:item.affixes,expectedHit:round(expectedHit),expectedActionDps:round(expectedHit*a.attacksPerSecond),
      maxHp:p.maxHp,armor:p.derived.armor,physicalReduction:p.derived.damageReduction,
      physicalEffectiveLife:round(p.maxHp/(1-p.derived.damageReduction)),lifeRegeneration:p.derived.lifeRegeneration};
  })};
});
const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),attributeDamageBonuses:ATTRIBUTE_DAMAGE_BONUSES,itemRollRules:ITEM_ROLL_RULES,skillDamageRankRules:SKILL_DAMAGE_RANK_RULES,eliteTargetLife:scaledEnemyStats('stalker',37,'elite').maxHp,builds,contacts,distances,scaling,gearSamples,affixExamples,bonusRankCases,itemUpgradeExamples,
  assumptions:'24 synthetic seeded builds, not Dimillian. Contact probes use rank 1, no crits, no prerequisite passives, a 1000-damage training weapon, infinite training mana, pinned high-life bodies, one cast and 20 seconds. Values normalize by derived weapon damage. Eight-body contact probes deliberately overlap bodies to measure clustered coverage bounds, not natural encounter geometry. Resource/TTK comparisons remain separate. Counterfactuals are independent removals, not additive attribution. Item-upgrade examples vary all four eligible affix percentiles together on one unenhanced level-35 Legendary, holding all other build pieces fixed; these are deliberately matched affix combinations, not drop probabilities. Additional 100 gear samples/style use level 35, rank 5, Epic +5, no charms/specializations/extra passives/offhand, three offense and two Vitality points/level; greedily select among eight generated candidates per slot for expected first-target DPS. Weapon profile alternatives are included. These are damage-selected sets, not random-drop distributions, not optimized global maxima, and not estimates of acquisition time.'};
writeFileSync(process.argv[2]??'/tmp/evergrow-damage-audit.json',JSON.stringify(report,null,2));
console.log(`Audited ${builds.length} builds, ${contacts.length} skill/formation cases and ${distances.length} distance/body cases.`);
