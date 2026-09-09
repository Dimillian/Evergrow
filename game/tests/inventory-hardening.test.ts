import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem, deriveItem, rebalanceCharm, itemAffixPool } from '../src/items.ts';
import { improveItem, improvementProblem, nextEnhancementLevel } from '../src/item-improvement.ts';
import { quoteService, planService, improvementPrice } from '../src/commerce.ts';
import { CHARM_PROFILES, charmThematicStat } from '../src/charm-content.ts';
import { bulkSaleItems, setItemLock } from '../src/item-protection.ts';
import { activeCharms, compactPackLayout, resolvePackLayout, packSpaceProblem, validPackLayout } from '../src/inventory-grid.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { previewCharmReplacement } from '../src/charm-comparison.ts';
import { sortInventory } from '../src/inventory-tools.ts';
import { validItem } from '../src/item-validation.ts';
import { Simulation } from '../src/simulation.ts';
import { executeDropItem } from '../src/drop-item-command.ts';
import { refreshCharacter } from '../src/character.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import type { TownNPC } from '../src/npcs.ts';
const world={seed:7319,generationVersion:4,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),getPOIs:()=>[]};
const smith:TownNPC={id:'smith',buildingId:'stall',role:'blacksmith',name:'Smith',seed:1,x:0,y:0,level:1};

test('enhancement skips rounded-away ranks, charges one step and never sells a no-op',()=>{
  for(let seed=0;seed<100;seed++){
    const item=generateItem(seed,1,'charm','jade-pebble','common');
    const next=nextEnhancementLevel(item),s=createCharacterSheet();s.gold=1e6;addInventoryItem(s,item);
    const quote=quoteService(s,smith,1,{type:'improve',source:{bag:0},operation:'enhance'});
    if(next===null){assert.equal(quote.ok,false);assert.throws(()=>improveItem(item,'enhance',1,1));continue;}
    assert.ok(quote.ok);const plan=planService(s,smith,1,quote.quote);assert.ok(plan.ok && plan.item);
    assert.notDeepEqual(plan.item.affixes,item.affixes);assert.equal(plan.item.recipe.enhancement,next);
    assert.equal(plan.character.gold,s.gold-improvementPrice(item,'enhance',1));
    for(let rank=item.recipe.enhancement+1;rank<next;rank++)assert.deepEqual(deriveItem({...item,recipe:{...item.recipe,enhancement:rank}}).affixes,item.affixes);
  }
  const capped=generateItem(1,1,'charm','jade-pebble','common');capped.recipe.enhancement=10;
  assert.equal(nextEnhancementLevel(capped),null);
});

test('charm sizes have focused budgets and keep their first affix thematic through services',()=>{
  for(const profile of CHARM_PROFILES)for(const tier of ['common','magic','rare','epic','legendary'] as const)for(let seed=0;seed<8;seed++){
    let item=generateItem(seed,20,'charm',profile.id,tier);
    assert.equal(item.affixes.length,profile.size.counts[['common','magic','rare','epic','legendary'].indexOf(tier)]);
    if(profile.size.width*profile.size.height<=2)assert.ok(item.affixes.length<=2);
    for(const operation of ['rerollOne','rerollAll','rarity'] as const){
      assert.ok(charmThematicStat(item,item.affixes[0].stat));assert.ok(validItem(item));
      if(!improvementProblem(item,operation,20,0))item=improveItem(item,operation,20,77,0);
    }
    assert.ok(charmThematicStat(item,item.affixes[0].stat));assert.ok(validItem(item));
  }
});

test('validated old charms rebalance deterministically on load without losing items or locks',async()=>{
  const old=generateItem(5,10,'charm','jade-pebble','rare');delete old.recipe.charmVersion;old.locked=true;
  const definitions=itemAffixPool(old);
  old.affixes=['maxHp','lifeRegen','fireResistance'].map(stat=>({name:definitions.find(a=>a.stat===stat)!.name,stat:stat as typeof old.affixes[number]['stat'],value:3}));old.recipe.rolls=[.2,.4,.6];
  assert.ok(validItem(old));const copy=structuredClone(old),rebalanced=rebalanceCharm(old);
  assert.deepEqual(old,copy);assert.ok(validItem(rebalanced));assert.equal(rebalanced.affixes.length,2);assert.equal(rebalanced.id,old.id);assert.equal(rebalanced.locked,true);assert.deepEqual(rebalanceCharm(rebalanced),rebalanced);
  const data=new Map<string,string>(),sim=new Simulation(world,{spawn:false}),repo=new CharacterRepository({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}}),session=new CharacterSession(repo,4);
  addInventoryItem(sim.player.character,generateItem(5,1,'charm','jade-pebble','rare'));refreshCharacter(sim.player);
  assert.ok(await session.create(0,'Test',7319,sim.captureCheckpoint(),'rebalance-save',100));
  const record=structuredClone(repo.read(0).record!);record.checkpoint.character.inventory[0]=old;record.checkpoint.character.inventoryLayout={[old.id]:72};
  const raw=JSON.stringify(record),decoded=decodeCharacterSave(raw);assert.ok(decoded);
  assert.deepEqual(decoded.checkpoint.character.inventory[0],rebalanced);assert.equal(JSON.stringify(record),raw);
});

