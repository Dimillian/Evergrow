import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { weaponReleasePoint, projectilePresentation, PROJECTILE_LAUNCH_BLEND } from '../src/projectile-launch.ts';
import { projectileLight } from '../src/projectile-art.ts';
import { PROJECTILE_HEIGHT } from '../src/ranged-aim.ts';
import { playerPose } from '../src/character-pose.ts';
import { playerMotion, characterTransform, PLAYER_ART_SCALE } from '../src/character-motion.ts';
import { transformPoint } from '../src/art-primitives.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const input = { moveX: 0, moveY: 0, aimX: 500, aimY: 0, attack: true, dodge: false, heal: false, skillSlot: null };
function release(profile: string, angle = 0, moving = false) {
  const sim = new Simulation(world, { spawn: false });
  sim.player.character.equipped.weapon = generateItem(71, 1, 'weapon', profile, 'common'); sim.player.character.equipped.offhand = null;
  refreshCharacter(sim.player);
  for (let i = 0; i < 200 && !sim.projectiles.length; i++) sim.update(FIXED_STEP, { ...input,
    aimX: sim.player.x + Math.cos(angle) * 500, aimY: sim.player.y + Math.sin(angle) * 500,
    moveX: moving ? .6 : 0, moveY: moving ? .8 : 0 });
  assert.equal(sim.projectiles.length, 1);
  return sim;
}
test('ranged basics snapshot their emitting weapon once, independently of later movement and equipment', () => {
  for (const profile of ['ember-staff', 'rime-staff', 'storm-staff', 'cinder-wand', 'hoarfrost-wand', 'spark-wand', 'star-wand', 'thorn-shortbow', 'crescent-recurve', 'warden-longbow']) {
    const sim = release(profile), shot = sim.projectiles[0]; assert.ok(shot.launch);
    assert.equal(shot.launch.weapon.kind, sim.player.equipment.mainHand.family);
    const event = sim.drainEvents().find(e => e.type === 'cast'); assert.ok(event?.type === 'cast'); assert.deepEqual(event.launch, shot.launch);
    const snapshot = structuredClone(shot.launch);
    sim.player.angle = Math.PI; sim.player.character.equipped.weapon = generateItem(8, 1, 'weapon', 'longsword', 'common'); refreshCharacter(sim.player);
    assert.deepEqual(shot.launch, snapshot);
  }
});

test('arrows and their light leave the rendered bow center in every facing, standing or walking', () => {
  for (const profile of ['thorn-shortbow', 'crescent-recurve', 'warden-longbow']) {
    for (const moving of [false, true]) for (const angle of [0, .7, Math.PI / 2, Math.PI - .001, -Math.PI + .001, -Math.PI / 2]) {
      const sim = release(profile, angle, moving), shot = sim.projectiles[0], attack = sim.player.attack!;
      // Movement advances after firing within this tick; inspect the rig at
      // the captured release gait, before that final movement step.
      const launch = shot.launch!;
      const pose = { ...playerPose(sim.player, sim.time, attack, attack.activeStart),
        gaitPhase: launch.gaitPhase, moving: launch.moving, moveAngle: launch.moveAngle };
      const motion = playerMotion(pose);
      const bodyGrip = transformPoint(motion.body, motion.weaponOrigin);
      const grip = transformPoint(characterTransform(pose), [bodyGrip[0] * PLAYER_ART_SCALE, bodyGrip[1] * PLAYER_ART_SCALE]);
      const point = weaponReleasePoint(shot.launch!);
      assert.ok(Math.hypot(point.x - grip[0], point.y - grip[1]) < .001, 'release matches the actual drawn grip');
      shot.x = shot.prevX = 120; shot.y = shot.prevY = 75; shot.life = shot.maxLife;
      const before = structuredClone(shot), visible = projectilePresentation(shot), light = projectileLight(shot);
      assert.deepEqual(visible, { x: 120 + point.x, y: 75 + point.y });
      assert.equal(light.x, visible.x); assert.equal(light.y, visible.y);
      assert.deepEqual(shot, before, 'visual attachment never changes collision coordinates');
    }
  }
});
test('bolt art and light start at the tip, converge continuously and cannot mutate combat coordinates', () => {
  const sim = release('ember-staff'), shot = sim.projectiles[0];
  shot.x = shot.prevX = 0; shot.y = shot.prevY = 0; shot.life = shot.maxLife;
  const before = structuredClone(shot), tip = weaponReleasePoint(shot.launch!);
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
