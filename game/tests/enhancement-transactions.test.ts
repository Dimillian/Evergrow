import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterSheet, generateItem, deriveItem, ITEM_KINDS } from '../src/items.ts';
import { nextEnhancementLevel } from '../src/item-improvement.ts';
import { planService, quoteService, improvementPrice, itemPrice, type ItemSource } from '../src/commerce.ts';
import { executeService } from '../src/commerce-command.ts';
import { EnhancementSequence, ENHANCEMENT_CHARGE_MS } from '../src/enhancement-feedback.ts';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import type { TownNPC } from '../src/npcs.ts';

const smith: TownNPC = {id:'enhance-smith',buildingId:'enhance-building',role:'blacksmith',name:'Edda',seed:7,x:0,y:0,level:10};
const world = {blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
function fixture(rank=5) {
  const sheet=createCharacterSheet(); sheet.gold=10_000_000;
  const item=generateItem(650,10,'weapon','longsword','rare');
  sheet.inventory[0]=deriveItem({...item,recipe:{...item.recipe,enhancement:rank}});
  return sheet;
}
function quote(sheet:CharacterSheet,source:ItemSource={bag:0}) {
  const result=quoteService(sheet,smith,10,{type:'improve',source,operation:'enhance'});
  assert.ok(result.ok,result.ok?'':result.message); return result.quote;
}
test('every useful enhancement through +10 is guaranteed for every item kind',()=>{
  for(const kind of ITEM_KINDS.filter(kind=>kind!=='riftKey')) {
    const sheet=fixture(),item=generateItem(453,20,kind,undefined,'legendary');
    for(let rank=0;rank<10;rank++)for(const operations of [0,7,31]) {
      sheet.commerce.operations=operations;
      sheet.inventory[0]=deriveItem({...item,recipe:{...item.recipe,enhancement:rank}});
      const target=nextEnhancementLevel(sheet.inventory[0]);if(target===null)continue;
      const q=quote(sheet),plan=planService(sheet,smith,10,q);assert.ok(plan.ok&&plan.item);
      assert.equal(plan.item.recipe.enhancement,target,`${kind} +${rank}`);
      assert.equal(plan.character.gold,sheet.gold!-q.price);
    }
  }
});

test('skipped ranks charge a single current-rank fee without mutating previews',()=>{
  const sheet=fixture(); let found=false;
  for(let seed=1;seed<=100&&!found;seed++) {
    const item=generateItem(seed,1,'legs',undefined,'common');
    for(let rank=0;rank<9;rank++) {
      const current=deriveItem({...item,recipe:{...item.recipe,enhancement:rank}});
      const target=nextEnhancementLevel(current);
      if(target===null||target<=rank+1||target<=5)continue;
      sheet.inventory[0]=current; const before=structuredClone(sheet),q=quote(sheet);
      const plan=planService(sheet,smith,10,q);assert.ok(plan.ok);assert.equal(plan.item?.recipe.enhancement,target);
      assert.equal(q.price,improvementPrice(current,'enhance',10));
      assert.deepEqual(sheet,before); found=true; break;
    }
  }
  assert.ok(found,'fixture exercises free skips beyond +5');
});

test('upgrades spend once, advance only the chosen item and reject stale quotes or insufficient funds',()=>{
  for(const source of [{bag:0},{equipped:'weapon'}] as const) {
    const sheet=fixture(9);
    if('equipped' in source){sheet.equipped.weapon=sheet.inventory[0];sheet.inventory[0]=null;}
    const before=structuredClone(sheet),q=quote(sheet,source),plan=planService(sheet,smith,10,q);assert.ok(plan.ok&&plan.item);
    assert.equal(plan.item.recipe.enhancement,10);assert.equal(plan.character.gold,sheet.gold!-q.price);
    assert.equal(plan.character.commerce.operations,sheet.commerce.operations+1);
    assert.deepEqual(sheet,before);
    assert.equal(planService(plan.character,smith,10,q).ok,false);
    assert.equal(planService(sheet,smith,10,{...q,price:1}).ok,false);
    sheet.gold=q.price-1;assert.equal(planService(sheet,smith,10,q).ok,false);
    assert.equal(sheet.commerce.operations,before.commerce.operations);
  }
  assert.equal(quoteService(fixture(10),smith,10,{type:'improve',source:{bag:0},operation:'enhance'}).ok,false);
});

test('upgrade and gold persist atomically; save rejection preserves resources',async()=>{
  const sim=new Simulation(world,{spawn:false}),p=sim.player;
  p.x=0;p.y=0;p.level=10;p.character=fixture();
  p.character.statPoints=45;p.character.skillPoints=9;refreshCharacter(p);p.hp=30;p.mana=15;
  const data=new Map<string,string>(); const session=new CharacterSession(new CharacterRepository({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}}),4);
  assert.ok(await session.create(0,'Upgrade test',7319,sim.captureCheckpoint(),'enhancement-test',1));
  const q=quote(p.character),before=structuredClone(p);
  const error=await executeService(p,smith,world,q,async()=>({ok:false,message:'Save failed'}));
  assert.equal(error.ok,false);assert.deepEqual(p,before);
  let finish!:(result:{ok:boolean})=>void;
  const pending=executeService(p,smith,world,q,async(character,hp,mana)=>{
    assert.deepEqual(p,before,'staged upgrade has not changed live state');
    assert.ok(await session.save({...sim.captureCheckpoint(),character,hp,mana},2));
    return new Promise(resolve=>{finish=resolve;});
  });
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(p,before);
  finish({ok:true});const result=await pending;
  assert.equal(result.ok,true);assert.equal(p.character.inventory[0]!.recipe.enhancement,nextEnhancementLevel(before.character.inventory[0]!));
  assert.equal(p.hp,30);assert.equal(p.mana,15);
  const saved=(await session.repository.read(0)).record!.checkpoint.character;
  assert.deepEqual(saved,p.character);
  assert.equal(saved.gold,before.character.gold!-q.price);
  assert.deepEqual(planService(saved,smith,10,quote(saved)),planService(p.character,smith,10,quote(p.character)),'reload retains the next quote');
});

