import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, deriveItem, createCharacterSheet, itemAffixCount, itemAffixPool } from '../src/items.ts';
import { CHARM_PROFILES, CHARM_SIZES, CHARM_REWARD_CAPS } from '../src/charm-content.ts';
import { activeCharms, PACK_CELLS, PACK_COLUMNS, INVENTORY_CELLS, resolvePackLayout, validPackLayout, itemFootprint } from '../src/inventory-grid.ts';
import { addInventoryItem, moveInventoryItem } from '../src/inventory.ts';
import { sortInventory } from '../src/inventory-tools.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { improveItem, improvementProblem } from '../src/item-improvement.ts';
import { validItem } from '../src/item-validation.ts';
import { itemIconSVG, itemDropShapes, itemPackIconSVG } from '../src/item-art.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { itemTooltipMarkup } from '../src/item-ui.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { quoteService } from '../src/commerce.ts';
import type { TownNPC } from '../src/npcs.ts';
const world={seed:7319,generationVersion:4,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),getPOIs:()=>[]};
const stone=(seed=11,profile='jade-pebble',level=1)=>generateItem(seed,level,'charm',profile,'rare');

test('all stone shapes and flavors share deterministic item recipes, size budgets and service rules',()=>{
  for(const profile of CHARM_PROFILES)for(const tier of ['common','magic','rare','epic','legendary'] as const){
    const item=generateItem(432,30,'charm',profile.id,tier);
    assert.deepEqual(item,generateItem(432,30,'charm',profile.id,tier));assert.deepEqual(deriveItem(item),item);assert.ok(validItem(item));
    assert.equal(item.affixes.length,itemAffixCount(item));assert.deepEqual(itemFootprint(item),{width:profile.size.width,height:profile.size.height});
    assert.ok(itemDropShapes(item).length>8);assert.match(itemIconSVG(item),/<svg/);assert.match(itemPackIconSVG(item,profile.size.width,profile.size.height),/<svg/);
    for(const op of ['enhance','rerollAll','rerollOne','relevel'] as const)if(!improvementProblem(item,op,40,0))assert.ok(validItem(improveItem(item,op,40,871,0)));
    if(tier!=='legendary'&&!improvementProblem(item,'rarity',40)){const next=improveItem(item,'rarity',40,871);assert.ok(validItem(next));assert.equal(next.affixes.length,itemAffixCount(next));}
  }
  assert.ok(stone(11,'jade-monolith').affixes.length>stone().affixes.length);
  const forged=stone();forged.recipe.profileId='missing';assert.equal(validItem(forged),false);
});

test('pickups use only the charm grid, with level-gated bonuses and atomic placement',()=>{
  const s=createCharacterSheet(),a=stone(),b=stone(12,'storm-shard'),late=stone(13,'amber-monolith',20);
  for(const item of [a,b,late])assert.ok(addInventoryItem(s,item));
  assert.equal(activeCharms(s).length,3);assert.equal(activeCharms(s,1).length,2);
  for(const item of [a,b,late])assert.ok(resolvePackLayout(s)[item.id]>=PACK_CELLS);
  const before=structuredClone(s);assert.equal(moveInventoryItem(s,0,0).ok,false);assert.deepEqual(s,before);
  assert.equal(moveInventoryItem(s,1,PACK_CELLS+PACK_COLUMNS*3).ok,false,'no bottom overflow');
  assert.ok(moveInventoryItem(s,2,PACK_CELLS+8).ok,'higher-level stones can be rearranged');
  assert.ok(sortInventory(s,'compact').ok);assert.equal(activeCharms(s,1).length,2);
  assert.ok(validPackLayout(s.inventory,s.inventoryLayout));
  assert.equal(validPackLayout(s.inventory,{[a.id]:0}),false);
  assert.equal(validPackLayout(s.inventory,{[a.id]:INVENTORY_CELLS}),false);
});

