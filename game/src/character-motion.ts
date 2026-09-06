import { STARTING_SWORD, getGripLength, getSupportGripOffset } from './equipment.ts';
import { meleeStroke } from './melee-art-motion.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { PLAYER_ABILITIES, RANGED_BASIC_ATTACK_PHASES } from './combat-content.ts';
import { ARM_DEPTH_SCALE, armShoulder, solveArm, projectArmPoint, type RigPoint } from './player-arm-rig.ts';
import type { WeaponVisual } from './model.ts';
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

const meleeGuard = (kind: WeaponVisual['kind']) => kind === 'sword' || kind === 'dagger' || kind === 'axe' || kind === 'mace';
/** Outward-leaning armed guards; both hands use the same family-specific stance. */
function meleeGuardAngle(kind: WeaponVisual['kind'], facing: number, twoHanded: boolean, side = 1): number {
  const lean = kind === 'dagger' ? .2 : kind === 'mace' ? (twoHanded ? .42 : .22)
    : kind === 'axe' ? (twoHanded ? .5 : .38) : twoHanded ? .6 : .32;
  return -Math.PI / 2 - Math.sin(facing) * lean * side + Math.cos(facing) * (kind === 'dagger' ? .1 : .16);
}


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
  const t = clamp(progress);
  // Use one angular branch for the entire action. Choosing a new shortest route
  // after contact lets front-facing guards complete a full wrist/shoulder turn.
  const rest = restAngle ?? angle + WEAPON_REST_ANGLE;
  const strikeStart = restAngle === undefined ? angle + from
    : rest + Math.atan2(Math.sin(angle + from - rest), Math.cos(angle + from - rest));
  const strikeEnd = strikeStart + arc;
  if (t < start) return rest + (strikeStart - rest) * smooth(t / start);
  if (t < end) return strikeStart + arc / 2 + getActiveSwingOffset((t - start) / (end - start), arc, 'off');
  const recovery = (t - end) / (1 - end);
  // A short follow-through then reverse along the slash into the same guard.
  const settle = smooth((recovery - 0.14) / 0.86);
  return strikeEnd + (rest - strikeEnd) * settle + 0.22 * Math.sin(recovery * Math.PI) ** 2 * (1 - settle);
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
  const ranged = pose.attackKind ? pose.attackKind === 'ranged' : pose.weapon?.kind === 'bow' || pose.weapon?.kind === 'staff' || pose.weapon?.kind === 'wand';
  const swinging = attack > 0 && !ranged;
  const phases = ranged ? RANGED_BASIC_ATTACK_PHASES : PLAYER_ABILITIES.basicAttack;
  const start = pose.attackStart ?? phases.activeStart, end = pose.attackEnd ?? phases.activeEnd;
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
  // Basic bolts gather at the grip and release with a small impulse. Keep their
  // pose separate from full skill casting, which may turn the weapon to aim.
  const magicBasic = ranged && (pose.weapon?.kind === 'staff' || pose.weapon?.kind === 'wand') && pose.attackHand !== 'off';
  const boltPulse = magicBasic && attack > 0 ? attack < start ? smooth(attack / start)
    : 1 - smooth((attack - start) / Math.min(.28, 1 - start)) : 0;
  const basicImpulse = boltPulse * (1 - cast);
  const weaponCharge = Math.max(cast, boltPulse);
  const staffCharge = pose.weapon?.kind === 'staff' ? cast : 0;
  const staffPalmOffset = 12 * (1 - staffCharge);
  const idleSway = Math.sin(phase + 0.35) * moving * 0.07 + breath * 0.08;
  const attackBlend = !swinging ? 0 : attack < start ? windup : 1 - recovery;
  const mainKind = (pose.weapon ?? STARTING_SWORD.visual).kind;
  const guardedMelee = meleeGuard(mainKind);
  const hilted = mainKind === 'sword' || mainKind === 'dagger';
  const mainGuard = meleeGuardAngle(mainKind, pose.angle, pose.grip !== 'one-handed');
  const offVisual = pose.offHand?.kind === 'weapon' ? pose.offHand.visual : undefined;
  const offGuardAngle = offVisual && meleeGuard(offVisual.kind) ? meleeGuardAngle(offVisual.kind, pose.angle, false, -1) : pose.angle - .7;
  const mainRestAngle = guardedMelee ? mainGuard : mainKind === 'wand'
    ? -Math.PI / 2 - Math.sin(pose.angle) * .25 : pose.angle + WEAPON_REST_ANGLE;
  let weaponAngle = swinging
    ? getSwingAngle(pose.attackAngle, attack, start, end, pose.attackArc,
      pose.attackHand === 'off' && offVisual ? offGuardAngle : guardedMelee ? mainGuard : undefined) + idleSway * (pose.attackHand === 'off' ? .7 : 1) * (1 - attackBlend)
    : mainRestAngle + idleSway;
  if (pose.weapon?.kind === 'bow') {
    const carry = .12 + Math.cos(pose.angle) * .12 + idleSway * .18;
    weaponAngle = carry + Math.atan2(Math.sin(pose.angle - carry), Math.cos(pose.angle - carry)) * rangedDraw;
  }
  if (pose.weapon?.kind === 'staff') {
    // Upright two-hand carry: the lower palm supports the shaft below the lead grip.
    const carry = -Math.PI / 2 + Math.cos(pose.angle) * .035 + idleSway * .12;
    const turn = Math.atan2(Math.sin(pose.angle - carry), Math.cos(pose.angle - carry));
    weaponAngle = carry + turn * staffCharge + (Math.cos(pose.angle) * .065 - Math.sin(pose.angle) * .025) * basicImpulse;
  }
  const wandCharge = pose.weapon?.kind === 'wand' && pose.attackHand !== 'off' ? cast : 0;
  if (pose.weapon?.kind === 'wand' && pose.attackHand !== 'off') {
    const carry = -Math.PI / 2 - Math.sin(pose.angle) * .25 + idleSway * .3;
    weaponAngle = carry + Math.atan2(Math.sin(pose.angle - carry), Math.cos(pose.angle - carry)) * wandCharge
      + (Math.cos(pose.angle) * .13 - Math.sin(pose.angle) * .055) * basicImpulse;
  }
  if (pose.gesture === 'thrust') weaponAngle += (pose.angle - weaponAngle) * cast;
  if (pose.gesture === 'slam') weaponAngle -= cast * .9;
  let activeWeaponAngle = weaponAngle;
  const offAttacking = (swinging || !!pose.gesture) && pose.attackHand === 'off';
  const offBlend = pose.gesture ? cast : attackBlend;
  const offRestAngle = offGuardAngle + idleSway * .7;
  let offWeaponAngle = offAttacking ? pose.gesture
    ? offRestAngle + Math.atan2(Math.sin(activeWeaponAngle - offRestAngle), Math.cos(activeWeaponAngle - offRestAngle)) * offBlend
    : activeWeaponAngle : offRestAngle;
  if (offAttacking) weaponAngle = mainRestAngle + idleSway * (pose.weapon?.kind === 'wand' ? .3 : 1);
  const hipX = -moveY * step * 0.65 + Math.cos(pose.attackAngle) * commitment * 0.55;
  const hipY = Math.cos(phase * 2) * moving * 0.25 + crouch;
  const lean = moving * moveX * 0.065 + Math.cos(pose.attackAngle) * commitment * 0.065;
  const body: Affine = [1, 0, -lean, 1,
    hipX * 0.6 + Math.cos(pose.attackAngle) * commitment * 1.6,
    bob + crouch - 3 + Math.sin(pose.attackAngle) * commitment * 1.4];
  // The grip cuts across the front of the chest, independently of blade pitch.
  // Recovery retracts from the end of that cut rather than orbiting the torso.
  const sweep = smooth(active);
  const sweepSide = -3 + sweep * 10;
  const reach = 13 + Math.sin(sweep * Math.PI) * 1.5;
  const swingDepth = Math.sin(pose.attackAngle) * reach + Math.cos(pose.attackAngle) * sweepSide;
  const swingHand: Point = [Math.cos(pose.attackAngle) * reach - Math.sin(pose.attackAngle) * sweepSide,
    swingDepth * ARM_DEPTH_SCALE - (19 - sweep * 2)];
  const restSide = guardedMelee ? (pose.grip === 'one-handed' ? (mainKind === 'axe' || mainKind === 'mace' ? 10 : 8) : 3.5) : 2;
  const restingDepth = Math.sin(pose.angle) * 8 + Math.cos(bodyAngle) * restSide;
  const restHand: Point = [Math.cos(pose.angle) * 8 - Math.sin(bodyAngle) * restSide,
    guardedMelee ? restingDepth * ARM_DEPTH_SCALE - 24 : -16.5 + Math.sin(pose.angle) * 4.4 + Math.cos(bodyAngle) * .9];
  let hand: Point = [restHand[0] * (1 - attackBlend) + swingHand[0] * attackBlend,
    restHand[1] * (1 - attackBlend) + swingHand[1] * attackBlend];
  const shoulderSway = step * .3;
  // Keep the grip within a compact forward envelope throughout the slash.
  const handDepth = restingDepth * (1 - attackBlend)
    + swingDepth * attackBlend;
  let weaponHand: RigPoint = [hand[0], handDepth, handDepth * ARM_DEPTH_SCALE - hand[1]];
  if (pose.weapon?.kind === 'bow') {
    const reach = 9 + rangedDraw * 6, carrySide = 4 * (1 - rangedDraw);
    weaponHand = [Math.cos(pose.angle) * reach + Math.sin(pose.angle) * carrySide,
      Math.sin(pose.angle) * reach - Math.cos(pose.angle) * carrySide,
      18 + rangedDraw * 5];
    hand = projectArmPoint(weaponHand);
  }
  if (pose.weapon?.kind === 'staff') {
    const reach = 6 + staffCharge * 10 + basicImpulse * 1.1, shoulderSide = 9 * (1 - staffCharge);
    const palm: RigPoint = [Math.cos(pose.angle) * reach - Math.sin(pose.angle) * shoulderSide,
      Math.sin(pose.angle) * reach + Math.cos(pose.angle) * shoulderSide,
      26 - staffCharge * 4.5 + basicImpulse * .2];
    weaponHand = gripAt(palm, weaponAngle, -staffPalmOffset);
    hand = projectArmPoint(weaponHand);
  }
  if (pose.weapon?.kind === 'wand') {
    const reach = 7 + wandCharge * 9 + basicImpulse * 1.7, side = 9 * (1 - wandCharge);
    weaponHand = [Math.cos(pose.angle) * reach - Math.sin(pose.angle) * side,
      Math.sin(pose.angle) * reach + Math.cos(pose.angle) * side, 23 - wandCharge * 1.5 + basicImpulse * .35];
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
  const supportHolding = !independent && (cast < .05 || bow || staff || !!pose.gesture);
  const rightX = -Math.sin(bodyAngle), rightDepth = Math.cos(bodyAngle);
  const guardHand = (side: number): RigPoint => [
    rightX * side * 8 + Math.cos(bodyAngle) * (8 + (pose.guard ?? 0) * 3) - step * moveX * .5,
    rightDepth * side * 8 + Math.sin(bodyAngle) * (8 + (pose.guard ?? 0) * 3) - step * moveY * .5,
    20 + (pose.guard ?? 0) * 2,
  ];
  const supportOffset = bow ? bowStringOffset(rangedDraw) : staff ? staffPalmOffset - 8 : getSupportGripOffset(pose.weapon);
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
  let offHand3: RigPoint = offAttacking ? [
    offGuard[0] * (1 - offBlend) + weaponHand[0] * offBlend,
    offGuard[1] * (1 - offBlend) + weaponHand[1] * offBlend,
    offGuard[2] * (1 - offBlend) + weaponHand[2] * offBlend,
  ] : [
    restOffHand[0] * (1 - release) + castHand[0] * release,
    restOffHand[1] * (1 - release) + castHand[1] * release,
    restOffHand[2] * (1 - release) + castHand[2] * release,
  ];
  let mainHand3: RigPoint = offAttacking && pose.weapon?.kind !== 'wand' ? [restHand[0], restingDepth, restingDepth * ARM_DEPTH_SCALE - restHand[1]] : weaponHand;
  // Keep the blade mount and sweep fixed; seat sword/dagger palms down
  // the actual hilt, with the forearm following that same contact point.
  const mainGrip = staff ? staffPalmOffset : hilted && independent ? -getGripLength(pose.weapon) * .58 : 0;
  const offGrip = pose.offHand?.kind === 'weapon' && (pose.offHand.visual.kind === 'sword' || pose.offHand.visual.kind === 'dagger')
    ? -getGripLength(pose.offHand.visual) * .58 : 0;
  let mainPalm = gripAt(mainHand3, weaponAngle, mainGrip);
  let offPalm = gripAt(offHand3, offWeaponAngle, offGrip);
  let weaponScale = 1, offWeaponScale = 1, activeWeaponYaw = pose.attackAngle;
  const strokeVisual = offAttacking && offVisual ? offVisual : pose.weapon ?? STARTING_SWORD.visual;
  const diagonal = swinging && !pose.gesture && meleeGuard(strokeVisual.kind);
  if (diagonal) {
    const restAngle = offAttacking ? offRestAngle : mainRestAngle + idleSway;
    const restMount: RigPoint = offAttacking ? offGuard : [restHand[0], restingDepth, restingDepth * ARM_DEPTH_SCALE - restHand[1]];
    const offset = offAttacking ? offGrip : mainGrip;
    const stroke = meleeStroke(pose.attackAngle, attack, start, end, pose.attackArc ?? 2.3,
      offAttacking ? 'off' : 'main', gripAt(restMount, restAngle, offset), restAngle);
    const mount: RigPoint = [stroke.palm[0] - stroke.axis[0] * offset,
      stroke.palm[1] - stroke.axis[1] * offset, stroke.palm[2] - stroke.axis[2] * offset];
    if (offAttacking) {
      offHand3 = mount; offPalm = stroke.palm; offWeaponAngle = stroke.angle; offWeaponScale = stroke.scale;
    } else {
      mainHand3 = mount; mainPalm = stroke.palm; weaponAngle = stroke.angle; weaponScale = stroke.scale;
      if (!independent) {
        offHand3 = [mount[0] + stroke.axis[0] * supportOffset,
          mount[1] + stroke.axis[1] * supportOffset, mount[2] + stroke.axis[2] * supportOffset];
        offPalm = offHand3;
      }
    }
    activeWeaponAngle = stroke.angle; activeWeaponYaw = stroke.yaw;
  }
  const weaponBehind = (staff || pose.weapon?.kind === 'wand') ? back : guardedMelee ? mainHand3[1] < -.5 : Math.sin(weaponAngle) < -0.18;
  const weaponArm = solveArm(armShoulder(bodyAngle, 1, shoulderSway), mainPalm, bodyAngle, 1, elbowTuck, diagonal && independent && !offAttacking ? .55 * attackBlend : gripAmount);
  const offArm = solveArm(armShoulder(bodyAngle, -1, shoulderSway), offPalm, bodyAngle, -1, offAttacking ? elbowTuck : 0, diagonal && offAttacking ? .55 * offBlend : gripAmount);
  hand = projectArmPoint(mainHand3);
  const offWeaponActive = pose.attackHand === 'off' && pose.offHand?.kind === 'weapon';
  const offWeaponOrigin = projectArmPoint(offHand3);
  const activeWeaponOrigin = offWeaponActive ? offWeaponOrigin : hand;
  if (offWeaponActive) activeWeaponAngle = offWeaponAngle;
  return { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, activeWeaponAngle, activeWeaponYaw, offWeaponAngle, rangedDraw, weaponBehind, supportHolding, hipX, hipY, lean, body,
    weaponOrigin: hand, offWeaponOrigin, activeWeaponOrigin, weaponScale, offWeaponScale,
    activeWeaponScale: offWeaponActive ? offWeaponScale : weaponScale, bodyAngle, weaponArm, offArm, weaponCharge };

}

/** Shared joint data for equipment attachment checks and static rig inspection. */
export function getPlayerArmRig(pose: CharacterPose) {
  const { weaponArm, offArm, bodyAngle, weaponAngle, weaponScale } = playerMotion(pose);
  return { weapon: weaponArm, offhand: offArm, facing: bodyAngle, weaponAngle, weaponScale };
}

/** Exact blade tip in scaled player-local coordinates, relative to the ground anchor. */
export function getPlayerSwordTip(pose: CharacterPose): { x: number; y: number } {
  const motion = playerMotion(pose);
  const activeWeapon = pose.attackHand === 'off' && pose.offHand?.kind === 'weapon' ? pose.offHand.visual : pose.weapon;
  const length = weaponArtLength(activeWeapon ?? STARTING_SWORD.visual) * motion.activeWeaponScale;
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
