import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { createCharacterSheet, STARTER_LOADOUTS, generateItem, deriveItem, itemAffixPool, affixConflicts, ITEM_KINDS } from '../src/items.ts';
import { ELEMENTS, RESISTANCE_STATS, RESISTANCE_AFFIXES, RESISTANCE_RULES, isResistanceStat, projectileDamageType } from '../src/resistance-content.ts';
import { damagePlayer } from '../src/combat-damage.ts';
import { advanceProjectiles } from '../src/projectile-combat.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { updateWildernessBoss } from '../src/wilderness-boss.ts';
import { characterStatDetails } from '../src/character-stat-details.ts';
import { previewEquipmentChange } from '../src/equipment-preview.ts';
import { itemTooltipMarkup } from '../src/item-ui.ts';
import { improveItem, affixCategory } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import type { CombatEvent, DamageType, Projectile, ProjectileStyle, EnemyKind } from '../src/model.ts';
const world = { isSanctuary: () => false, blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}) };
const setup = () => new Simulation(world, { spawn:false, startX:0, startY:0 });

test('all starters have zero resistance; single and all-element bonuses add and cap independently', () => {
  for (const loadout of STARTER_LOADOUTS) assert.deepEqual(deriveCharacterStats(createCharacterSheet(loadout.id)).resistances, {fire:0,frost:0,lightning:0,arcane:0});
  const sheet = createCharacterSheet(); sheet.equipped.ring1 = generateItem(89,1,'ring');
  sheet.equipped.ring1.implicit = {fireResistance:24, allResistance:8}; sheet.equipped.ring1.affixes=[];
  assert.deepEqual(deriveCharacterStats(sheet,{fireResistance:80,frostResistance:12}).resistances, {fire:.75,frost:.2,lightning:.08,arcane:.08});
  sheet.equipped.ring1=null; assert.deepEqual(deriveCharacterStats(sheet).resistances,{fire:0,frost:0,lightning:0,arcane:0});
});

test('physical damage uses source-level armor; each element ignores armor and uses only its own resistance', () => {
  const p = setup().player; p.character.equipped.chest!.implicit = {armor:120, fireResistance:30,frostResistance:20,lightningResistance:10,arcaneResistance:40}; refreshCharacter(p);
  const context = {player:p,world,random:()=>1,emit:()=>{}};
  for (const [kind,loss] of [['physical',50],['fire',70],['frost',80],['lightning',90],['arcane',60]] as const) {
    p.hp=100;p.invulnerable=0;p.dead=false; damagePlayer(100,0,1,kind,context); assert.equal(100-p.hp,loss,kind);
  }
  p.hp=100;p.invulnerable=0;damagePlayer(100,0,20,'fire',context);assert.equal(p.hp,30,'resistance has no hidden zone/level penalty');
  p.hp=100;p.invulnerable=0;damagePlayer(100,0,20,'physical',context);assert.ok(p.hp<50,'stronger physical attackers still test more armor');
});

test('resistance applies before block; caps and exactly-once immunity preserve damage and death behavior', () => {
  const p=setup().player;p.character=createCharacterSheet('sword-shield');p.character.equipped.ring1=generateItem(50,1,'ring');
  p.character.equipped.ring1.implicit={allResistance:999};p.character.equipped.ring1.affixes=[];refreshCharacter(p);
  p.guardTime=1;p.guardReduction=.8;const events:CombatEvent[]=[];
  const context={player:p,world,random:()=>1,emit:(e:CombatEvent)=>events.push(e)};
  damagePlayer(100,0,1,'fire',context);assert.equal(p.hp,95);assert.equal(events.find(e=>e.type==='block')?.value,20);
  damagePlayer(100,0,1,'fire',context);assert.equal(p.hp,95,'hurt immunity does not award a second hit');
  p.invulnerable=0;p.hp=1;damagePlayer(1,0,1,'fire',context);assert.equal(p.hp,0);assert.equal(p.dead,true);
});

test('every missile style retains the correct damage channel without a live caster', () => {
  for (const style of ['arrow','fire','frost','lightning','arcane','spirit'] as ProjectileStyle[]) {
    const sim=setup(), received:Array<[number,DamageType,EnemyKind|undefined]>=[];
    const shot:Projectile={id:1,x:-10,y:0,prevX:-10,prevY:0,vx:100,vy:0,angle:0,radius:4,damage:40,life:1,maxLife:1,sourceLevel:22,sourceKind:'caster',owner:'enemy',effects:{style},hitIds:new Set()};
    advanceProjectiles([shot],.1,{player:sim.player,enemies:[],world,schedule:()=>{},damage:()=>{},hurt:(_amount,_angle,level,kind,source)=>received.push([level,kind,source]),onScreen:()=>true,visible:()=>true,emit:()=>{}});
    assert.deepEqual(received,[[22,projectileDamageType(style),'caster']]);assert.equal(shot.life,0);
  }
  assert.equal(projectileDamageType('spirit'),'arcane');assert.equal(projectileDamageType('arrow'),'physical');
});

