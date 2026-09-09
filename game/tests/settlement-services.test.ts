import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { quoteService, planService, GAMBLE_KINDS, gambleOdds, STASH_CAPACITY } from '../src/commerce.ts';
import { executeService } from '../src/commerce-command.ts';
import { validItem } from '../src/item-validation.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { Simulation } from '../src/simulation.ts';
import { World, WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { TownNPC } from '../src/npcs.ts';
import type { CharacterSheet } from '../src/character-types.ts';
const gambler:TownNPC={id:'town:7319:0:building:3:gambler',name:'Mara',buildingId:'town:7319:0:building:3',role:'gambler',seed:77,level:1,maxLevel:12,x:0,y:0};
const stash:TownNPC={...gambler,id:'town:7319:0:building:8:stash',role:'stash'};
const wealthy=()=>{const s=createCharacterSheet();s.gold=100000;return s;};
function save(sheet:CharacterSheet){const world=new World(),sim=new Simulation(world,{spawn:false}),record={version:4,id:'test-settlement',name:'Rowan',worldSeed:7319,worldVersion:WORLD_GENERATION_VERSION,createdAt:1,updatedAt:2,checkpoint:{...sim.captureCheckpoint(),character:sheet}};world.dispose();return decodeCharacterSave(JSON.stringify(record));}
test('gambles select equipment categories at bounded town level and share real recipe validation',()=>{
 assert.equal(gambleOdds(gambler).reduce((a,b)=>a+b,0),100);
 for(const kind of GAMBLE_KINDS){const sheet=wealthy(),q=quoteService(sheet,gambler,40,{type:'gamble',kind});assert.ok(q.ok && q.item);
  assert.equal(q.item.kind,kind);assert.equal(q.item.itemLevel,12);assert.ok(validItem(q.item));
  assert.deepEqual(quoteService(sheet,gambler,40,{type:'gamble',kind}),q,'inspecting an offer never advances RNG');
  const before=structuredClone(sheet),plan=planService(sheet,gambler,40,q.quote);assert.ok(plan.ok && plan.item);assert.deepEqual(sheet,before);
  assert.equal(plan.character.gold,sheet.gold!-q.quote.price);assert.equal(plan.character.inventory.filter(Boolean).length,1);
  assert.equal(planService(plan.character,gambler,40,q.quote).ok,false,'replayed purchases cannot issue twice');
  const next=quoteService(plan.character,gambler,40,{type:'gamble',kind});assert.ok(next.ok && next.item);assert.notEqual(next.item.id,q.item.id);
 }
});
test('gambling charges nothing on full bags, insufficient funds, forged quotes or other services',()=>{
 const sheet=wealthy(),q=quoteService(sheet,gambler,1,{type:'gamble',kind:'weapon'});assert.ok(q.ok && q.item);
 assert.equal(planService(sheet,gambler,1,{...q.quote,price:0}).ok,false);
 const empty={...sheet,gold:0};assert.equal(planService(empty,gambler,1,q.quote).ok,false);assert.equal(empty.commerce.operations,0);
 const full={...sheet,inventory:Array.from({length:64},(_,i)=>generateItem(i+100,1))};assert.equal(planService(full,gambler,1,q.quote).ok,false);
 assert.equal(quoteService(sheet,stash,1,{type:'gamble',kind:'weapon'}).ok,false);
 assert.equal(quoteService(sheet,gambler,1,{type:'buy',slot:0}).ok,false);
 const plan=planService(sheet,gambler,1,q.quote);assert.ok(plan.ok && plan.item);assert.ok(save(plan.character),'gambled gear round trips with the normal save validator');
});
test('stash transfers exact gear between locations, prevents duplication, and saves its ownership',()=>{
 const sheet=wealthy();sheet.inventory[3]=generateItem(912,1,'weapon');const item=sheet.inventory[3];
 const q=quoteService(sheet,stash,1,{type:'store',bag:3});assert.ok(q.ok && q.item);const stored=planService(sheet,stash,1,q.quote);assert.ok(stored.ok);
 assert.equal(stored.character.inventory[3],null);assert.deepEqual(stored.character.stash![0],item);assert.equal(stored.character.gold,sheet.gold);assert.ok(save(stored.character));
 assert.equal(planService(stored.character,stash,1,q.quote).ok,false);
 const other={...stash,id:'town:7319:1:building:18:stash'},take=quoteService(stored.character,other,1,{type:'retrieve',slot:0});assert.ok(take.ok);
 const result=planService(stored.character,other,1,take.quote);assert.ok(result.ok);assert.equal(result.character.stash![0],null);assert.equal(result.character.inventory.filter(i=>i?.id===item.id).length,1);
 const duplicate=structuredClone(stored.character);duplicate.inventory[0]=item;assert.equal(save(duplicate),null);
 const invalid=structuredClone(stored.character);invalid.stash!.push(null);assert.equal(save(invalid),null);
 const full=structuredClone(sheet);full.stash=Array.from({length:STASH_CAPACITY},(_,i)=>generateItem(i+2200,1));assert.equal(planService(full,stash,1,q.quote).ok,false);
});
test('storage and gambling retain live state until persistence succeeds and preserve it on failure',async()=>{
 const world=new World(),sim=new Simulation(world,{spawn:false}),p=sim.player;
 p.character=wealthy();p.character.inventory[0]=generateItem(774,1,'boots');
 for(const [npc,request]of [[stash,{type:'store',bag:0}],[gambler,{type:'gamble',kind:'weapon'}]] as const){
  const q=quoteService(p.character,npc,1,request);assert.ok(q.ok && q.item);const before=structuredClone(p.character);
  const failure=await executeService(p,npc,world,q.quote,()=>({ok:false}));assert.equal(failure.ok,false);assert.deepEqual(p.character,before);
  let finish!:(v:{ok:boolean})=>void;const pending=executeService(p,npc,world,q.quote,()=>new Promise(resolve=>{finish=resolve;}));
  assert.deepEqual(p.character,before);finish({ok:true});assert.equal((await pending).ok,true);assert.notDeepEqual(p.character,before);
 }
 world.dispose();
});
