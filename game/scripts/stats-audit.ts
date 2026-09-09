/** Headless balance audit. Run: node --experimental-strip-types game/scripts/stats-audit.ts */
import { initialPlayer } from '../src/simulation.ts';
import { createCharacterSheet, generateItem, EQUIPMENT_SLOTS } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { itemPowerScale, monsterHealthScale, monsterDamageScale, itemAffixGrowthLevel } from '../src/progression-content.ts';
import { SKILL_TREE, getTreeBonuses } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import { CHARM_SIZES, CHARM_PROFILES } from '../src/charm-content.ts';
import { addInventoryItem } from '../src/inventory.ts';
const levels=[1,12,30,60,100,300,1000];
const round=(n:number)=>Math.round(n*100)/100;
const builds=[
  {name:'Melee',starter:'sword-shield' as const,weapon:'longsword',domain:'Might',attributes:{strength:3,vitality:2},weights:{damagePercent:1,strength:2,maxHp:.13,vitality:.8,armor:.15,attackSpeedPercent:1,critChance:2}},
  {name:'Bow',starter:'bow' as const,weapon:'thorn-shortbow',domain:'Cunning',attributes:{dexterity:3,vitality:2},weights:{damagePercent:1,dexterity:1,maxHp:.13,vitality:.8,attackSpeedPercent:1,critChance:2,critDamage:.5}},
  {name:'Caster',starter:'fire' as const,weapon:'ember-staff',domain:'Arcana',attributes:{intelligence:3,vitality:2},weights:{spellDamagePercent:1,intelligence:3,maxHp:.13,vitality:.8,castSpeedPercent:1,manaRegen:8}},
];
const sheets=builds.flatMap(build=>levels.map(level=>{
  const p=initialPlayer(0,0);p.character=createCharacterSheet(build.starter);p.level=level;
  for(const [key,points] of Object.entries(build.attributes))p.character.attributes[key as keyof typeof p.character.attributes]+=points!*(level-1);
  const gearSeed=8427;
  for(const [i,slot] of EQUIPMENT_SLOTS.entries()){
    if(slot==='offhand'&&build.name!=='Melee'){p.character.equipped[slot]=null;continue;}
    const kind=slot==='weapon'?'weapon':slot==='offhand'?'shield':slot==='ring1'||slot==='ring2'?'ring':slot;
    p.character.equipped[slot]=generateItem(gearSeed+i,level,kind,slot==='weapon'?build.weapon:slot==='offhand'?'iron-buckler':undefined,'rare');
  }
  let budget=level-1;
  while(budget>0){
    const owned = new Set(p.character.allocatedNodes);
    const routes=buildSkillRoutes(owned);
    const options=SKILL_TREE.nodes.filter(node=>node.domain===build.domain&&Object.keys(node.bonuses).length&&routes.get(node.id)?.cost&&routes.get(node.id)!.cost<=budget)
      .map(node=>{const path=previewSkillRoute(routes,node.id).filter(id => !owned.has(id));const bonuses=getTreeBonuses(path);return {path,score:Object.entries(bonuses).reduce((sum,[key,n])=>sum+(build.weights[key as keyof typeof build.weights]??0)*n!,0)/path.length};})
      .sort((a,b)=>b.score-a.score||a.path.at(-1)!.localeCompare(b.path.at(-1)!));
    if(!options.length)break;p.character.allocatedNodes.push(...options[0].path);budget-=options[0].path.length;
  }
  refreshCharacter(p);const a=deriveAttackStats(p.stats,p.equipment.mainHand);
  const dps=a.damage*a.attacksPerSecond*(1+p.derived.critChance*(p.derived.critMultiplier-1));
  const monster=scaledEnemyStats('stalker',level,'normal');
  if (!Number.isFinite(dps) || dps <= 0 || !Number.isFinite(monster.maxHp) || budget < 0) throw new Error('Invalid study build');
  return {build:build.name,level,hp:p.maxHp,hit:a.damage,rate:round(a.attacksPerSecond),crit:round(p.derived.critChance*100),dps:round(dps),stalkerHP:monster.maxHp,secondsPerStalker:round(monster.maxHp/dps),armorPercent:round(p.derived.damageReduction*100),manaRegen:round(p.derived.manaRegeneration),treePoints:level-1-budget};
}));
const charmBudgets=CHARM_SIZES.map(size=>({size:size.name,cells:size.width*size.height,commonAffixes:size.affixes,legendaryAffixes:size.affixes+4,rollStrength:size.potency,
  commonBudgetPerCell:round(size.potency*size.affixes/(size.width*size.height)),legendaryBudgetPerCell:round(size.potency*(size.affixes+4)/(size.width*size.height))}));
const charmSaturation=levels.filter(l=>l<=100).map(level=>{
  const p=initialPlayer(0,0);p.level=level;
  // A deliberately generous ceiling study: randomly rolled Legendary pebbles, not a realistic loot timeline.
  for(let i=0;i<48;i++) {
    if (!addInventoryItem(p.character,generateItem(3247+i,level,'charm',`${CHARM_PROFILES[i%CHARM_PROFILES.length].flavor.id}-pebble`,'legendary')))
      throw new Error('Charm study did not fit all 48 stones');
  }
  refreshCharacter(p);return {level,gold:round((p.derived.goldFindMultiplier-1)*100),xp:round((p.derived.xpGainMultiplier-1)*100),resistance:p.derived.resistances,speed:round((p.derived.attackSpeedMultiplier-1)*100),life:p.maxHp,mana:p.maxMana};
});
console.log(JSON.stringify({assumptions:'Same rare gear seeds at each level, normal seeded materials, 3 main attribute + 2 Vitality per level. Greedy connected passive routes within the build domain; no charms or enhanced gear, active skills, mana downtime, misses, movement, enemy armor or status damage in DPS. A formula comparison, not gameplay testing.',curves:levels.map(level=>({level,weapon:round(itemPowerScale(level)),monsterHP:round(monsterHealthScale(level)),monsterDamage:round(monsterDamageScale(level)),percentGrowth:round(itemAffixGrowthLevel(level))})),sheets,charmBudgets,charmSaturation},null,2));
