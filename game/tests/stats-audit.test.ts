import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { createCharacterSheet, generateItem, deriveItem, itemModifiers, affixConflicts, EQUIPMENT_SLOTS } from '../src/items.ts';
import { improveItem } from '../src/item-improvement.ts';
import { refreshCharacter } from '../src/character.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { trackChronicleEvent } from '../src/chronicle-tracking.ts';
import { advanceGroundEffects, type ActiveGroundEffect } from '../src/ground-effects.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { xpForNextLevel } from '../src/progression.ts';
import { CHARM_PROFILES } from '../src/charm-content.ts';
import { validItem } from '../src/item-validation.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { PACK_CELLS } from '../src/inventory-grid.ts';
import { SKILL_TREE, getTreeBonuses } from '../src/skill-tree.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { FOCUS_PROFILES } from '../src/focus-content.ts';
import { JEWELRY_PROFILES } from '../src/jewelry-content.ts';
import { itemMaterialPool } from '../src/item-materials.ts';
import type { ItemKind } from '../src/character-types.ts';
import type { WeaponFamily } from '../src/model.ts';
const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const values=(sim:Simulation)=>sim.player.chronicle!.sources.find(s=>s.id===sim.player.chronicle!.active)!.values;

test('starter armor gains a real base when upgraded instead of charging for zero stats',()=>{
  const sheet=createCharacterSheet();
  for(const slot of ['head','chest','gloves','legs','boots','cloak'] as const){
    const item=sheet.equipped[slot]!;
    assert.deepEqual(item.implicit,{});
    for(const op of ['enhance','rarity','relevel'] as const){
      const next=improveItem(item,op,12,871);
      assert.ok(validItem(next));assert.ok((itemModifiers(next)[slot==='cloak'?'maxHp':'armor']??0)>0,`${slot} ${op}`);
      assert.equal(next.recipe.starter,false);
    }
    assert.deepEqual(item.implicit,{},'the quote must not mutate the owned item');
  }
});

test('spirit hits are recorded as arcane damage instead of physical damage',()=>{
  const sim=new Simulation(world,{spawn:false}),p=sim.player,e=sim.spawnEnemy('stalker',40,0)!;e.hp=e.maxHp=10000;
  damageEnemy(e,20,0,false,{player:p,enemies:[e],random:()=>1,visible:()=>true,killed:()=>{},emit:event=>trackChronicleEvent(p,[e],event)},false,'spirit');
  assert.equal(values(sim)['damage:arcane'],20);assert.equal(values(sim)['damage:physical']??0,0);
});

test('channel upkeep contributes actual mana spent, with no charge for a cancelled pulse',()=>{
  const sim=new Simulation(world,{spawn:false}),p=sim.player;p.character=createCharacterSheet('fire');refreshCharacter(p);p.mana=100;
  const effect:ActiveGroundEffect={id:1,kind:'storm',x:0,y:0,radius:20,delay:0,duration:3,interval:.5,tick:0,damage:1,skill:'tempest',style:'lightning',upkeep:12,pulsesLeft:4};
  const context={player:p,enemies:[],visible:()=>true,damage:()=>{},emit:()=>{}};
  advanceGroundEffects([effect],.5,context);assert.equal(p.mana,94);assert.equal(values(sim).manaSpent,6);
  p.mana=1;advanceGroundEffects([effect],.5,context);assert.equal(p.mana,1);assert.equal(values(sim).manaSpent,6);
});

test('a level-up kill uses pre-award gold bonuses, then unlocks eligible charms for future kills',()=>{
  const run=(charm:boolean)=>{
    const sim=new Simulation(world,{spawn:false}),p=sim.player;
    if(charm){let item=generateItem(333,4,'charm','amber-pebble','common');item.affixes[0]={name:'Prosperity',stat:'goldFindPercent',value:0};item=deriveItem(item);item.affixes[0].value=100;addInventoryItem(p.character,item);}
    refreshCharacter(p);assert.equal(p.derived.goldFindMultiplier,1);p.xp=xpForNextLevel(1)-1;
    const e={...sim.spawnEnemy('stalker',40,0)!,rank:'elite' as const,level:1,lootSeed:741,xpReward:20};
    awardKillRewards(e,1,0,{player:p,groundItems:sim.groundItems,groundGold:sim.groundGold,pickups:sim.pickups,nextId:()=>900,emit:()=>{}});
    assert.equal(p.level,2);if(charm)assert.equal(p.derived.goldFindMultiplier,2);
    return sim.groundGold.reduce((sum,g)=>sum+g.amount,0);
  };
  const base=run(false);assert.ok(base>0);assert.equal(run(true),base);
});

