import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { executeEvent } from '../src/poi-command.ts';
import { eventRecipe } from '../src/event-recipes.ts';
import { advanceTrial } from '../src/poi-runtime.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { validEvents } from '../src/poi-validation.ts';
import { EVENT_RULES, eventLabel, blessingChoices, syncTrial, type EventSite } from '../src/poi-content.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { SAVE_MAX_CODE_UNITS } from '../src/character-save.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { Exploration } from '../src/exploration.ts';
import { World } from '../src/world.ts';
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const site = (kind: EventSite['kind'], id = 1): EventSite => ({ id: `site:7319:test-${id}`, kind, name: 'Test site', x: 0, y: 30, seed: id * 7319, biome: 'deadwood', level: 1 });
async function setup(w = world) {
  const sim = new Simulation(w, { spawn: false, seed: 7319 });
  const data = new Map<string, string>();
  const repo = new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } });
  const session = new CharacterSession(repo, 4);
  assert.ok((await session.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'test-character', 100)));
  const persist = async (c: ReturnType<Simulation['captureCheckpoint']>) => ({ ok: (await session.save(c, 200)), message: session.error });
  return { sim, repo, session, persist };
}
function tick(sim: Simulation, seconds: number, input: Partial<Input> = {}) { for (let i = 0; i < Math.ceil(seconds / FIXED_STEP); i++)
  sim.update(FIXED_STEP, { ...idle, ...input }); }
