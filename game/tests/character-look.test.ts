import { progressForRecord } from '../src/chronicle.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterLook, validCharacterLook, type CharacterLook } from '../src/character-look.ts';
import { executeAppearanceChange } from '../src/character-commands.ts';
import { Simulation } from '../src/simulation.ts';
import { playerPose } from '../src/character-pose.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { CharacterRepository, characterSlotKey } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { awardCharacterExperience } from '../src/character.ts';
import { decodeSaveBundle, makeSaveBundle } from '../src/save-bundle.ts';
import { openCloudCache, type CloudRow } from '../src/cloud-cache.ts';
import { IDBFactory } from 'fake-indexeddb';
import { HAIR_STYLES, SKIN_PALETTES, HAIR_PALETTES, ACCESSORIES, FACIAL_HAIR } from '../src/appearance-content.ts';
const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const look=():CharacterLook=>({appearance:{skin:'moonblue',hairColor:'lilac',hair:'twinbraids',facialHair:'chinbraid',accessory:'eyepatch'},armorTints:{chest:'crimson',cloak:'teal',head:'violet'},showHelmet:false});

test('appearance recipes accept every catalog ID and reject malformed or unbounded values',()=>{
  for(const [key,values]of Object.entries({hair:HAIR_STYLES,skin:SKIN_PALETTES,hairColor:HAIR_PALETTES,accessory:ACCESSORIES,facialHair:FACIAL_HAIR}))
    for(const value of values)assert.ok(validCharacterLook({...look(),appearance:{...look().appearance,[key]:value.id}}));
  for(const bad of [null,{},[],{...look(),showHelmet:1},{...look(),extra:true},{...look(),armorTints:{chest:'#ff0000'}},{...look(),armorTints:{weapon:'teal'}},{...look(),appearance:{...look().appearance,hair:'unknown'}},{...look(),appearance:{...look().appearance,height:2}}])assert.equal(validCharacterLook(bad),false);
  const a=createCharacterSheet(),b=createCharacterSheet();a.look.appearance.skin='moonblue';assert.notEqual(a.look.appearance.skin,b.look.appearance.skin);
});

test('appearance commands leave the live character unchanged until persistence accepts the detached draft',async()=>{
  const p=new Simulation(world,{spawn:false}).player;p.hp=31;p.mana=12;
  const before=structuredClone(p),draft=look();
  let release!:(value:{ok:boolean})=>void;
  const operation=executeAppearanceChange(p,draft,async candidate=>{
    assert.deepEqual(p,before);assert.deepEqual(candidate.look,draft);
    return new Promise(resolve=>{release=resolve;});
  });
  draft.appearance.skin='ebony';release({ok:true});assert.ok((await operation).ok);
  assert.deepEqual(p.character.look,look());
  assert.deepEqual({...p,character:before.character},before);
  assert.deepEqual({...p.character,look:before.character.look},before.character);
});

test('failed or invalid appearance saves preserve live gear, stats and resources',async()=>{
  const p=new Simulation(world,{spawn:false}).player,before=structuredClone(p);
  assert.equal((await executeAppearanceChange(p,look(),async()=>({ok:false,message:'Stale writer'}))).ok,false);
  assert.deepEqual(p,before);
  await assert.rejects(executeAppearanceChange(p,look(),async()=>{throw new Error('Storage unavailable');}));
  assert.deepEqual(p,before);
  assert.equal((await executeAppearanceChange(p,{...look(),showHelmet:'yes'} as unknown as CharacterLook,async()=>{assert.fail('invalid draft reached storage');})).ok,false);
});

test('appearance survives character creation, durable edits and checkpoint restoration',async()=>{
  const data=new Map<string,string>(),repo=new CharacterRepository({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}});
  const session=new CharacterSession(repo,5),sim=new Simulation(world,{spawn:false});
  sim.player.character.look=look();
  assert.ok(await session.create(0,'Rowan',7319,sim.captureCheckpoint(),'appearance-test',1));
  const draft={...look(),showHelmet:true};
  assert.ok((await executeAppearanceChange(sim.player,draft,async character=>{
    const checkpoint=sim.captureCheckpoint();checkpoint.character=character;return {ok:await session.save(checkpoint,2)};
  })).ok);
  const record=await new CharacterSession(repo,5).load(0);assert.ok(record);assert.equal(record.version,CHARACTER_SAVE_VERSION);
  const restored=new Simulation(world,{spawn:false});restored.restoreCheckpoint(record.checkpoint);
  assert.deepEqual(restored.player.character.look,draft);
  assert.deepEqual(playerPose(restored.player,0).appearance,draft.appearance);
  assert.ok(playerPose(restored.player,0).outfit?.head);
  restored.player.character.look.showHelmet=false;assert.equal(playerPose(restored.player,0).outfit?.head,null);
});

test('save validation rejects missing v4 appearance and unsupported schemas without repairing their payload',()=>{
  const sim=new Simulation(world,{spawn:false}),record={version:CHARACTER_SAVE_VERSION,id:'look-test',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:5,checkpoint:sim.captureCheckpoint()};
  assert.ok(decodeCharacterSave(JSON.stringify(record)));
  for(const version of [1,2,5])assert.equal(decodeCharacterSave(JSON.stringify({...record,version})),null);
  for(const invalid of [undefined,{...look(),armorTints:{chest:'invalid'}}]){
    const candidate=structuredClone(record);candidate.checkpoint.character.look=invalid as CharacterLook;
    assert.equal(decodeCharacterSave(JSON.stringify(candidate)),null);
  }
});

