/** Head art uses the same eight-facing sectors as the direction study. */
export function isHeadProfile(facing: number): boolean {
  return Math.abs(Math.sin(facing)) < Math.sin(Math.PI / 8);
}

/** A torso has depth even when its front surface is edge-on. */
export function torsoFacing(facing: number) {
  const side = Math.cos(facing), front = Math.sin(facing);
  return { side, back: front < 0, surface: Math.abs(front),
    width: Math.hypot(front, side * .52), surfaceOffset: side * 3.1 };
}
