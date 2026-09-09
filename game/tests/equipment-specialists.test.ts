import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem,itemAffixPool,deriveItem } from '../src/items.ts';
import { sourceMaterialPool,itemMaterialService } from '../src/item-materials.ts';
import { JEWELRY_PROFILES } from '../src/jewelry-content.ts';
import { improveItem } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { itemPrice, improvementPrice } from '../src/commerce.ts';
import { itemIconSVG,itemDropShapes } from '../src/item-art.ts';

test('leather and cloth favor their builds while keeping specialist slots and skill affinities',()=>{
  for(const kind of ['head','chest','gloves','legs','boots'] as const)for(const material of ['leather','cloth','silk','velvet','starweave'] as const){
    const item=generateItem(98,20,kind,undefined,'legendary',material),pool=itemAffixPool(item);
    const weights=Object.fromEntries(pool.map(a=>[a.stat,a.weight??1]));
    assert.ok(weights[material==='leather'?'dexterity':'intelligence']>weights.armor);
    assert.equal(weights.moveSpeedPercent!==undefined,kind==='boots');
    assert.equal(weights.attackSpeedPercent!==undefined,kind==='gloves'&&material==='leather');
    assert.equal(weights.castSpeedPercent!==undefined,kind==='gloves'&&material!=='leather');
    assert.ok(validItem(item));assert.deepEqual(deriveItem(item),item);
    for(const skill of pool.filter(a=>a.stat.startsWith('skill:'))){
      if(material!=='leather')assert.ok(!['skill:cleave','skill:multishot','skill:backstab'].includes(skill.stat));
      else assert.ok(!['skill:fireball','skill:meteor','skill:arcLightning'].includes(skill.stat));
    }
    const rerolled=improveItem(item,'rerollAll',20,340);assert.ok(rerolled.affixes.every(a=>pool.some(p=>p.stat===a.stat)));assert.equal(rerolled.recipe.materialId,material);
  }
});

test('jewelry bases have distinct persistent implicits and favor their own affixes',()=>{
  for(const profile of JEWELRY_PROFILES){
    const item=generateItem(2,1,profile.kind,profile.id,'common','iron');
    assert.deepEqual(item.implicit,profile.id==='moonstone-ring'?{manaRegen:1}:profile.implicit);assert.ok(validItem(item));
    assert.deepEqual(deriveItem(JSON.parse(JSON.stringify(item))),item);
    const upgraded=improveItem(improveItem(item,'rarity',1,89),'relevel',35,91);
    assert.equal(upgraded.recipe.profileId,profile.id);assert.equal(upgraded.recipe.materialId,'iron');assert.ok(validItem(upgraded));
    const pool=itemAffixPool(item),favored=pool.filter(a=>profile.affinity.includes(a.stat));assert.ok(favored.length>=3);
    assert.ok(favored.some(a=>(a.weight??1)>1));
    const bad=structuredClone(item);bad.kind=profile.kind==='ring'?'amulet':'ring';assert.equal(validItem(bad),false);
  }
  const ids=new Set(Array.from({length:160},(_,seed)=>generateItem(seed,1,'ring').recipe.profileId));assert.equal(ids.size,4);
});

test('harder geographic sources improve material odds monotonically without guaranteeing precious gear',()=>{
  const precious=(p:ReturnType<typeof sourceMaterialPool>)=>p.filter(m=>['silver','gold','crystal'].includes(m.id)).reduce((n,m)=>n+m.weight,0);
  let last=0;
  for(const level of [1,5,25,50,100,1000,1e6]){
    const normal=sourceMaterialPool('weapon','sword',{level}),veteran=sourceMaterialPool('weapon','sword',{level,rank:'veteran'}),elite=sourceMaterialPool('weapon','sword',{level,rank:'elite'}),boss=sourceMaterialPool('weapon','sword',{level,encounter:'bossChest'});
    assert.ok(precious(normal)>=last);last=precious(normal);
    assert.ok(precious(veteran)>=precious(normal));assert.ok(precious(elite)>=precious(veteran));assert.ok(precious(boss)>=precious(elite));
    for(const pool of [normal,veteran,elite,boss]){assert.ok(Math.abs(pool.reduce((n,m)=>n+m.weight,0)-100)<1e-9);assert.ok(pool.every(m=>m.weight>0));assert.ok(precious(pool)<25);}
  }
  assert.deepEqual(sourceMaterialPool('weapon','sword',{level:NaN}),sourceMaterialPool('weapon','sword',{level:1}));
});

