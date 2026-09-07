import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, createCharacterSheet, STARTER_LOADOUTS } from '../src/items.ts';
import { MATERIAL_POOLS, itemMaterialPool, itemMaterialScale, rollItemMaterial } from '../src/item-materials.ts';
import { equipmentExhibits } from '../src/equipment-review-fixtures.ts';
import { validItem } from '../src/item-validation.ts';
import { improveItem } from '../src/item-improvement.ts';
import { itemPrice, improvementPrice } from '../src/commerce.ts';
import { rollEnemyLoot } from '../src/loot.ts';

test('material tables remain immutable with rare precious bases and complete roll coverage',()=>{
  for(const pool of Object.values(MATERIAL_POOLS)){
    assert.ok(Object.isFrozen(pool));assert.ok(Math.abs(pool.reduce((n,m)=>n+m.weight,0)-100)<1e-9);
    let start=0;
    for(const m of pool){assert.ok(Object.isFrozen(m));assert.equal(rollItemMaterial(pool,(start+m.weight/2)/100),m.id);start+=m.weight;}
    assert.equal(rollItemMaterial(pool,1-Number.EPSILON),pool.at(-1)!.id);
  }
  assert.equal(MATERIAL_POOLS.melee.filter(m=>['iron','steel'].includes(m.id)).reduce((n,m)=>n+m.weight,0),94);
  assert.equal(MATERIAL_POOLS.armor.filter(m=>['cloth','leather','iron','steel'].includes(m.id)).reduce((n,m)=>n+m.weight,0),87);
  assert.throws(()=>rollItemMaterial(MATERIAL_POOLS.melee,NaN),RangeError);
  assert.throws(()=>generateItem(3,1,'weapon','longsword','common','leather'),RangeError);
});

test('every gallery material is a valid durable item with real base stats, not a painted mock',()=>{
  const exhibits=equipmentExhibits();assert.equal(exhibits.length,196);
  for(const {item} of exhibits){
    assert.ok(validItem(item),item.baseName);
    const loaded=JSON.parse(JSON.stringify(item));assert.ok(validItem(loaded));assert.deepEqual(deriveItem(loaded),item,item.baseName);
    const bad=structuredClone(item);bad.recipe.materialId='unknown' as never;assert.equal(validItem(bad),false);
  }
  const invalid=generateItem(1,2,'weapon','longsword');invalid.recipe.materialId='leather';assert.equal(validItem(invalid),false);
});

test('base materials increase damage/armor without changing affix rolls, cadence or elements',()=>{
  const variants=MATERIAL_POOLS.melee.map(m=>generateItem(47,20,'weapon','longsword','rare',m.id));
  for(const [i,item] of variants.entries()){
    assert.deepEqual(item.affixes,variants[0].affixes);assert.deepEqual(item.recipe.rolls,variants[0].recipe.rolls);
    assert.equal(item.weapon!.baseAttacksPerSecond,variants[0].weapon!.baseAttacksPerSecond);
    assert.equal(item.weapon!.damageType,'physical');
    if(i)assert.ok(item.weapon!.damage>variants[i-1].weapon!.damage);
  }
  const armor=MATERIAL_POOLS.armor.map(m=>generateItem(4,20,'chest',undefined,'common',m.id));
  for(const material of ['cloth','silk','velvet','starweave'])assert.equal(armor.find(i=>i.recipe.materialId===material)!.appearance.style,'cloth');
  assert.ok(armor.find(i=>i.recipe.materialId==='gold')!.implicit.armor!>armor.find(i=>i.recipe.materialId==='leather')!.implicit.armor!);
});

test('improving and repricing a precious base preserves its recipe without compounding',()=>{
  let item=generateItem(25,10,'weapon','ember-staff','rare','crystal');
  for(const operation of ['enhance','rarity','rerollOne','rerollAll','relevel'] as const){
    item=improveItem(item,operation,20,70,0);assert.equal(item.recipe.materialId,'crystal');assert.ok(validItem(item));
    assert.deepEqual(deriveItem(deriveItem(item)),item);
  }
  const iron=generateItem(5,10,'weapon','longsword','common','iron'),gold=generateItem(5,10,'weapon','longsword','common','gold');
  assert.ok(itemPrice(gold,'buy')>itemPrice(iron,'buy'));assert.ok(itemPrice(gold,'sell')>itemPrice(iron,'sell'));
  for(const op of ['enhance','rarity','relevel'] as const)assert.ok(improvementPrice(gold,op,20)>improvementPrice(iron,op,20));
});

test('new characters keep ordinary authored starts and existing unspecified bases stay unchanged',()=>{
  for(const loadout of STARTER_LOADOUTS){
    const sheet=createCharacterSheet(loadout.id);
    for(const item of Object.values(sheet.equipped).filter(i=>i!==null)){
      assert.ok(validItem(item));assert.equal(itemMaterialScale(item),1);assert.equal(item.tier,'common');
    }
  }
  const item=generateItem(20,10,'weapon','longsword','common','iron');delete item.recipe.materialId;
  assert.ok(validItem(item));assert.equal(deriveItem(item).weapon!.damage,item.weapon!.damage);
});

test('enemy drops roll materials independently of rarity and preserve source-level identities',()=>{
  const seen=new Set<string>();let ordinary=0,total=0;
  for(let seed=0;seed<1600;seed++){
    const loot=rollEnemyLoot({seed,level:12,rank:'elite',biome:'deadwood',kind:'brute',firstKill:true});
    for(const item of loot){assert.ok(validItem(item));assert.ok(itemMaterialPool(item.kind,item.weapon?.family).some(m=>m.id===item.recipe.materialId));seen.add(item.recipe.materialId!);total++;if(['iron','steel','leather','ashwood','runewood','glass','quartz','cloth'].includes(item.recipe.materialId!))ordinary++;}
    const common=generateItem(seed,12,'weapon','longsword','common'),legendary=generateItem(seed,12,'weapon','longsword','legendary');
    assert.equal(common.recipe.materialId,legendary.recipe.materialId);
  }
  assert.ok(seen.has('gold')&&seen.has('silver')&&seen.has('crystal'));assert.ok(ordinary/total>.8);
});