test('size scales the same affix and shared totals cap utility, resistance and speed without stash or under-level bonuses',()=>{
  const s=createCharacterSheet();
  let previous=0;
  for(const size of [CHARM_SIZES[0],CHARM_SIZES[1],CHARM_SIZES[4],CHARM_SIZES[5]]){
    let item=stone(44,`amber-${size.id}`);item.affixes[0]={name:'Wisdom',stat:'xpGainPercent',value:0};item.recipe.rolls[0]=.5;item=deriveItem(item);
    assert.ok(item.affixes[0].value>previous);previous=item.affixes[0].value;
  }
  const item=stone();item.affixes=[{name:'Test',stat:'goldFindPercent',value:200},{name:'Test',stat:'xpGainPercent',value:200},{name:'Test',stat:'allResistance',value:90}];
  s.stash=[item];assert.equal(deriveCharacterStats(s).goldFindMultiplier,1);
  s.stash=[];s.inventory[0]=item;s.inventoryLayout={};
  s.inventoryLayout[item.id]=PACK_CELLS;const stats=deriveCharacterStats(s);
  assert.equal(stats.goldFindMultiplier,1+CHARM_REWARD_CAPS.gold/100);assert.equal(stats.xpGainMultiplier,1+CHARM_REWARD_CAPS.xp/100);assert.equal(stats.resistances.fire,.75);
  s.inventory[0]=null;s.stash=[item];assert.equal(deriveCharacterStats(s).goldFindMultiplier,1);
  const pool=itemAffixPool({kind:'charm'});assert.ok(pool.find(a=>a.stat==='goldFindPercent')!.weight!>pool.find(a=>a.stat==='damagePercent')!.weight!);
});

test('charm drops are rare, seeded and retain source levels and normal rarity',()=>{
  let charms=0,total=0;const tiers=new Set<string>();
  for(let seed=0;seed<20000;seed++)for(const item of rollEnemyLoot({seed,level:27,rank:'elite',biome:'verdant',kind:'caster'})){
    total++;if(item.kind!=='charm')continue;charms++;tiers.add(item.tier);assert.equal(item.itemLevel,29);assert.ok(validItem(item));
  }
  assert.ok(charms/total>.04&&charms/total<.06,`${charms}/${total}`);assert.ok(tiers.size>=4);
});

test('pre-charm 64/72-slot saves can earn, pick up and persist new monster-dropped charms',()=>{
  for(const capacity of [64,72]){
    const source=new Simulation(world,{spawn:false});
    source.player.level=16;source.player.character.skillPoints=15;source.player.character.statPoints=75;
    refreshCharacter(source.player);
    const checkpoint=source.captureCheckpoint();
    checkpoint.kills=1200;
    checkpoint.character.inventory=checkpoint.character.inventory.slice(0,capacity);
    delete checkpoint.character.inventoryLayout;
    const record={version:4,id:`old-charms-${capacity}`,name:'Existing adventurer',createdAt:1,updatedAt:2,worldSeed:7319,worldVersion:4,checkpoint};
    const saved=decodeCharacterSave(JSON.stringify(record));assert.ok(saved);
    const sim=new Simulation(world,{spawn:false});sim.restoreCheckpoint(saved.checkpoint);
    const enemy=sim.spawnEnemy('stalker',sim.player.x+40,sim.player.y)!;
    Object.assign(enemy,{x:sim.player.x,y:sim.player.y,level:16,rank:'normal',biome:'verdant',lootSeed:118,xpReward:20,hp:0,state:'dead'});
    let id=9000;
    awardKillRewards(enemy,1200,0,{player:sim.player,groundGold:sim.groundGold,groundItems:sim.groundItems,pickups:sim.pickups,nextId:()=>++id,emit:()=>{}});
    const drop=sim.groundItems.find(d=>d.item.kind==='charm');assert.ok(drop,'ordinary kill must use the current charm pool');
    assert.ok(decodeCharacterSave(JSON.stringify({...record,checkpoint:sim.captureCheckpoint()})),'charm on the ground must survive saving');
    assert.equal(sim.requestGroundItem(drop.id),null);
    sim.update(FIXED_STEP,{moveX:0,moveY:0,aimX:0,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null});
    assert.ok(sim.player.character.inventory.some(item=>item?.id===drop.item.id));
    assert.ok(resolvePackLayout(sim.player.character)[drop.item.id]>=PACK_CELLS);
    const picked=decodeCharacterSave(JSON.stringify({...record,checkpoint:sim.captureCheckpoint()}));assert.ok(picked);
    assert.ok(picked.checkpoint.character.inventory.some(item=>item?.id===drop.item.id));
  }
});

