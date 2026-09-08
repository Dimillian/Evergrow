import type { WorldQuery } from './model.ts';
import { worldNavigation } from './world-navigation.ts';
import { SPAWN_VISIBILITY_MARGIN, type SpawnExclusion } from './spawn-visibility.ts';
/** Shared offscreen, body-clear approach planning for wilderness and dungeon waves. */
export function encounterApproaches(world: WorldQuery, view: SpawnExclusion, player: {x:number;y:number}, site: {x:number;y:number}, clearance: number, radius = 1800) {
  // Plan close, complete walking routes once for the whole wave. A sight ray or
  // a nonzero first step does not prove that a guardian can fit through the route.
  const left = view.x - SPAWN_VISIBILITY_MARGIN.horizontal - clearance - 12;
  const right = view.x + view.width + SPAWN_VISIBILITY_MARGIN.horizontal + clearance + 12;
  const top = view.y - SPAWN_VISIBILITY_MARGIN.vertical - clearance - 12;
  const bottom = view.y + view.height + SPAWN_VISIBILITY_MARGIN.vertical + clearance + 12;
  const candidates: { x: number; y: number; edge: number }[] = [];
  for (const depth of [0, 48, 96]) for (const offset of [0, -56, 56, -112, 112, -168, 168, -224, 224, -280, 280]) {
    const x = Math.max(left, Math.min(right, player.x + offset));
    const y = Math.max(top, Math.min(bottom, player.y + offset));
    candidates.push({ x, y: top - depth, edge: 0 }, { x, y: bottom + depth, edge: 1 }, { x: left - depth, y, edge: 2 }, { x: right + depth, y, edge: 3 });
  }
  candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  const nearest = Math.hypot(candidates[0].x - player.x, candidates[0].y - player.y);
  // Wide cameras still need hidden births. Allow a small detour from their nearest
  // edge, never a trek from the far side of the 1,800-unit trial tether.
  const maxRoute = Math.min(radius, nearest * 1.35 + 192);
  const navigation = worldNavigation(world);
  const checkedPerEdge = [0, 0, 0, 0];
  return candidates.flatMap(p => {
    if (Math.hypot(p.x - site.x, p.y - site.y) > radius
      || world.blocked(p.x, p.y, clearance + 4) || world.isSanctuary?.(p.x, p.y)) return [];
    // Reserve search work for every side; blocked or disconnected near-side lanes
    // must not starve an open approach on another viewport edge.
    if (checkedPerEdge[p.edge]++ >= 12) return [];
    const route = navigation.route(p.x, p.y, player.x, player.y, clearance, 32);
    return route && route.distance <= maxRoute ? [{ ...p, distance: route.distance }] : [];
  }).sort((a, b) => (a.distance + Math.hypot(a.x - site.x, a.y - site.y) * .15) - (b.distance + Math.hypot(b.x - site.x, b.y - site.y) * .15));
}