test('item locks and explicit active-charm consent are enforced by transaction owners',async()=>{
  const sim=new Simulation(world,{spawn:false}),s=sim.player.character,stone=generateItem(88,1,'charm','jade-pebble','common'),ring=generateItem(89,1,'ring');
  addInventoryItem(s,stone);addInventoryItem(s,ring);
  assert.deepEqual(bulkSaleItems(s,1).map(i=>i.id),[ring.id]);
  const items=[{bag:0,id:stone.id,revision:0}];
  assert.equal(quoteService(s,smith,1,{type:'sellMany',items}).ok,false);
  assert.equal(quoteService(s,smith,1,{type:'sellMany',items,includeActiveCharms:true}).ok,true);
  assert.equal(quoteService(s,smith,1,{type:'sell',source:{bag:0}}).ok,true);
  const stale=quoteService(s,smith,1,{type:'sell',source:{bag:1}});assert.ok(stale.ok);
  assert.ok(setItemLock(s,ring.id,true).ok);assert.equal(planService(s,smith,1,stale.quote).ok,false);
  assert.equal(quoteService(s,smith,1,{type:'sell',source:{bag:1}}).ok,false);
  assert.equal(bulkSaleItems(s,1).length,0);assert.ok(validItem(s.inventory[1]));
  let writes=0;const before=sim.captureCheckpoint();
  assert.equal((await executeDropItem(sim,{type:'bag',index:1,id:ring.id},async()=>{writes++;return {ok:true};})).ok,false);
  assert.equal(writes,0);assert.deepEqual(sim.captureCheckpoint(),before);
  assert.ok(setItemLock(s,ring.id,false).ok);assert.equal(bulkSaleItems(s,1).length,1);
});

test('bounded packing recovers a fragmented layout without losing items or changing acquisition order',()=>{
  const inventory=Array.from({length:14},(_,i)=>generateItem(801+i,1,(['ring','chest','head','weapon'] as const)[(9*(i+3)+i*i)%4],undefined,'common'));
  assert.equal(Object.keys(resolvePackLayout({inventory})).length,13);
  const layout=compactPackLayout(inventory);assert.equal(Object.keys(layout).length,14);assert.ok(validPackLayout(inventory,layout));
  const s=createCharacterSheet();s.inventory=inventory;s.inventoryLayout=layout;s.recentItems=inventory.map(i=>i.id);
  const ids=[...s.recentItems];assert.ok(sortInventory(s,'compact').ok);assert.deepEqual(s.recentItems,ids);assert.equal(Object.keys(s.inventoryLayout!).length,14);
  assert.deepEqual(compactPackLayout(inventory),layout);
});

test('replacement compares several active stones to one stored stone without moving anything',()=>{
  const s=createCharacterSheet();
  for(let i=0;i<48;i++)addInventoryItem(s,generateItem(8000+i,10,'charm','jade-pebble','common'));
  const incoming=generateItem(9000,10,'charm','storm-monolith','legendary');s.stash=Array(96).fill(null);s.stash[0]=incoming;
  const before=structuredClone(s),ids=[0,1,12,13,24,25,36,37].map(i=>s.inventory[i]!.id);
  assert.equal(previewCharmReplacement(s,10,incoming.id,[]).ok,false);
  const preview=previewCharmReplacement(s,10,incoming.id,ids);assert.ok(preview.ok);assert.ok(preview.changes.length>0);assert.equal(preview.removed.length,8);
  assert.deepEqual(s,before);assert.equal(activeCharms(s,10).length,48);
  assert.equal(previewCharmReplacement(s,1,incoming.id,ids).ok,false);
  assert.equal(previewCharmReplacement(s,10,incoming.id,[ids[0],ids[0]]).ok,false);
  assert.match(packSpaceProblem(s,incoming),/full/);
  const scattered=structuredClone(s);for(let i=0;i<48;i+=2)scattered.inventory[i]=null;
  assert.match(packSpaceProblem(scattered,incoming),/No 2 × 4 space/);
});

test('city preferences still apply to later charm rolls when the thematic first roll has one category',()=>{
  const s=createCharacterSheet();s.gold=1e6;
  const item=generateItem(889,20,'charm','jade-monolith','legendary');addInventoryItem(s,item);
  const enchanter:TownNPC={...smith,role:'enchanter',settlementTier:'city'};
  const result=quoteService(s,enchanter,20,{type:'improve',source:{bag:0},operation:'rerollAll',focus:'utility'});
  assert.ok(result.ok);const plan=planService(s,enchanter,20,result.quote);assert.ok(plan.ok && plan.item);
  assert.ok(validItem(plan.item));assert.ok(charmThematicStat(plan.item,plan.item.affixes[0].stat));
});
