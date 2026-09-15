import type { WorldQuery } from './model.ts';
import { WORLD_QUERY_LIMITS, isWorldCoordinate } from './world-query.ts';

/** Local steering only. All probes and committed steps use the world's collision solver. */
export const PLAYER_EDGE_SLIDE = Object.freeze({
  reach: 18, probeSpacing: 3, forwardReach: 13, step: 4, sidewaysSpeed: .65, usefulProgress: .45,
  failedSearchRetry: .125,
  failedSearchDistance: .25, failedSearchAngle: Math.PI / 90,
});
const TURNS = [15, 30, 45, 60, 75, 90].map(degrees => ({
  cos: Math.cos(degrees * Math.PI / 180), sin: Math.sin(degrees * Math.PI / 180),
}));
const EPSILON = 1e-6;
const FAILED_SEARCH_HEADING_DOT = Math.cos(PLAYER_EDGE_SLIDE.failedSearchAngle);
const arrived = (p: { x: number; y: number }, x: number, y: number) =>
  Math.abs(p.x - x) < EPSILON && Math.abs(p.y - y) < EPSILON;

type MovementWorld = Pick<WorldQuery, 'move' | 'blocked'>;
interface FailedSearch {
  world: MovementWorld;
  x: number; y: number; ux: number; uy: number; radius: number; time: number;
}

/** One transient failed-search cache per player; never persisted or shared between simulations. */
export class PlayerMovement {
  private failed: FailedSearch | null = null;

  clear(): void { this.failed = null; }

  /** Time is the deterministic simulation clock, not wall time. Collision still runs every tick. */
  move(world: MovementWorld,
    x: number, y: number, dx: number, dy: number, radius: number, time: number): { x: number; y: number } {
    const distance = Math.hypot(dx, dy);
    if (![x, y, x + dx, y + dy].every(isWorldCoordinate) || !Number.isFinite(distance)
      || !Number.isFinite(radius) || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius
      || !Number.isFinite(time) || distance > WORLD_QUERY_LIMITS.movement || distance === 0) {
      this.clear(); return { x, y };
    }
    const count = Math.max(1, Math.ceil(distance / PLAYER_EDGE_SLIDE.step));
    const step = distance / count, ux = dx / distance, uy = dy / distance;
    const sx = ux * step, sy = uy * step;
    for (let i = 0; i < count; i++) {
      const ordinary = world.move(x, y, sx, sy, radius);
      if (arrived(ordinary, x + sx, y + sy)) { this.clear(); x = ordinary.x; y = ordinary.y; continue; }
      const progress = (ordinary.x - x) * ux + (ordinary.y - y) * uy;
      if (progress >= step * PLAYER_EDGE_SLIDE.usefulProgress) { this.clear(); x = ordinary.x; y = ordinary.y; continue; }
      const failed = this.failed;
      // Compare to the original failure, not the last cache hit: slow movement or
      // gradual steering must eventually leave this small tolerance region.
      if (failed && failed.world === world && failed.radius === radius
        && (failed.x - x) ** 2 + (failed.y - y) ** 2 <= PLAYER_EDGE_SLIDE.failedSearchDistance ** 2
        && failed.ux * ux + failed.uy * uy >= FAILED_SEARCH_HEADING_DOT
        && time >= failed.time && time - failed.time < PLAYER_EDGE_SLIDE.failedSearchRetry) {
        x = ordinary.x; y = ordinary.y; continue;
      }
      this.clear();
      // Never use assistance to escape invalid starting geometry.
      if (world.blocked(x, y, radius)) { x = ordinary.x; y = ordinary.y; continue; }

      // Find the nearest reachable side with room to resume forward travel. Requiring
      // both legs to be clear excludes broad walls, closed corners and narrow gaps.
      let side = 0;
      for (let reach = PLAYER_EDGE_SLIDE.probeSpacing; !side && reach <= PLAYER_EDGE_SLIDE.reach;
        reach += PLAYER_EDGE_SLIDE.probeSpacing) {
        for (const sign of [1, -1]) {
          const ex = x - uy * reach * sign, ey = y + ux * reach * sign;
          if (!arrived(world.move(x, y, ex - x, ey - y, radius), ex, ey)) continue;
          const fx = ex + ux * PLAYER_EDGE_SLIDE.forwardReach, fy = ey + uy * PLAYER_EDGE_SLIDE.forwardReach;
          if (arrived(world.move(ex, ey, fx - ex, fy - ey, radius), fx, fy)) { side = sign; break; }
        }
      }
      let destination = ordinary;
      if (!side) this.failed = { world, x, y, ux, uy, radius, time };
      if (side) {
        // Prefer the smallest legal deflection. Nearly perpendicular corrections are
        // slower, and can never replace useful forward progress with a sideways shove.
        for (const turn of TURNS) {
          const length = step * Math.min(1, PLAYER_EDGE_SLIDE.sidewaysSpeed / turn.sin);
          const cx = (ux * turn.cos - uy * turn.sin * side) * length;
          const cy = (uy * turn.cos + ux * turn.sin * side) * length;
          if (cx * ux + cy * uy + EPSILON < progress) continue;
          const candidate = world.move(x, y, cx, cy, radius);
          if (!arrived(candidate, x + cx, y + cy)) continue;
          // Dungeon collision checks a perimeter ring against room unions. Check
          // the correction interior too, where a short diagonal can cross a seam.
          let clear = true;
          for (let sample = 1; sample <= 8; sample++) {
            if (world.blocked(x + cx * sample / 8, y + cy * sample / 8, radius)) { clear = false; break; }
          }
          if (clear) { destination = candidate; break; }
        }
      }
      x = destination.x; y = destination.y;
    }
    return { x, y };
  }
}
