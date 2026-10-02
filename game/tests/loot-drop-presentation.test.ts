import test from 'node:test';
import assert from 'node:assert/strict';
import { LootDropPresentation, lootBeaconLights, lootDropEvent } from '../src/loot-drop-presentation.ts';
import { generateItem, generateUnique } from '../src/items.ts';
import type { GroundItem } from '../src/character-types.ts';
import { GameAudio } from '../src/audio.ts';
const legendary: GroundItem = { id: 1, x: 0, y: 0, item: generateItem(98, 25, 'weapon', 'ember-staff', 'legendary') };
const unique: GroundItem = { id: 2, x: 0, y: 0, item: generateUnique(99, 25, 'triune-carapace') };
const listener = { x: 0, y: 0 };

test('loaded loot has persistent light but no arrival; ordinary tiers have neither cue nor emitter', () => {
  const feedback = new LootDropPresentation();
  assert.equal(feedback.advance([legendary, unique], 20, listener), null);
  assert.equal(feedback.flare(1, 20), 0);
  assert.equal(lootBeaconLights([legendary, unique], 20, listener).length, 2);
  for (const tier of ['common', 'magic', 'rare', 'epic'] as const) {
    const drop = { ...legendary, item: { ...legendary.item, tier } };
    assert.equal(lootDropEvent(drop), null);
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
  assert.equal(feedback.advance(drops, 1, listener), 'legendary');
  feedback.handle([lootDropEvent(unique)!]);
  assert.equal(feedback.advance([...drops, unique], 1.1, listener), 'unique');
  feedback.handle([lootDropEvent(legendary)!]);
  assert.equal(feedback.advance([legendary], 1.2, listener), null);
  assert.equal(feedback.advance([legendary], 2, listener), null, 'no delayed audio backlog');
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
