import test from 'node:test';
import assert from 'node:assert/strict';
import { characterBounds, fitCharacter } from '../src/character-framing.ts';
import { playerFootCycle, playerMotion } from '../src/character-motion.ts';
import { getActiveSwingOffset } from '../src/attack-motion.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { weaponShapes } from '../src/weapon-shapes.ts';
import { itemIconSVG } from '../src/item-art.ts';
import { generateItem } from '../src/items.ts';
import type { CharacterPose } from '../src/art-types.ts';
import { transformPoint } from '../src/art-primitives.ts';
import { projectArmPoint } from '../src/player-arm-rig.ts';

const pose: CharacterPose = { kind: 'player', angle: 1.15, attackAngle: 1.15, time: 0, moving: 0, attack: 0, hitFlash: 0, dodging: false };
test('one-handed sword and dagger palms stay on the lower middle of the hilt through both-hand attacks', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.hands === 1 && (w.family === 'sword' || w.family === 'dagger'))) {
  for (let facing = 0; facing < 8; facing++) for (const attack of [0, .1, .19, .32, .45, .8, .999]) {
    for (const attackHand of ['main', 'off'] as const) {
      const angle = facing * Math.PI / 4;
      const motion = playerMotion({ ...pose, angle, attackAngle: angle, attack, attackHand,
        weapon: weapon.visual, grip: 'one-handed', offHand: { kind: 'weapon', visual: weapon.visual } });
      for (const [arm, origin, rotation, scale] of [
        [motion.weaponArm, motion.weaponOrigin, motion.weaponAngle, motion.weaponScale],
        [motion.offArm, motion.offWeaponOrigin, motion.offWeaponAngle, motion.offWeaponScale],
      ] as const) {
        const palm = projectArmPoint(arm.hand), dx = palm[0] - origin[0], dy = palm[1] - origin[1];
        const along = (dx * Math.cos(rotation) + dy * Math.sin(rotation)) / scale;
        assert.ok(along < -weapon.visual.gripLength! * .5 && along > -weapon.visual.gripLength! * .7,
          'palm is below the midpoint and above the pommel');
        assert.ok(Math.abs(-dx * Math.sin(rotation) + dy * Math.cos(rotation)) < 1e-8,
          'palm remains centered on the shaft');
      }
    }
  }
  }
});
test('all melee guards stay raised during idle and travel and preserve active contact sweeps', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.attackKind === 'melee')) {
    for (let facing = 0; facing < 16; facing++) {
      const angle = facing * Math.PI / 8;
      const resting: CharacterPose = { ...pose, angle, attackAngle: angle, weapon: weapon.visual,
        grip: weapon.hands === 1 ? 'one-handed' : 'two-handed' };
      for (const moving of [0, 1]) {
        const guard = playerMotion({ ...resting, moving, time: .4,
          offHand: weapon.hands === 1 ? { kind: 'weapon', visual: weapon.visual } : null });
        assert.ok(Math.sin(guard.weaponAngle) < -.75, `${weapon.id}: main-hand guard points up`);
        if (weapon.hands === 1) assert.ok(Math.sin(guard.offWeaponAngle) < -.85, `${weapon.id}: off-hand guard points up`);
      }
      if (weapon.hands === 1) {
        const shield = playerMotion({ ...resting, offHand: { kind: 'shield', visual: SHIELD_PROFILES[1].visual } });
        assert.ok(shield.offArm.hand[0] * Math.cos(angle) + shield.offArm.hand[1] * Math.sin(angle) > 0,
          'shield remains held forward');
        assert.deepEqual(shield.weaponArm.hand, playerMotion(resting).weaponArm.hand, 'equipping a shield preserves the weapon grip');
      }
      for (const attack of [.19, .25, .32, .4, .45]) {
        const motion = playerMotion({ ...resting, attack, attackArc: weapon.arc });
        assert.ok(Math.abs(motion.activeWeaponYaw - angle - getActiveSwingOffset((attack - .19) / (.45 - .19), weapon.arc)) < 1e-8,
          'projected blade retains the shared contact yaw');
        if (weapon.hands === 1) {
          const off = playerMotion({ ...resting, attack, attackArc: weapon.arc, attackHand: 'off',
            offHand: { kind: 'weapon', visual: weapon.visual } });
          assert.ok(Math.abs(off.activeWeaponYaw - angle - getActiveSwingOffset((attack - .19) / (.45 - .19), weapon.arc, 'off')) < 1e-8);
        }
      }
    }
  }
});
test('front-facing melee attacks reverse into guard without a full wrist turn or orbiting hand', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.attackKind === 'melee' && w.hands === 1)) {
    for (const attackHand of ['main', 'off'] as const) for (const offset of [-.3, 0, .3]) {
      const angle = Math.PI / 2 + offset;
      const base: CharacterPose = { ...pose, angle, attackAngle: angle, weapon: weapon.visual,
        grip: 'one-handed', attackHand, attackArc: weapon.arc,
        offHand: { kind: 'weapon', visual: weapon.visual } };
      let previous = playerMotion(base), turn = 0;
      for (let frame = 1; frame <= 240; frame++) {
        const motion = playerMotion({ ...base, attack: frame === 240 ? 0 : frame / 240 });
        const rotation = attackHand === 'main' ? motion.weaponAngle : motion.offWeaponAngle;
        const before = attackHand === 'main' ? previous.weaponAngle : previous.offWeaponAngle;
        const delta = Math.atan2(Math.sin(rotation - before), Math.cos(rotation - before));
        assert.ok(Math.abs(delta) < .3, 'projected blade angle remains continuous through foreshortening');
        turn += delta;
        if (frame / 240 > .6 && frame / 240 < .8) assert.ok(delta * (attackHand === 'main' ? 1 : -1) >= -.00001, 'recovery reverses the slash');
        const arm = attackHand === 'main' ? motion.weaponArm : motion.offArm;
        assert.ok(Math.hypot(...arm.hand.map((v, i) => v - arm.shoulder[i])) < 23,
          'grip stays within the reach of the shoulder');
        previous = motion;
      }
      assert.ok(Math.abs(turn) < 1e-8, 'one complete attack has zero net wrist rotation');
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
test('upright staff remains supported by two hands at rest and while casting', () => {
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
    assert.ok(front.weaponArm.hand[0] < -8, 'staff hand clears the shoulder and face');
    assert.ok(front.offArm.hand[2] > 20, 'support arm reaches across to the shaft');
    assert.equal(front.supportHolding, true, 'resting staff uses both hands');
    const bottom = Math.min(...weaponShapes(weapon.visual).flatMap(shape => shape.points.map(p => p[0])));
    const base = transformPoint(front.body, [front.weaponOrigin[0] + Math.cos(front.weaponAngle) * bottom,
      front.weaponOrigin[1] + Math.sin(front.weaponAngle) * bottom]);
    assert.ok(Math.abs(base[1]) < 4, 'upright staff base is close to the feet');
    const casting = playerMotion({ ...pose, angle: Math.PI / 2, weapon: weapon.visual, grip: 'two-handed', cast: 1 });
    assert.equal(casting.supportHolding, true, 'both hands keep supporting the cast');
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

test('staff and wand basics keep an upright guard, small palm travel and continuous release recovery', () => {
  for (const weapon of WEAPON_PROFILES.filter(w => w.family === 'staff' || w.family === 'wand')) {
    for (let facing = 0; facing < 16; facing++) {
      const angle = facing * Math.PI / 8;
      const base: CharacterPose = { ...pose, angle, attackAngle: angle, weapon: weapon.visual,
        grip: weapon.hands === 2 ? 'two-handed' : 'one-handed', attackKind: 'ranged' };
      const rest = playerMotion(base);
      for (const attack of [.001, .12, .3, .42, .5, .6, .7, .85, .999]) {
        const motion = playerMotion({ ...base, attack });
        assert.ok(Math.abs(motion.weaponAngle - rest.weaponAngle) < .145, 'basic bolt never sweeps the weapon toward the target');
        assert.ok(Math.sin(motion.weaponAngle) < -.9, 'weapon remains upright through the whole cycle');
        const palmTravel = Math.hypot(...motion.weaponArm.hand.map((v, i) => v - rest.weaponArm.hand[i]));
        assert.ok(palmTravel < 1.8, 'only a small forward hand impulse');
        if (weapon.family === 'staff') assert.equal(motion.supportHolding, true);
        else assert.deepEqual(motion.offArm.hand, rest.offArm.hand, 'off-hand book, orb or shield stays steady');
      }
      assert.equal(playerMotion({ ...base, attack: .42 }).weaponCharge, 1, 'core glow peaks at projectile release');
      for (const boundary of [0, .42, .7, 1]) {
        const before = playerMotion({ ...base, attack: Math.max(0, boundary - 1e-7) });
        const after = playerMotion({ ...base, attack: boundary === 1 ? 0 : boundary + 1e-7 });
        assert.ok(Math.abs(before.weaponAngle - after.weaponAngle) < .00001);
        for (const arm of ['weaponArm', 'offArm'] as const) assert.ok(Math.hypot(...before[arm].hand.map((v, i) => v - after[arm].hand[i])) < .0001);
      }
    }
  }
});
