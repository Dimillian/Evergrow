import { ENCOUNTER_RULES } from '../src/encounter-director.ts';
import { ROAMING_RULES } from '../src/roaming-encounters.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository, characterSlotKey } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave, CHARACTER_SLOT_COUNT } from '../src/character-save.ts';
import { awardCharacterExperience, refreshCharacter } from '../src/character.ts';
import { generateItem, createCharacterSheet, STARTER_LOADOUTS } from '../src/items.ts';
import { addInventoryItem, equipItem } from '../src/inventory.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { SKILL_NODES } from '../src/skill-tree.ts';
import { Exploration } from '../src/exploration.ts';
import { characterPower, previewCharacter } from '../src/character-summary.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
async function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repo = new CharacterRepository(storage), session = new CharacterSession(repo, 4), sim = new Simulation(world, { seed: 7319, spawn: false });
  assert.ok((await session.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'character-a', 100)), session.error);
  return { data, storage, repo, session, sim };
}

test('pickup history and sorted bag round trip; malformed histories are rejected', async () => {
  const { session, repo, sim } = await setup();
  const first = generateItem(919, 1, 'ring', undefined, 'legendary');
  const latest = generateItem(920, 1, 'head', undefined, 'common');
  addInventoryItem(sim.player.character, first); addInventoryItem(sim.player.character, latest);
  executeCharacterCommand(sim.player, { type: 'sortInventory', mode: 'rarity' });
  assert.ok(await session.save(sim.captureCheckpoint(), 200));
  const record = repo.read(0).record!;
  const decoded = decodeCharacterSave(JSON.stringify(record))!;
  sim.restoreCheckpoint(decoded.checkpoint);
  assert.equal(sim.player.character.inventory[0]!.id, first.id);
  executeCharacterCommand(sim.player, { type: 'sortInventory', mode: 'recent' });
  assert.equal(sim.player.character.inventory[0]!.id, latest.id);
  for (const history of [[latest.id, latest.id], [9], ['x'.repeat(161)], Array.from({ length: 76 }, (_, i) => `item-${i}`)]) {
    const bad = structuredClone(record); bad.checkpoint.character.recentItems = history as string[];
    assert.equal(decodeCharacterSave(JSON.stringify(bad)), null);
  }
});

test('all eight slots create independent identical starters with leather armor and empty inventories', async () => {
  const { repo, session, sim } = (await setup());
  for (let i = 1; i < CHARACTER_SLOT_COUNT; i++) assert.ok((await session.create(i, `Wayfarer ${i}`, 7319, sim.captureCheckpoint(), `character-${i}`, 100)));
  const slots = repo.list(); assert.equal(slots.length, 8); assert.equal(slots.filter(s => s.record).length, 8);
  for (const slot of slots) {
    assert.deepEqual(slot.record!.checkpoint.character, sim.player.character);
    assert.equal(slot.record!.checkpoint.character.inventory.filter(Boolean).length, 0);
    assert.equal(slot.record!.checkpoint.character.equipped.chest!.appearance.style, 'leather');
  }
  assert.equal((await session.create(0, 'Overwrite', 7319, sim.captureCheckpoint(), 'another', 101)), false);
  assert.throws(() => repo.read(8), RangeError);
});

test('round trip restores progression, all gear kinds, assignments, resources, location and ground loot without active attacks', async () => {
  const { session, repo, sim } = (await setup());
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
  assert.ok((await session.save(before, 200)), session.error);
  const saved = repo.read(0).record!;
  const fresh = new Simulation(world, { spawn: false }); fresh.restoreCheckpoint(saved.checkpoint);
  assert.deepEqual(fresh.captureCheckpoint(), before);
  assert.equal(fresh.player.prevX, 8150); assert.equal(fresh.player.prevY, -1680);
  assert.equal(fresh.player.attack, null); assert.equal(fresh.player.castTime, 0); assert.equal(fresh.enemies.length, 0);
  assert.equal(fresh.getCampState('cleared-test-camp'), 'cleared');
  fresh.player.character.inventory[50]!.name = 'Changed'; assert.notEqual(saved.checkpoint.character.inventory[50]!.name, 'Changed');
});