test('enemy ground signatures and Colossus eruptions route actual elemental contacts', () => {
  const sim=setup(), hits:DamageType[]=[];
  const context:EnemyAIContext={world,player:sim.player,enemies:sim.enemies,time:0,trial:null,visible:()=>true,move:()=>{},hurt:(_n,_a,_e,kind)=>hits.push(kind),shoot:()=>{},emit:()=>{}};
  for(const [kind,element] of [['mireSpitter','arcane'],['frostRevenant','frost'],['emberAcolyte','fire']] as const){
    const enemy=sim.spawnEnemy(kind,60,0)!;enemy.attackVariant=1;enemy.state='windup';enemy.stateTime=2;enemy.stateDuration=1;enemy.attackTargetX=0;enemy.attackTargetY=0;enemy.seesPlayer=true;
    updateEnemyAI(enemy,1/120,context);assert.equal(hits.pop(),element);
  }
  const boss=sim.spawnEnemy('ashColossus',60,0)!;boss.state='attack';boss.bossMove='eruption';boss.attackTargetX=0;boss.attackTargetY=0;
  updateWildernessBoss(boss,1/120,context);assert.equal(hits.pop(),'fire');
});

test('resistance rolls are restricted to jewelry/shields and exactly one resistance family per item', () => {
  for (const kind of ITEM_KINDS) {
    const rolls=itemAffixPool({kind}).filter(a=>isResistanceStat(a.stat));
    assert.equal(rolls.length,['ring','amulet','shield','charm'].includes(kind)?5:0,kind);
  }
  for(const a of RESISTANCE_STATS){assert.equal(affixCategory(a),'defense');for(const b of RESISTANCE_STATS)assert.ok(affixConflicts(a,[b]));}
  assert.ok(RESISTANCE_AFFIXES.find(a=>a.stat==='allResistance')!.weight! < RESISTANCE_AFFIXES.find(a=>a.stat==='fireResistance')!.weight!);
  const seen=new Set<string>();
  for(const kind of ['ring','amulet','shield'] as const) for(let seed=0;seed<400;seed++){
    const item=generateItem(seed,1+seed%80,kind,undefined,'legendary');const resist=item.affixes.filter(a=>isResistanceStat(a.stat));
    assert.ok(resist.length<=1);assert.ok(validItem(item));assert.deepEqual(deriveItem(item).affixes,item.affixes);
    for(const a of resist)seen.add(a.stat);
    const high=deriveItem({...item,itemLevel:1_000_000,recipe:{...item.recipe,enhancement:10}});
    for(const a of high.affixes.filter(a=>isResistanceStat(a.stat)))assert.ok(a.value<=(a.stat==='allResistance'?8:24));
    assert.ok(validItem(high));
  }
  assert.deepEqual([...seen].sort(),[...RESISTANCE_STATS].sort());
});

function resistanceItem(stat: typeof RESISTANCE_STATS[number]) {
  const item=generateItem(784,20,'ring',undefined,'magic');
  item.affixes=[{name:RESISTANCE_AFFIXES.find(a=>a.stat===stat)!.name,stat,value:0}];item.recipe.rolls=[.5];return deriveItem(item);
}
test('single resistance is stronger; enchanting, save validation, equip comparisons and tooltips share real rolls', () => {
  const single=resistanceItem('fireResistance'),all=resistanceItem('allResistance');assert.ok(single.affixes[0].value>=all.affixes[0].value*3);
  for(const item of [single,all]){
    assert.ok(validItem(item));assert.ok(validItem(improveItem(item,'enhance',20,33)));
    const upgraded=improveItem(item,'rarity',20,77);assert.equal(upgraded.affixes.filter(a=>isResistanceStat(a.stat)).length,1);assert.ok(validItem(upgraded));
    const p=setup().player,preview=previewEquipmentChange(p.character,item,p.level+30);assert.ok(preview.ok);
    for(const element of item===all?ELEMENTS:['fire'] as const)assert.ok(preview.changes.some(c=>c.key===`${element}Resistance`&&c.after>c.before));
    assert.match(itemTooltipMarkup(item,{sheet:p.character,level:40}),/resistance/i);
    p.character.equipped.ring1=item;refreshCharacter(p);
    const group=characterStatDetails(p).find(g=>g.tone==='resistances')!;assert.equal(group.rows.length,4);
    assert.equal(group.rows[0].amount,p.derived.resistances.fire);assert.ok(group.rows[0].sources.some(s=>s.label.includes(item.name)));
  }
  const duplicate=structuredClone(all);duplicate.tier='rare';duplicate.affixes.push(single.affixes[0]);duplicate.recipe.rolls.push(.5);assert.equal(validItem(duplicate),false);
  const illegal=generateItem(10,20,'boots',undefined,'magic');illegal.affixes=single.affixes;illegal.recipe.rolls=[.5];assert.equal(validItem(illegal),false);
  const excessive=structuredClone(all);excessive.affixes[0].value=RESISTANCE_RULES.allAffixCap+1;assert.equal(validItem(excessive),false);
});
