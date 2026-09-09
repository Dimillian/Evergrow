import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { World } from '../src/world.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { Simulation } from '../src/simulation.ts';
import { awardCharacterExperience } from '../src/character.ts';
import { decodeCharacterSave, type CharacterSave } from '../src/character-save.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository, type CharacterRepositoryPort, type SaveSlot, type SaveResult } from '../src/character-storage.ts';
import { canLoadWorld, upgradeWorldSave, upgradeWorldChart } from '../src/world-save-upgrade.ts';
import { vendorStock, quoteService, planService } from '../src/commerce.ts';
import { buildingNPC } from '../src/npcs.ts';
import { settlementPOIs } from '../src/settlements.ts';
import { openSaveDatabase } from '../src/save-database.ts';
import { openCloudCache, prepareCloudSave, type CloudRow } from '../src/cloud-cache.ts';
import { chartKey, makeSaveBundle, bundleChart, encodeChart } from '../src/save-bundle.ts';
import type { DecodedExploration } from '../src/exploration-save.ts';
import { createDungeonRun, emptyContents, freshExpeditions } from '../src/dungeon-state.ts';

function fixture(){
 const world=new World(7319),sim=new Simulation(world,{spawn:false});awardCharacterExperience(sim.player,2300);sim.player.character.gold=9876;
 const town=world.getNearestSettlement(0,-1150),npc=buildingNPC(town.buildings.find(b=>b.kind==='blacksmith')!)!;
 const item=vendorStock(sim.player.character,npc,sim.player.level)[0]!;
 sim.player.character.inventory[0]=item;sim.player.character.commerce.sold[npc.id]=1;sim.player.character.recentItems=[item.id];
 const cp=sim.captureCheckpoint(),record:CharacterSave={version:4,id:'upgrade-character',name:'Rowan',createdAt:1,updatedAt:2,worldVersion:9,worldSeed:7319,checkpoint:cp};
 const wall=town.buildings.find(b=>b.wallSegment)!;cp.x=wall.x+wall.width/2;cp.y=wall.y+wall.height/2;
 cp.travel!.returnTo={x:cp.x,y:cp.y,town:0};cp.brokenContainers=[`${town.id}:building:1:furniture:0`,'site:7319:kept:crate'];
 const chart:DecodedExploration={chunks:[{x:0,y:0,revision:0,words:Uint32Array.from({length:32},(_,i)=>i===0?123:0)}],pois:[...settlementPOIs(town).filter(p=>['town','blacksmith'].includes(p.kind)),{id:'site:kept',kind:'camp',name:'Camp',description:'Kept discovery',x:9000,y:9000}]};
 assert.ok(decodeCharacterSave(JSON.stringify(record)));world.dispose();return {record,chart};
}
const factory=(seed:number)=>new World(seed);
function port(db:ReturnType<typeof openSaveDatabase>):CharacterRepositoryPort{return {
 read:async index=>await db.execute({id:1,method:'read',index}) as SaveSlot,
 list:async()=>await db.execute({id:1,method:'list'}) as SaveSlot[],
 write:async(index,record,expected)=>await db.execute({id:1,method:'write',index,record,expected}) as SaveResult,
 remove:async(index,expected)=>await db.execute({id:1,method:'remove',index,expected}) as SaveResult,
};}

test('9→10 keeps progression, items and receipts, refreshes shops, and safely relocates blocked surface positions',()=>{
 const {record}=fixture(),before=JSON.stringify(record),next=upgradeWorldSave(record,10,factory),a=record.checkpoint,b=next.checkpoint;
 assert.equal(JSON.stringify(record),before);assert.ok(decodeCharacterSave(JSON.stringify(next)));assert.equal(next.worldVersion,10);
 for(const key of ['level','xp','hp','mana','kills','flasks','skillCooldowns','clearedCamps','defeatedCampMembers','encounterScales','events','chronicle'] as const)assert.deepEqual(b[key],a[key]);
 assert.equal(b.character.gold,a.character.gold);assert.deepEqual(b.character.equipped,a.character.equipped);assert.deepEqual(b.character.attributes,a.character.attributes);
 assert.deepEqual(b.character.inventory[0],{...a.character.inventory[0],id:'owned:'+a.character.inventory[0]!.id});assert.deepEqual(b.character.recentItems,[b.character.inventory[0]!.id]);
 assert.deepEqual(b.character.commerce.sold,{});assert.deepEqual(b.brokenContainers,['site:7319:kept:crate']);
 const w=factory(7319);assert.ok(!w.blocked(b.x,b.y,18));assert.ok(!w.blocked(b.travel!.returnTo!.x,b.travel!.returnTo!.y,18));w.dispose();
 assert.ok(canLoadWorld(9,10));assert.ok(!canLoadWorld(8,10));assert.throws(()=>upgradeWorldSave(next,10,factory));
});

