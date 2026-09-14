import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOT_LOG_LIMIT, recordLoot, lootLogAfterTrade, lootLogLocation, lootLogAge, type LootLogEntry } from '../src/loot-log.ts';
import { validLootLog } from '../src/loot-log-validation.ts';
import { createCharacterSheet, generateItem, deriveItem } from '../src/items.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { executeDropItem } from '../src/drop-item-command.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION, type CharacterSave } from '../src/character-save.ts';
import { notificationAnchor } from '../src/notification-layout.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';
import type { Input } from '../src/model.ts';
import { freshExpeditions, emptyContents } from '../src/dungeon-state.ts';

const world = { blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}), sampleBiome: () => ({ id:'verdant' as const }) };
const idle: Input = { moveX:0, moveY:0, aimX:200, aimY:0, attack:false, dodge:false, heal:false, skillSlot:null };
function pickup(sim: Simulation, seed = 901) {
  const item = generateItem(seed, 1, 'ring', undefined, 'rare');
  sim.groundItems.push({id:seed,x:sim.player.x,y:sim.player.y,item});
  sim.requestGroundItem(seed); sim.update(FIXED_STEP, idle);
  return item;
}
function save(sim: Simulation): CharacterSave {
  return {version:CHARACTER_SAVE_VERSION,id:'loot-test',name:'Rowan',createdAt:100,updatedAt:100,worldSeed:7319,worldVersion:10,checkpoint:sim.captureCheckpoint()};
}

test('successful pickup records once, detached from equipment and presentation events', () => {
  const sim = new Simulation(world, {spawn:false});
  const item = pickup(sim);
  assert.equal(sim.lootLog.length, 1);
  assert.equal(sim.lootLog[0].location, 'Verdant Forest');
  assert.deepEqual(sim.lootLog[0].item, item);
  assert.notEqual(sim.lootLog[0].item, item);
  sim.drainEvents(); sim.update(FIXED_STEP, idle);
  assert.equal(sim.lootLog.length, 1);
  const original = structuredClone(sim.lootLog[0].item);
  item.recipe.enhancement = 3; Object.assign(item, deriveItem(item));
  assert.deepEqual(sim.lootLog[0].item, original);
});

test('uncollected and rejected pickups do not enter the log', () => {
  const sim = new Simulation(world, {spawn:false});
  sim.groundItems.push({id:901,x:sim.player.x,y:sim.player.y,item:generateItem(901,1)});
  sim.update(FIXED_STEP, idle);
  assert.equal(sim.lootLog.length, 0);
  // A genuinely full spatial pack causes the transfer to fail.
  for (let index=0; index<72; index++) sim.player.character.inventory[index] = generateItem(2000+index,1,'ring');
  pickup(sim, 902);
  assert.equal(sim.lootLog.length, 0);
  assert.ok(sim.groundItems.some(drop=>drop.id===902));
});

test('history keeps the latest 100 distinct item IDs, including identical-looking items', () => {
  const log: LootLogEntry[] = [], item = generateItem(1,1);
  for (let index=0;index<105;index++) recordLoot(log,{...item,id:`pickup-${index}`},index,'The Mire');
  assert.equal(log.length, LOOT_LOG_LIMIT); assert.equal(log[0].time, 5);
  assert.equal(log.at(-1)?.time, 104); assert.ok(validLootLog(log,104));
  const original = structuredClone(log);
  recordLoot(log,{...item,id:'pickup-5'},120,'Verdant Forest');
  assert.deepEqual(log,original);
});

test('pickup, durable drop, save reload and re-pick preserve the first history entry', async () => {
  const sim=new Simulation(world,{spawn:false}), item=pickup(sim);
  pickup(sim,902); // The first item must not move ahead of this newer entry.
  const original=structuredClone(sim.lootLog);
  const index=sim.player.character.inventory.findIndex(gear=>gear?.id===item.id);
  assert.ok((await executeDropItem(sim,{type:'bag',index,id:item.id},async()=>({ok:true}))).ok);
  const decoded=decodeCharacterSave(JSON.stringify(save(sim))); assert.ok(decoded);
  sim.restoreCheckpoint(decoded.checkpoint);
  const drop=sim.groundItems.find(gear=>gear.item.id===item.id)!;
  sim.time+=2; sim.player.x=drop.x; sim.player.y=drop.y;
  assert.equal(sim.requestGroundItem(drop.id),null); sim.update(FIXED_STEP,idle);
  assert.ok(sim.player.character.inventory.some(gear=>gear?.id===item.id));
  assert.deepEqual(sim.lootLog,original);
  assert.equal(lootLogLocation(sim.lootLog[0],sim.player.character,sim.groundItems),'In inventory');
});

test('saved duplicate receipts collapse to the first snapshot and latest sold state', () => {
  const sim=new Simulation(world,{spawn:false});pickup(sim);sim.time+=20;
  const record=save(sim), first=structuredClone(record.checkpoint.lootLog![0]);
  const changed=structuredClone(first.item); changed.recipe.enhancement=2;
  record.checkpoint.lootLog!.push({item:deriveItem(changed),time:sim.time,location:'The Mire',sold:true});
  const decoded=decodeCharacterSave(JSON.stringify(record));assert.ok(decoded);
  assert.deepEqual(decoded.checkpoint.lootLog,[{...first,sold:true}]);
  assert.equal(record.checkpoint.lootLog!.length,2);
  const log=decoded.checkpoint.lootLog!;
  recordLoot(log,changed,sim.time,'Verdant Forest');
  assert.deepEqual(log,[first]);
});

