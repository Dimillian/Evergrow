import { STARTING_SWORD, getSupportGripOffset } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { ARM_DEPTH_SCALE, armShoulder, solveArm, type RigPoint } from './player-arm-rig.ts';
import type { CharacterPose } from './art-types.ts';
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
  const swinging = attack > 0;
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
  const idleSway = Math.sin(phase + 0.35) * moving * 0.07 + breath * 0.08;
  const attackBlend = !swinging ? 0 : attack < start ? windup : 1 - recovery;
  const weaponAngle = swinging
    ? getSwingAngle(pose.attackAngle, attack, start, end, pose.attackArc) + idleSway * (1 - attackBlend)
    : pose.angle + WEAPON_REST_ANGLE + idleSway;
  const swordBehind = Math.sin(weaponAngle) < -0.18;
  const hipX = -moveY * step * 0.65 + Math.cos(pose.attackAngle) * commitment * 0.55;
  const hipY = Math.cos(phase * 2) * moving * 0.25 + crouch;
  const lean = moving * moveX * 0.065 + Math.cos(pose.attackAngle) * commitment * 0.065;
  const body: Affine = [1, 0, -lean, 1,
    hipX * 0.6 + Math.cos(pose.attackAngle) * commitment * 1.6,
    bob + crouch + Math.sin(pose.attackAngle) * commitment * 1.4];
  const reach = !swinging ? 11 : attack < start ? 11 + windup * 2.3
    : attack < end ? 13.3 + Math.sin(active * Math.PI) ** 2 * 3.5 : 13.3 - recovery * 2.3;
  const swingHand: Point = [Math.cos(weaponAngle) * reach, -20 + Math.sin(weaponAngle) * reach * .9];
  const restHand: Point = [Math.cos(pose.angle) * 8 - Math.sin(bodyAngle) * 2,
    -16.5 + Math.sin(pose.angle) * 4.4 + Math.cos(bodyAngle) * .9];
  const hand: Point = [restHand[0] * (1 - attackBlend) + swingHand[0] * attackBlend,
    restHand[1] * (1 - attackBlend) + swingHand[1] * attackBlend];
  const shoulderSway = step * .3;
  // A centered two-hand guard blends into the existing active attack orbit.
  const handDepth = (Math.sin(pose.angle) * 8 + Math.cos(bodyAngle) * 2) * (1 - attackBlend)
    + Math.sin(weaponAngle) * reach * attackBlend;
  const weaponHand: RigPoint = [hand[0], handDepth, handDepth * ARM_DEPTH_SCALE - hand[1]];
  const gripAmount = pose.grip === 'one-handed' ? 0 : 1 - cast;
  const weaponArm = solveArm(armShoulder(bodyAngle, 1, shoulderSway), weaponHand, bodyAngle, 1, elbowTuck, gripAmount);
  const rightX = -Math.sin(bodyAngle), rightDepth = Math.cos(bodyAngle);
  const relaxedHand: RigPoint = [-rightX * 9 - step * moveX * 1.2,
    -rightDepth * 9 - step * moveY * 1.2, 10 + Math.max(0, -commitment) * 3];
  const supportOffset = getSupportGripOffset(pose.weapon);
  const supportGrip: RigPoint = [weaponHand[0] + Math.cos(weaponAngle) * supportOffset,
    weaponHand[1] + Math.sin(weaponAngle) * supportOffset,
    weaponHand[2] + (ARM_DEPTH_SCALE - 1) * Math.sin(weaponAngle) * supportOffset];
  const restOffHand = pose.grip === 'one-handed' ? relaxedHand : supportGrip;
  const castHand: RigPoint = [Math.cos(pose.angle) * 15, Math.sin(pose.angle) * 15, 20];
  const offHand3: RigPoint = [
    restOffHand[0] * (1 - cast) + castHand[0] * cast,
    restOffHand[1] * (1 - cast) + castHand[1] * cast,
    restOffHand[2] * (1 - cast) + castHand[2] * cast,
  ];
  const offArm = solveArm(armShoulder(bodyAngle, -1, shoulderSway), offHand3, bodyAngle, -1, 0, gripAmount);
  return { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, swordBehind, hipX, hipY, lean, body, hand, bodyAngle, weaponArm, offArm };
}

/** Shared joint data for equipment attachment checks and static rig inspection. */
export function getPlayerArmRig(pose: CharacterPose) {
  const { weaponArm, offArm, bodyAngle, weaponAngle } = playerMotion(pose);
  return { weapon: weaponArm, offhand: offArm, facing: bodyAngle, weaponAngle };
}

/** Exact blade tip in scaled player-local coordinates, relative to the ground anchor. */
export function getPlayerSwordTip(pose: CharacterPose): { x: number; y: number } {
  const motion = playerMotion(pose);
  const length = Math.max(8, pose.weapon?.length ?? STARTING_SWORD.visual.length);
  const local: Point = [motion.hand[0] + Math.cos(motion.weaponAngle) * length,
    motion.hand[1] + Math.sin(motion.weaponAngle) * length];
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
