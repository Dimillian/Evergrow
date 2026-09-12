import { ATLAS_BENCHMARK_LEVELS, ATLAS_BENCHMARK_BUILDS, atlasBenchmarkSheet } from '../src/atlas-benchmark.ts';
import { mitigateSkillHit, advanceSkillEffects } from '../src/player-skill-effects.ts';
import { generateItem } from '../src/items.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { createCharacterSheet } from '../src/items.ts';
import { primeSpellweave, consumeSpellweave } from '../src/affix-combat.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_SPECIALIZATIONS, resolveSkill } from '../src/skill-progression.ts';
import { SkillStudy, studyWeapons } from '../src/tools/skill-scene.ts';
import { atlasLabelCandidates, atlasLabelBudget } from '../src/skill-tree-labels.ts';
import { SKILL_NODES } from '../src/skill-tree.ts';
const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('every active has three distinct selectable Techniques',()=>{
 for(const id of Object.keys(SKILL_DEFINITIONS) as Array<keyof typeof SKILL_DEFINITIONS>){
  const variants=SKILL_SPECIALIZATIONS.filter(s=>s.skill===id);assert.equal(variants.length,3,id);
  const base=resolveSkill(id,{manaCostMultiplier:1,cooldownMultiplier:1});
  const signatures=variants.map(v=>{const sheet=createCharacterSheet();sheet.allocatedNodes=['origin',`skill:${id}`,`specialization:${v.id}`];sheet.skillSpecializations[id]=v.id;const r=resolveSkill(id,{manaCostMultiplier:1,cooldownMultiplier:1},sheet);const signature=JSON.stringify([r.recipe,r.damageMultiplier,r.mana,r.cooldown]);assert.notEqual(signature,JSON.stringify([base.recipe,base.damageMultiplier,base.mana,base.cooldown]));return signature;});
  assert.equal(new Set(signatures).size,3,id);
 }
});
test('Borrowed Flame gives the same alternating-action payoff at every Spellweave investment, including the cap',()=>{
 const p=new Simulation(world,{spawn:false}).player;
 for(const weave of [0,30,70,78,100,150]){
  p.character.allocatedNodes=['origin'];p.derived=deriveCharacterStats(p.character,{spellweavePercent:weave});const base=p.derived.attackDamageMultiplier*(1+p.derived.spellweavePercent/100);
  p.character.allocatedNodes.push('keystone:borrowed-flame');p.derived=deriveCharacterStats(p.character,{spellweavePercent:weave});primeSpellweave(p,false,'fire');const multiplier=consumeSpellweave(p,'melee');close(p.derived.attackDamageMultiplier*multiplier/base,1.19);assert.equal(consumeSpellweave(p,'melee'),1);
 }
});
test('tree armor retains same-level reduction from level 1 to 100 while its contribution remains explicit',()=>{
 const sheet=createCharacterSheet();sheet.equipped.weapon=null;sheet.equipped.offhand=null;
 for(const level of [1,10,25,50,100]){const s=deriveCharacterStats(sheet,{armor:32},level);close(s.damageReduction,32/152);assert.ok(s.armor>=32);}
});
test('Rally and Ghost ranks improve damage per charge, and Brace improves mitigation',()=>{
 for(const id of ['rallyOfIron','ghostHunt','brace'] as const){const a=resolveSkill(id,{manaCostMultiplier:1,cooldownMultiplier:1},undefined,1),b=resolveSkill(id,{manaCostMultiplier:1,cooldownMultiplier:1},undefined,3);assert.equal(a.recipe.kind,'stance');assert.equal(b.recipe.kind,'stance');if(a.recipe.kind==='stance'&&b.recipe.kind==='stance'){if(id==='brace')assert.ok(b.recipe.reduction>a.recipe.reduction);else assert.ok(b.recipe.bonus/a.recipe.bonus>b.mana/a.mana);}}
});
function study(skill:keyof typeof SKILL_DEFINITIONS,scenario:'followup'|'defense'|'sustain',baseline=false){const s=new SkillStudy(world,{skill,scenario,baseline,level:50,rank:3,specialization:'',weapon:studyWeapons(skill)[0].id,facing:0,targets:'single',enemy:'brute',x:0,y:0});while(s.elapsed<s.duration&&!s.simulation.player.dead)s.step();return s;}
test('finite playground exercises buff follow-ups, incoming damage, baseline comparison and exhaustion',()=>{
 const ghost=study('ghostHunt','followup'),baseline=study('ghostHunt','followup',true);assert.ok(ghost.didCast);assert.ok(ghost.damage>baseline.damage);assert.ok(ghost.manaSpent>baseline.manaSpent);
 const ward=study('runicWard','defense'),bare=study('runicWard','defense',true);assert.ok(ward.absorbed>0);assert.ok(ward.damageTaken<bare.damageTaken);assert.equal(ward.incomingDamage,bare.incomingDamage);
 const tempest=study('tempest','sustain');assert.ok(tempest.manaSpent>tempest.resolved.mana);assert.ok(tempest.simulation.player.mana<tempest.simulation.player.maxMana);assert.ok(tempest.simulation.player.maxMana<100000);
});
test('new defensive and late dagger actions resolve actual mitigation, control and damage',()=>{
 for(const id of ['smokeVeil','ironCitadel'] as const){const a=study(id,'defense'),b=study(id,'defense',true);assert.ok(a.didCast);assert.ok(a.damageTaken<b.damageTaken,id);}
 const reap=study('nightReaping','followup');assert.ok(reap.didCast);assert.ok(reap.damage>0);
});
test('close zoom has bounded labels, only focused Techniques, and keeps selection visible',()=>{
 const node=SKILL_NODES.get('skill:fireball')!;
 for(const zoom of [.35,.72,1,1.8,2.6])for(const [width,height]of [[1400,800],[520,620]]){
  const view={zoom,width,height,centerX:node.x,centerY:node.y,selected:node.id,hovered:null,matches:()=>true};const plan=atlasLabelCandidates(view),budget=atlasLabelBudget(zoom,width,height);
  assert.ok(plan.focused.includes(node));assert.ok(plan.landmarks.length<=budget.landmarks);assert.ok(plan.clusters.length<=budget.clusters);
  assert.ok(plan.techniques.every(n=>n.developmentSkill==='fireball'));if(zoom>=.72){assert.ok(plan.landmarks.length<=4);assert.ok(plan.clusters.length<=2);}
 }
});

