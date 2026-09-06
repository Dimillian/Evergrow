import { focusShapes } from './focus-shapes.ts';
import type { CharacterPose } from './art-types.ts';
import { characterTransform, PLAYER_ART_SCALE, playerMotion } from './character-motion.ts';
import { transformPoint, type Point } from './art-primitives.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import { STARTING_SWORD } from './equipment.ts';
import { shieldShapes, weaponShapes } from './weapon-shapes.ts';

export interface CharacterBounds { left: number; top: number; right: number; bottom: number; }

/** Full equipment contours, including the grip, bow limbs and off-hand. Body and
 * cloth use a conservative envelope so tiny secondary motion cannot crop them. */
export function characterBounds(pose: CharacterPose): CharacterBounds {
  const motion = playerMotion(pose), points: Point[] = [];
  const outer = characterTransform(pose);
  const add = (point: Point, body = true) => {
    const local = body ? transformPoint(motion.body, point) : point;
    points.push(transformPoint(outer, [local[0] * PLAYER_ART_SCALE, local[1] * PLAYER_ART_SCALE]));
  };
  for (const x of [-20, 20]) for (const y of [-42, 10]) add([x, y]);
  for (const x of [-19, 19]) for (const y of [-16, 12]) add([x, y], false);
  for (const arm of [motion.weaponArm, motion.offArm]) for (const joint of [arm.shoulder, arm.elbow, arm.hand]) {
    const p = projectArmPoint(joint);
    for (const x of [-5, 5]) for (const y of [-5, 5]) add([p[0] + x, p[1] + y]);
  }
  const weapon = (visual: NonNullable<CharacterPose['weapon']>, hand: Point, angle: number, draw = 0, scale = 1) => {
    for (const shape of weaponShapes(visual, draw)) for (const [x, y] of shape.points) {
      add([hand[0] + x * scale * Math.cos(angle) - y * Math.sin(angle), hand[1] + x * scale * Math.sin(angle) + y * Math.cos(angle)]);
    }
  };
  weapon(pose.weapon ?? STARTING_SWORD.visual, motion.weaponOrigin, motion.weaponAngle, motion.rangedDraw, motion.weaponScale);
  const hand = projectArmPoint(motion.offArm.hand);
  if (pose.offHand?.kind === 'weapon') weapon(pose.offHand.visual, motion.offWeaponOrigin, motion.offWeaponAngle, 0, motion.offWeaponScale);
  if (pose.offHand?.kind === 'focus') {
    for (const shape of focusShapes(pose.offHand.visual, pose.effectTime ?? pose.time, pose.angle)) for (const [x, y] of shape.points) add([hand[0] + x, hand[1] + y]);
  }
  if (pose.offHand?.kind === 'shield') {
    const angle = Math.cos(pose.angle) * -.12, scale = .62 + Math.abs(Math.sin(pose.angle)) * .38;
    for (const shape of shieldShapes(pose.offHand.visual)) for (const [x, y] of shape.points) {
      add([hand[0] + x * scale * Math.cos(angle) - y * Math.sin(angle), hand[1] + x * scale * Math.sin(angle) + y * Math.cos(angle)]);
    }
  }
  return { left: Math.min(...points.map(p => p[0])) - 3, right: Math.max(...points.map(p => p[0])) + 3,
    top: Math.min(...points.map(p => p[1])) - 3, bottom: Math.max(...points.map(p => p[1])) + 3 };
}

/** One scale on both axes: a narrow portrait must never squash the figure. */
export function fitCharacter(bounds: CharacterBounds, width: number, height: number, padding = .08) {
  const scale = Math.min(width * (1 - padding * 2) / (bounds.right - bounds.left),
    height * (1 - padding * 2) / (bounds.bottom - bounds.top));
  return { scale, x: width / 2 - (bounds.left + bounds.right) / 2 * scale,
    y: height / 2 - (bounds.top + bounds.bottom) / 2 * scale };
}
