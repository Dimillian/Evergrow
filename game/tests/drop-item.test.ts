import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { executeDropItem } from '../src/drop-item-command.ts';
import { generateItem, deriveItem } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { refreshCharacter } from '../src/character.ts';
import { LOOT_RULES } from '../src/combat-content.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { Input } from '../src/model.ts';
const world = { blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}) };
const create = () => new Simulation(world, { spawn:false });
const saved = async () => ({ok:true});
const idle:Input={moveX:0,moveY:0,aimX:100,aimY:0,attack:false,dodge:false,heal:false,skillSlot:null};

test('dropping transfers exactly one item only after storage succeeds, and permits picking it back up',async()=>{
  const sim=create(),item=generateItem(871,1,'ring');assert.ok(addInventoryItem(sim.player.character,item));
  const source={type:'bag' as const,index:0,id:item.id};
  let checkpoint:CharacterCheckpoint|undefined, release!:()=>void;
  const pending=executeDropItem(sim,source,async next=>{checkpoint=next;await new Promise<void>(resolve=>{release=resolve;});return {ok:true};});
  assert.equal(sim.groundItems.length,0);assert.equal(sim.player.character.inventory[0]?.id,item.id);
  assert.equal(checkpoint!.character.inventory[0],null);assert.equal(checkpoint!.groundItems[0].item.id,item.id);
  assert.ok(decodeCharacterSave(JSON.stringify({version:CHARACTER_SAVE_VERSION,id:'drop-save',name:'Drop',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:4,checkpoint})));
  release();assert.ok((await pending).ok);assert.equal(sim.groundItems.length,1);assert.equal(sim.player.character.inventory[0],null);
  assert.equal(sim.player.character.inventoryLayout?.[item.id],undefined);assert.ok(!sim.player.character.recentItems?.includes(item.id));
  assert.ok(sim.nextEntityIdentity>sim.groundItems[0].id);
  assert.equal((await executeDropItem(sim,source,saved)).ok,false);assert.equal(sim.groundItems.length,1);
  const drop=sim.groundItems[0];sim.time+=2;sim.player.x=drop.x;sim.player.y=drop.y;
  assert.equal(sim.requestGroundItem(drop.id),null);sim.update(FIXED_STEP,idle);
  assert.equal(sim.groundItems.length,0);assert.deepEqual(sim.player.character.inventory.find(i=>i?.id===item.id),item);
});

test('failed and throwing saves preserve the item, ground pile, identity and character projection',async()=>{
  for(const persist of [async()=>({ok:false}),async()=>{throw new Error('Storage unavailable');}]){
    const sim=create(),item=generateItem(17,1,'ring');addInventoryItem(sim.player.character,item);
    const before=sim.captureCheckpoint(),identity=sim.nextEntityIdentity,derived=structuredClone(sim.player.derived);
    assert.equal((await executeDropItem(sim,{type:'bag',index:0,id:item.id},persist)).ok,false);
    assert.deepEqual(sim.captureCheckpoint(),before);assert.equal(sim.nextEntityIdentity,identity);assert.deepEqual(sim.player.derived,derived);
  }
});

test('stale, invalid and defeated sources cannot write or drop another item',async()=>{
  const sim=create();addInventoryItem(sim.player.character,generateItem(17,1,'ring'));
  let writes=0;const persist=async()=>{writes++;return {ok:true};};
  for(const index of [-1,.5,120])assert.equal((await executeDropItem(sim,{type:'bag',index,id:'bad'},persist)).ok,false);
  assert.equal((await executeDropItem(sim,{type:'bag',index:0,id:'stale'},persist)).ok,false);
  sim.player.dead=true;assert.equal((await executeDropItem(sim,{type:'bag',index:0,id:sim.player.character.inventory[0]!.id},persist)).ok,false);
  assert.equal(writes,0);assert.equal(sim.groundItems.length,0);
});

test('dropping equipped gear and active charms updates combat without healing',async()=>{
  const sim=create(),weapon=sim.player.character.equipped.weapon!;
  const hp=sim.player.hp;assert.ok((await executeDropItem(sim,{type:'equipment',slot:'weapon',id:weapon.id},saved)).ok);
  assert.equal(sim.player.character.equipped.weapon,null);assert.equal(sim.player.hp,hp);
  let charm=generateItem(133,1,'charm','jade-pebble','common');charm.affixes[0]={name:'Vigor',stat:'maxHp',value:0};charm=deriveItem(charm);
  addInventoryItem(sim.player.character,charm);refreshCharacter(sim.player);const boosted=sim.player.maxHp;
  sim.player.hp=sim.player.maxHp;
  assert.ok((await executeDropItem(sim,{type:'bag',index:0,id:charm.id},saved)).ok);
  assert.ok(sim.player.maxHp<boosted);assert.equal(sim.player.hp,sim.player.maxHp);assert.equal(sim.groundItems.length,2);
});

test('dropping on a full ground pile uses oldest-first eviction and a nearby walkable landing',async()=>{
  const sim=create();const item=generateItem(44,1,'ring');addInventoryItem(sim.player.character,item);
  sim.groundItems=Array.from({length:LOOT_RULES.maxGroundItems},(_,i)=>({id:i+1,x:0,y:0,item:generateItem(1000+i,1,'ring')}));
  sim.reserveIdentity(LOOT_RULES.maxGroundItems+1);
  sim.world={...world,blocked:(x,y)=>x>10||y>10};
  assert.ok((await executeDropItem(sim,{type:'bag',index:0,id:item.id},saved)).ok);
  assert.equal(sim.groundItems.length,LOOT_RULES.maxGroundItems);assert.equal(sim.groundItems[0].id,2);
  const drop=sim.groundItems.at(-1)!;assert.equal(drop.item.id,item.id);assert.ok(!sim.world.blocked(drop.x,drop.y,8));
  assert.ok(Math.hypot(drop.x-sim.player.x,drop.y-sim.player.y)<140);
});