test('encounter material advantage changes neither drop count, affix rarity nor source item levels',()=>{
  let changed=0;
  for(let seed=0;seed<150;seed++){
    const context={seed,level:25,rank:'elite' as const,biome:'deadwood' as const,kind:'brute' as const};
    const ordinary=rollEnemyLoot(context),chest=rollEnemyLoot({...context,encounter:'bossChest'});
    assert.deepEqual(ordinary.map(i=>[i.kind,i.tier,i.itemLevel,i.recipe.profileId]),chest.map(i=>[i.kind,i.tier,i.itemLevel,i.recipe.profileId]));
    for(let i=0;i<ordinary.length;i++)if(ordinary[i].recipe.materialId!==chest[i].recipe.materialId)changed++;
    assert.deepEqual(chest,rollEnemyLoot({...context,encounter:'bossChest'}));
  }
  assert.ok(changed>10);
});

test('service premiums are gentler than trade value for precious gear',()=>{
  const iron=generateItem(3,20,'weapon','longsword','rare','iron'),crystal=generateItem(3,20,'weapon','longsword','rare','crystal');
  assert.equal(itemMaterialService(crystal),2);assert.equal(itemMaterialService(iron),1);
  assert.equal(itemPrice(crystal,'buy'),itemPrice(iron,'buy')*6);
  for(const op of ['enhance','rarity','rerollOne','rerollAll','relevel'] as const)assert.ok(improvementPrice(crystal,op,30)<=improvementPrice(iron,op,30)*2);
});

test('robe geometry is cloth, long, bounded, and shared with its inventory icon',()=>{
  const robe=generateItem(11,8,'chest',undefined,'common','cloth');
  assert.equal(robe.baseName,'Linen Robe');assert.equal(robe.appearance.style,'cloth');
  const shapes=itemDropShapes(robe);assert.ok(shapes.some(s=>s.surface?.material==='cloth'));assert.ok(shapes.every(s=>s.points.every(p=>p.every(Number.isFinite))));
  assert.ok(itemIconSVG(robe,96).includes('Linen Robe'));assert.ok(!itemIconSVG(robe,96).includes('NaN'));
});

test('silk is a rarer caster fabric with improved armor, soft sheen and durable identity',async()=>{
  const {gearLightResponse,gearSurface}=await import('../src/gear-material.ts');
  for(const kind of ['head','chest','gloves','legs','boots'] as const){
    const cloth=generateItem(76,15,kind,undefined,'rare','cloth'),silk=generateItem(76,15,kind,undefined,'rare','silk');
    assert.equal(silk.appearance.style,'cloth');assert.equal(silk.appearance.surface,'silk');
    assert.ok(silk.implicit.armor!>cloth.implicit.armor!);assert.deepEqual(silk.affixes,cloth.affixes);
    assert.ok(validItem(silk));assert.deepEqual(deriveItem(JSON.parse(JSON.stringify(silk))),silk);
    const improved=improveItem(silk,'enhance',15,87);assert.equal(improved.recipe.materialId,'silk');assert.ok(validItem(improved));
    assert.ok(itemDropShapes(silk).some(s=>s.surface?.material==='silk'));
  }
  const initial=sourceMaterialPool('chest',undefined,{level:1}),later=sourceMaterialPool('chest',undefined,{level:50,rank:'elite'});
  assert.equal(initial.find(m=>m.id==='silk')!.weight,6);
  assert.ok(later.find(m=>m.id==='silk')!.weight>6);
  assert.ok(initial.find(m=>m.id==='cloth')!.weight>initial.find(m=>m.id==='silk')!.weight);
  const lamp={direction:[0,0,1] as const,color:'#ffffff',power:1};
  const silkResponse=gearLightResponse(gearSurface('silk',0,[0,0,1]),lamp),clothResponse=gearLightResponse(gearSurface('cloth',0,[0,0,1]),lamp);
  assert.equal(silkResponse.metalness,0);assert.ok(silkResponse.specular>clothResponse.specular);
});


test('four caster fabrics have distinct surfaces, increasing armor and falling base drop rates',()=>{
  const fabrics=['cloth','silk','velvet','starweave'] as const;
  const items=fabrics.map(material=>generateItem(45,25,'chest',undefined,'rare',material));
  assert.equal(new Set(items.map(i=>i.appearance.base)).size,4);
  const pool=sourceMaterialPool('chest',undefined,{level:1});
  for(const [index,item] of items.entries()){
    assert.ok(validItem(item));assert.deepEqual(item.affixes,items[0].affixes);assert.deepEqual(deriveItem(item),item);
    assert.ok(itemDropShapes(item).some(s=>s.surface?.material===fabrics[index]));
    if(index){assert.ok(item.implicit.armor!>items[index-1].implicit.armor!);assert.ok(pool.find(m=>m.id===fabrics[index])!.weight<pool.find(m=>m.id===fabrics[index-1])!.weight);}
  }
});