test('caravan choices persist complete physical rewards once without touching wallet or healing', async () => {
  const { sim, repo, persist } = (await setup());
  sim.player.hp = 31;
  sim.player.mana = 22;
  assert.ok((await executeEvent(sim, site('caravan'), 'goods', persist)).ok);
  assert.equal(sim.groundItems.length, 2);
  assert.equal(sim.player.character.gold, 0);
  assert.equal(sim.player.hp, 31);
  assert.equal(sim.player.mana, 22);
  const saved = repo.read(0).record!;
  assert.ok(saved);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(saved.checkpoint);
  assert.equal((await executeEvent(resumed, site('caravan'), 'coin', persist)).ok, false);
  assert.deepEqual(resumed.groundItems, sim.groundItems);
});
test('storage rejection leaves reward IDs, character, ledger and existing actors untouched', async () => {
  const { sim } = (await setup());
  const enemy = sim.spawnEnemy('stalker', 200, 0)!;
  const before = sim.captureCheckpoint(), id = sim.nextEntityIdentity;
  const result = (await executeEvent(sim, site('caravan'), 'goods', () => ({ ok: false, message: 'Storage full' })));
  assert.equal(result.ok, false);
  assert.deepEqual(sim.captureCheckpoint(), before);
  assert.equal(sim.nextEntityIdentity, id);
  assert.equal(sim.enemies[0], enemy);
});
test('full ground stores a deterministic pending bundle and partial delivery never rerolls', async () => {
  const { sim, persist, repo } = (await setup());
  sim.groundItems = Array.from({ length: 96 }, (_, i) => ({ id: 1000 + i, x: 500, y: 500, item: generateItem(i + 900, 1) }));
  // Restore establishes the shared identity allocator as in an actual saved full-ground run.
  sim.restoreCheckpoint(sim.captureCheckpoint());
  assert.ok((await executeEvent(sim, site('caravan'), 'goods', persist)).ok);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'completed');
  assert.equal(sim.groundItems.length, 96);
  const expected = eventRewards(sim.eventState.sites[site('caravan').id]).items;
  sim.groundItems.pop();
  assert.ok((await executeEvent(sim, site('caravan'), 'goods', persist)).ok);
  assert.deepEqual(sim.groundItems.at(-1)!.item, expected[0]);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(repo.read(0).record!.checkpoint);
  resumed.groundItems.shift();
  assert.ok((await executeEvent(resumed, site('caravan'), 'goods', persist)).ok);
  assert.deepEqual(resumed.groundItems.at(-1)!.item, expected[1]);
  assert.equal(resumed.eventState.sites[site('caravan').id].phase, 'claimed');
  assert.equal(new Set(resumed.groundItems.map(i => i.id)).size, 96);
});
test('full coin capacity retains value until a later interaction', async () => {
  const { sim, persist } = (await setup());
  sim.groundGold = Array.from({ length: 128 }, (_, i) => ({ id: i + 1, x: 400, y: 400, amount: 1, age: 1 }));
  sim.restoreCheckpoint(sim.captureCheckpoint());
  assert.ok((await executeEvent(sim, site('caravan'), 'coin', persist)).ok);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'completed');
  sim.groundGold.pop();
  assert.ok((await executeEvent(sim, site('caravan'), 'coin', persist)).ok);
  assert.equal(sim.groundGold.length, 128);
  assert.equal(sim.eventState.sites[site('caravan').id].phase, 'claimed');
});
test('camp reward reads the actual camp clear ledger and never adds a wave', async () => {
  const { sim, persist } = (await setup());
  const camp = site('camp');
  assert.equal((await executeEvent(sim, camp, null, persist)).ok, false);
  const c = sim.captureCheckpoint();
  c.clearedCamps = [camp.id];
  sim.restoreCheckpoint(c);
  assert.ok((await executeEvent(sim, camp, null, persist)).ok);
  assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.groundGold.length, 1);
  assert.equal(sim.enemies.length, 0);
});
test('trial admission waits for camera coverage, then preserves source and injuries on reload', async () => {
  const { sim, persist, repo } = (await setup());
  const grave = site('graveyard');
  assert.ok((await executeEvent(sim, grave, null, persist)).ok);
  tick(sim, 1);
  assert.equal(sim.enemies.length, 0);
  const view = { x: -900, y: -550, width: 1800, height: 1100 };
  sim.setSpawnExclusion(view);
  for (let i = 0; i < 120 && !sim.enemies.length; i++) tick(sim, FIXED_STEP);
  assert.equal(sim.enemies.length, eventRecipe(grave)!.size);
  assert.ok(sim.enemies.every(e => { const g = sim.eventState.trial!.guardians[Number(e.campMemberId)]; return isSpawnHidden(g.x, g.y, view, e.radius); }), 'admission is hidden; guardians may then walk into view');
  assert.ok(sim.enemies.every(e => e.level === 1 && e.biome === 'deadwood'));
  const first = sim.enemies[0];
  first.hp = 3;
  first.state = 'dead';
  first.hp = 0;
  sim.enemies[1].hp = 4;
  assert.ok((await persist(sim.captureCheckpoint())).ok);
  const resumed = new Simulation(world, { spawn: false });
  resumed.restoreCheckpoint(repo.read(0).record!.checkpoint);
  assert.equal(resumed.eventState.trial!.guardians[0].dead, true);
  assert.equal(resumed.eventState.trial!.guardians[1].hp, 4);
  resumed.setSpawnExclusion({ x: -400, y: -250, width: 800, height: 500 });
  tick(resumed, .6);
  assert.equal(resumed.enemies.length, eventRecipe(grave)!.size-1);
  assert.ok(resumed.enemies.some(e => e.hp === 4));
  assert.equal((await executeEvent(resumed, site('standingStones', 2), blessingChoices(site('standingStones', 2))[0], persist)).ok, false);
});
test('recipe waves count only defeated members and pay their bonus exactly once', async () => {
  const {sim,persist}=await setup();const grave=site('graveyard');
  assert.ok((await executeEvent(sim,grave,null,persist)).ok);
  const trial=sim.eventState.trial!,recipe=eventRecipe(grave)!;
  const advance=()=>advanceTrial({state:sim.eventState,player:sim.player,enemies:[],world,view:{x:-400,y:-200,width:800,height:400},spawn:()=>null});
  syncTrial(sim.eventState,[]);assert.equal(trial.cleared,0);
  for(let wave=0;wave<recipe.rules.count;wave++) {
    trial.rest=0;
    for(const g of trial.guardians.filter(g=>g.wave===wave)){g.admitted=true;g.dead=true;g.hp=0;}
    advance();assert.equal(trial.cleared,wave+1);
  }
  assert.equal(sim.eventState.trial,null);
  assert.ok((await executeEvent(sim,grave,null,persist)).ok);
  const xp=sim.player.xp;assert.ok(xp>0);
  assert.equal(sim.drainEvents().filter(e=>e.type==='experience').length,1);
  assert.equal((await executeEvent(sim,grave,null,persist)).ok,false);assert.equal(sim.player.xp,xp);
});
test('blessings use shared stat derivation, expire in wilderness, pause in town and disappear on death', async () => {
  const { sim } = (await setup({ ...world, isSanctuary: x => x > 1000 }));
  sim.player.character.blessing = { kind: 'haste', remaining: 1 };
  refreshCharacter(sim.player);
  assert.equal(sim.player.stats.attackSpeedMultiplier, 1.15);
  assert.equal(sim.player.stats.castSpeedMultiplier, 1.15);
  sim.player.x = 1100;
  tick(sim, .5);
  assert.equal(sim.player.character.blessing.remaining, 1);
  sim.player.x = 0;
  tick(sim, 1.1);
  assert.equal(sim.player.character.blessing, undefined);
  assert.equal(sim.player.stats.attackSpeedMultiplier, 1);
  sim.player.character.blessing = { kind: 'wellspring', remaining: 90 };
  refreshCharacter(sim.player);
  assert.equal(sim.player.derived.manaCostMultiplier, .8);
  sim.player.dead = true;
  sim.player.hp = 0;
  sim.revive();
  assert.equal(sim.player.character.blessing, undefined);
});
test('event channels stop on movement, combat and input clearing', async () => {
  const { sim } = (await setup());
  const beacon = site('watchtower');
  sim.eventChannel.start(beacon, null);
  tick(sim, .5);
  assert.equal(sim.eventChannel.ready, false);
  tick(sim, .02, { moveX: 1 });
  assert.equal(sim.eventChannel.site, null);
  sim.player.vx = 0;
  sim.eventChannel.start(beacon, null);
  sim.clearInput();
  assert.equal(sim.eventChannel.site, null);
  sim.eventChannel.start(beacon, null);
  tick(sim, .02, { attack: true });
  assert.equal(sim.eventChannel.site, null);
});
test('beacon terrain and sighted target replay without discovery spam or a path through fog', () => {
  const landmark = { id: 'site:target', name: 'Distant grave', kind: 'graveyard' as const, x: 2100, y: 0, description: 'A grave' };
  const notices: string[] = [];
  const exploration = new Exploration({ seed: 1, getPOIs: () => [landmark] }, { storage: null, onDiscover: p => notices.push(p.id) });
  exploration.revealFromBeacon(0, 0, landmark);
  assert.equal(exploration.isRevealed(900, 0), true);
  assert.equal(exploration.isRevealed(1500, 0), false);
  assert.equal(exploration.isRevealed(2100, 0), false);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, true);
  assert.equal(notices.length, 0);
  exploration.reveal(2100, 0, 50);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, undefined);
  assert.deepEqual(notices, [landmark.id]);
  exploration.revealFromBeacon(0, 0, landmark);
  assert.equal(exploration.getDiscoveredPOIs()[0].sighted, undefined);
  const restored = new Exploration({ seed: 1, getPOIs: () => [] }, { storage: null });
  assert.ok(restored.restore(exploration.serialize()));
  exploration.dispose();
  restored.dispose();
});
test('event validation rejects forged completion, bad waves and invalid blessings without accepting partial state', async () => {
  const { sim, persist } = (await setup());
  assert.ok((await executeEvent(sim, site('graveyard'), null, persist)).ok);
  assert.ok(validEvents(sim.eventState));
  for (const mutate of [(s: typeof sim.eventState) => { s.trial!.wave = 1; }, (s: typeof sim.eventState) => { s.sites[site('graveyard').id].phase = 'claimed'; }, (s: typeof sim.eventState) => { s.trial!.guardians[0].hp = 1e30; }]) {
    const clone = structuredClone(sim.eventState);
    mutate(clone);
    assert.equal(validEvents(clone), false);
  }
});
test('more than 256 events remain claimable without evicting earlier beacon records', async () => {
  const { sim, persist } = (await setup());
  for (let i = 0; i < 300; i++) {
    const s = site('watchtower', i + 1);
    sim.eventState.sites[s.id] = { ...s, phase: 'claimed', choice: null, wavesCleared: 0, delivered: 0, bonusGranted: true };
  }
  assert.ok(validEvents(sim.eventState));
  assert.ok((await persist(sim.captureCheckpoint())).ok);
  assert.ok(JSON.stringify(sim.eventState).length < 100000);
  assert.ok(JSON.stringify(sim.captureCheckpoint()).length < SAVE_MAX_CODE_UNITS);
  assert.equal((await executeEvent(sim, site('reliquary', 999), null, persist)).ok, true);
  assert.equal(Object.keys(sim.eventState.sites).length, 301);
});
test('roadside reliquaries have deterministic separated safe approaches and are discoverable POIs', () => {
  const w = new World(74319);
  const sites = w.getEventSites(-4000, -6000, 8000, 12000).filter(s => s.kind === 'reliquary');
  assert.ok(sites.length > 0);
  assert.deepEqual(w.getEventSites(-4000, -6000, 8000, 12000).filter(s => s.kind === 'reliquary'), sites);
  for (const s of sites) {
    assert.equal(w.blocked(s.x, s.y, 25), false);
    assert.equal(w.isSanctuary(s.x, s.y), false);
    assert.ok(w.getPOIs(s.x - 1, s.y - 1, 2, 2).some(p => p.id === s.id));
    for (const other of sites)
      if (other !== s)
        assert.ok(Math.hypot(s.x - other.x, s.y - other.y) >= 450);
  }
});
test('trial actors exceed the former population limit and suspend without rewards or healing', async () => {
  const { sim, persist } = (await setup());
  const grave = site('graveyard');
  (await executeEvent(sim, grave, null, persist));
  const view = { x: -900, y: -550, width: 1800, height: 1100 };
  sim.setSpawnExclusion(view);
  for (let i = 0; i < 48 - 1; i++)
    sim.spawnEnemy('stalker', 2500 + i * 50, 0, 'normal', { campId: 'capacity-fixture', memberId: String(i), lootSeed: i });
  tick(sim, .6);
  assert.ok(sim.enemies.length>48);
  assert.ok(sim.eventState.trial!.guardians.some(g => g.admitted));
  sim.enemies=sim.enemies.filter(e=>e.campId===`event:${grave.id}`);
  assert.equal(sim.enemies.length, eventRecipe(grave)!.size);
  sim.enemies[1].hp = 7;
  const xp = sim.player.xp, kills = sim.kills;
  sim.player.x = 4000;
  sim.setSpawnExclusion({ x: 3500, y: -400, width: 1000, height: 800 });
  tick(sim, .6);
  assert.equal(sim.enemies.length, 0);
  assert.equal(sim.eventState.trial,null);
  assert.equal(sim.eventState.sites[grave.id].pausedTrial!.guardians[1].hp, 7);
  assert.equal(sim.player.xp, xp);
  assert.equal(sim.kills, kills);
  sim.player.x = 0;
  assert.ok((await executeEvent(sim,grave,null,persist)).ok);
  sim.setSpawnExclusion(view);
  tick(sim, .6);
  assert.equal(sim.enemies.length, 0, 'survivors cannot reappear inside padded camera coverage');
  sim.setSpawnExclusion({ x: -400, y: -250, width: 800, height: 500 });
  tick(sim, .6);
  assert.equal(sim.enemies.length, eventRecipe(grave)!.size);
  assert.ok(sim.enemies.some(e => e.hp === 7));
});
test('landed enemy damage cancels a beacon channel before it can award anything', async () => {
  const { sim } = (await setup());
  const enemy = sim.spawnEnemy('stalker', 0, 25)!;
  enemy.state = 'windup';
  enemy.stateTime = 1;
  enemy.stateDuration = .1;
  enemy.attackAngle = -Math.PI / 2;
  enemy.attackTargetX = 0;
  enemy.attackTargetY = 0;
  sim.eventChannel.start(site('watchtower'), null);
  tick(sim, .1);
  assert.ok(sim.player.hp < sim.player.maxHp);
  assert.equal(sim.eventChannel.site, null);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.eventState.sites, {});
});