test('every charm recipe stays valid, finite, monotonic and conflict-free through the level ceiling',()=>{
  for(const profile of CHARM_PROFILES)for(const tier of ['common','magic','rare','epic','legendary'] as const){
    let previous:ReturnType<typeof generateItem>|undefined;
    for(const level of [1,12,30,60,100,300,1000,1000000]){
      const item=generateItem(7843,level,'charm',profile.id,tier);assert.ok(validItem(item));assert.deepEqual(deriveItem(item),item);
      item.affixes.forEach((a,i)=>{assert.ok(Number.isFinite(a.value)&&a.value>0);assert.equal(affixConflicts(a.stat,item.affixes.slice(0,i).map(v=>v.stat)),false);if(previous)assert.ok(a.value>=previous.affixes[i].value);});
      previous=item;
    }
  }
});

test('every gear profile and material scales monotonically and survives maximum enhancement',()=>{
  const profiles: Array<{kind:ItemKind;id?:string;family?:WeaponFamily}> = [
    ...WEAPON_PROFILES.map(p=>({kind:'weapon' as const,id:p.id,family:p.family})),
    ...SHIELD_PROFILES.map(p=>({kind:'shield' as const,id:p.id})),
    ...FOCUS_PROFILES.map(p=>({kind:p.visual.kind,id:p.id})),
    ...JEWELRY_PROFILES.map(p=>({kind:p.kind,id:p.id})),
    ...(['head','chest','gloves','legs','boots','cloak'] as const).map(kind=>({kind})),
  ];
  for(const profile of profiles)for(const material of itemMaterialPool(profile.kind,profile.family)){
    for(const tier of ['common','magic','rare','epic','legendary'] as const){
      let previous:Record<string,number>={};
      for(const level of [1,12,30,60,100,300,1000,1000000]){
        const item=generateItem(7843,level,profile.kind,profile.id,tier,material.id);
        assert.ok(validItem(item),`${profile.id??profile.kind} ${material.id} ${tier} ${level}`);
        assert.deepEqual(deriveItem(item),item);
        const stats={...itemModifiers(item),...(item.weapon?{weaponDamage:item.weapon.damage}:{}),...(item.shield?{blockChance:item.shield.blockChance,blockReduction:item.shield.blockReduction}:{})};
        for(const [key,value] of Object.entries(stats)){
          assert.ok(Number.isFinite(value)&&value!>=0,key);
          assert.ok(value!>=(previous[key]??0),`${profile.id??profile.kind} ${key} at ${level}`);
        }
        assert.ok(validItem(deriveItem({...item,recipe:{...item.recipe,enhancement:10}})));
        previous=stats;
      }
    }
  }
});

test('all passive node bonuses merge once and real gear and charms share the same additive derivation',()=>{
  const sheet=createCharacterSheet();for(const slot of EQUIPMENT_SLOTS)sheet.equipped[slot]=null;
  const ids=SKILL_TREE.nodes.filter(n=>Object.keys(n.bonuses).length).map(n=>n.id),tree=getTreeBonuses(ids);
  assert.deepEqual(getTreeBonuses([...ids,...ids,'missing']),tree);
  const ring=generateItem(87,1,'ring');ring.implicit={strength:4,maxHp:20,fireResistance:10};ring.affixes=[];sheet.equipped.ring1=ring;
  const charm=generateItem(133,1,'charm','jade-pebble','common');charm.affixes=[{name:'Test',stat:'strength',value:6},{name:'Test',stat:'fireResistance',value:5}];addInventoryItem(sheet,charm);
  assert.ok(sheet.inventoryLayout![charm.id]>=PACK_CELLS);
  const actual=deriveCharacterStats(sheet,{strength:2,maxHp:5},1);
  const empty=createCharacterSheet();for(const slot of EQUIPMENT_SLOTS)empty.equipped[slot]=null;
  assert.deepEqual(actual,deriveCharacterStats(empty,{strength:12,maxHp:25,fireResistance:15},1));
  assert.ok(Object.values(deriveCharacterStats(empty,tree,1000)).filter(v=>typeof v==='number').every(Number.isFinite));
});