test('history round-trips in the character checkpoint; missing history starts empty without changing progress', () => {
  const sim = new Simulation(world, {spawn:false}); pickup(sim);
  const record = save(sim), decoded = decodeCharacterSave(JSON.stringify(record));
  assert.ok(decoded); assert.deepEqual(decoded.checkpoint.lootLog, sim.lootLog);
  const restored = new Simulation(world, {spawn:false}); restored.restoreCheckpoint(decoded.checkpoint);
  assert.deepEqual(restored.lootLog, sim.lootLog);
  restored.lootLog[0].item.name = 'Detached';
  assert.notEqual(decoded.checkpoint.lootLog![0].item.name, 'Detached');
  delete record.checkpoint.lootLog;
  const old = decodeCharacterSave(JSON.stringify(record)); assert.ok(old);
  restored.restoreCheckpoint(old.checkpoint);
  assert.deepEqual(restored.lootLog, []);
  assert.deepEqual(restored.player.character.inventory, old.checkpoint.character.inventory);
  assert.equal(restored.time, sim.time);
  sim.reset(); assert.deepEqual(sim.lootLog, []);
});

test('malformed, future, out-of-order and oversized histories are rejected by shared save decoding', () => {
  const sim = new Simulation(world, {spawn:false}); pickup(sim);
  const good = save(sim);
  const mutations = [
    (log: LootLogEntry[]) => { log[0].item.recipe.enhancement = 99; },
    (log: LootLogEntry[]) => { log[0].time = 999; },
    (log: LootLogEntry[]) => { log[0].location = '\u0000'; },
    (log: LootLogEntry[]) => { while(log.length<=LOOT_LOG_LIMIT) log.push(structuredClone(log[0])); },
    (log: LootLogEntry[]) => { log.push({...structuredClone(log[0]),time:0}); },
  ];
  for (const mutate of mutations) { const record=structuredClone(good); mutate(record.checkpoint.lootLog!); assert.equal(decodeCharacterSave(JSON.stringify(record)),null); }
});

test('location follows equip, storage, ground and durable sales without changing recorded stats', () => {
  const item = generateItem(1,1,'ring'), before=createCharacterSheet();
  before.inventory[0]=item;
  const log: LootLogEntry[]=[]; recordLoot(log,item,0,'The Mire');
  assert.equal(lootLogLocation(log[0],before,[]),'In inventory');
  const after=structuredClone(before); after.inventory[0]=null;
  const staged=lootLogAfterTrade(log,before,after,true);
  assert.equal(log[0].sold,undefined); // A failed save leaves the live log unchanged.
  assert.equal(lootLogLocation(staged[0],after,[]),'Sold · Town merchant');
  const boughtBack=lootLogAfterTrade(staged,after,before,false);
  assert.equal(boughtBack[0].sold,undefined);
  after.equipped.ring1=item;
  assert.equal(lootLogLocation(log[0],after,[]),'Equipped · Ring 1');
  after.equipped.ring1=null; after.stash=[item];
  assert.equal(lootLogLocation(log[0],after,[]),'In personal storage');
  after.stash=[];
  assert.equal(lootLogLocation(log[0],after,[{id:1,x:0,y:0,item}]),'On the ground');
  const expeditions=freshExpeditions(); expeditions.surface={...emptyContents(),groundItems:[{id:1,x:0,y:0,item}]};
  assert.equal(lootLogLocation(log[0],after,[],expeditions),'On the ground');
  assert.equal(lootLogLocation(log[0],after,[]),'No longer carried');
  assert.deepEqual(staged[0].item,item);
});

test('bulk sale history survives buyback eviction', () => {
  const before=createCharacterSheet(), log:LootLogEntry[]=[];
  for(let i=0;i<20;i++){const item=generateItem(i+1,1,'ring');before.inventory[i]=item;recordLoot(log,item,i,'Verdant Forest');}
  const after=structuredClone(before);after.inventory.fill(null);
  const staged=lootLogAfterTrade(log,before,after,true);
  assert.ok(staged.every(entry=>lootLogLocation(entry,after,[])==='Sold · Town merchant'));
});

test('pickup age uses active character time and the HUD button excludes combat at desktop and narrow sizes', () => {
  assert.equal(lootLogAge(100,110),'Just now'); assert.equal(lootLogAge(0,120),'2 min ago');
  for(const [width,height] of [[1440,900],[800,600],[360,480]]) {
    const rect=notificationAnchor(width,height);
    assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=width && rect.y+rect.height<=height);
    assert.ok(isGameUIPoint(rect.x+10,rect.y+10,width,height,null,false,rect));
    assert.equal(isGameUIPoint(rect.x+10,rect.y+10,width,height,null,false),false);
  }
  const phone = notificationAnchor(844,390,true,12);
  assert.equal(phone.y,70); assert.equal(phone.x+phone.width/2,422);
  assert.ok(isGameUIPoint(phone.x+10,phone.y+10,844,390,null,false,phone));
});
