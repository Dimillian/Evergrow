import test from 'node:test';
import assert from 'node:assert/strict';
import { PendingItemInspections } from '../src/item-inspection.ts';
import { Simulation } from '../src/simulation.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { executeDropItem } from '../src/drop-item-command.ts';
import { generateItem } from '../src/items.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
function setup() {
  const sim = new Simulation(world, { spawn: false });
  const dropped = { ...generateItem(1981, 1, 'ring'), newPickup: true as const };
  const inspected = { ...generateItem(1982, 1, 'ring'), newPickup: true as const };
  addInventoryItem(sim.player.character, dropped); addInventoryItem(sim.player.character, inspected);
  return { sim, dropped, inspected, queue: new PendingItemInspections() };
}

for (const outcome of ['saved', 'failed', 'thrown'] as const) {
  test(`inspection waits for a ${outcome} durable drop and acknowledges the current sheet`, async () => {
    const { sim, dropped, inspected, queue } = setup();
    const originalSheet = sim.player.character;
    const recent = [...originalSheet.recentItems!];
    let release!: () => void;
    let written!: CharacterCheckpoint;
    const pending = executeDropItem(sim, { type: 'bag', index: 0, id: dropped.id }, async checkpoint => {
      written = checkpoint;
      await new Promise<void>(resolve => { release = resolve; });
      if (outcome === 'thrown') throw new Error('Disk unavailable');
      return { ok: outcome === 'saved' };
    });
    // Both pointer and touch inspection use the same queued character command.
    queue.request(sim.player, 'character-a', inspected.id);
    queue.request(sim.player, 'character-a', inspected.id);
    queue.request(sim.player, 'character-a', dropped.id);
    assert.equal(inspected.newPickup, true);
    assert.equal(written.character.inventory.find(item => item?.id === inspected.id)?.newPickup, true);
    assert.equal(sim.groundItems.length, 0);
    release();
    assert.equal((await pending).ok, outcome === 'saved');
    if (outcome === 'saved') assert.notEqual(sim.player.character, originalSheet);
    else assert.equal(sim.player.character, originalSheet);
    // A changed position must not redirect inspection to the old cell's occupant.
    executeCharacterCommand(sim.player, { type: 'sortInventory', mode: 'recent' });
    assert.equal(queue.flush(sim.player, 'character-a'), true);
    assert.equal(sim.player.character.inventory.find(item => item?.id === inspected.id)?.newPickup, undefined);
    assert.deepEqual(sim.player.character.recentItems, outcome === 'saved' ? recent.filter(id => id !== dropped.id) : recent);
    if (outcome === 'saved') assert.equal(sim.groundItems[0].item.newPickup, true);
    else assert.equal(sim.player.character.inventory.find(item => item?.id === dropped.id)?.newPickup, undefined);
    assert.equal(sim.captureCheckpoint().character.inventory.find(item => item?.id === inspected.id)?.newPickup, undefined);
    assert.equal(queue.flush(sim.player, 'character-a'), false, 'Repeated refreshes need no further acknowledgment save');
  });
}

test('queued inspections cannot cross a character or player-session change', () => {
  for (const change of ['character', 'player', 'inactive'] as const) {
    const { sim, inspected, queue } = setup();
    queue.request(sim.player, 'character-a', inspected.id);
    const other = setup(); // Intentionally the same item IDs in another player session.
    const player = change === 'player' ? other.sim.player : sim.player;
    assert.equal(queue.flush(player, change === 'inactive' ? null : change === 'character' ? 'character-b' : 'character-a'), false);
    assert.equal(player.character.inventory.find(item => item?.id === inspected.id)?.newPickup, true);
    assert.equal(queue.flush(sim.player, 'character-a'), false, 'Stale requests are discarded');
  }
});

test('a removed item cannot acknowledge the replacement occupying its old cell', () => {
  const { sim, inspected, queue } = setup();
  queue.request(sim.player, 'character-a', inspected.id);
  const replacement = { ...generateItem(1983, 1, 'ring'), newPickup: true as const };
  sim.player.character.inventory[1] = replacement;
  assert.equal(queue.flush(sim.player, 'character-a'), false);
  assert.equal(replacement.newPickup, true);
});

test('invalid, already inspected and cleared requests do not change the sheet', () => {
  const { sim, inspected, queue } = setup();
  queue.request(sim.player, 'character-a', inspected.id); queue.clear();
  assert.equal(queue.flush(sim.player, 'character-a'), false);
  executeCharacterCommand(sim.player, { type: 'inspectItem', id: inspected.id });
  const before = sim.captureCheckpoint();
  queue.request(sim.player, 'character-a', inspected.id); queue.request(sim.player, 'character-a', 'missing');
  assert.equal(queue.flush(sim.player, 'character-a'), false);
  assert.deepEqual(sim.captureCheckpoint(), before);
});
