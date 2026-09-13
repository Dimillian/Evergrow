import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { activeBuffs } from '../src/active-buffs.ts';
import { applyBurn, applySlow, applyStun, advanceEnemyStatuses } from '../src/combat-status.ts';
import { enemyDebuffs } from '../src/enemy-debuffs.ts';
import { UNIQUES, uniqueSlot } from '../src/unique-content.ts';
import { generateItem, generateUnique } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { advanceUniqueEffects, harvestRear, releaseStoredEmbers } from '../src/unique-combat.ts';
import { effectExplanation, effectText, statTerm } from '../src/effect-terms.ts';
import { SKILL_SPECIALIZATIONS, resolveSkill } from '../src/skill-progression.ts';
import { TECHNIQUE_SUMMARIES } from '../src/technique-summaries.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { skillMechanicFacts } from '../src/skill-mechanic-facts.ts';
import { placeExplanation } from '../src/tooltip-stack-layout.ts';
import type { GroundEffect } from '../src/model.ts';

const world = { blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}) };
function setup(id:string) {
  const sim = new Simulation(world,{spawn:false}), p = sim.player, u = UNIQUES.find(u => u.id === id)!;
  p.character.equipped.weapon = generateItem(42,25,'weapon',['ghostHunt','volley'].includes(u.skill) ? 'crescent-recurve' : ['bulwark','lunge','backstab','smokeVeil'].includes(u.skill) ? 'longsword' : 'star-wand','common');
  p.character.equipped.offhand = null; p.character.equipped[uniqueSlot(u)] = generateUnique(43,25,id);
  p.character.allocatedNodes.push(`skill:${u.skill}`); refreshCharacter(p); p.skillEffects = {echoes:[]};
  return {sim,p};
}

test('stored casts show the earliest independent expiry and disappear on release', () => {
  const {p} = setup('cinderheart-testament');
  p.skillEffects!.embers = [{remaining:16,shots:[]},{remaining:2,shots:[]},{remaining:9,shots:[]}];
  const before=JSON.stringify(p);
  const buff=activeBuffs(p).find(b=>b.id==='cinderheart-testament')!;
  assert.equal(buff.remaining,2);assert.equal(buff.duration,20);assert.equal(buff.charges,3);assert.equal(JSON.stringify(p),before);
  advanceUniqueEffects(p,2.1);
  assert.equal(activeBuffs(p).find(b=>b.id==='cinderheart-testament')!.charges,2);
  assert.equal(activeBuffs(p).find(b=>b.id==='cinderheart-testament')!.remaining,6.9);
  releaseStoredEmbers(p,100,100,()=>{});assert.ok(!activeBuffs(p).some(b=>b.id==='cinderheart-testament'));
});

test('return readiness begins after outward travel and ends on expiry', () => {
  const {p} = setup('duelists-return');
  p.dash={angle:0,speed:100,remaining:.2,radius:20,damage:0,skill:'lunge',hitIds:new Set()};
  p.skillEffects!.returnStep={x:0,y:0,remaining:2,speed:100,outward:p.dash};
  assert.ok(!activeBuffs(p).some(b=>b.id==='duelists-return'));
  advanceUniqueEffects(p,.1);assert.equal(p.skillEffects!.returnStep.remaining,2);
  p.dash=null;advanceUniqueEffects(p,.1);
  assert.equal(activeBuffs(p).find(b=>b.id==='duelists-return')!.remaining,1.9);
  advanceUniqueEffects(p,2);assert.ok(!activeBuffs(p).some(b=>b.id==='duelists-return'));
});

test('barrier and guard cards report actual budgets and remove stale equipment effects', () => {
  const {p}=setup('borrowed-life');p.skillEffects!.borrowed={capacity:23,remaining:3};
  assert.match(activeBuffs(p).find(b=>b.id==='borrowed-life')!.summary,/23/);
  p.skillEffects!.borrowed.capacity=0;assert.ok(!activeBuffs(p).some(b=>b.id==='borrowed-life'));
  const {p:guard}=setup('patient-bastion');guard.skillEffects!.bastion={damage:86,remaining:5.2};
  assert.equal(activeBuffs(guard).find(b=>b.id==='patient-bastion')!.summary,'Next basic melee attack: +86 damage.');
  guard.character.equipped.offhand=null;refreshCharacter(guard);assert.ok(!activeBuffs(guard).some(b=>b.id==='patient-bastion'));
});

test('rupture and spectral echoes extend existing cards instead of adding duplicates', () => {
  const {p}=setup('broken-seal');p.skillEffects!.ward={remaining:2,capacity:30,rupture:{absorbed:90,cap:80,radius:140,offense:{critChance:0,critMultiplier:1,lifeOnHit:0}}};
  const buffs=activeBuffs(p).filter(b=>b.id==='runicWard'||b.id==='broken-seal');assert.equal(buffs.length,1);assert.match(buffs[0].summary,/Rupture: 80/);
  const {p:bow}=setup('pale-huntsman');bow.skillEffects!.ghostHunt={remaining:3,reduction:0,charges:2,bonus:.6};bow.skillEffects!.archer={x:0,y:0,angle:0,remaining:3};
  assert.match(activeBuffs(bow).find(b=>b.id==='ghostHunt')!.summary,/Spectral archer/);
  bow.skillEffects!.ghostHunt.charges=0;assert.ok(!activeBuffs(bow).some(b=>b.id==='ghostHunt'));
});