function preEditorSave(){
  const sim=new Simulation(world,{spawn:false});
  awardCharacterExperience(sim.player,2877);
  sim.player.character.inventory[50]=generateItem(777,1,'ring',undefined,'epic');
  sim.player.character.gold=1942;sim.player.x=8150;sim.player.y=-1680;sim.player.hp=31;sim.player.mana=12;
  sim.kills=15;sim.time=126;
  const record={version:3,id:'pre-editor',name:'Rowan',createdAt:1,updatedAt:2,worldSeed:7319,worldVersion:5,checkpoint:sim.captureCheckpoint()};
  const {look:_,...character}=record.checkpoint.character;
  return {...record,checkpoint:{...record.checkpoint,character}};
}

test('v3 migration supplies the default look while preserving every other saved field and the original bytes',()=>{
  const old=preEditorSave(),raw=JSON.stringify(old),migrated=decodeCharacterSave(raw);
  assert.ok(migrated);
  assert.deepEqual(migrated,{...old,version:4,checkpoint:{...old.checkpoint,character:{...old.checkpoint.character,look:createCharacterLook()}}});
  assert.equal(raw,JSON.stringify(old));
  assert.equal(migrated.checkpoint.character.look.showHelmet,false);
  assert.deepEqual(decodeCharacterSave(JSON.stringify(migrated)),migrated);
  migrated.checkpoint.character.look.appearance.skin='moonblue';
  assert.deepEqual(decodeCharacterSave(raw)!.checkpoint.character.look,createCharacterLook());
  const sim=new Simulation(world,{spawn:false});sim.restoreCheckpoint(decodeCharacterSave(raw)!.checkpoint);
  assert.deepEqual(sim.player.character,decodeCharacterSave(raw)!.checkpoint.character);
  const withLook={...old,checkpoint:{...old.checkpoint,character:{...old.checkpoint.character,look:look()}}};
  assert.deepEqual(decodeCharacterSave(JSON.stringify(withLook))!.checkpoint.character.look,look());
  for(const bad of [null,{...look(),showHelmet:1}])assert.equal(decodeCharacterSave(JSON.stringify({...withLook,checkpoint:{...withLook.checkpoint,character:{...withLook.checkpoint.character,look:bad}}})),null);
  old.checkpoint.character.statPoints+=1;
  assert.equal(decodeCharacterSave(JSON.stringify(old)),null);
});

test('v3 slots migrate on read and save v4 durably with failure and stale-writer protection intact',async()=>{
  const raw=JSON.stringify(preEditorSave()),key=characterSlotKey(0),data=new Map([[key,raw]]);
  let fail=false;
  const repo=new CharacterRepository({getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw new Error('Storage unavailable');data.set(k,v);}});
  const session=new CharacterSession(repo,5),other=new CharacterSession(repo,5);
  const loaded=await session.load(0);assert.ok(loaded);assert.ok(await other.load(0));
  assert.equal(data.get(key),raw);assert.equal(session.active!.token,raw);
  fail=true;assert.equal(await session.save(loaded.checkpoint,3),false);assert.equal(data.get(key),raw);
  fail=false;
  const edited=structuredClone(loaded.checkpoint);edited.character.look=look();
  assert.ok(await session.save(edited,4));assert.equal(JSON.parse(data.get(key)!).version,4);
  assert.deepEqual((await new CharacterSession(repo,5).load(0))!.checkpoint,edited);
  assert.equal(await other.save(loaded.checkpoint,5),false);
  assert.deepEqual(repo.read(0).record!.checkpoint,edited);
  data.set(key,'{damaged');assert.equal(repo.read(0).state,'recovered');
  const backup=repo.read(0).record!;assert.deepEqual({...backup.checkpoint,chronicle:progressForRecord(backup)},loaded.checkpoint);
});

test('portable and cloud bundle decoding upgrades v3 appearance while retaining its chart and identity',()=>{
  const old=preEditorSave(),current=decodeCharacterSave(JSON.stringify(old))!;
  const bundle=makeSaveBundle(current,{chunks:[{x:0,y:0,revision:1,words:new Uint32Array(32).fill(1)}],pois:[]});
  const result=decodeSaveBundle(JSON.stringify({...bundle,character:old}));
  assert.ok(result);assert.deepEqual(result,{...bundle,character:current});
});

test('cloud cached v3 reads migrate without modifying stored recovery bytes or pending upload retries',async()=>{
  const factory=new IDBFactory(),cache=openCloudCache(factory,'appearance-migration');
  const old=preEditorSave(),current=decodeCharacterSave(JSON.stringify(old))!;
  const bundle={...makeSaveBundle(current),character:old} as unknown as ReturnType<typeof makeSaveBundle>;
  try {
    await cache.execute({kind:'write',index:0,expected:null,bundle,operation:'old-upload'});
    const staged=await cache.execute({kind:'upload',index:0}) as CloudRow;
    assert.deepEqual(staged.bundle!.character,current);
    assert.deepEqual(staged.upload!.bundle,bundle,'the immutable upload keeps the original v3 request');
    const read=await cache.execute({kind:'read',index:0}) as CloudRow;
    assert.deepEqual(read,staged);
    const rows=await cache.execute({kind:'list'}) as CloudRow[];assert.deepEqual(rows,[read]);
    const stored=await new Promise<CloudRow>((resolve,reject)=>{
      const open=factory.open('evergrow-cloud:appearance-migration');
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{const db=open.result,tx=db.transaction('slots','readonly'),request=tx.objectStore('slots').get(0);
        tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onerror=()=>{db.close();reject(tx.error);};};
    });
    assert.deepEqual(stored.bundle,bundle);assert.deepEqual(stored.upload,read.upload);
    assert.equal(stored.token,read.token);assert.equal(stored.operation,read.operation);
  }finally{await cache.close();}
});
