/** Ground-plane depth and height remain separate until drawing the top-down rig. */
export type RigPoint = readonly [x: number, depth: number, height: number];
export interface ArmRig {
  shoulder: RigPoint;
  elbow: RigPoint;
  hand: RigPoint;
  upperLength: number;
  forearmLength: number;
}
export const ARM_DEPTH_SCALE = .45;

export function projectArmPoint(point: RigPoint): readonly [number, number] {
  return [point[0], point[1] * ARM_DEPTH_SCALE - point[2]];
}

/** Anatomical right/left mounts rotate with facing, including their depth. */
export function armShoulder(facing: number, side: number, gaitSway: number): RigPoint {
  return [-Math.sin(facing) * side * 6.5, Math.cos(facing) * side * 6.5, 26 - side * gaitSway];
}

/** A stable body-relative elbow pole gives real foreshortening without shrinking bones. */
export function solveArm(shoulder: RigPoint, hand: RigPoint, facing: number, side: number, tuck = 0, grip = 0): ArmRig {
  const delta = hand.map((value, index) => value - shoulder[index]);
  const distance = Math.max(.001, Math.hypot(...delta));
  const axis = delta.map(value => value / distance);
  const stretch = Math.max(1, distance / 19.7);
  const upperLength = 9.1 * stretch, forearmLength = 10.8 * stretch;
  const along = Math.max(-upperLength, Math.min(upperLength,
    (upperLength ** 2 - forearmLength ** 2 + distance ** 2) / (2 * distance)));
  const radius = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  // Gripping keeps elbows in front of the torso; a released arm can swing behind it.
  const outward = .35 + grip * .25;
  const forward = -(.9 - tuck * .3) * (1 - grip) + .4 * grip;
  const pole = [
    -Math.sin(facing) * side * outward + Math.cos(facing) * forward,
    Math.cos(facing) * side * outward + Math.sin(facing) * forward,
    -.1 - tuck * .25 - grip * .5,
  ];
  const dot = pole.reduce((sum, value, index) => sum + value * axis[index], 0);
  let perpendicular = pole.map((value, index) => value - dot * axis[index]);
  let length = Math.hypot(...perpendicular);
  if (length < .001) {
    // The pole can align with an extreme weapon pose; use an orthogonal axis.
    const fallback = Math.abs(axis[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
    const projection = fallback.reduce((sum, value, index) => sum + value * axis[index], 0);
    perpendicular = fallback.map((value, index) => value - projection * axis[index]);
    length = Math.hypot(...perpendicular);
  }
  const joint = (index: number) => shoulder[index] + axis[index] * along + perpendicular[index] / length * radius;
  const elbow: RigPoint = [joint(0), joint(1), joint(2)];
  return { shoulder, elbow, hand, upperLength, forearmLength };
}
