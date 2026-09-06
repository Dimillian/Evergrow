import { STARTING_SWORD, getGripLength, getSupportGripOffset } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { ARM_DEPTH_SCALE, armShoulder, solveArm, projectArmPoint, type RigPoint } from './player-arm-rig.ts';
import type { CharacterPose } from './art-types.ts';
import { bowStringOffset, weaponArtLength } from './weapon-shapes.ts';
import { compose, transformPoint, clamp, smooth, type Point, type Affine } from './art-primitives.ts';

export const PLAYER_ART_SCALE = 1.24;

/** Rest-space mounts; animated limbs carry their attached pieces with them. */
export const PLAYER_ATTACHMENTS = {
  head: [0, -33], chest: [0, -21], waist: [0, -13],
  leftShoulder: [-6.5, -26], rightShoulder: [6.5, -26],
  leftHip: [-3.2, -15], rightHip: [3.2, -15],
  leftFoot: [-3.6, 0], rightFoot: [3.6, 0],
} as const;

export const WEAPON_REST_ANGLE = 0.46;

const gripAt = (mount: RigPoint, angle: number, offset: number): RigPoint => [
  mount[0] + Math.cos(angle) * offset, mount[1] + Math.sin(angle) * offset,
  mount[2] + (ARM_DEPTH_SCALE - 1) * Math.sin(angle) * offset,
];

/** The weapon and its renderer-owned trail share exactly the same sweep. */
export function getSwingAngle(
  angle: number,
  progress: number,
  activeStart = 0.2,
  activeEnd = 0.5,
  arc = 2.3,
  restAngle?: number,
): number {
  const start = clamp(activeStart, 0.01, 0.95);
  const end = clamp(activeEnd, start + 0.01, 0.99);
  const from = -arc * 0.5;
  const to = arc * 0.5;
  const near = (target: number) => target + Math.atan2(Math.sin(restAngle! - angle - target), Math.cos(restAngle! - angle - target));
  const restFrom = restAngle === undefined ? WEAPON_REST_ANGLE : near(from);
  const restTo = restAngle === undefined ? WEAPON_REST_ANGLE : near(to);
  const t = clamp(progress);
  if (t < start) return angle + restFrom + (from - restFrom) * smooth(t / start);
  if (t < end) return angle + getActiveSwingOffset((t - start) / (end - start), arc);
  const recovery = (t - end) / (1 - end);
  // Finish the motion before bringing the blade back: the hand does not reverse
  // at full speed on the exact tick where the damaging arc ends.
  const settle = smooth((recovery - 0.14) / 0.86);
  return angle + to + (restTo - to) * settle + 0.22 * Math.sin(recovery * Math.PI) ** 2 * (1 - settle);
}

/** A planted backstroke followed by a lifted, eased return. */
export function playerFootCycle(phase: number) {
  const t = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  const stance = .58;
  if (t < stance) return { travel: 8 - t / stance * 16, lift: 0 };
  const swing = (t - stance) / (1 - stance);
  return { travel: -8 + smooth(swing) * 16, lift: Math.sin(swing * Math.PI) ** 1.3 * 4 };
}

