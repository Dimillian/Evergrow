import test from 'node:test';
import assert from 'node:assert/strict';
import { characterBounds, fitCharacter } from '../src/character-framing.ts';
import { getSwingAngle, playerFootCycle, playerMotion } from '../src/character-motion.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { weaponShapes } from '../src/weapon-shapes.ts';
import { itemIconSVG } from '../src/item-art.ts';
import { generateItem } from '../src/items.ts';
import type { CharacterPose } from '../src/art-types.ts';
import { transformPoint } from '../src/art-primitives.ts';
import { projectArmPoint } from '../src/player-arm-rig.ts';

const pose: CharacterPose = { kind: 'player', angle: 1.15, attackAngle: 1.15, time: 0, moving: 0, attack: 0, hitFlash: 0, dodging: false };
test('one-handed sword palms stay on the lower middle of the hilt through both-hand attacks', () => {
  const weapon = WEAPON_PROFILES.find(w => w.id === 'longsword')!;
  for (let facing = 0; facing < 8; facing++) for (const attack of [0, .1, .19, .32, .45, .8, .999]) {
    for (const attackHand of ['main', 'off'] as const) {
      const angle = facing * Math.PI / 4;
      const motion = playerMotion({ ...pose, angle, attackAngle: angle, attack, attackHand,
        weapon: weapon.visual, grip: 'one-handed', offHand: { kind: 'weapon', visual: weapon.visual } });
      for (const [arm, origin, rotation] of [
        [motion.weaponArm, motion.weaponOrigin, motion.weaponAngle],
        [motion.offArm, motion.offWeaponOrigin, motion.offWeaponAngle],
      ] as const) {
        const palm = projectArmPoint(arm.hand), dx = palm[0] - origin[0], dy = palm[1] - origin[1];
        const along = dx * Math.cos(rotation) + dy * Math.sin(rotation);
        assert.ok(along < -weapon.visual.gripLength! * .5 && along > -weapon.visual.gripLength! * .7,
          'palm is below the midpoint and above the pommel');
        assert.ok(Math.abs(-dx * Math.sin(rotation) + dy * Math.cos(rotation)) < 1e-8,
          'palm remains centered on the shaft');
      }
    }
  }
});
test('sword guards raise the blade and leave the shield hand guarding independently', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.family === 'sword')) {
    for (let facing = 0; facing < 16; facing++) {
      const angle = facing * Math.PI / 8;
      const resting: CharacterPose = { ...pose, angle, attackAngle: angle, weapon: weapon.visual,
        grip: weapon.hands === 1 ? 'one-handed' : 'two-handed' };
      assert.ok(Math.sin(playerMotion(resting).weaponAngle) < -.78, 'resting blade points up at every facing');
      if (weapon.hands === 1) {
        const shield = playerMotion({ ...resting, offHand: { kind: 'shield', visual: SHIELD_PROFILES[1].visual } });
        assert.ok(shield.offArm.hand[0] * Math.cos(angle) + shield.offArm.hand[1] * Math.sin(angle) > 0,
          'shield remains held forward');
        assert.deepEqual(shield.weaponArm.hand, playerMotion(resting).weaponArm.hand, 'equipping a shield preserves the sword grip');
      }
      for (const attack of [.19, .25, .32, .4, .45]) {
        const motion = playerMotion({ ...resting, attack, attackArc: weapon.arc });
        assert.ok(Math.abs(motion.weaponAngle - getSwingAngle(angle, attack, .19, .45, weapon.arc)) < 1e-8,
          'raised guard does not alter the active blade/contact sweep');
      }
    }
  }
});
test('all weapon and off-hand silhouettes fit both tall and wide portraits with one scale', () => {
  for (const weapon of WEAPON_PROFILES) for (let facing = 0; facing < 8; facing++) for (const attack of [0, .19, .32, .7]) {
    const angle = facing * Math.PI / 4;
    const bounds = characterBounds({ ...pose, angle, attackAngle: angle, attack, weapon: weapon.visual,
      grip: weapon.hands === 2 ? 'two-handed' : 'one-handed',
      offHand: weapon.hands === 1 ? { kind: 'shield', visual: SHIELD_PROFILES[2].visual } : null });
    assert.ok(Object.values(bounds).every(Number.isFinite));
    for (const [width, height] of [[240, 720], [560, 720], [800, 300]]) {
      const fit = fitCharacter(bounds, width, height);
      assert.ok(fit.scale > 0);
      assert.ok(bounds.left * fit.scale + fit.x >= width * .08 - 1e-8);
      assert.ok(bounds.right * fit.scale + fit.x <= width * .92 + 1e-8);
      assert.ok(bounds.top * fit.scale + fit.y >= height * .08 - 1e-8);
      assert.ok(bounds.bottom * fit.scale + fit.y <= height * .92 + 1e-8);
    }
  }
});
test('resting staves and bow limbs stay upright in every facing', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.family === 'staff' || w.family === 'bow')) {
    for (let facing = 0; facing < 64; facing++) {
      const angle = facing * Math.PI / 32;
      const motion = playerMotion({ ...pose, angle, attackAngle: angle, weapon: weapon.visual });
      if (weapon.family === 'staff') assert.ok(Math.sin(motion.weaponAngle) < -.99);
      else assert.ok(Math.abs(Math.sin(motion.weaponAngle)) < .3);
    }
  }
});
test('walking-staff carry stays beside the body and regrips for casting', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.family === 'staff')) {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * .75, Math.PI]) {
      for (const action of [{}, { moving: 1, gaitPhase: 1.3 }, { attack: .19 }, { attack: .7 }, { cast: .5 }, { cast: 1 }]) {
        const motion = playerMotion({ ...pose, ...action, angle, attackAngle: angle, weapon: weapon.visual, grip: 'two-handed' });
        assert.equal(motion.weaponBehind, false, 'upward tips must not move the staff and forearms behind the chest');
        for (const arm of [motion.weaponArm, motion.offArm]) {
          const forward = arm.hand[0] * Math.cos(angle) + arm.hand[1] * Math.sin(angle);
          assert.ok(forward > 0, 'both hands are physically forward of the torso');
        }
      }
    }
    const front = playerMotion({ ...pose, angle: Math.PI / 2, weapon: weapon.visual, grip: 'two-handed' });
    assert.ok(front.weaponArm.hand[0] < -11, 'staff hand clears the shoulder and face');
    assert.ok(front.offArm.hand[2] < 12, 'free arm rests down beside the body');
    assert.equal(front.supportHolding, false, 'resting staff uses one visible hand');
    const bottom = Math.min(...weaponShapes(weapon.visual).flatMap(shape => shape.points.map(p => p[0])));
    const base = transformPoint(front.body, [front.weaponOrigin[0] + Math.cos(front.weaponAngle) * bottom,
      front.weaponOrigin[1] + Math.sin(front.weaponAngle) * bottom]);
    assert.ok(Math.abs(base[1]) < 4, 'upright staff base is close to the feet');
    const casting = playerMotion({ ...pose, angle: Math.PI / 2, weapon: weapon.visual, grip: 'two-handed', cast: 1 });
    assert.equal(casting.supportHolding, true, 'free hand joins the staff for casting');
    for (const phase of [0, .3, .55, 1]) {
      const before = playerMotion({ ...pose, weapon: weapon.visual, cast: Math.max(0, phase - 1e-6) });
      const after = playerMotion({ ...pose, weapon: weapon.visual, cast: Math.min(1, phase + 1e-6) });
      for (const arm of ['weaponArm', 'offArm'] as const) for (const joint of ['shoulder', 'elbow', 'hand'] as const) {
        assert.ok(Math.hypot(...before[arm][joint].map((v, i) => v - after[arm][joint][i])) < .002, 'casting transition is continuous');
      }
    }
    assert.equal(playerMotion({ ...pose, angle: -Math.PI / 2, weapon: weapon.visual }).weaponBehind, true,
      'rear view still lets the body occlude the forward-held staff');
  }
});
test('feet have a grounded stance, a lifted return and continuous cycle boundaries', () => {
  const tau = Math.PI * 2;
  for (const phase of [.1, .3, .5]) assert.equal(playerFootCycle(phase * tau).lift, 0);
  assert.ok(playerFootCycle(.8 * tau).lift > 3);
  for (const phase of [0, .58 * tau, tau]) {
    const before = playerFootCycle(phase - 1e-7), after = playerFootCycle(phase + 1e-7);
    assert.ok(Math.abs(before.travel - after.travel) < .00001);
    assert.ok(Math.abs(before.lift - after.lift) < .00001);
  }
});
test('inventory detail keeps every SVG reference local and all procedural coordinates finite', () => {
  for (const [index, weapon] of WEAPON_PROFILES.entries()) {
    for (const draw of [0, .5, 1]) for (const shape of weaponShapes(weapon.visual, draw)) {
      assert.ok(shape.points.every(p => p.every(Number.isFinite)));
    }
    const item = generateItem(831 + index, 8, 'weapon', weapon.id, 'rare');
    for (const size of [48, 120]) {
      const svg = itemIconSVG(item, size);
      const ids = new Set([...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
      for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(ref[1]), `missing ${ref[1]}`);
      assert.ok(!svg.includes('NaN') && !svg.includes('Infinity'));
    }
  }
});
