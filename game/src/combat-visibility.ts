import type { Enemy } from './model.ts';
import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';

export interface CombatViewport { x: number; y: number; width: number; height: number; }

/** Actual displayed viewport, never the padded/predicted spawn exclusion envelope. */
export function enemyInCombatViewport(enemy: Pick<Enemy, 'x' | 'y' | 'kind'>, view: CombatViewport | null): boolean {
  if (!view) return false;
  const body = ENEMY_BODY_BOUNDS[enemy.kind];
  return enemy.x + body.radiusX > view.x && enemy.x - body.radiusX < view.x + view.width
    && enemy.y + body.bottom > view.y && enemy.y + body.top < view.y + view.height;
}
