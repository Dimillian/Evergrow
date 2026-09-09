import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { quoteService, planService, type ServiceRequest } from '../src/commerce.ts';
import { executeService } from '../src/commerce-command.ts';
import { storageTabCount, storageTabItems, STORAGE_TAB_PRICES, STASH_CAPACITY } from '../src/storage-content.ts';
import { sortStorage } from '../src/inventory-tools.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { Simulation } from '../src/simulation.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import type { TownNPC } from '../src/npcs.ts';

const npc: TownNPC = {id:'test:stash',buildingId:'test',role:'stash',name:'Storage',seed:1,level:1,x:0,y:0};
const world = {blocked:()=>false,move:(x:number,y:number)=>({x,y})};
const wealthy=():CharacterSheet=>({...createCharacterSheet(),gold:2_000_000});
function quote(sheet:CharacterSheet,request:ServiceRequest) {
  const result=quoteService(sheet,npc,1,request); assert.ok(result.ok); return result.quote;
}
function apply(sheet:CharacterSheet,request:ServiceRequest) {
  const result=planService(sheet,npc,1,quote(sheet,request)); assert.ok(result.ok); return result.character;
}
function save(sheet:CharacterSheet) {
  const sim=new Simulation(world,{spawn:false});
  return decodeCharacterSave(JSON.stringify({version:4,id:'storage-tabs',name:'Rowan',worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,
    createdAt:1,updatedAt:2,checkpoint:{...sim.captureCheckpoint(),character:sheet}}));
}

test('four increasingly expensive purchases permanently unlock five tabs and keep existing possessions',()=>{
  let sheet=wealthy(); const item=generateItem(80001,1,'charm','jade-monolith','rare');
  sheet.stash=Array(STASH_CAPACITY).fill(null); sheet.stash[45]=item;
  const inventory=JSON.stringify(sheet.inventory); let spent=0;
  assert.equal(storageTabCount(sheet),1);
  for(let tab=1;tab<5;tab++) {
    const before=structuredClone(sheet),offer=quote(sheet,{type:'unlockStorage',tab});
    assert.equal(offer.price,STORAGE_TAB_PRICES[tab-1]);
    if(tab>1)assert.ok(offer.price>STORAGE_TAB_PRICES[tab-2]);
    const planned=planService(sheet,npc,1,offer); assert.ok(planned.ok); assert.equal(planned.item,null);
    assert.deepEqual(sheet,before,'planning never mutates the current save');
    sheet=planned.character; spent+=offer.price;
    assert.equal(sheet.gold,2_000_000-spent); assert.equal(storageTabCount(sheet),tab+1);
    assert.equal(sheet.stash![45],item); assert.equal(sheet.stash!.length,(tab+1)*STASH_CAPACITY);
    assert.ok(storageTabItems(sheet,tab).every(i=>i===null));
    assert.equal(JSON.stringify(sheet.inventory),inventory);
    assert.ok(save(sheet),'every purchased capacity round trips through shared save validation');
  }
  assert.equal(quoteService(sheet,npc,1,{type:'unlockStorage',tab:5}).ok,false);
});

test('tab purchases reject unaffordable, forged, stale, skipped and wrong-vendor offers',()=>{
  const sheet=wealthy(),before=structuredClone(sheet),offer=quote(sheet,{type:'unlockStorage',tab:1});
  assert.equal(planService({...sheet,gold:offer.price-1},npc,1,offer).ok,false);
  assert.equal(planService(sheet,npc,1,{...offer,price:0}).ok,false);
  for(const tab of [-1,0,2,1.5,NaN])assert.equal(quoteService(sheet,npc,1,{type:'unlockStorage',tab}).ok,false);
  assert.equal(quoteService(sheet,{...npc,role:'blacksmith'},1,{type:'unlockStorage',tab:1}).ok,false);
  const bought=apply(sheet,{type:'unlockStorage',tab:1});
  assert.equal(planService(bought,npc,1,offer).ok,false,'replaying a purchase cannot charge or unlock again');
  assert.deepEqual(sheet,before);
});