test('clear surface positions and current dungeon runs survive without resetting their state',()=>{
 const {record}=fixture(),w=factory(7319);record.checkpoint.x=0;record.checkpoint.y=0;assert.ok(!w.blocked(0,0,18));
 let next=upgradeWorldSave(record,10,factory);assert.equal(next.checkpoint.x,0);assert.equal(next.checkpoint.y,0);
 const p=record.checkpoint,entrance={id:'dungeon:7319:0',seed:7319,x:4000,y:4000,level:1,biome:'deadwood' as const,name:'Rootbound Crypt'};
 const run=createDungeonRun(entrance),exp=freshExpeditions();exp.runs=[run];exp.location=entrance.id;exp.surface=emptyContents();exp.surfaceX=p.travel!.returnTo!.x;exp.surfaceY=p.travel!.returnTo!.y;p.expeditions=exp;p.x=run.x;p.y=run.y;
 assert.ok(decodeCharacterSave(JSON.stringify(record)));next=upgradeWorldSave(record,10,factory);
 assert.deepEqual(next.checkpoint.expeditions!.runs,JSON.parse(JSON.stringify([run])));assert.equal(next.checkpoint.x,run.x||0);assert.equal(next.checkpoint.y,run.y||0);assert.equal(next.checkpoint.expeditions!.location,entrance.id);
 assert.ok(!w.blocked(next.checkpoint.expeditions!.surfaceX,next.checkpoint.expeditions!.surfaceY,18));w.dispose();
});

test('session upgrade waits for durable success and preserves the original on failure or stale writer',async()=>{
 const {record}=fixture(),data=new Map<string,string>(),repo=new CharacterRepository({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});assert.ok(repo.write(0,record,null).ok);
 const before=repo.read(0).token;let release!:(value:SaveResult)=>void;
 const session=new CharacterSession({read:i=>repo.read(i),list:()=>repo.list(),remove:(i,t)=>repo.remove(i,t),write:()=>new Promise(r=>release=r)},10,factory);
 const pending=session.load(0);await new Promise(r=>setTimeout(r,0));assert.equal(session.active,null);assert.equal(repo.read(0).token,before);
 release({ok:false,message:'Storage full'});assert.equal(await pending,null);assert.equal(repo.read(0).token,before);assert.equal(session.error,'Storage full');
 const good=new CharacterSession(repo,10,factory);assert.ok(await good.load(0));assert.equal(repo.read(0).record!.worldVersion,10);assert.equal(data.get('evergrow:character:1:0:backup'),JSON.stringify(record));
 const token=repo.read(0).token;assert.ok(await good.load(0));assert.equal(repo.read(0).token,token,'migration runs once');assert.equal(repo.write(0,record,before).ok,false);
});

test('local migration commits character and rekeyed chart atomically, preserving original bytes and exploration',async t=>{
 const db=openSaveDatabase(new IDBFactory());t.after(()=>db.close());const {record,chart}=fixture(),r=port(db);
 assert.ok((await db.execute({id:1,method:'write',index:0,record,expected:null,chart:encodeChart(record,chart)}) as SaveResult).ok);
 const session=new CharacterSession(r,10,factory),next=await session.load(0);assert.ok(next);
 const bundle=JSON.parse(await db.execute({id:1,method:'export',index:0}) as string);
 assert.equal(bundle.character.worldVersion,10);assert.deepEqual(bundleChart(bundle),upgradeWorldChart(chart,7319));
 const old=await db.execute({id:1,method:'chart-read',key:chartKey(record),seed:7319,generation:'9'}) as {data:DecodedExploration};assert.equal(old.data.chunks[0].words[0],123);
});

