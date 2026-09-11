import { createCharacterSheet, generateItem, deriveItem, EQUIPMENT_SLOTS } from './items.ts';
import { characterModifierSources } from './character-stats.ts';
import { getTreeBonuses } from './skill-tree.ts';
import { allocateSkillRoute } from './skill-tree-routes.ts';
import { addInventoryItem } from './inventory.ts';
import { initialPlayer } from './simulation.ts';
import { refreshCharacter } from './character.ts';
import { deriveAttackStats } from './equipment.ts';
import { resolveSkill } from './skill-progression.ts';
import type { CharacterSheet, ItemKind, SkillId } from './character-types.ts';
import type { Player } from './model.ts';

export type BenchmarkStyle = 'melee' | 'bow' | 'caster';
export type BenchmarkGear = 'ordinary' | 'strong' | 'sustain';
export const BENCHMARK_LEVELS = [10,20,35,50] as const;
export const BENCHMARK_SKILLS: Record<BenchmarkStyle,SkillId> = {melee:'cleave',bow:'ricochet',caster:'arcLightning'};
/** Reproducible synthetic gear, never a claim about a cloud player's current build. */
export function benchmarkSheet(level:number, style:BenchmarkStyle, gear:BenchmarkGear):CharacterSheet {
  const sheet=createCharacterSheet();
  const strong=gear!=='ordinary',tier=strong?'epic':'rare';
  sheet.attributes[style==='caster'?'intelligence':'strength']+=3*(level-1);
  sheet.attributes.vitality+=2*(level-1);
  sheet.skillPoints=level-1;
  const skill=BENCHMARK_SKILLS[style];
  allocateSkillRoute(sheet,`skill:${skill}`);
  const rank=Math.min(strong?5:3,1+sheet.skillPoints);
  sheet.skillRanks[skill]=rank;sheet.skillPoints-=rank-1;sheet.skillSlots[0]=skill;
  for(const [index,slot] of EQUIPMENT_SLOTS.entries()) {
    if(slot==='offhand'){sheet.equipped[slot]=null;continue;}
    const kind:ItemKind=slot==='ring1'||slot==='ring2'?'ring':slot;
    const profile=slot==='weapon'?{melee:'longsword',bow:'thorn-shortbow',caster:'ember-staff'}[style]:undefined;
    const item=generateItem(7319+index*73,level,kind,profile,tier);
    item.recipe.enhancement=strong?5:0;sheet.equipped[slot]=deriveItem(item);
  }
  if(strong) for(let i=0;i<(gear==='sustain'?48:8);i++) {
    const item=generateItem(8400+i,level,'charm','astral-pebble','common');
    // Deliberately selected recovery rolls: eight stones or the extreme full-grid case.
    item.affixes=[{name:'Clarity',stat:'manaRegen',value:1}];item.recipe.rolls=[.5];
    if(!addInventoryItem(sheet,deriveItem(item)))throw new Error('Benchmark charm does not fit');
  }
  return sheet;
}
export function benchmarkPlayer(level:number,style:BenchmarkStyle,gear:BenchmarkGear):Player {
  const p=initialPlayer(0,0);p.character=benchmarkSheet(level,style,gear);p.level=level;
  refreshCharacter(p);p.hp=p.maxHp;p.mana=p.maxMana;return p;
}
export function resourceBuildReport(p:Player,skill:SkillId) {
  const action=deriveAttackStats(p.stats,p.equipment.mainHand),resolved=resolveSkill(skill,p.derived,p.character);
  const rate=Math.min(action.attacksPerSecond,resolved.cooldown?1/resolved.cooldown:Infinity);
  const drain=resolved.mana*rate;
  const net=drain+resolved.upkeep-p.derived.manaRegeneration;
  return {mana:p.maxMana,regen:p.derived.manaRegeneration,costReduction:1-p.derived.manaCostMultiplier,
    skill,rank:resolved.rank,bonusRanks:resolved.bonusRanks,manaPerCast:resolved.mana,castsPerSecond:rate,
    manaPerSecond:drain+resolved.upkeep,isolatedBurstSeconds:net>0?p.maxMana/net:null,
    expectedFirstHit:action.damage*resolved.damageMultiplier*(1+p.derived.critChance*(p.derived.critMultiplier-1)),
    sources:characterModifierSources(p.character,getTreeBonuses(p.character.allocatedNodes),p.level)
      .map(s=>({label:s.label,modifiers:Object.fromEntries(Object.entries(s.modifiers).filter(([k])=>['intelligence','maxMana','manaRegen','manaOnKill','manaCostPercent'].includes(k)))})).filter(s=>Object.keys(s.modifiers).length),
    assumptions:'Steady cadence resource budget, full starting mana, no kills, pickups or potions. Burst seconds is analytical, not measured combat time.'};
}
export function resourceBenchmark() {
  return BENCHMARK_LEVELS.flatMap(level=>(['melee','bow','caster'] as const).flatMap(style=>
    (style==='caster'?['ordinary','strong','sustain'] as const:['ordinary','strong'] as const).map(gear=>({level,style,gear,...resourceBuildReport(benchmarkPlayer(level,style,gear),BENCHMARK_SKILLS[style])}))));
}