test('store, take and auto-sort operate within their selected purchased tab',()=>{
  let sheet=apply(wealthy(),{type:'unlockStorage',tab:1});
  const ring=generateItem(81001,1,'ring'),sword=generateItem(81002,1,'weapon','greatblade'),other=generateItem(81003,1,'chest');
  sheet.stash![0]=other; sheet.inventory[0]=ring; sheet.inventory[1]=sword;
  assert.equal(quoteService(sheet,npc,1,{type:'store',bag:0,tab:2}).ok,false);
  sheet=apply(sheet,{type:'store',bag:0,tab:1}); sheet=apply(sheet,{type:'store',bag:1,tab:1});
  assert.equal(sheet.stash![96],ring); assert.equal(sheet.stash![97],sword); assert.equal(sheet.stash![0],other);
  const first=storageTabItems(sheet,0),bag=JSON.stringify(sheet.inventory);
  assert.equal(sortStorage(sheet,1).ok,true);
  assert.deepEqual(storageTabItems(sheet,0),first); assert.equal(JSON.stringify(sheet.inventory),bag);
  assert.equal(sheet.stash![96],sword); assert.equal(sortStorage(sheet,2).ok,false);
  sheet=apply(sheet,{type:'retrieve',slot:96});
  assert.equal(sheet.stash![96],null); assert.equal(sheet.inventory.filter(i=>i?.id===sword.id).length,1);
  assert.ok(save(sheet));
});

test('a full selected tab cannot silently spill stored gear into another tab',()=>{
  const sheet=apply(wealthy(),{type:'unlockStorage',tab:1});
  for(let i=0;i<STASH_CAPACITY;i++)sheet.stash![i]=generateItem(82000+i,1,'ring');
  sheet.inventory[0]=generateItem(83000,1,'boots'); const before=structuredClone(sheet);
  assert.equal(planService(sheet,npc,1,quote(sheet,{type:'store',bag:0,tab:0})).ok,false);
  assert.deepEqual(sheet,before);
  assert.equal(planService(sheet,npc,1,quote(sheet,{type:'store',bag:0,tab:1})).ok,true);
});

test('purchasing waits for durable storage and preserves gold and tabs after failure',async()=>{
  const player=new Simulation(world,{spawn:false}).player; player.character=wealthy(); player.hp=7; player.mana=3;
  const offer=quote(player.character,{type:'unlockStorage',tab:1}),before=structuredClone(player.character);
  assert.equal((await executeService(player,npc,world,offer,()=>({ok:false,message:'Disk full'}))).ok,false);
  assert.deepEqual(player.character,before);
  let finish!:(value:{ok:boolean})=>void;
  const pending=executeService(player,npc,world,offer,()=>new Promise(resolve=>{finish=resolve;}));
  assert.deepEqual(player.character,before); finish({ok:true}); assert.equal((await pending).ok,true);
  assert.equal(storageTabCount(player.character),2); assert.equal(player.character.gold,before.gold!-10_000);
  assert.equal(player.hp,7); assert.equal(player.mana,3);
  let persisted=false;
  assert.equal((await executeService(player,npc,world,offer,()=>{persisted=true;return{ok:true};})).ok,false);
  assert.equal(persisted,false);
});

test('save validation accepts old chests and rejects malformed capacities or duplicate ownership across tabs',()=>{
  assert.ok(save(wealthy()));
  const sheet=wealthy();sheet.stash=Array(96).fill(null); assert.ok(save(sheet));
  for(const length of [0,95,97,481,576])assert.equal(save({...sheet,stash:Array(length).fill(null)}),null);
  const item=generateItem(84001,1,'ring');sheet.stash=Array(192).fill(null);sheet.stash[0]=item;sheet.stash[96]=item;
  assert.equal(save(sheet),null);
});


test('all five full tabs round trip through the shared save validator',()=>{
  const sheet=wealthy();
  sheet.stash=Array.from({length:5*STASH_CAPACITY},(_,i)=>generateItem(90000+i,40,'charm','astral-monolith','legendary'));
  const decoded=save(sheet);assert.ok(decoded);
  assert.equal(decoded.checkpoint.character.stash!.filter(Boolean).length,480);
  assert.equal(storageTabCount(decoded.checkpoint.character),5);
});