/** Geometry shared by the articulated rig and its attached sword effects. */
export function playerMotion(pose: CharacterPose) {
  const moving = pose.dead ? 0 : clamp(pose.moving);
  const phase = pose.gaitPhase ?? pose.time * 8;
  const step = Math.sin(phase) * moving;
  const moveAngle = pose.moveAngle ?? pose.angle;
  const moveX = Math.cos(moveAngle), moveY = Math.sin(moveAngle);
  const breath = Math.sin(pose.time * 1.8) * 0.2;
  const bob = (Math.cos(phase * 2) * 0.5 - 0.5) * moving + breath;
  const back = Math.sin(pose.angle) < -0.16;
  const attack = pose.dead ? 0 : clamp(pose.attack);
  const ranged = pose.attackKind === 'ranged' || pose.weapon?.kind === 'bow' || pose.weapon?.kind === 'staff';
  const swinging = attack > 0 && !ranged;
  const start = pose.attackStart ?? PLAYER_ABILITIES.basicAttack.activeStart, end = pose.attackEnd ?? PLAYER_ABILITIES.basicAttack.activeEnd;
  const windup = swinging && attack < start ? smooth(attack / start) : 0;
  const active = swinging ? clamp((attack - start) / Math.max(0.01, end - start)) : 0;
  const recovery = swinging ? smooth((attack - end) / Math.max(0.01, 1 - end)) : 0;
  const commitment = swinging
    ? (attack < start ? -windup : (-1 + smooth(active) * 2.1) * (1 - recovery)) : 0;
  const torsoTurn = swinging
    ? (attack < start ? -windup * 0.52 : (-0.52 + smooth(active) * 1.14) * (1 - recovery)) : 0;
  const elbowTuck = !swinging ? 0 : attack < start ? windup : 1 - smooth(active / 0.65);
  const heft = pose.weapon?.kind === 'mace' || pose.weapon?.kind === 'axe' ? 1.2 : pose.weapon?.kind === 'dagger' ? .65 : 1;
  const bodyAngle = pose.angle + torsoTurn * heft;
  const crouch = Math.max(0, -commitment) * 1.3;
  const cast = pose.dead ? 0 : smooth(pose.cast ?? 0);
  const rangedDraw = Math.max(pose.weapon?.kind === 'bow' ? cast : 0, ranged && attack > 0 ? (attack < start ? smooth(attack / start)
    : 1 - smooth((attack - start) / Math.max(.06, (end - start) * .75))) : 0);
  const staffCharge = pose.weapon?.kind === 'staff' ? Math.max(cast, rangedDraw) : 0;
  const staffSupport = smooth(staffCharge / .55);
  const staffPalmOffset = 12 * (1 - staffCharge);
  const idleSway = Math.sin(phase + 0.35) * moving * 0.07 + breath * 0.08;
  const attackBlend = !swinging ? 0 : attack < start ? windup : 1 - recovery;
  const sword = (pose.weapon ?? STARTING_SWORD.visual).kind === 'sword';
  const swordGuard = -Math.PI / 2 - Math.sin(pose.angle) * (pose.grip === 'one-handed' ? .32 : .6) + Math.cos(pose.angle) * .16;
  const mainRestAngle = sword ? swordGuard : pose.angle + WEAPON_REST_ANGLE;
  let weaponAngle = swinging
    ? getSwingAngle(pose.attackAngle, attack, start, end, pose.attackArc,
      sword && pose.attackHand !== 'off' ? swordGuard : undefined) + idleSway * (1 - attackBlend)
    : mainRestAngle + idleSway;
  if (pose.weapon?.kind === 'bow') {
    const carry = .12 + Math.cos(pose.angle) * .12 + idleSway * .18;
    weaponAngle = carry + Math.atan2(Math.sin(pose.angle - carry), Math.cos(pose.angle - carry)) * rangedDraw;
  }
  if (pose.weapon?.kind === 'staff') {
    // Walking-staff carry: upright at the lead side, supported midway up the
    // shaft. The free hand joins the shaft only as the cast gathers.
    const carry = -Math.PI / 2 + Math.cos(pose.angle) * .035 + idleSway * .12;
    const turn = Math.atan2(Math.sin(pose.angle - carry), Math.cos(pose.angle - carry));
    weaponAngle = carry + turn * staffCharge;
  }
  if (pose.gesture === 'thrust') weaponAngle += (pose.angle - weaponAngle) * cast;
  if (pose.gesture === 'slam') weaponAngle -= cast * .9;
  let activeWeaponAngle = weaponAngle;
  const offAttacking = (swinging || !!pose.gesture) && pose.attackHand === 'off';
  const offBlend = pose.gesture ? cast : attackBlend;
  const offRestAngle = pose.angle - .7 + idleSway * .7;
  const offWeaponAngle = offAttacking ? offRestAngle + (activeWeaponAngle - offRestAngle) * offBlend : offRestAngle;
  if (offAttacking) weaponAngle = mainRestAngle + idleSway;
  const hipX = -moveY * step * 0.65 + Math.cos(pose.attackAngle) * commitment * 0.55;
  const hipY = Math.cos(phase * 2) * moving * 0.25 + crouch;
  const lean = moving * moveX * 0.065 + Math.cos(pose.attackAngle) * commitment * 0.065;
  const body: Affine = [1, 0, -lean, 1,
    hipX * 0.6 + Math.cos(pose.attackAngle) * commitment * 1.6,
    bob + crouch - 3 + Math.sin(pose.attackAngle) * commitment * 1.4];
  const reach = !swinging ? 11 : attack < start ? 11 + windup * 2.3
    : attack < end ? 13.3 + Math.sin(active * Math.PI) ** 2 * 3.5 : 13.3 - recovery * 2.3;
  const swingHand: Point = [Math.cos(activeWeaponAngle) * reach, -20 + Math.sin(activeWeaponAngle) * reach * .9];
  const restSide = sword ? (pose.grip === 'one-handed' ? 8 : 3.5) : 2;
  const restingDepth = Math.sin(pose.angle) * 8 + Math.cos(bodyAngle) * restSide;
  const restHand: Point = [Math.cos(pose.angle) * 8 - Math.sin(bodyAngle) * restSide,
    sword ? restingDepth * ARM_DEPTH_SCALE - 24 : -16.5 + Math.sin(pose.angle) * 4.4 + Math.cos(bodyAngle) * .9];
  let hand: Point = [restHand[0] * (1 - attackBlend) + swingHand[0] * attackBlend,
    restHand[1] * (1 - attackBlend) + swingHand[1] * attackBlend];
  const shoulderSway = step * .3;
  // A centered two-hand guard blends into the existing active attack orbit.
  const handDepth = restingDepth * (1 - attackBlend)
    + Math.sin(activeWeaponAngle) * reach * attackBlend;
  let weaponHand: RigPoint = [hand[0], handDepth, handDepth * ARM_DEPTH_SCALE - hand[1]];
  if (pose.weapon?.kind === 'bow') {
    const reach = 9 + rangedDraw * 6, carrySide = 4 * (1 - rangedDraw);
    weaponHand = [Math.cos(pose.angle) * reach + Math.sin(pose.angle) * carrySide,
      Math.sin(pose.angle) * reach - Math.cos(pose.angle) * carrySide,
      18 + rangedDraw * 5];
    hand = projectArmPoint(weaponHand);
  }
  if (pose.weapon?.kind === 'staff') {
    const reach = 6 + staffCharge * 10, shoulderSide = 13 * (1 - staffCharge);
    const palm: RigPoint = [Math.cos(pose.angle) * reach - Math.sin(pose.angle) * shoulderSide,
      Math.sin(pose.angle) * reach + Math.cos(pose.angle) * shoulderSide,
      26 - staffCharge * 4.5];
    weaponHand = gripAt(palm, weaponAngle, -staffPalmOffset);
    hand = projectArmPoint(weaponHand);
  }
  if (pose.gesture === 'thrust' || pose.gesture === 'slam') {
    const reach = 10 + cast * (pose.gesture === 'thrust' ? 12 : 5);
    const gestureHand: RigPoint = [Math.cos(pose.angle) * reach, Math.sin(pose.angle) * reach, 20 + (pose.gesture === 'slam' ? cast * 8 : 0)];
    weaponHand = [weaponHand[0] * (1 - cast) + gestureHand[0] * cast,
      weaponHand[1] * (1 - cast) + gestureHand[1] * cast, weaponHand[2] * (1 - cast) + gestureHand[2] * cast];
  }
  const bow = pose.weapon?.kind === 'bow', staff = pose.weapon?.kind === 'staff';
  const independent = pose.grip === 'one-handed';
  const gripAmount = independent ? 0 : bow || staff ? 1 : 1 - cast;
  const supportHolding = !independent && (staff ? staffSupport >= .999 : cast < .05 || bow || !!pose.gesture);
  const rightX = -Math.sin(bodyAngle), rightDepth = Math.cos(bodyAngle);
  const guardHand = (side: number): RigPoint => [
    rightX * side * 8 + Math.cos(bodyAngle) * (8 + (pose.guard ?? 0) * 3) - step * moveX * .5,
    rightDepth * side * 8 + Math.sin(bodyAngle) * (8 + (pose.guard ?? 0) * 3) - step * moveY * .5,
    20 + (pose.guard ?? 0) * 2,
  ];
  const supportOffset = bow ? bowStringOffset(rangedDraw) : getSupportGripOffset(pose.weapon);
  const supportGrip: RigPoint = [weaponHand[0] + Math.cos(weaponAngle) * supportOffset,
    weaponHand[1] + Math.sin(weaponAngle) * supportOffset,
    weaponHand[2] + (ARM_DEPTH_SCALE - 1) * Math.sin(weaponAngle) * supportOffset];
  const offGuard = guardHand(-1);
  const relaxedHand: RigPoint = [-rightX * 8 + Math.cos(bodyAngle) * 1.5 - step * moveX * .5,
    -rightDepth * 8 + Math.sin(bodyAngle) * 1.5 - step * moveY * .5, 9.5];
  const restOffHand: RigPoint = pose.gesture === 'bash'
    ? [offGuard[0] * (1 - cast) + (Math.cos(pose.angle) * 23 - rightX * 4) * cast,
      offGuard[1] * (1 - cast) + (Math.sin(pose.angle) * 23 - rightDepth * 4) * cast, offGuard[2] + cast * 2]
    : staff ? [relaxedHand[0] * (1 - staffSupport) + supportGrip[0] * staffSupport,
      relaxedHand[1] * (1 - staffSupport) + supportGrip[1] * staffSupport,
      relaxedHand[2] * (1 - staffSupport) + supportGrip[2] * staffSupport]
    : independent ? offGuard : supportGrip;
  const castHand: RigPoint = [Math.cos(pose.angle) * 15, Math.sin(pose.angle) * 15, 20];
  const release = bow || staff || pose.offHand || pose.gesture ? 0 : cast;
  const offHand3: RigPoint = offAttacking ? [
    offGuard[0] * (1 - offBlend) + weaponHand[0] * offBlend,
    offGuard[1] * (1 - offBlend) + weaponHand[1] * offBlend,
    offGuard[2] * (1 - offBlend) + weaponHand[2] * offBlend,
  ] : [
    restOffHand[0] * (1 - release) + castHand[0] * release,
    restOffHand[1] * (1 - release) + castHand[1] * release,
    restOffHand[2] * (1 - release) + castHand[2] * release,
  ];
  const mainHand3: RigPoint = offAttacking ? [restHand[0], restingDepth, restingDepth * ARM_DEPTH_SCALE - restHand[1]] : weaponHand;
  // Keep the blade mount and sweep fixed; seat a one-handed sword's palm down
  // the actual hilt, with the forearm following that same contact point.
  const mainGrip = staff ? staffPalmOffset : sword && independent ? -getGripLength(pose.weapon) * .58 : 0;
  const offGrip = pose.offHand?.kind === 'weapon' && pose.offHand.visual.kind === 'sword'
    ? -getGripLength(pose.offHand.visual) * .58 : 0;
  const weaponBehind = pose.weapon?.kind === 'staff' ? back : sword ? mainHand3[1] < -.5 : Math.sin(weaponAngle) < -0.18;
  const weaponArm = solveArm(armShoulder(bodyAngle, 1, shoulderSway), gripAt(mainHand3, weaponAngle, mainGrip), bodyAngle, 1, elbowTuck, gripAmount);
  const offArm = solveArm(armShoulder(bodyAngle, -1, shoulderSway), gripAt(offHand3, offWeaponAngle, offGrip), bodyAngle, -1, offAttacking ? elbowTuck : 0, staff ? staffSupport : gripAmount);
  hand = projectArmPoint(mainHand3);
  const offWeaponActive = pose.attackHand === 'off' && pose.offHand?.kind === 'weapon';
  const offWeaponOrigin = projectArmPoint(offHand3);
  const activeWeaponOrigin = offWeaponActive ? offWeaponOrigin : hand;
  if (offWeaponActive) activeWeaponAngle = offWeaponAngle;
  return { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, activeWeaponAngle, offWeaponAngle, rangedDraw, weaponBehind, supportHolding, hipX, hipY, lean, body,
    weaponOrigin: hand, offWeaponOrigin, activeWeaponOrigin, bodyAngle, weaponArm, offArm };

}

