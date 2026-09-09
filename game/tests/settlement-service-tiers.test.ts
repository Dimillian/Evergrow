import test from 'node:test';
import assert from 'node:assert/strict';
import { servicePolicy, SETTLEMENT_SERVICES } from '../src/settlement-services.ts';
import { gamblePrice, gambleOdds, vendorStock, quoteService, planService, premiumStockSlot } from '../src/commerce.ts';
import { createCharacterSheet } from '../src/items.ts';
import { generateItem } from '../src/items.ts';
import { validItem } from '../src/item-validation.ts';
import { validCommerce } from '../src/commerce-validation.ts';
import { rerollPool, affixCategory } from '../src/item-improvement.ts';
import { sourceMaterialPool } from '../src/item-materials.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { World, WORLD_GENERATION_VERSION } from '../src/world.ts';
import { Simulation } from '../src/simulation.ts';
import type { TownNPC } from '../src/npcs.ts';
const npc:TownNPC={id:'town:7319:0:building:0:blacksmith',buildingId:'town:7319:0:building:0',role:'blacksmith',name:'Edda',seed:42,level:1,maxLevel:12,x:0,y:0};
test('tier stock preserves regional caps, premium rarity, unique IDs, and highest-slot save ownership',()=>{
 const world=new World(),sim=new Simulation(world,{spawn:false});
 for(const settlementTier of ['settlement','village','city'] as const)for(const role of ['blacksmith','jeweler'] as const){
  const vendor={...npc,role,settlementTier,id:npc.id.replace('blacksmith',role)},sheet=createCharacterSheet();sheet.gold=1000000;
  const stock=vendorStock(sheet,vendor,40),policy=servicePolicy(vendor);
  assert.equal(stock.length,role==='blacksmith'?policy.smithStock:policy.jewelerStock);
  assert.deepEqual(stock,vendorStock(sheet,vendor,40));assert.equal(new Set(stock.map(i=>i!.id)).size,stock.length);
  for(const [slot,item] of stock.entries()){assert.ok(item&&validItem(item));assert.equal(item.itemLevel,12);if(premiumStockSlot(vendor,slot))assert.ok(['rare','epic','legendary'].includes(item.tier));}
  const q=quoteService(sheet,vendor,40,{type:'buy',slot:stock.length-1});assert.ok(q.ok);const plan=planService(sheet,vendor,40,q.quote);assert.ok(plan.ok);assert.ok(validCommerce(plan.character.commerce,40));
  const cp=sim.captureCheckpoint();cp.level=40;cp.character=plan.character;cp.character.statPoints=195;cp.character.skillPoints=39;
  const raw={version:4,id:'tier-test',name:'Rowan',worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,createdAt:1,updatedAt:2,checkpoint:cp};
  assert.ok(decodeCharacterSave(JSON.stringify(raw)),'high stock index survives normal save validation');
  assert.equal(vendorStock(plan.character,vendor,40).at(-1),null);assert.equal(planService(plan.character,vendor,40,q.quote).ok,false);
 }
 world.dispose();
});
test('gambling tier premium and odds improve without bypassing regional item levels',()=>{
 for(const tier of ['settlement','village','city'] as const){const vendor={...npc,role:'gambler' as const,settlementTier:tier};
  assert.equal(gambleOdds(vendor).reduce((n,w)=>n+w,0),100);
  assert.equal(gamblePrice(vendor,99,'weapon'),Math.ceil(252*SETTLEMENT_SERVICES[tier].gamblePrice));
  assert.equal(gamblePrice(vendor,99,'ring'),Math.ceil(378*SETTLEMENT_SERVICES[tier].gamblePrice));
  const q=quoteService(createCharacterSheet(),vendor,99,{type:'gamble',kind:'weapon'});assert.ok(q.ok);assert.equal(q.item.itemLevel,12);
 }
 const rare=(bonus:number)=>sourceMaterialPool('weapon','sword',{level:12,merchantBonus:bonus}).filter(m=>['silver','gold','crystal'].includes(m.id)).reduce((n,m)=>n+m.weight,0);
 assert.ok(rare(2.6)>rare(1.7)&&rare(1.7)>rare(1));
});
test('city affix preference uses the displayed weights, surcharge and eligibility; other services reject it',()=>{
 const sheet=createCharacterSheet();sheet.gold=1000000;sheet.inventory[0]=generateItem(931,12,'amulet',undefined,'rare');
 const vendor={...npc,role:'enchanter' as const,settlementTier:'city' as const};const item=sheet.inventory[0]!;
 const base=rerollPool(item,0),favored=rerollPool(item,0,'offense');assert.deepEqual(base.map(a=>a.stat),favored.map(a=>a.stat));
 for(let i=0;i<base.length;i++)assert.equal(favored[i].weight,base[i].weight*(affixCategory(base[i].stat)==='offense'?3:1));
 const plain=quoteService(sheet,vendor,12,{type:'improve',operation:'rerollOne',source:{bag:0},affix:0});assert.ok(plain.ok);
 const request={type:'improve',operation:'rerollOne',source:{bag:0},affix:0,focus:'offense'} as const;
 const q=quoteService(sheet,vendor,12,request);assert.ok(q.ok);assert.equal(q.quote.price,Math.ceil(plain.quote.price*1.75));
 assert.equal(quoteService(sheet,{...vendor,settlementTier:'village'},12,request).ok,false);
 assert.equal(quoteService(sheet,vendor,12,{...request,operation:'rarity'}).ok,false);
 const plan=planService(sheet,vendor,12,q.quote);assert.ok(plan.ok);assert.ok(validItem(plan.item));assert.notEqual(plan.item.affixes[0].stat,item.affixes[0].stat);
 assert.ok(base.some(a=>a.stat===plan.item.affixes[0].stat));assert.deepEqual(plan.item.affixes.slice(1),item.affixes.slice(1));
});
