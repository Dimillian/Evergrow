import type { Point } from './art-primitives.ts';
import { PLAYER_SHIN_LENGTH } from './player-leg-rig.ts';

/** Keep the foot planted and project the shaft as a fraction of the actual
 * shin. Normalizing its length would undo foreshortening and reach the knee. */
export function bootProjection(ankle: Point, knee: Point): (point: Point) => Point {
  const dx = knee[0] - ankle[0], dy = knee[1] - ankle[1];
  const length = Math.hypot(dx, dy);
  const normalX = length > .001 ? -dy / length : 1;
  const normalY = length > .001 ? dx / length : 0;
  return ([x, y]) => {
    if (y >= -2) return [x, y];
    const rise = -y - 2, blend = Math.min(1, rise / 3);
    return [x * (1 - blend + blend * normalX) + dx * rise / PLAYER_SHIN_LENGTH,
      -2 + dy * rise / PLAYER_SHIN_LENGTH + x * normalY * blend];
  };
}