/** Shared joint data for equipment attachment checks and static rig inspection. */
export function getPlayerArmRig(pose: CharacterPose) {
  const { weaponArm, offArm, bodyAngle, weaponAngle } = playerMotion(pose);
  return { weapon: weaponArm, offhand: offArm, facing: bodyAngle, weaponAngle };
}

/** Exact blade tip in scaled player-local coordinates, relative to the ground anchor. */
export function getPlayerSwordTip(pose: CharacterPose): { x: number; y: number } {
  const motion = playerMotion(pose);
  const activeWeapon = pose.attackHand === 'off' && pose.offHand?.kind === 'weapon' ? pose.offHand.visual : pose.weapon;
  const length = weaponArtLength(activeWeapon ?? STARTING_SWORD.visual);
  const local: Point = [motion.activeWeaponOrigin[0] + Math.cos(motion.activeWeaponAngle) * length,
    motion.activeWeaponOrigin[1] + Math.sin(motion.activeWeaponAngle) * length];
  const body = transformPoint(motion.body, local);
  const tip = transformPoint(characterTransform(pose), [body[0] * PLAYER_ART_SCALE, body[1] * PLAYER_ART_SCALE]);
  return { x: tip[0], y: tip[1] };
}

export function characterTransform(pose: CharacterPose): Affine {
  let base: Affine = [1, 0, 0, 1, 0, 0];
  if (pose.dead) {
    base = [1, 0, 0.72, 0.27, 7, 0];
  } else if (pose.dodging) {
    const progress = clamp(pose.dodgeProgress ?? 0.4);
    const envelope = Math.pow(Math.max(0, Math.sin(progress * Math.PI)), 0.7);
    const direction = Math.cos(pose.moveAngle ?? pose.angle);
    base = [1 + Math.abs(direction) * envelope * 0.12, 0,
      -direction * envelope * 0.2, 1 - envelope * 0.23,
      direction * envelope * 1.5, -envelope];
  } else if (pose.kind !== 'player' && pose.attack !== 0) {
    const windup = pose.attack < 0 ? smooth(-pose.attack) : 1 - smooth(pose.attack / 0.28);
    const strike = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
    const commitment = strike * 0.1 - windup * 0.035;
    base = [1, 0, -Math.cos(pose.attackAngle) * commitment,
      1 - windup * 0.035, 0, Math.sin(pose.attackAngle) * strike * 1.5];
  }
  if (!pose.dead && (pose.impact ?? 0) > 0) {
    const elapsed = 1 - clamp(pose.impact!);
    const recoil = elapsed < 0.18 ? smooth(elapsed / 0.18) : 1 - smooth((elapsed - 0.18) / 0.82);
    const angle = pose.impactAngle ?? pose.angle + Math.PI;
    const height = pose.kind === 'player' ? 48 : 38;
    // All terms vanish at y=0. Feet remain planted while the shoulders and head
    // recoil away from the hit and then settle, independently of locomotion.
    const impact: Affine = [1 + recoil * 0.025, 0, -Math.cos(angle) * recoil * 4.2 / height,
      1 - (Math.sin(angle) * 3.4 + 1.1) * recoil / height, 0, 0];
    return compose(base, impact);
  }
  return base;
}