test('maintained storm and persistent Overload use distinct time and cost states', () => {
  const {p}=setup('stormglass-reliquary');p.character.allocatedNodes.push('keystone:arcane-overload');p.character.arcaneOverload=true;
  p.skillEffects!.conductor={x:0,y:0,remaining:2.4};
  const storms=[{kind:'storm',duration:4,delay:.2,upkeep:8},{kind:'storm',duration:2,delay:0,upkeep:6}] as GroundEffect[];
  const buffs=activeBuffs(p,storms);
  assert.equal(buffs.find(b=>b.id==='tempest')?.remaining,4.2);assert.match(buffs.find(b=>b.id==='tempest')!.summary,/14 mana/);
  assert.equal(buffs.find(b=>b.id==='arcane-overload')?.persistent,true);assert.equal(buffs.find(b=>b.id==='stormglass-reliquary')?.duration,3);
  p.dead=true;assert.deepEqual(activeBuffs(p,storms),[]);
});

test('reapplication preserves original progress unless it extends the remaining window', () => {
  const sim=new Simulation(world,{spawn:false}),e=sim.spawnEnemy('brute',100,0)!;
  applySlow(e,{duration:4,factor:.7});applyBurn(e,{duration:6,dps:10});
  advanceEnemyStatuses(e,1,()=>{});applySlow(e,{duration:2,factor:.5});
  const slow=enemyDebuffs(e).find(b=>b.id==='slow')!;assert.equal(slow.remaining,3);assert.equal(slow.duration,4);assert.match(slow.summary,/50%/);
  applySlow(e,{duration:5,factor:.6});assert.equal(enemyDebuffs(e).find(b=>b.id==='slow')!.duration,5);
  assert.equal(enemyDebuffs(e).find(b=>b.id==='burn')!.duration,6);
  applyStun(e,2,'freeze');assert.equal(enemyDebuffs(e).find(b=>b.id==='freeze')!.duration,e.freezeTime);
});

test('marks and exposure stay on their own living target and clear after consumption', () => {
  const {p,sim}=setup('red-harvest'),a=sim.spawnEnemy('brute',100,0)!,b=sim.spawnEnemy('brute',200,0)!;
  harvestRear(p,a.id,true);a.auraExposure={fire:{power:10,remaining:2},frost:{power:12,remaining:0}};
  assert.deepEqual(enemyDebuffs(a,p).map(b=>b.id),['red-harvest','exposure:fire']);assert.deepEqual(enemyDebuffs(b,p),[]);
  harvestRear(p,a.id,false);assert.deepEqual(enemyDebuffs(a,p).map(b=>b.id),['exposure:fire']);
  a.hp=0;assert.deepEqual(enemyDebuffs(a,p),[]);
});

test('all Unique and Technique summaries have complete nested rules, with safe glossary markup', () => {
  for(const u of UNIQUES){assert.ok(u.power.length<150);assert.ok(effectExplanation(`unique:${u.id}`));}
  assert.deepEqual(Object.keys(TECHNIQUE_SUMMARIES).sort(),SKILL_SPECIALIZATIONS.map(s=>s.id).sort());
  for(const s of SKILL_SPECIALIZATIONS){assert.ok(TECHNIQUE_SUMMARIES[s.id]);assert.ok(effectExplanation(`technique:${s.id}`));}
  const text=effectText('<script>Spellweave & armor</script>');assert.ok(!text.includes('<script>'));assert.match(text,/data-ui-term="spellweave"/);
  for (const match of text.matchAll(/data-ui-term="([^"]+)"/g)) assert.ok(effectExplanation(match[1]));
  assert.match(statTerm('skill:fireball','Fireball ranks'),/data-ui-term="ranks"/);
  for(const node of SKILL_TREE.nodes.filter(n=>n.name.startsWith('Living Stone ·'))) {assert.equal(node.bonuses.afterguardPercent,undefined);assert.match(node.description,/endpoint enables/);}
});

test('Technique effect values use resolved rank and equipment, not base description numbers', () => {
  const {p}=setup('cinderheart-testament');p.character.allocatedNodes.push('skill:runicWard','specialization:ward-lasting');p.character.skillRanks.runicWard=10;p.character.skillSpecializations.runicWard='ward-lasting';
  const r=resolveSkill('runicWard',p.derived,p.character);assert.equal(r.recipe.kind,'ward');
  assert.match(skillMechanicFacts('runicWard',r.recipe),new RegExp(String(r.recipe.kind==='ward'?r.recipe.duration:0)+'s'));
});

test('deeper cards avoid the external equipment card as well as their immediate parent', () => {
  const item={left:735,right:1023,top:176,bottom:711},parent={left:469,right:717,top:489,bottom:711};
  const next=placeExplanation(parent,248,157,{width:1280,height:720},[item,parent]);
  assert.ok(next.left+248<=item.left||next.left>=item.right||next.top+157<=item.top||next.top>=item.bottom);
});
