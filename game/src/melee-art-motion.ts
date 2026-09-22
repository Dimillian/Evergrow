import { getActiveSwingOffset } from './attack-motion.ts';
import { clamp, smooth } from './art-primitives.ts';
import { ARM_DEPTH_SCALE, type RigPoint } from './player-arm-rig.ts';

const mix = (a: RigPoint, b: RigPoint, t: number): RigPoint =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A shoulder-led diagonal cut in depth/height space, not a screen-space orbit. */
export function meleeStroke(facing: number, progress: number, start: number, end: number,
  arc: number, hand: 'main' | 'off', restPalm: RigPoint, restAngle: number) {
  const side = hand === 'main' ? 1 : -1;
  const recovery = clamp((progress - end) / (1 - end));
  const active = progress <= end ? clamp((progress - start) / (end - start))
    : 1 - smooth(clamp((recovery - .08) / .8));
  const cut = smooth(active);
  const yaw = facing + getActiveSwingOffset(active, arc, hand);
  // Lower the blade early in the cut, before it passes directly toward camera.
  // This keeps a readable projected silhouette through the front-facing stroke.
  const pitch = .85 - 1.1 * smooth(clamp(active / .65));
  const axis: RigPoint = [Math.cos(yaw) * Math.cos(pitch), Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const lateral = side * (8 - cut * 10), reach = 6 + cut * 3.8;
  const palm: RigPoint = [Math.cos(facing) * reach - Math.sin(facing) * lateral,
    Math.sin(facing) * reach + Math.cos(facing) * lateral, 27 - cut * 7];
  // Match the upright carry grip in height/depth space at both boundaries.
  // Its screen projection is unchanged, but the support arm no longer jumps
  // forward into depth when an attack starts.
  const restAxis: RigPoint = [Math.cos(restAngle), 0, -Math.sin(restAngle)];
  const blend = progress <= 0 ? 0 : progress < start ? smooth(progress / start)
    : progress <= end ? 1 : 1 - smooth(clamp((recovery - .65) / .35));
  const direction = mix(restAxis, axis, blend);
  const screenX = direction[0], screenY = direction[1] * ARM_DEPTH_SCALE - direction[2];
  return { palm: mix(restPalm, palm, blend), axis: direction,
    angle: Math.atan2(screenY, screenX), scale: Math.hypot(screenX, screenY), yaw };
}
