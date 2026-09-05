import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository, characterSlotKey } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave, CHARACTER_SLOT_COUNT } from '../src/character-save.ts';
import { awardCharacterExperience, refreshCharacter } from '../src/character.ts';
import { generateItem } from '../src/items.ts';
import { equipItem } from '../src/inventory.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { SKILL_NODES } from '../src/skill-tree.ts';
import { Exploration } from '../src/exploration.ts';
import { characterPower, previewCharacter } from '../src/character-summary.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repo = new CharacterRepository(storage), session = new CharacterSession(repo, 7319, 4), sim = new Simulation(world, { seed: 7319, spawn: false });
  assert.ok(session.create(0, 'Rowan', sim.captureCheckpoint(), 'character-a', 100), session.error);
  return { data, storage, repo, session, sim };
}

test('all eight slots create independent identical starters with leather armor and empty inventories', () => {
  const { repo, session, sim } = setup();
  for (let i = 1; i < CHARACTER_SLOT_COUNT; i++) assert.ok(session.create(i, `Wayfarer ${i}`, sim.captureCheckpoint(), `character-${i}`, 100));
  const slots = repo.list(); assert.equal(slots.length, 8); assert.equal(slots.filter(s => s.record).length, 8);
  for (const slot of slots) {
    assert.deepEqual(slot.record!.checkpoint.character, sim.player.character);
    assert.equal(slot.record!.checkpoint.character.inventory.filter(Boolean).length, 0);
    assert.equal(slot.record!.checkpoint.character.equipped.chest!.appearance.style, 'leather');
  }
  assert.equal(session.create(0, 'Overwrite', sim.captureCheckpoint(), 'another', 101), false);
  assert.throws(() => repo.read(8), RangeError);
});

test('round trip restores progression, all gear kinds, assignments, resources, location and ground loot without active attacks', () => {
  const { session, repo, sim } = setup();
  awardCharacterExperience(sim.player, 2877);
  assert.ok(executeCharacterCommand(sim.player, { type: 'allocateAttribute', attribute: 'vitality' }).ok);
  const target = 'skill:fireball', parents = new Map<string, string | null>([['origin', null]]), queue = ['origin'];
  for (let i = 0; i < queue.length && !parents.has(target); i++) for (const id of SKILL_NODES.get(queue[i])!.neighbors) if (!parents.has(id)) { parents.set(id, queue[i]); queue.push(id); }
  const path: string[] = []; for (let id: string | null = target; id && id !== 'origin'; id = parents.get(id)!) path.unshift(id);
  for (const id of path) assert.ok(executeCharacterCommand(sim.player, { type: 'allocateNode', id }).ok);
  assert.ok(executeCharacterCommand(sim.player, { type: 'assignSkill', slot: 3, skill: 'fireball' }).ok);
  sim.player.character.inventory[63] = generateItem(786, 7, 'weapon', 'ember-staff', 'rare');
  assert.ok(equipItem(sim.player.character, 63, sim.player.level).ok); refreshCharacter(sim.player);
  sim.player.character.inventory[50] = generateItem(777, 7, 'shield', 'vigil-kite', 'epic');
  sim.player.x = 8150; sim.player.y = -1680; sim.player.hp = 43; sim.player.mana = 19; sim.player.flasks = 0;
  sim.player.skillCooldowns.fireball = .2; sim.player.dodgeCharges = 1; sim.player.dodgeRecharge = .4;
  sim.time = 126; sim.kills = 15; sim.groundItems.push({ id: 39, x: 8100, y: -1650, item: generateItem(881, 7, 'ring', undefined, 'legendary') });
  const before = sim.captureCheckpoint(); before.clearedCamps = ['cleared-test-camp'];
  assert.ok(session.save(before, 200), session.error);
  const saved = repo.read(0).record!;
  const fresh = new Simulation(world, { spawn: false }); fresh.restoreCheckpoint(saved.checkpoint);
  assert.deepEqual(fresh.captureCheckpoint(), before);
  assert.equal(fresh.player.prevX, 8150); assert.equal(fresh.player.prevY, -1680);
  assert.equal(fresh.player.attack, null); assert.equal(fresh.player.castTime, 0); assert.equal(fresh.enemies.length, 0);
  assert.equal(fresh.getCampState('cleared-test-camp'), 'cleared');
  fresh.player.character.inventory[50]!.name = 'Changed'; assert.notEqual(saved.checkpoint.character.inventory[50]!.name, 'Changed');
});

