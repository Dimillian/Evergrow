import test from 'node:test';
import assert from 'node:assert/strict';
import { validCharacterLook, type CharacterLook } from '../src/character-look.ts';
import { executeAppearanceChange } from '../src/character-commands.ts';
import { Simulation } from '../src/simulation.ts';
import { playerPose } from '../src/character-pose.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { createCharacterSheet } from '../src/items.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
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

test('save validation rejects missing appearance and old schemas without repairing their payload',()=>{
  const sim=new Simulation(world,{spawn:false}),record={version:CHARACTER_SAVE_VERSION,id:'look-test',name:'Rowan',createdAt:1,updatedAt:1,worldSeed:7319,worldVersion:5,checkpoint:sim.captureCheckpoint()};
  assert.ok(decodeCharacterSave(JSON.stringify(record)));
  assert.equal(decodeCharacterSave(JSON.stringify({...record,version:3})),null);
  for(const invalid of [undefined,{...look(),armorTints:{chest:'invalid'}}]){
    const candidate=structuredClone(record);candidate.checkpoint.character.look=invalid as CharacterLook;
    assert.equal(decodeCharacterSave(JSON.stringify(candidate)),null);
  }
});