test('damaged payloads are rejected wholesale and do not overwrite saved characters', async () => {
  const { repo, session, data } = (await setup()), good = repo.read(0).record!, token = session.active!.token;
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

test('quota failures retain the previous save and never report success', async () => {
  const { data, repo, sim } = (await setup());
  const before = data.get(characterSlotKey(0));
  const failing = new CharacterRepository({ getItem: key => data.get(key) ?? null, setItem: () => { throw new Error('quota'); } });
  const session = new CharacterSession(failing, 4); assert.ok((await session.load(0)));
  sim.player.x = 300; assert.equal((await session.save(sim.captureCheckpoint(), 200)), false);
  assert.match(session.error, /storage/); assert.equal(data.get(characterSlotKey(0)), before); assert.equal(repo.read(0).record!.checkpoint.x, 0);
});

test('a stale tab cannot overwrite a newer checkpoint or deleted slot', async () => {
  const { repo, session, sim } = (await setup()), second = new CharacterSession(repo, 4); assert.ok((await second.load(0)));
  sim.player.x = 100; assert.ok((await session.save(sim.captureCheckpoint(), 200)));
  assert.equal((await second.save(sim.captureCheckpoint(), 300)), false); assert.match(second.error, /another tab/);
  assert.ok(repo.remove(0, repo.read(0).token).ok); assert.equal(repo.read(0).state, 'empty');
  assert.equal((await session.save(sim.captureCheckpoint(), 400)), false);
});

test('backup recovery is explicit, corrupt slots are reserved, and deletion cannot resurrect a backup', async () => {
  const { data, repo, session, sim } = (await setup()); assert.ok((await session.save(sim.captureCheckpoint(), 200)));
  data.set(characterSlotKey(0), '{broken'); assert.equal(repo.read(0).state, 'recovered');
  assert.equal(repo.read(0).record!.updatedAt, 100);
  assert.ok(repo.remove(0, '{broken').ok); assert.equal(repo.read(0).state, 'empty');
  data.set(characterSlotKey(1), '{broken'); assert.equal(repo.read(1).state, 'invalid');
  assert.equal((await session.create(1, 'No overwrite', 7319, sim.captureCheckpoint(), 'new', 300)), false);
  assert.equal(new CharacterRepository(null).read(0).state, 'unavailable');
});

test('world version mismatches cannot activate or rewrite a save', async () => {
  const { repo } = (await setup()), session = new CharacterSession(repo, 5);
  assert.equal((await session.load(0)), null); assert.equal(session.active, null); assert.match(session.error, /world version/);
});

test('death recovery keeps progression and gear, resets transient combat, and returns to the refuge', async () => {
  const { sim } = (await setup()); awardCharacterExperience(sim.player, 300); sim.player.dead = true; sim.player.hp = 0; sim.player.x = 9900;
  const before = structuredClone(sim.player.character), level = sim.player.level, xp = sim.player.xp;
  sim.revive(); assert.deepEqual(sim.player.character, before); assert.equal(sim.player.level, level); assert.equal(sim.player.xp, xp);
  assert.equal(sim.player.dead, false); assert.equal(sim.player.hp, sim.player.maxHp); assert.equal(sim.player.x, 0); assert.equal(sim.player.flasks, 2);
});

test('explored maps are independent between characters and restore on reopening the same slot', async () => {
  const { storage } = (await setup());
  const a = new Exploration(world, { storage, characterId: 'a' }), b = new Exploration(world, { storage, characterId: 'b' });
  a.reveal(500, 500); a.save(); assert.ok(a.isRevealed(500, 500)); assert.equal(b.isRevealed(500, 500), false);
  const reload = new Exploration(world, { storage, characterId: 'a' }); assert.ok(reload.isRevealed(500, 500));
  a.dispose(); b.dispose(); reload.dispose();
});

test('character power is reproducible from saved gear and increases with stronger stats', async () => {
  const { repo } = (await setup()); const saved = repo.read(0).record!;
  const a = previewCharacter(saved), b = previewCharacter(saved); assert.deepEqual(characterPower(a), characterPower(b));
  a.character.equipped.chest!.implicit = { maxHp: 500, armor: 100, damagePercent: 50 }; refreshCharacter(a);
  assert.ok(characterPower(a).power > characterPower(b).power);
});


test('each starter choice persists with matching portrait equipment, common gear and an empty bag', async () => {
  const { repo, session, sim } = (await setup());
  assert.deepEqual(STARTER_LOADOUTS.map(option => option.id), ['sword-shield', 'sword', 'wand', 'fire', 'bow', 'longbow']);
  for (const [index, option] of STARTER_LOADOUTS.entries()) {
    sim.player.character = createCharacterSheet(option.id); refreshCharacter(sim.player);
    const preview = previewCharacter(null, option.id);
    assert.deepEqual(preview.equipment, sim.player.equipment);
    assert.equal(sim.player.equipment.mainHand.id, option.profileId);
    assert.equal(sim.player.character.equipped.weapon!.tier, 'common');
    assert.equal(sim.player.character.equipped.weapon!.itemLevel, 1);
    assert.deepEqual(sim.player.character.equipped.weapon!.affixes, []);
    assert.equal(sim.player.character.equipped.offhand?.recipe.profileId ?? null, option.offhandProfileId);
    assert.ok(sim.player.character.inventory.every(item => item === null));
    assert.equal(sim.player.character.equipped.chest!.appearance.style, 'leather');
    assert.ok((await session.create(index + 1, option.label, 7319, sim.captureCheckpoint(), `starter-${option.id}`, 200)));
    const loaded = (await session.load(index + 1))!;
    const restored = new Simulation(world, { spawn: false }); restored.restoreCheckpoint(loaded.checkpoint);
    assert.deepEqual(restored.player.equipment, preview.equipment);
    assert.equal(repo.read(index + 1).record!.checkpoint.character.equipped.weapon!.weapon!.id, option.profileId);
  }
});

test('wallet and uncollected coins round trip together without duplicating pickups', async () => {
  const { session, repo, sim } = (await setup());
  sim.player.character.gold = 1234;
  sim.groundGold = [{ id: 8100, x: sim.player.x, y: sim.player.y, amount: 25, age: 1 }];
  assert.ok((await session.save(sim.captureCheckpoint(), 200)), session.error);
  const saved = repo.read(0).record!;
  sim.restoreCheckpoint(saved.checkpoint);
  assert.equal(sim.player.character.gold, 1234); assert.equal(sim.groundGold[0].amount, 25);
  const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
  sim.update(.02, input);
  assert.equal(sim.player.character.gold, 1259); assert.equal(sim.groundGold.length, 0);
  assert.ok((await session.save(sim.captureCheckpoint(), 300)), session.error);
  sim.restoreCheckpoint(repo.read(0).record!.checkpoint); sim.update(.02, input);
  assert.equal(sim.player.character.gold, 1259); assert.equal(sim.groundGold.length, 0);
});

test('save validation rejects malformed currency and duplicated ground identities', async () => {
  const { repo } = (await setup()), record = repo.read(0).record!;
  for (const amount of [-1, 1.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = structuredClone(record); (invalid.checkpoint.character as unknown as { gold: unknown }).gold = amount;
    assert.equal(decodeCharacterSave(JSON.stringify(invalid)), null);
  }
  for (const amount of [0, -1, .5]) {
    const invalid = structuredClone(record); invalid.checkpoint.groundGold = [{ id: 7, x: 0, y: 0, age: 0, amount }];
    assert.equal(decodeCharacterSave(JSON.stringify(invalid)), null);
  }
  record.checkpoint.groundGold = [{ id: 7, x: 0, y: 0, age: 0, amount: 4 }, { id: 7, x: 5, y: 0, age: 0, amount: 8 }];
  assert.equal(decodeCharacterSave(JSON.stringify(record)), null);
});

test('characters retain independent world seeds when switching, saving and reopening the repository', async () => {
  const { repo, storage, session } = (await setup());
  const seeds = [0, 18427, 4294967295];
  for (const [i, seed] of seeds.entries()) {
    const seededWorld = { ...world, seed };
    const sim = new Simulation(seededWorld, { seed, spawn: false });
    assert.ok((await session.create(i + 1, `Seed ${seed}`, seed, sim.captureCheckpoint(), `seed-${seed}`, 100)), session.error);
  }
  const reopened = new CharacterSession(new CharacterRepository(storage), 4);
  for (const index of [3, 0, 2, 1, 3]) {
    const seed = index === 0 ? 7319 : seeds[index - 1];
    const record = (await reopened.load(index))!; assert.ok(record, reopened.error);
    assert.equal(record.worldSeed, seed);
    assert.equal(record.checkpoint.randomState, seed);
    const sim = new Simulation({ ...world, seed }, { seed, spawn: false });
    sim.restoreCheckpoint(record.checkpoint);
    assert.ok((await reopened.save(sim.captureCheckpoint(), 200)), reopened.error);
    assert.equal(repo.read(index).record!.worldSeed, seed);
  }
});

test('invalid creation seeds preserve both the empty slot and active character', async () => {
  const { repo, session, sim } = (await setup()), active = session.active;
  for (const seed of [-1, 4294967296, .5, NaN, Infinity]) {
    assert.equal((await session.create(1, 'Invalid seed', seed, sim.captureCheckpoint(), 'invalid-seed', 200)), false);
    assert.equal(repo.read(1).state, 'empty'); assert.equal(session.active, active);
    assert.match(session.error, /world seed/);
  }
});

test('full encounter population and fresh roaming warmup survive an atomic character checkpoint', async () => {
  const { session, repo, sim } = await setup();
  for (let i = 0; i < ENCOUNTER_RULES.hardPopulationCap; i++)
    assert.ok(sim.spawnEnemy('stalker', 500 + i * 50, 0));
  const checkpoint = sim.captureCheckpoint();
  assert.equal(checkpoint.actors?.length, 48);
  assert.equal(checkpoint.roaming?.warmup, ROAMING_RULES.warmupPopulation);
  assert.ok(await session.save(checkpoint, 200), session.error);
  const saved = repo.read(0).record!;
  assert.ok(decodeCharacterSave(JSON.stringify(saved)));
  const restored = new Simulation(world, { spawn: false });
  restored.restoreCheckpoint(saved.checkpoint);
  assert.equal(restored.enemies.length, 48);
  assert.equal(restored.captureCheckpoint().roaming?.warmup, 16);
  assert.equal(restored.spawnEnemy('stalker', 3000, 0), null);
});
