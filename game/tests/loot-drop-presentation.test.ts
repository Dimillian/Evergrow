import test from 'node:test';
import assert from 'node:assert/strict';
import { LootDropPresentation, lootBeaconLights, lootDropEvent, lootLandingMaterial } from '../src/loot-drop-presentation.ts';
import { generateItem, generateUnique } from '../src/items.ts';
import type { GroundItem } from '../src/character-types.ts';
import { GameAudio } from '../src/audio.ts';
const legendary: GroundItem = { id: 1, x: 0, y: 0, item: generateItem(98, 25, 'weapon', 'ember-staff', 'legendary') };
const unique: GroundItem = { id: 2, x: 0, y: 0, item: generateUnique(99, 25, 'triune-carapace') };
const listener = { x: 0, y: 0 };

test('loaded loot has persistent light but no arrival; ordinary tiers emit arrival events but no persistent light', () => {
  const feedback = new LootDropPresentation();
  assert.equal(feedback.advance([legendary, unique], 20, listener), null);
  assert.equal(feedback.flare(1, 20), 0);
  assert.equal(lootBeaconLights([legendary, unique], 20, listener).length, 2);
  for (const tier of ['common', 'magic', 'rare', 'epic'] as const) {
    const drop = { ...legendary, item: { ...legendary.item, tier } };
    assert.equal(lootDropEvent(drop).tier, tier);
    assert.equal(lootBeaconLights([drop], 0, listener).length, 0);
  }
});
test('chest arrival waits for landing and fires once; pickup and reset cancel queued cues', () => {
  const feedback = new LootDropPresentation();
  const drop = { ...unique, flight: { x: 0, y: 0, at: 10, delay: .2 } };
  feedback.handle([lootDropEvent(drop)!]);
  assert.equal(feedback.advance([drop], 11, listener), null);
  assert.equal(lootBeaconLights([drop], 11, listener).length, 0);
  assert.equal(feedback.advance([drop], 11.26, listener), 'unique');
  assert.ok(feedback.flare(2, 11.26) > .95);
  assert.equal(feedback.advance([drop], 11.3, listener), null);
  feedback.handle([lootDropEvent(drop)!]);
  assert.equal(feedback.advance([], 11.3, listener), null);
  feedback.handle([lootDropEvent(drop)!]); feedback.reset();
  assert.equal(feedback.advance([drop], 11.3, listener), null);
});
test('treasure showers coalesce, allow a Unique upgrade, and bound light and sound distance', () => {
  const feedback = new LootDropPresentation();
  const drops = Array.from({ length: 100 }, (_, i) => ({ ...legendary, id: i + 10 }));
  feedback.handle(drops.map(drop => lootDropEvent(drop)!));
  assert.equal(feedback.advance(drops, .4, listener), null);
  assert.equal(feedback.advance(drops, 1, listener), 'legendary');
  feedback.handle([lootDropEvent(unique)!]);
  assert.equal(feedback.advance([...drops, unique], 1.1, listener), null);
  assert.equal(feedback.advance([...drops, unique], 1.62, listener), 'unique');
  feedback.handle([lootDropEvent(legendary)!]);
  assert.equal(feedback.advance([legendary], 1.63, listener), null);
  assert.equal(feedback.advance([legendary], 2.13, listener), null, 'no delayed audio backlog');
  assert.equal(lootBeaconLights(drops, 1, listener).length, 3);
  feedback.reset(); feedback.handle([lootDropEvent(unique)!]);
  assert.equal(feedback.advance([unique], 2, { x: 2000, y: 0 }), null);
  assert.equal(lootBeaconLights([unique], 2, { x: 2000, y: 0 }).length, 0);
});
test('Legendary and Unique audio are distinct and respect disabled SFX', () => {
  const audio = new GameAudio(), tones: number[][] = [];
  const internal = audio as unknown as { ctx: { currentTime: number; state: string }; tone(...args: number[]): void; hiss(): void };
  internal.ctx = { currentTime: 1, state: 'running' };
  internal.tone = (...args) => { tones.push(args); }; internal.hiss = () => {};
  audio.lootDrop('legendary'); const first = tones[0][0]; assert.equal(tones.length, 7);
  tones.length = 0; audio.lootDrop('unique'); assert.equal(tones.length, 9); assert.notEqual(tones[0][0], first);
  assert.ok(tones.every(t => t[4] === 3));
  tones.length = 0; audio.enabled = false; audio.lootDrop('unique'); assert.equal(tones.length, 0);
});