test('benchmark fixtures use exactly their available point budget and legal connected paths',()=>{
 for(const level of ATLAS_BENCHMARK_LEVELS)for(const build of ATLAS_BENCHMARK_BUILDS){const sheet=atlasBenchmarkSheet(level,build);assert.equal(sheet.skillPoints,0);assert.equal(sheet.allocatedNodes.length-1+Object.values(sheet.skillRanks).reduce((sum,n)=>sum+n-1,0),level-1);const owned=new Set(['origin']);for(const id of sheet.allocatedNodes.slice(1)){assert.ok(SKILL_NODES.get(id)!.neighbors.some(n=>owned.has(n)),id);owned.add(id);}}
});
test('overlapping shelters retain their independent expiry and use strongest mitigation',()=>{
 const p=new Simulation(world,{spawn:false}).player;p.character.allocatedNodes=['origin','skill:smokeVeil','skill:ironCitadel'];p.equipment.mainHand=generateItem(204,1,'weapon','longsword','common').weapon!;p.equipment.offHand={kind:'shield',shield:generateItem(203,1,'shield',undefined,'common').shield!};
 p.skillEffects={echoes:[],shelters:{smokeVeil:{remaining:2,reduction:.2},ironCitadel:{remaining:5,reduction:.45}}};assert.equal(mitigateSkillHit(p,100).damage,55);advanceSkillEffects(p,2.1);assert.equal(mitigateSkillHit(p,100).damage,55);assert.equal(p.skillEffects.shelters!.smokeVeil,undefined);p.equipment.offHand=null;advanceSkillEffects(p,.1);assert.equal(mitigateSkillHit(p,100).damage,100);
});
