import type { Enemy } from './model.ts';

export interface SpawnExclusion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** World-space padding covers tall bodies, their shadows and nearby effect trails. */
export const SPAWN_VISIBILITY_MARGIN = Object.freeze({ horizontal: 80, vertical: 120 });

/** Engaged actors must disengage naturally before either streaming path removes them. */
export function isEnemyInactive(enemy: Pick<Enemy, 'state' | 'awareness'>): boolean {
  return Number.isFinite(enemy.awareness) && enemy.awareness <= .25
    && (enemy.state === 'idle' || enemy.state === 'patrol' || enemy.state === 'return');
}

/** Invalid geometry fails closed; null permits explicit headless/authored placement. */
export function isSpawnHidden(x: number, y: number, exclusion: SpawnExclusion | null, radius = 0): boolean {
  if (![x, y, radius].every(Number.isFinite) || radius < 0) return false;
  if (exclusion === null) return true;
  if (!exclusion || typeof exclusion !== 'object') return false;
  if (![exclusion.x, exclusion.y, exclusion.width, exclusion.height].every(Number.isFinite)
    || exclusion.width <= 0 || exclusion.height <= 0) return false;
  const left = exclusion.x - SPAWN_VISIBILITY_MARGIN.horizontal - radius;
  const right = exclusion.x + exclusion.width + SPAWN_VISIBILITY_MARGIN.horizontal + radius;
  const top = exclusion.y - SPAWN_VISIBILITY_MARGIN.vertical - radius;
  const bottom = exclusion.y + exclusion.height + SPAWN_VISIBILITY_MARGIN.vertical + radius;
  if (![left, right, top, bottom].every(Number.isFinite)) return false;
  return x < left || x > right || y < top || y > bottom;
}
