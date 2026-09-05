import { STARTING_SWORD, getSupportGripOffset } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { ARM_DEPTH_SCALE, armShoulder, solveArm, projectArmPoint, type RigPoint } from './player-arm-rig.ts';
import type { CharacterPose } from './art-types.ts';
import { bowStringOffset } from './weapon-shapes.ts';
import { compose, transformPoint, clamp, smooth, type Point, type Affine } from './art-primitives.ts';

export const PLAYER_ART_SCALE = 1.24;

/** Rest-space mounts; animated limbs carry their attached pieces with them. */
export const PLAYER_ATTACHMENTS = {
  head: [0, -33], chest: [0, -21], waist: [0, -13],
  leftShoulder: [-6.5, -26], rightShoulder: [6.5, -26],
  leftHip: [-3.4, -12], rightHip: [3.4, -12],
  leftFoot: [-3.6, 0], rightFoot: [3.6, 0],
} as const;

export const WEAPON_REST_ANGLE = 0.46;

/** The weapon and its renderer-owned trail share exactly the same sweep. */
export function getSwingAngle(
  angle: number,
  progress: number,
  activeStart = 0.2,
  activeEnd = 0.5,
  arc = 2.3,
): number {
  const start = clamp(activeStart, 0.01, 0.95);
  const end = clamp(activeEnd, start + 0.01, 0.99);
  const rest = WEAPON_REST_ANGLE;
  const from = -arc * 0.5;
  const to = arc * 0.5;
  const t = clamp(progress);
  if (t < start) return angle + rest + (from - rest) * smooth(t / start);
  if (t < end) return angle + getActiveSwingOffset((t - start) / (end - start), arc);
  const recovery = (t - end) / (1 - end);
  // Finish the motion before bringing the blade back: the hand does not reverse
  // at full speed on the exact tick where the damaging arc ends.
  const settle = smooth((recovery - 0.14) / 0.86);
  return angle + to + (rest - to) * settle + 0.22 * Math.sin(recovery * Math.PI) ** 2 * (1 - settle);
}

