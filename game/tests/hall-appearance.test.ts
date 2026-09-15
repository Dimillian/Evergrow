import test from 'node:test';
import { creditGold, goldBalance } from '../src/wallet.ts';
import assert from 'node:assert/strict';
import { executeSavedAppearanceChange } from '../src/character-commands.ts';
import { CharacterRepository, type CharacterRepositoryPort } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { Simulation } from '../src/simulation.ts';
import type { CharacterLook } from '../src/character-look.ts';

async function fixture() {
  const data = new Map<string, string>();
  const repo = new CharacterRepository({getItem:key=>data.get(key)??null, setItem:(key,value)=>{data.set(key,value);}});
  const world = {seed:7319, blocked:()=>false, move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
  const sim = new Simulation(world, {spawn:false});
  sim.player.hp=31; sim.player.mana=12; sim.player.character.gold=1942;
  sim.player.x=8150; sim.player.y=-1680; sim.time=126;
  const session = new CharacterSession(repo, 9);
  assert.ok(await session.create(0, 'Rowan', world.seed, sim.captureCheckpoint(), 'hall-appearance', 1));
  const slot = repo.read(0), before = structuredClone(slot);
  const look = structuredClone(slot.record!.checkpoint.character.look);
  look.appearance.skin='moonblue'; look.armorTints={chest:'crimson'}; look.showHelmet=true;
  return {repo, slot, before, look, session};
}

test('hall appearance saves only cosmetics and timestamp without activating or upgrading the world', async () => {
  const {repo,slot,before,look} = await fixture();
  const idle = new CharacterSession(repo, 10);
  const result = await executeSavedAppearanceChange(repo, slot, look, 20);
  assert.ok(result.ok);
  assert.equal(idle.active, null);
  const saved = repo.read(0).record!;
  assert.deepEqual(saved.checkpoint.character.look, look);
  assert.equal(saved.updatedAt, 20);
  saved.checkpoint.character.look = before.record!.checkpoint.character.look;
  saved.updatedAt = before.record!.updatedAt;
  assert.deepEqual(saved, before.record);
  assert.deepEqual(slot, before);
});

test('pending and failed hall appearance writes preserve the selected save and capture a detached draft', async () => {
  const {repo,slot,before,look} = await fixture();
  const expectedLook = structuredClone(look);
  let release!: () => void;
  const gate = new Promise<void>(resolve=>{release=resolve;});
  const deferred: CharacterRepositoryPort = {
    read:async index=>{await gate; return repo.read(index);}, list:()=>repo.list(), remove:(...args)=>repo.remove(...args),
    write:async (_index,record)=>{
      assert.deepEqual(record.checkpoint.character.look, expectedLook);
      assert.deepEqual(slot, before);
      return {ok:false,message:'Storage full'};
    },
  };
  const pending = executeSavedAppearanceChange(deferred, slot, look, 20);
  look.appearance.skin='ebony';
  assert.deepEqual(repo.read(0), before);
  release();
  assert.deepEqual(await pending, {ok:false,message:'Storage full'});
  assert.deepEqual(repo.read(0), before);
});

test('hall appearance rejects stale slots and unresolved conflicts without overwriting progress', async () => {
  const {repo,slot,look,session} = await fixture();
  const checkpoint = structuredClone(slot.record!.checkpoint);
  creditGold(checkpoint.character, 50);
  assert.ok(await session.save(checkpoint, 2));
  const current = repo.read(0);
  assert.equal((await executeSavedAppearanceChange(repo, slot, look, 20)).ok, false);
  assert.equal((await executeSavedAppearanceChange(repo, {...current,conflict:true}, look, 20)).ok, false);
  assert.deepEqual(repo.read(0), current);
});

test('hall appearance retains repository compare-and-swap protection when another writer wins during save', async () => {
  const {repo,slot,look,session} = await fixture();
  const racing: CharacterRepositoryPort = {
    read:index=>repo.read(index), list:()=>repo.list(), remove:(...args)=>repo.remove(...args),
    write:async (...args)=>{
      const checkpoint = structuredClone(slot.record!.checkpoint);
      creditGold(checkpoint.character, 50);
      assert.ok(await session.save(checkpoint, 2));
      return repo.write(...args);
    },
  };
  assert.equal((await executeSavedAppearanceChange(racing, slot, look, 20)).ok, false);
  assert.equal(repo.read(0).record!.checkpoint.character.gold, goldBalance(slot.record!.checkpoint.character) + 50);
  assert.deepEqual(repo.read(0).record!.checkpoint.character.look, slot.record!.checkpoint.character.look);
});

test('invalid hall appearance never reaches storage', async () => {
  const {repo,slot,look,before} = await fixture();
  assert.equal((await executeSavedAppearanceChange(repo, slot, {...look,showHelmet:'yes'} as unknown as CharacterLook, 20)).ok, false);
  assert.deepEqual(repo.read(0), before);
});