test('committed event rewards announce only new loot; restoring and recommitting never replay it', async () => {
  const { Simulation } = await import('../src/simulation.ts');
  const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: () => true };
  const sim = new Simulation(world, { spawn: false });
  sim.groundItems = [legendary];
  const checkpoint = sim.captureCheckpoint(); checkpoint.groundItems.push(unique);
  sim.commitEventCheckpoint(checkpoint, 0, 0);
  assert.deepEqual(sim.drainEvents().filter(e => e.type === 'item-drop').map(e => e.dropId), [unique.id]);
  sim.commitEventCheckpoint(checkpoint, 0, 0);
  assert.equal(sim.drainEvents().filter(e => e.type === 'item-drop').length, 0);
  sim.restoreCheckpoint(checkpoint);
  assert.equal(sim.drainEvents().filter(e => e.type === 'item-drop').length, 0);
});


test('monster drops hop, bounce and land once without changing loot or blocking early pickup', () => {
  const feedback = new LootDropPresentation();
  const drop = {...legendary, item:generateItem(7,25,'weapon','longsword','common')};
  const original = structuredClone(drop);
  feedback.handle([lootDropEvent(drop)]);
  assert.equal(feedback.advance([drop],10,listener),null);
  assert.ok(feedback.pose(drop.id,10.2).height>20);
  assert.equal(feedback.pose(drop.id,10.2).landed,false);
  assert.equal(feedback.flare(drop.id,10.2),0);
  assert.equal(feedback.pose(drop.id,10.2,true).height,0);
  feedback.handle([lootDropEvent(drop)]); // duplicate must not restart the hop
  assert.equal(feedback.advance([drop],10.49,listener),'metal');
  assert.equal(feedback.advance([drop],10.5,listener),null);
  assert.ok(feedback.pose(drop.id,10.55).height>0);
  assert.equal(feedback.pose(drop.id,10.7).height,0);
  assert.deepEqual(drop,original);
  feedback.reset();feedback.handle([lootDropEvent(drop)]);feedback.advance([drop],20,listener);
  assert.equal(feedback.advance([],20.5,listener),null);
  assert.equal(feedback.flare(drop.id,20.5),0);
});
test('an ordinary pile coalesces sound and a same-frame Unique takes priority', () => {
  const feedback = new LootDropPresentation();
  const plain = {...legendary,item:generateItem(8,25,'head',undefined,'common')};
  feedback.handle([lootDropEvent(plain),lootDropEvent(unique)]);
  feedback.advance([plain,unique],0,listener);
  assert.equal(lootBeaconLights([unique],.2,listener,feedback).length,0);
  assert.equal(feedback.advance([plain,unique],.6,listener),'unique');
  assert.equal(lootBeaconLights([unique],.6,listener,feedback).length,1);
  assert.equal(feedback.advance([plain,unique],2,listener),null);
});
test('material landing voices distinguish blades, bows, robes and charms', () => {
  assert.equal(lootLandingMaterial(generateItem(5,25,'weapon','longsword')),'metal');
  assert.equal(lootLandingMaterial(generateItem(5,25,'weapon','crescent-recurve')),'wood');
  assert.equal(lootLandingMaterial(generateItem(5,25,'charm')),'charm');
  const armor=generateItem(5,25,'chest');
  armor.appearance.style='plate';assert.equal(lootLandingMaterial(armor),'armor');
  armor.appearance.style='cloth';assert.equal(lootLandingMaterial(armor),'cloth');
});


test('a dense ordinary shower cannot evict a pending precious landing', () => {
  const feedback=new LootDropPresentation();
  const ordinary=generateItem(8,25,'boots',undefined,'common');
  const drops=[unique,...Array.from({length:100},(_,i)=>({id:400+i,x:0,y:0,item:ordinary}))];
  feedback.handle(drops.map(lootDropEvent));feedback.advance(drops,0,listener);
  assert.equal(feedback.advance(drops,.6,listener),'unique');
});