/** Geometry shared by the articulated rig and its attached sword effects. */
export function playerMotion(pose: CharacterPose) {
  const moving = pose.dead ? 0 : clamp(pose.moving);
  const phase = pose.gaitPhase ?? pose.time * 8;
  const step = Math.sin(phase) * moving;
  const moveAngle = pose.moveAngle ?? pose.angle;
  const moveX = Math.cos(moveAngle), moveY = Math.sin(moveAngle);
  const breath = Math.sin(pose.time * 2.7) * 0.25;
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
  const bodyAngle = pose.angle + torsoTurn;
  const crouch = Math.max(0, -commitment) * 1.3;
  const cast = pose.dead ? 0 : smooth(pose.cast ?? 0);
  const rangedDraw = Math.max(pose.weapon?.kind === 'bow' ? cast : 0, ranged && attack > 0 ? (attack < start ? smooth(attack / start)
    : 1 - smooth((attack - start) / Math.max(.06, (end - start) * .75))) : 0);
  const staffCharge = pose.weapon?.kind === 'staff' ? Math.max(cast, rangedDraw) : 0;
  const idleSway = Math.sin(phase + 0.35) * moving * 0.07 + breath * 0.08;
  const attackBlend = !swinging ? 0 : attack < start ? windup : 1 - recovery;
  let weaponAngle = swinging
    ? getSwingAngle(pose.attackAngle, attack, start, end, pose.attackArc) + idleSway * (1 - attackBlend)
    : pose.angle + WEAPON_REST_ANGLE + idleSway;
  if (pose.weapon?.kind === 'bow') weaponAngle = pose.angle + idleSway * .18;
  if (pose.weapon?.kind === 'staff') weaponAngle = pose.angle + (WEAPON_REST_ANGLE + idleSway) * (1 - staffCharge);
  if (pose.gesture === 'thrust') weaponAngle += (pose.angle - weaponAngle) * cast;
  if (pose.gesture === 'slam') weaponAngle -= cast * .9;
  let activeWeaponAngle = weaponAngle;
  const offAttacking = (swinging || !!pose.gesture) && pose.attackHand === 'off';
  const offBlend = pose.gesture ? cast : attackBlend;
  const offRestAngle = pose.angle - .7 + idleSway * .7;
  const offWeaponAngle = offAttacking ? offRestAngle + (activeWeaponAngle - offRestAngle) * offBlend : offRestAngle;
  if (offAttacking) weaponAngle = pose.angle + WEAPON_REST_ANGLE + idleSway;
  const swordBehind = Math.sin(weaponAngle) < -0.18;
  const hipX = -moveY * step * 0.65 + Math.cos(pose.attackAngle) * commitment * 0.55;
  const hipY = Math.cos(phase * 2) * moving * 0.25 + crouch;
  const lean = moving * moveX * 0.065 + Math.cos(pose.attackAngle) * commitment * 0.065;
  const body: Affine = [1, 0, -lean, 1,
    hipX * 0.6 + Math.cos(pose.attackAngle) * commitment * 1.6,
    bob + crouch + Math.sin(pose.attackAngle) * commitment * 1.4];
  const reach = !swinging ? 11 : attack < start ? 11 + windup * 2.3
    : attack < end ? 13.3 + Math.sin(active * Math.PI) ** 2 * 3.5 : 13.3 - recovery * 2.3;
  const swingHand: Point = [Math.cos(activeWeaponAngle) * reach, -20 + Math.sin(activeWeaponAngle) * reach * .9];
  const restHand: Point = [Math.cos(pose.angle) * 8 - Math.sin(bodyAngle) * 2,
    -16.5 + Math.sin(pose.angle) * 4.4 + Math.cos(bodyAngle) * .9];
  let hand: Point = [restHand[0] * (1 - attackBlend) + swingHand[0] * attackBlend,
    restHand[1] * (1 - attackBlend) + swingHand[1] * attackBlend];
  const shoulderSway = step * .3;
  // A centered two-hand guard blends into the existing active attack orbit.
  const handDepth = (Math.sin(pose.angle) * 8 + Math.cos(bodyAngle) * 2) * (1 - attackBlend)
    + Math.sin(activeWeaponAngle) * reach * attackBlend;
  let weaponHand: RigPoint = [hand[0], handDepth, handDepth * ARM_DEPTH_SCALE - hand[1]];
  if (pose.weapon?.kind === 'bow' || pose.weapon?.kind === 'staff') {
    const reach = pose.weapon.kind === 'bow' ? 14 + rangedDraw : 9 + staffCharge * 7;
    weaponHand = [Math.cos(pose.angle) * reach, Math.sin(pose.angle) * reach,
      (pose.weapon.kind === 'bow' ? 23 : 20) + staffCharge * 1.5];
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
  const restOffHand: RigPoint = pose.gesture === 'bash'
    ? [offGuard[0] * (1 - cast) + (Math.cos(pose.angle) * 23 - rightX * 4) * cast,
      offGuard[1] * (1 - cast) + (Math.sin(pose.angle) * 23 - rightDepth * 4) * cast, offGuard[2] + cast * 2]
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
  const restingDepth = Math.sin(pose.angle) * 8 + Math.cos(bodyAngle) * 2;
  const mainHand3: RigPoint = offAttacking ? [restHand[0], restingDepth, restingDepth * ARM_DEPTH_SCALE - restHand[1]] : weaponHand;
  const weaponArm = solveArm(armShoulder(bodyAngle, 1, shoulderSway), mainHand3, bodyAngle, 1, elbowTuck, gripAmount);
  const offArm = solveArm(armShoulder(bodyAngle, -1, shoulderSway), offHand3, bodyAngle, -1, offAttacking ? elbowTuck : 0, gripAmount);
  hand = projectArmPoint(mainHand3);
  const offWeaponActive = pose.attackHand === 'off' && pose.offHand?.kind === 'weapon';
  const activeHand = offWeaponActive ? projectArmPoint(offHand3) : hand;
  if (offWeaponActive) activeWeaponAngle = offWeaponAngle;
  return { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, activeWeaponAngle, offWeaponAngle, rangedDraw, swordBehind, hipX, hipY, lean, body,
    hand, activeHand, bodyAngle, weaponArm, offArm };

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
  const length = Math.max(8, activeWeapon?.length ?? STARTING_SWORD.visual.length);
  const local: Point = [motion.activeHand[0] + Math.cos(motion.activeWeaponAngle) * length,
    motion.activeHand[1] + Math.sin(motion.activeWeaponAngle) * length];
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