test('both vigil waves spawn near the event and actively arrive to attack instead of idling at home', async () => {
  const { sim, persist } = await setup();
  const grave = site('graveyard');
  assert.ok((await executeEvent(sim, grave, null, persist)).ok);
  const view = { x: -400, y: -200, width: 800, height: 400 };
  sim.setSpawnExclusion(view);
  sim.player.hp = sim.player.maxHp = 10000;
  tick(sim, FIXED_STEP);
  const first = sim.enemies.filter(e => e.campId === `event:${grave.id}`);
  assert.equal(first.length, eventRecipe(grave)!.size);
  for (const enemy of first) {
    assert.ok(isSpawnHidden(enemy.x, enemy.y, view, enemy.radius));
    assert.ok(Math.hypot(enemy.x - grave.x, enemy.y - grave.y) < 380, 'use the nearby viewport edge, not its distant diagonal');
    assert.equal(enemy.state, 'chase');
    assert.equal(enemy.awareness, 1);
  }
  // Reproduce the old return-home state on already-admitted guardians.
  first.forEach(e => { e.state = 'return'; e.awareness = 0; });
  tick(sim, 8);
  assert.ok(first.every(e => Math.hypot(e.x - sim.player.x, e.y - sim.player.y) < 300));
  assert.ok(first.every(e => !['return', 'idle', 'patrol'].includes(e.state)));
  assert.ok(sim.drainEvents().some(e => e.type === 'hurt'), 'the wave must actually reach combat');
  first.forEach(e => { e.state = 'dead'; e.hp = 0; });
  tick(sim, 3);
  const second = sim.enemies.filter(e => e.state !== 'dead');
  assert.equal(second.length, eventRecipe(grave)!.size+eventRecipe(grave)!.growth);
  assert.ok(second.every(e => Math.hypot(e.x - grave.x, e.y - grave.y) < 380), 'later member indices cannot push the second wave farther away');
  tick(sim, 8);
  assert.ok(second.every(e => Math.hypot(e.x - sim.player.x, e.y - sim.player.y) < 300));
  assert.ok(sim.drainEvents().some(e => e.type === 'hurt'));
});

