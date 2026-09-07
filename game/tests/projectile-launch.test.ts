import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { weaponReleaseTip, projectilePresentation, PROJECTILE_LAUNCH_BLEND } from '../src/projectile-launch.ts';
import { projectileLight } from '../src/projectile-art.ts';
import { PROJECTILE_HEIGHT } from '../src/ranged-aim.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const input = { moveX: 0, moveY: 0, aimX: 500, aimY: 0, attack: true, dodge: false, heal: false, skillSlot: null };
function release(profile: string) {
  const sim = new Simulation(world, { spawn: false });
  sim.player.character.equipped.weapon = generateItem(71, 1, 'weapon', profile, 'common'); sim.player.character.equipped.offhand = null;
  refreshCharacter(sim.player);
  for (let i = 0; i < 200 && !sim.projectiles.length; i++) sim.update(FIXED_STEP, input);
  assert.equal(sim.projectiles.length, 1);
  return sim;
}
test('staff/wand basics snapshot a tip launch once; arrows retain their established flight', () => {
  for (const profile of ['ember-staff', 'rime-staff', 'storm-staff', 'cinder-wand', 'hoarfrost-wand', 'spark-wand', 'star-wand']) {
    const sim = release(profile), shot = sim.projectiles[0]; assert.ok(shot.launch);
    assert.equal(shot.launch.weapon.kind, sim.player.equipment.mainHand.family);
    const event = sim.drainEvents().find(e => e.type === 'cast'); assert.ok(event?.type === 'cast'); assert.deepEqual(event.launch, shot.launch);
    const snapshot = structuredClone(shot.launch);
    sim.player.angle = Math.PI; sim.player.character.equipped.weapon = generateItem(8, 1, 'weapon', 'longsword', 'common'); refreshCharacter(sim.player);
    assert.deepEqual(shot.launch, snapshot);
  }
  assert.equal(release('thorn-shortbow').projectiles[0].launch, undefined);
});
test('bolt art and light start at the tip, converge continuously and cannot mutate combat coordinates', () => {
  const sim = release('ember-staff'), shot = sim.projectiles[0];
  shot.x = shot.prevX = 0; shot.y = shot.prevY = 0; shot.life = shot.maxLife;
  const before = structuredClone(shot), tip = weaponReleaseTip(shot.launch!);
  assert.deepEqual(projectilePresentation(shot), tip);
  assert.deepEqual({ x: projectileLight(shot).x, y: projectileLight(shot).y }, tip);
  assert.deepEqual(shot, before);
  for (const age of [0, .02, .08, .15, PROJECTILE_LAUNCH_BLEND - 1e-7, PROJECTILE_LAUNCH_BLEND, .4]) {
    shot.life = shot.maxLife - age; shot.x = shot.prevX = age * shot.vx;
    const p = projectilePresentation(shot), l = projectileLight(shot);
    assert.equal(p.x, l.x); assert.equal(p.y, l.y); assert.ok(Number.isFinite(p.x + p.y));
    if (age >= PROJECTILE_LAUNCH_BLEND) assert.deepEqual(p, { x: shot.x, y: -PROJECTILE_HEIGHT });
  }
});
