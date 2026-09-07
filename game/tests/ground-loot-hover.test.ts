import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { groundLootIsSafe, hoveredGroundLoot } from '../src/ground-loot-hover.ts';
const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const view = { x: -300, y: -200, width: 600, height: 400 };
const drop = { id: 1, x: 100, y: 0, item: generateItem(123, 1, 'ring') };

test('ground inspection closes for nearby, visible or incoming threats and reopens after combat', () => {
  const sim = new Simulation(world, { spawn: false });
  const safe = () => groundLootIsSafe(sim.player, drop, sim.enemies, sim.projectiles, view);
  assert.ok(safe());
  const enemy = sim.spawnEnemy('stalker', 350, 0)!;
  assert.equal(safe(), false, 'nearby enemies just offscreen still block inspection');
  enemy.x = 2000; assert.ok(safe(), 'unrelated distant camps do not block inspection');
  enemy.x = 50; enemy.state = 'dead'; enemy.hp = 0; assert.ok(safe(), 'corpses are safe');
  sim.projectiles.push({ id: 20, owner: 'enemy', sourceLevel: 1, x: 150, y: 0, prevX: 150, prevY: 0,
    vx: -100, vy: 0, angle: Math.PI, radius: 3, damage: 1, life: 1, maxLife: 1, hitIds: new Set() });
  assert.equal(safe(), false, 'a dead caster can leave a dangerous projectile');
  sim.projectiles.length = 0;
  sim.player.castTime = .3; assert.equal(safe(), false);
  sim.player.castTime = 0; sim.player.hitFlash = .1; assert.equal(safe(), false);
  sim.player.hitFlash = 0; assert.ok(safe());
});

test('loot hit testing follows the packed label before nearby silhouettes', () => {
  const labels = [
    { id: 1, x: 10, y: 20, width: 80, height: 19, anchorX: 50, anchorY: 60 },
    { id: 2, x: 100, y: 20, width: 80, height: 19, anchorX: 110, anchorY: 30 },
  ];
  assert.equal(hoveredGroundLoot(labels, 110, 25)?.id, 2);
  assert.equal(hoveredGroundLoot(labels, 50, 60)?.id, 1);
  assert.equal(hoveredGroundLoot(labels, 250, 90), undefined);
});