test('suspended wounded guardians resume their exact clustered positions even behind an obstacle', async () => {
  const wall: WorldQuery = { ...world, blocked: x => x >= 300 && x <= 310 };
  const { sim, persist } = await setup(wall);
  const grave = site('graveyard');
  assert.ok((await executeEvent(sim, grave, null, persist)).ok);
  const records = sim.eventState.trial!.guardians.filter(g=>g.wave===0);
  records.forEach((g, i) => { g.admitted = true; g.x = 700; g.y = i * 20; g.hp = 7; });
  sim.setSpawnExclusion({ x: -200, y: -200, width: 400, height: 400 });
  tick(sim, FIXED_STEP);
  assert.equal(sim.enemies.length, eventRecipe(grave)!.size);
  sim.enemies.forEach((e, i) => {
    assert.equal(e.x, 700); assert.equal(e.y, i * 20); assert.equal(e.hp, 7);
    assert.equal(e.state, 'chase');
    assert.equal(e.lootSeed, records[i].seed);
  });
  tick(sim, .6);
  assert.ok(sim.enemies.every(e => e.state === 'chase' && e.x < 700));
  assert.equal(sim.player.hp, sim.player.maxHp, 'ritual tracking is not permission to attack through the wall');
});


test('leaving the event clears its slot independently of zoom and resumes only with an explicit interaction',async()=>{
  const {sim,persist}=await setup(),grave=site('graveyard');
  assert.ok((await executeEvent(sim,grave,null,persist)).ok);
  const actor=sim.spawnEnemy('stalker',100,30,'normal',{campId:`event:${grave.id}`,memberId:'0',lootSeed:1})!;
  // Preserve the generated member's source contract while staging a visible wounded survivor.
  const g=sim.eventState.trial!.guardians[0];actor.kind=g.kind;actor.hp=g.hp=7;g.admitted=true;
  sim.player.x=EVENT_RULES.abandonRadius-1;sim.player.y=grave.y;
  const advance=(view:{x:number;y:number;width:number;height:number})=>advanceTrial({state:sim.eventState,player:sim.player,enemies:sim.enemies,world,view,spawn:()=>null,dt:0});
  // Keep all candidate spawn positions blocked to inspect departure without admitting new members.
  const context={state:sim.eventState,player:sim.player,enemies:sim.enemies,world:{...world,blocked:()=>true},view:{x:-5000,y:-5000,width:10000,height:10000},spawn:()=>null,dt:0};
  advanceTrial(context);assert.ok(sim.eventState.trial);
  sim.player.x=EVENT_RULES.abandonRadius+1;advanceTrial(context);
  assert.equal(sim.eventState.trial,null);assert.equal(sim.eventState.sites[grave.id].phase,'paused');
  assert.equal(sim.enemies.length,1,'visible survivors must not disappear');
  assert.equal(sim.player.xp,0);assert.equal(sim.eventState.sites[grave.id].bonusGranted,false);
  actor.hp=3;syncTrial(sim.eventState,sim.enemies);
  assert.equal(sim.eventState.sites[grave.id].pausedTrial!.guardians[0].hp,3);
  advance({x:3000,y:3000,width:500,height:400});assert.equal(sim.enemies.length,0);
  assert.ok(validEvents(sim.eventState));
  const saved=sim.captureCheckpoint();sim.restoreCheckpoint(saved);
  sim.player.x=0;advanceTrial({...context,state:sim.eventState,enemies:sim.enemies,player:sim.player});
  assert.equal(sim.eventState.trial,null);assert.equal(eventLabel(grave,sim.eventState,false),'Resume trial');
  const second=site('quarry',2);assert.ok((await executeEvent(sim,second,null,persist)).ok);
  assert.equal((await executeEvent(sim,grave,null,persist)).ok,false,'resuming cannot overwrite another active trial');
  sim.player.x=EVENT_RULES.abandonRadius+1;advanceTrial({...context,state:sim.eventState,enemies:sim.enemies,player:sim.player});
  sim.player.x=0;const before=sim.captureCheckpoint();
  assert.equal((await executeEvent(sim,grave,null,()=>({ok:false,message:'Save failed'}))).ok,false);
  assert.deepEqual(sim.captureCheckpoint(),before);
  assert.ok((await executeEvent(sim,grave,null,persist)).ok);
  assert.equal(sim.captureCheckpoint().events!.trial!.guardians[0].hp,3);assert.equal(sim.eventState.sites[grave.id].pausedTrial,undefined);
  assert.ok(validEvents(sim.eventState));
});
test('departing cursed challenges banks only cleared waves and never parks a running timer',async()=>{
  const {sim,persist}=await setup(),chest=site('cursedChest');
  assert.ok((await executeEvent(sim,chest,null,persist)).ok);
  const trial=sim.eventState.trial!;trial.wave=trial.cleared=1;
  trial.guardians.filter(g=>g.wave===0).forEach(g=>{g.hp=0;g.dead=g.admitted=true;});
  sim.player.x=EVENT_RULES.abandonRadius+1;sim.player.y=chest.y;
  advanceTrial({state:sim.eventState,player:sim.player,enemies:sim.enemies,world,view:null,spawn:()=>null});
  assert.equal(sim.eventState.trial,null);assert.equal(sim.eventState.sites[chest.id].phase,'completed');
  assert.equal(sim.eventState.sites[chest.id].wavesCleared,1);assert.equal(sim.eventState.sites[chest.id].pausedTrial,undefined);
  assert.equal(sim.player.xp,0);assert.ok(validEvents(sim.eventState));
});
