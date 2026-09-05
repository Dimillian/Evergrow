import type { Enemy } from './model.ts';
import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';

/** Projectile ground coordinates are rendered at this shared body height. */
export const PROJECTILE_HEIGHT = 16;
export const PLAYER_PROJECTILE_FORGIVENESS = 5;
export interface RangedAim { x: number; y: number; targetId: number | null; }
interface Point { x: number; y: number; }
interface AimOptions {
  range: number; speed: number; alpha: number; previousTargetId: number | null;
  bounds: { left: number; top: number; width: number; height: number };
  visible(ax: number, ay: number, bx: number, by: number): boolean;
}

/** Assist only close to the cursor's visible creature silhouette; never home a released shot. */
export function resolveRangedAim(origin: Point, cursor: Point, enemies: readonly Enemy[], options: AimOptions): RangedAim {
  const fallback = { x: cursor.x, y: cursor.y + PROJECTILE_HEIGHT, targetId: null };
  const alpha = Math.max(0, Math.min(1, options.alpha));
  let selected: Enemy | null = null, best = Infinity;
  for (const enemy of enemies) {
    if (enemy.state === 'dead' || enemy.hp <= 0 || Math.hypot(enemy.x - origin.x, enemy.y - origin.y) > options.range) continue;
    const body = ENEMY_BODY_BOUNDS[enemy.kind], view = options.bounds;
    const x = enemy.prevX + (enemy.x - enemy.prevX) * alpha;
    const groundY = enemy.prevY + (enemy.y - enemy.prevY) * alpha;
    const y = groundY + (body.top + body.bottom) / 2;
    if (x < view.left || x > view.left + view.width || y < view.top || y > view.top + view.height) continue;
    const distance = ((cursor.x - x) / (body.radiusX + 10)) ** 2
      + ((cursor.y - y) / ((body.bottom - body.top) / 2 + 8)) ** 2;
    if (distance > 1 || !options.visible(origin.x, origin.y, enemy.x, enemy.y)) continue;
    const score = distance - (enemy.id === options.previousTargetId ? .12 : 0);
    if (score < best || score === best && enemy.id < selected!.id) { selected = enemy; best = score; }
  }
  if (!selected) return fallback;
  const flight = Math.hypot(selected.x - origin.x, selected.y - origin.y) / Math.max(1, options.speed);
  const lead = Math.min(.18, flight) * .7;
  let dx = selected.vx * lead, dy = selected.vy * lead;
  const scale = Math.min(1, 18 / Math.max(1, Math.hypot(dx, dy))); dx *= scale; dy *= scale;
  if (!options.visible(origin.x, origin.y, selected.x + dx, selected.y + dy)) { dx = 0; dy = 0; }
  return { x: selected.x + dx, y: selected.y + dy, targetId: selected.id };
}