test('the charge is cancellable until the final tick before its guaranteed upgrade',async()=>{
  let tick!:()=>void,commits=0;
  const sequence=new EnhancementSequence((done,ms)=>{assert.equal(ms,ENHANCEMENT_CHARGE_MS);tick=done;return()=>{};});
  const sheet=fixture(9),before=structuredClone(sheet),q=quote(sheet);
  const commit=async()=>{commits++;const plan=planService(sheet,smith,10,q);assert.ok(plan.ok);assert.equal(plan.item?.recipe.enhancement,10);return {ok:true,message:plan.message};};
  const canceled=sequence.run(commit,true,()=>{});
  assert.equal(sequence.cancel(),true);tick();assert.equal(await canceled,null);assert.equal(commits,0);assert.deepEqual(sheet,before);
  const running=sequence.run(commit,true,()=>{});assert.equal(commits,0);tick();assert.equal((await running)?.ok,true);assert.equal(commits,1);
});

test('original guaranteed-rank pricing is restored through +10',()=>{
  const base=generateItem(51,10,'weapon','longsword','rare','iron'),sheet=fixture();
  let total=0;
  for(let rank=0;rank<10;rank++) {
    const item=deriveItem({...base,recipe:{...base.recipe,enhancement:rank}});sheet.inventory[0]=item;
    const q=quote(sheet);assert.equal(q.price,Math.ceil(855*1.65**rank));total+=q.price;
    assert.equal(itemPrice(item,'sell'),42);
  }
  assert.equal(total,195428);
});

test('late-rank prices preserve level, rarity and material scaling without charging for free skips',()=>{
  for(const level of [1,10,100,1_000_000])for(const tier of ['common','rare','legendary'] as const)for(const material of ['iron','gold','crystal'] as const) {
    const sheet=fixture(),base=generateItem(51,level,'weapon','longsword',tier,material);
    let previous=0;
    for(let rank=0;rank<10;rank++) {
      const item=deriveItem({...base,recipe:{...base.recipe,enhancement:rank}});
      const price=improvementPrice(item,'enhance',level);
      assert.ok(Number.isSafeInteger(price)&&price>previous);previous=price;
      sheet.inventory[0]=item;
      const target=nextEnhancementLevel(item);
      if(target!==null)assert.equal(quote(sheet).price,price);
    }
  }
});