test('damaged payloads are rejected wholesale and do not overwrite saved characters', () => {
  const { repo, session, data } = setup(), good = repo.read(0).record!, token = session.active!.token;
  const mutations = [
    (r: typeof good) => { r.checkpoint.x = Infinity; },
    (r: typeof good) => { r.checkpoint.character.inventory.pop(); },
    (r: typeof good) => { r.checkpoint.character.inventory[0] = r.checkpoint.character.equipped.weapon; },
    (r: typeof good) => { r.checkpoint.character.skillPoints = 99; },
    (r: typeof good) => { r.checkpoint.character.allocatedNodes.push('missing'); },
    (r: typeof good) => { r.checkpoint.character.skillSlots[0] = 'meteor'; },
    (r: typeof good) => { r.checkpoint.character.equipped.chest!.appearance.base = 'url(https://example.com)'; },
    (r: typeof good) => { r.name = '<script>\u0000'; },
  ];
  for (const mutate of mutations) { const bad = structuredClone(good); mutate(bad); assert.equal(decodeCharacterSave(JSON.stringify(bad)), null); assert.equal(repo.write(0, bad, token).ok, false); }
  assert.equal(data.get(characterSlotKey(0)), token);
  assert.equal(decodeCharacterSave('{broken'), null);
});

test('quota failures retain the previous save and never report success', () => {
  const { data, repo, sim } = setup();
  const before = data.get(characterSlotKey(0));
  const failing = new CharacterRepository({ getItem: key => data.get(key) ?? null, setItem: () => { throw new Error('quota'); } });
  const session = new CharacterSession(failing, 7319, 4); assert.ok(session.load(0));
  sim.player.x = 300; assert.equal(session.save(sim.captureCheckpoint(), 200), false);
  assert.match(session.error, /storage/); assert.equal(data.get(characterSlotKey(0)), before); assert.equal(repo.read(0).record!.checkpoint.x, 0);
});

test('a stale tab cannot overwrite a newer checkpoint or deleted slot', () => {
  const { repo, session, sim } = setup(), second = new CharacterSession(repo, 7319, 4); assert.ok(second.load(0));
  sim.player.x = 100; assert.ok(session.save(sim.captureCheckpoint(), 200));
  assert.equal(second.save(sim.captureCheckpoint(), 300), false); assert.match(second.error, /another tab/);
  assert.ok(repo.remove(0, repo.read(0).token).ok); assert.equal(repo.read(0).state, 'empty');
  assert.equal(session.save(sim.captureCheckpoint(), 400), false);
});

test('backup recovery is explicit, corrupt slots are reserved, and deletion cannot resurrect a backup', () => {
  const { data, repo, session, sim } = setup(); assert.ok(session.save(sim.captureCheckpoint(), 200));
  data.set(characterSlotKey(0), '{broken'); assert.equal(repo.read(0).state, 'recovered');
  assert.equal(repo.read(0).record!.updatedAt, 100);
  assert.ok(repo.remove(0, '{broken').ok); assert.equal(repo.read(0).state, 'empty');
  data.set(characterSlotKey(1), '{broken'); assert.equal(repo.read(1).state, 'invalid');
  assert.equal(session.create(1, 'No overwrite', sim.captureCheckpoint(), 'new', 300), false);
  assert.equal(new CharacterRepository(null).read(0).state, 'unavailable');
});

test('world version mismatches cannot activate or rewrite a save', () => {
  const { repo } = setup(), session = new CharacterSession(repo, 7319, 5);
  assert.equal(session.load(0), null); assert.equal(session.active, null); assert.match(session.error, /world version/);
});

test('death recovery keeps progression and gear, resets transient combat, and returns to the refuge', () => {
  const { sim } = setup(); awardCharacterExperience(sim.player, 300); sim.player.dead = true; sim.player.hp = 0; sim.player.x = 9900;
  const before = structuredClone(sim.player.character), level = sim.player.level, xp = sim.player.xp;
  sim.revive(); assert.deepEqual(sim.player.character, before); assert.equal(sim.player.level, level); assert.equal(sim.player.xp, xp);
  assert.equal(sim.player.dead, false); assert.equal(sim.player.hp, sim.player.maxHp); assert.equal(sim.player.x, 0); assert.equal(sim.player.flasks, 2);
});

test('explored maps are independent between characters and restore on reopening the same slot', () => {
  const { storage } = setup();
  const a = new Exploration(world, { storage, characterId: 'a' }), b = new Exploration(world, { storage, characterId: 'b' });
  a.reveal(500, 500); a.save(); assert.ok(a.isRevealed(500, 500)); assert.equal(b.isRevealed(500, 500), false);
  const reload = new Exploration(world, { storage, characterId: 'a' }); assert.ok(reload.isRevealed(500, 500));
  a.dispose(); b.dispose(); reload.dispose();
});

test('character power is reproducible from saved gear and increases with stronger stats', () => {
  const { repo } = setup(); const saved = repo.read(0).record!;
  const a = previewCharacter(saved), b = previewCharacter(saved); assert.deepEqual(characterPower(a), characterPower(b));
  a.character.equipped.chest!.implicit = { maxHp: 500, armor: 100, damagePercent: 50 }; refreshCharacter(a);
  assert.ok(characterPower(a).power > characterPower(b).power);
});