test('kill gold and XP bonuses apply once while preserving equipment rolls',()=>{
  const run=(boost:boolean)=>{
    const sim=new Simulation(world,{spawn:false});const p=sim.player;
    if(boost){const item=stone();item.affixes=[{name:'Test',stat:'goldFindPercent',value:100},{name:'Test',stat:'xpGainPercent',value:50}];p.character.inventory[0]=item;p.character.inventoryLayout={[item.id]:PACK_CELLS};refreshCharacter(p);}
    const enemy={...sim.spawnEnemy('stalker',40,0)!,level:1,rank:'elite' as const,lootSeed:741,xpReward:20};
    awardKillRewards(enemy,0,0,{player:p,groundGold:sim.groundGold,groundItems:sim.groundItems,pickups:sim.pickups,nextId:(()=>{let id=200;return()=>id++;})(),emit:()=>{}});
    return {xp:p.xp,gold:sim.groundGold.reduce((sum,p)=>sum+p.amount,0),items:sim.groundItems};
  };
  const base=run(false),boost=run(true);assert.equal(boost.xp,Math.round(base.xp*1.5));assert.ok(base.gold>0);assert.equal(boost.gold,base.gold*2);assert.deepEqual(boost.items,base.items);
});

test('dedicated charm grid survives saves, including stones above character level',async()=>{
  const data=new Map<string,string>(),repo=new CharacterRepository({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}}),session=new CharacterSession(repo,4),sim=new Simulation(world,{spawn:false});
  const item=stone();assert.ok(addInventoryItem(sim.player.character,item));refreshCharacter(sim.player);
  assert.ok(await session.create(0,'Stonekeeper',7319,sim.captureCheckpoint(),'charm-save',100));
  const saved=repo.read(0).record!;assert.ok(decodeCharacterSave(JSON.stringify(saved)));assert.equal(activeCharms(saved.checkpoint.character).length,1);
  const higher=structuredClone(saved);higher.checkpoint.character.inventory[0]=stone(55,'amber-shard',20);higher.checkpoint.character.inventoryLayout={[higher.checkpoint.character.inventory[0]!.id]:PACK_CELLS};
  assert.ok(decodeCharacterSave(JSON.stringify(higher)));assert.equal(activeCharms(higher.checkpoint.character,1).length,0);
  const old=structuredClone(saved);old.checkpoint.character.inventory=Array(72).fill(null);delete old.checkpoint.character.inventoryLayout;assert.ok(decodeCharacterSave(JSON.stringify(old)));
});

test('charms can be sold directly and item tooltips contain no stat explanations or size line',()=>{
  const s=createCharacterSheet(),item=stone();assert.ok(addInventoryItem(s,item));
  const npc:TownNPC={id:'merchant',buildingId:'stall',role:'blacksmith',name:'Smith',seed:1,x:0,y:0,level:1};
  assert.ok(quoteService(s,npc,1,{type:'sell',source:{bag:0}}).ok);
  assert.ok(quoteService(s,npc,1,{type:'sellMany',items:[{bag:0,id:item.id,revision:item.recipe.revision}],includeActiveCharms:true}).ok);
  const markup=itemTooltipMarkup(item,{sheet:s,level:1,sourceIndex:0});
  assert.doesNotMatch(markup,/ui-item-affix-note|affixes ·|Active|Place in charm grid/);
});

test('all 48 charm cells and 72 bag cells can be occupied without an invisible count limit',()=>{
  const s=createCharacterSheet();
  for(let i=0;i<48;i++){const item=stone(1000+i);assert.ok(addInventoryItem(s,item));}
  assert.equal(addInventoryItem(s,stone(3000)),false,'no fallback into the empty bag');
  for(let i=0;i<72;i++)assert.ok(addInventoryItem(s,generateItem(2000+i,1,'ring',undefined,'common')));
  assert.equal(activeCharms(s).length,48);assert.equal(s.inventory.filter(Boolean).length,120);
  assert.equal(addInventoryItem(s,stone(3000)),false);assert.ok(validPackLayout(s.inventory,s.inventoryLayout));
});

test('a full equipment bag does not prevent charm collection',()=>{
  const s=createCharacterSheet();
  for(let i=0;i<72;i++)assert.ok(addInventoryItem(s,generateItem(5000+i,1,'ring',undefined,'common')));
  assert.ok(addInventoryItem(s,stone()));assert.equal(activeCharms(s,1).length,1);
});