test('cloud migration preserves explored cells and an immutable in-flight old upload while queuing the upgraded bundle',async t=>{
 const cache=openCloudCache(new IDBFactory(),'upgrade-test');t.after(()=>cache.close());const {record,chart}=fixture();
 let row=await cache.execute({kind:'write',index:0,expected:null,bundle:makeSaveBundle(record,chart),operation:'original-upload'}) as CloudRow;
 row=await cache.execute({kind:'upload',index:0}) as CloudRow;const inFlight=structuredClone(row.upload);
 const next=upgradeWorldSave(record,10,factory),bundle=prepareCloudSave(row,next);
 row=await cache.execute({kind:'write',index:0,expected:row.token,bundle,operation:'upgraded-upload'}) as CloudRow;
 assert.deepEqual(row.upload,inFlight);assert.equal(row.bundle!.character.worldVersion,10);assert.deepEqual(bundleChart(row.bundle!),upgradeWorldChart(chart,7319));
 row=await cache.execute({kind:'ack',index:0,base:0,operation:'original-upload',revision:1}) as CloudRow;assert.ok(row.dirty);assert.equal(row.bundle!.character.worldVersion,10);
 row=await cache.execute({kind:'upload',index:0}) as CloudRow;assert.equal(row.upload!.bundle!.character.worldVersion,10);assert.equal(row.upload!.base,1);
});

test('an unreadable old chart aborts the whole local upgrade, including its revision and character backup',async t=>{
 const factory=new IDBFactory(),db=openSaveDatabase(factory);t.after(()=>db.close());const {record,chart}=fixture();
 const saved=await db.execute({id:1,method:'write',index:0,record,expected:null,chart:encodeChart(record,chart)}) as SaveResult;assert.ok(saved.ok);
 await new Promise<void>((resolve,reject)=>{
   const open=factory.open('evergrow-local',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{
     const connection=open.result,tx=connection.transaction('charts','readwrite');tx.objectStore('charts').put('{broken',chartKey(record));
     tx.oncomplete=()=>{connection.close();resolve();};tx.onerror=()=>reject(tx.error);
   };
 });
 const session=new CharacterSession(port(db),10,seed=>new World(seed));assert.equal(await session.load(0),null);assert.equal(session.active,null);
 const after=await port(db).read(0);assert.equal(after.token,saved.token);assert.deepEqual(after.record,record);assert.match(session.error,/map could not be upgraded/);
});


test('retained shop gear in bag, buyback and ground loot remains valid beside freshly purchased replacement stock',()=>{
 const {record}=fixture(),p=record.checkpoint,w=new World(record.worldSeed),town=w.getNearestSettlement(0,-1150);
 const npc=buildingNPC(town.buildings.find(b=>b.kind==='blacksmith')!)!,stock=vendorStock(p.character,npc,p.level);
 p.character.commerce.buyback=[{item:stock[1]!,price:100}];p.groundItems=[{id:101,x:0,y:0,item:stock[2]!}];p.character.commerce.sold[npc.id]=7;
 assert.ok(decodeCharacterSave(JSON.stringify(record)));const next=upgradeWorldSave(record,10,factory),c=next.checkpoint.character;
 assert.deepEqual(c.commerce.buyback,[{item:{...stock[1],id:'owned:'+stock[1]!.id},price:100}]);
 assert.deepEqual(next.checkpoint.groundItems[0].item,{...stock[2],id:'owned:'+stock[2]!.id});
 const quoted=quoteService(c,npc,p.level,{type:'buy',slot:0});assert.ok(quoted.ok);
 const plan=planService(c,npc,p.level,quoted.quote);assert.ok(plan.ok);next.checkpoint.character=plan.character;
 assert.ok(decodeCharacterSave(JSON.stringify(next)),'old owned gear and new shop stock cannot collide');w.dispose();
});


test('surface actors displaced by a new wall keep their combat identity, wounds and body-sized clearance',()=>{
 const {record}=fixture(),p=record.checkpoint;
 const actor={kind:'brute' as const,rank:'elite' as const,level:12,biome:'deadwood' as const,seed:782,x:p.x,y:p.y,homeX:p.x,homeY:p.y,hp:15};
 p.actors=[actor];assert.ok(decodeCharacterSave(JSON.stringify(record)));
 const next=upgradeWorldSave(record,10,factory),after=next.checkpoint.actors![0],w=factory(7319);
 for(const key of ['kind','rank','level','biome','seed','hp'] as const)assert.equal(after[key],actor[key]);
 assert.ok(!w.blocked(after.x,after.y,ENEMY_DEFINITIONS.brute.radius));assert.ok(!w.blocked(after.homeX,after.homeY,ENEMY_DEFINITIONS.brute.radius));w.dispose();
});
