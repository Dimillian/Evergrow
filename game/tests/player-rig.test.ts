import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerArmRig, type CharacterPose } from '../src/art.ts';
import { projectArmPoint, type ArmRig, type RigPoint } from '../src/player-arm-rig.ts';
import { createStartingEquipment, getGripLength, getSupportGripOffset, getWeaponGrip, STARTING_SWORD } from '../src/equipment.ts';
import { playerPose } from '../src/character-pose.ts';
import { Simulation } from '../src/simulation.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { playerMotion } from '../src/character-motion.ts';
import { bowStringOffset } from '../src/weapon-shapes.ts';

const TAU = Math.PI * 2;
const rest: CharacterPose = {
  kind: 'player', angle: -Math.PI / 2, attackAngle: -Math.PI / 2,
  time: 0, gaitPhase: 0, moving: 0, attack: 0, cast: 0,
  attackStart: .19, attackEnd: .45, attackArc: Math.PI * .75,
  hitFlash: 0, dodging: false,
};
const actions: Partial<CharacterPose>[] = [
  {}, ...[.04, .18, .19, .26, .32, .44, .45, .7, .999].map(attack => ({ attack })),
  ...[.25, .5, .75, 1].map(cast => ({ cast })),
];
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, index) => value - b[index]));
const near = (actual: number, expected: number, message: string, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, received ${actual}`);

function validateArm(arm: ArmRig, description: string): void {
  for (const joint of [arm.shoulder, arm.elbow, arm.hand]) {
    assert.ok(joint.every(Number.isFinite), `${description}: every joint is finite`);
  }
  near(distance(arm.shoulder, arm.elbow), arm.upperLength, `${description}: upper-arm length`);
  near(distance(arm.elbow, arm.hand), arm.forearmLength, `${description}: forearm length`);
  assert.ok(arm.upperLength >= 9.1 && arm.forearmLength >= 10.8, `${description}: facing never shrinks bones`);
  near(arm.upperLength / arm.forearmLength, 9.1 / 10.8, `${description}: long reaches preserve limb proportions`);
}

function assertContinuous(a: ReturnType<typeof getPlayerArmRig>, b: ReturnType<typeof getPlayerArmRig>, description: string): void {
  for (const hand of ['weapon', 'offhand'] as const) {
    for (const joint of ['shoulder', 'elbow', 'hand'] as const) {
      assert.ok(distance(a[hand][joint], b[hand][joint]) < .001, `${description}: ${hand} ${joint} does not jump`);
    }
  }
}

test('player arm bones remain connected at every facing through movement, attacks and casting', () => {
  for (let facing = 0; facing < 72; facing++) {
    const angle = facing / 72 * TAU;
    for (const action of actions) for (const phase of [0, 1.3, 4.1]) for (const aimOffset of [-.8, 0, .8]) for (const grip of ['two-handed', 'one-handed'] as const) {
      const pose: CharacterPose = { ...rest, ...action, angle, attackAngle: angle + aimOffset,
        moving: phase === 0 ? 0 : 1, moveAngle: angle - 1.1, gaitPhase: phase, time: 3.7, grip };
      const rig = getPlayerArmRig(pose);
      const description = `facing ${facing}, action ${JSON.stringify(action)}, phase ${phase}, aim ${aimOffset}`;
      validateArm(rig.weapon, `weapon ${description}`);
      validateArm(rig.offhand, `offhand ${description}`);
    }
  }
});

test('both shoulder mounts rotate on one anatomical axis without collapsing at side views', () => {
  for (let facing = 0; facing < 64; facing++) {
    const angle = facing / 64 * TAU;
    for (const attack of [0, .19, .32, .7]) {
      const rig = getPlayerArmRig({ ...rest, angle, attackAngle: angle, attack, moving: 1, gaitPhase: 1.1 });
      const right = rig.weapon.shoulder, left = rig.offhand.shoulder;
      near(right[0] + left[0], 0, 'shoulder horizontal midpoint stays on torso');
      near(right[1] + left[1], 0, 'shoulder depth midpoint stays on torso');
      near(right[2] + left[2], 52, 'gait offsets remain balanced around the same shoulder height');
      near(Math.hypot(right[0] - left[0], right[1] - left[1]), 13, 'anatomical shoulder span survives side-facing foreshortening');
    }
  }
  const side = getPlayerArmRig({ ...rest, angle: 0, attackAngle: 0 });
  assert.ok(side.weapon.shoulder[1] > 0 && side.offhand.shoulder[1] < 0, 'side views distinguish near and far shoulders by depth');
});

test('a single weapon keeps both hands attached to its grip throughout facing, gait and attacks', () => {
  for (let facing = 0; facing < 48; facing++) for (const phase of [0, 1.3, 4.1]) {
    const angle = facing / 48 * TAU;
    for (const attack of [0, .04, .19, .27, .32, .45, .7, .999]) for (const gripLength of [8, 12, 20]) {
      const weapon = { ...STARTING_SWORD.visual, gripLength };
      const rig = getPlayerArmRig({ ...rest, angle, attackAngle: angle - .2, attack, weapon,
        gaitPhase: phase, moving: phase === 0 ? 0 : 1, time: 2.7 });
      const lead = projectArmPoint(rig.weapon.hand), support = projectArmPoint(rig.offhand.hand);
      const dx = support[0] - lead[0], dy = support[1] - lead[1];
      const along = dx * Math.cos(rig.weaponAngle) + dy * Math.sin(rig.weaponAngle);
      const across = dx * -Math.sin(rig.weaponAngle) + dy * Math.cos(rig.weaponAngle);
      near(across, 0, 'both gauntlets sit on the visible sword axis');
      near(along, getSupportGripOffset(weapon), 'support hand uses the weapon attachment offset');
      assert.ok(along < -4 && along > -getGripLength(weapon) + 1,
        'support hand stays behind the lead hand and ahead of the pommel');
    }
  }
});

test('authored weapon handedness selects the appropriate stance with or without off-hand equipment', () => {
  const equipment = createStartingEquipment();
  assert.equal(getWeaponGrip(equipment), 'two-handed');
  const weapon = WEAPON_PROFILES.find(profile => profile.family === 'sword' && profile.hands === 1)!;
  equipment.mainHand = weapon;
  assert.equal(getWeaponGrip(equipment), 'one-handed');
  equipment.offHand = { kind: 'shield', shield: SHIELD_PROFILES[0] };
  assert.equal(getWeaponGrip(equipment), 'one-handed');
  equipment.offHand = { kind: 'weapon', weapon: WEAPON_PROFILES.find(profile => profile.family === 'dagger')! };
  assert.equal(getWeaponGrip(equipment), 'one-handed');
  assert.equal(equipment.mainHand, weapon);
  equipment.offHand = null;
  assert.equal(getWeaponGrip(equipment), 'one-handed', 'an empty off-hand keeps a raised free-hand guard');
});

test('bows attach their support hand to the exact drawn string and staves keep both hands on their shafts', () => {
  for (const weapon of WEAPON_PROFILES.filter(profile => profile.family === 'bow' || profile.family === 'staff')) {
    for (let facing = 0; facing < 16; facing++) for (const attack of [0, .05, .19, .25, .45, .8]) for (const cast of [0, .7]) {
      const angle = facing / 16 * TAU;
      const pose: CharacterPose = { ...rest, angle, attackAngle: angle, weapon: weapon.visual,
        grip: 'two-handed', attackKind: 'ranged', attack, cast, moving: .7, gaitPhase: 1.4 };
      const motion = playerMotion(pose), rig = getPlayerArmRig(pose);
      validateArm(rig.weapon, weapon.name); validateArm(rig.offhand, weapon.name);
      const lead = projectArmPoint(rig.weapon.hand), support = projectArmPoint(rig.offhand.hand);
      const dx = support[0] - lead[0], dy = support[1] - lead[1];
      near(-dx * Math.sin(rig.weaponAngle) + dy * Math.cos(rig.weaponAngle), 0, 'support hand stays on string/shaft axis');
      near(dx * Math.cos(rig.weaponAngle) + dy * Math.sin(rig.weaponAngle),
        weapon.family === 'bow' ? bowStringOffset(motion.rangedDraw) : getSupportGripOffset(weapon.visual), 'hand matches the actual equipment attachment');
    }
  }
});

test('a dual-wield off-hand attack animates the matching arm without exchanging anatomical shoulder mounts', () => {
  const weapon = WEAPON_PROFILES.find(profile => profile.family === 'sword' && profile.hands === 1)!;
  const dagger = WEAPON_PROFILES.find(profile => profile.family === 'dagger')!;
  for (let facing = 0; facing < 16; facing++) {
    const angle = facing / 16 * TAU;
    const pose: CharacterPose = { ...rest, angle, attackAngle: angle, weapon: weapon.visual, grip: 'one-handed',
      offHand: { kind: 'weapon', visual: dagger.visual }, attackKind: 'melee', attackHand: 'off' };
    const idle = getPlayerArmRig(pose), attacking = getPlayerArmRig({ ...pose, attack: .32 });
    validateArm(attacking.weapon, 'main-hand guard'); validateArm(attacking.offhand, 'off-hand attack');
    assert.ok(distance(idle.offhand.hand, attacking.offhand.hand) > 4, 'the dagger hand performs the strike');
    near(attacking.weapon.shoulder[0] + attacking.offhand.shoulder[0], 0, 'weapons never swap shoulder identities');
    assert.ok(attacking.weapon.hand[2] >= 14, 'the resting main hand remains in its armed guard');
  }
});

test('casting releases the support hand and returns continuously to the same grip', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const player = sim.player;
  player.angle = player.castAngle = -.8;
  const restingPose = playerPose(player, 3.5);
  const restingRig = getPlayerArmRig(restingPose);
  player.castTime = .22;
  assertContinuous(restingRig, getPlayerArmRig(playerPose(player, 3.5)), 'cast begins on the grip');
  player.castTime = .22 * .55;
  const releasedPose = playerPose(player, 3.5);
  assert.ok((releasedPose.cast ?? 0) > .95, 'the middle of the cast clearly releases the support hand');
  const released = getPlayerArmRig(releasedPose);
  assert.ok(distance(projectArmPoint(released.offhand.hand), projectArmPoint(restingRig.offhand.hand)) > 4,
    'casting produces a distinct support-hand gesture');
  player.castTime = 1e-7;
  const returning = getPlayerArmRig(playerPose(player, 3.5));
  player.castTime = 0;
  const finishedPose = playerPose(player, 3.5);
  assert.equal(finishedPose.cast, 0);
  assertContinuous(returning, getPlayerArmRig(finishedPose), 'cast release completes without a regrip snap');
  assertContinuous(restingRig, getPlayerArmRig(finishedPose), 'support hand returns to its original grip');
});

test('arms remain continuous at east/west facings and across the angle wrap', () => {
  const epsilon = 1e-6;
  for (const action of actions) for (const aimOffset of [-.8, 0, .8]) {
    for (const boundary of [0, Math.PI]) {
      const pose = { ...rest, ...action, moving: .8, gaitPhase: 1.7 };
      const before = getPlayerArmRig({ ...pose, angle: boundary - epsilon, attackAngle: boundary - epsilon + aimOffset });
      const after = getPlayerArmRig({ ...pose, angle: boundary + epsilon, attackAngle: boundary + epsilon + aimOffset });
      assertContinuous(before, after, `side-facing ${boundary}, ${JSON.stringify(action)}`);
    }
    const before = getPlayerArmRig({ ...rest, ...action, angle: Math.PI - epsilon, attackAngle: Math.PI - epsilon + aimOffset });
    const after = getPlayerArmRig({ ...rest, ...action, angle: -Math.PI + epsilon, attackAngle: -Math.PI + epsilon + aimOffset });
    assertContinuous(before, after, `wrapped angle, ${JSON.stringify(action)}`);
  }
});

test('arm joints remain continuous through gait wrap and attack phase boundaries', () => {
  const epsilon = 1e-6;
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const action of actions) {
      const pose = { ...rest, ...action, angle, attackAngle: angle, moving: 1, moveAngle: angle + .7 };
      assertContinuous(getPlayerArmRig({ ...pose, gaitPhase: TAU - epsilon }),
        getPlayerArmRig({ ...pose, gaitPhase: epsilon }), 'wrapped gait');
    }
    for (const boundary of [0, .19, .45, 1]) {
      const pose = { ...rest, angle, attackAngle: angle, moving: .7, gaitPhase: 1.7 };
      assertContinuous(getPlayerArmRig({ ...pose, attack: Math.max(0, boundary - epsilon) }),
        getPlayerArmRig({ ...pose, attack: boundary === 1 ? 0 : boundary + epsilon }), `attack phase ${boundary}`);
    }
  }
});

test('arm projection preserves depth ordering independently of height', () => {
  const origin: RigPoint = [3, 0, 20], nearHand: RigPoint = [3, 6, 20], raisedHand: RigPoint = [3, 6, 24];
  assert.ok(projectArmPoint(nearHand)[1] > projectArmPoint(origin)[1], 'nearer ground depth projects lower');
  assert.ok(projectArmPoint(raisedHand)[1] < projectArmPoint(nearHand)[1], 'raising a hand projects higher without changing its depth');
  near(nearHand[1], raisedHand[1], 'height changes cannot silently switch the anatomical depth');
});


test('dual-wield hand attachments stay continuous at the start and end of every attack phase', () => {
  const weapon = WEAPON_PROFILES.find(profile => profile.family === 'sword' && profile.hands === 1)!;
  const dagger = WEAPON_PROFILES.find(profile => profile.family === 'dagger')!;
  const epsilon = 1e-6;
  for (let facing = 0; facing < 8; facing++) for (const boundary of [0, .19, .45, 1]) {
    const angle = facing / 8 * TAU;
    const pose: CharacterPose = { ...rest, angle, attackAngle: angle, weapon: weapon.visual, grip: 'one-handed',
      moving: .8, gaitPhase: 1.7, offHand: { kind: 'weapon', visual: dagger.visual }, attackKind: 'melee', attackHand: 'off' };
    const before = { ...pose, attack: Math.max(0, boundary - epsilon) };
    const after = { ...pose, attack: boundary === 1 ? 0 : boundary + epsilon };
    assertContinuous(getPlayerArmRig(before), getPlayerArmRig(after), `off-hand boundary ${boundary}`);
    const a = playerMotion(before), b = playerMotion(after);
    assert.ok(Math.abs(a.offWeaponAngle - b.offWeaponAngle) < .001, 'off-hand weapon returns smoothly to its own guard angle');
  }
});
