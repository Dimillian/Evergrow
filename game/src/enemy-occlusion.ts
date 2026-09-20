import { enemyBodyBounds } from './enemy-body.ts';
import { enemyEngaged } from './enemy-engagement.ts';
import { enemyVisualScale } from './enemy-modifiers.ts';
import type { Enemy } from './model.ts';

export interface OcclusionRect { left: number; top: number; width: number; height: number; }
export function overlapsOcclusion(a: OcclusionRect, b: OcclusionRect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left
    && a.top < b.top + b.height && a.top + a.height > b.top;
}

/** Includes animated weapons and limbs, matching the rank-outline art envelope. */
export function enemyOcclusionBounds(enemy: Pick<Enemy, 'kind' | 'rank'>, x: number, y: number): OcclusionRect {
  const body = enemyBodyBounds(enemy), scale = enemyVisualScale(enemy);
  const side = body.radiusX + 54 * scale, top = body.top - 38 * scale;
  return { left: x - side, top: y + top, width: side * 2, height: body.bottom + 38 * scale - top };
}

/** Only current nearby combatants are eligible; scenery masks never affect AI or aiming. */
export function enemyOcclusionStrength(enemy: Pick<Enemy, 'hp' | 'state'>,
  x: number, y: number, playerX: number, playerY: number): number {
  if (!enemyEngaged(enemy)) return 0;
  return Math.max(0, Math.min(1, (720 - Math.hypot(x - playerX, y - playerY)) / 120));
}

export class EnemyOcclusionFades {
  private values = new Map<number, number>();
  reset(): void { this.values.clear(); }
  retain(ids: ReadonlySet<number>): void {
    for (const id of this.values.keys()) if (!ids.has(id)) this.values.delete(id);
  }
  update(id: number, target: number, dt: number, reducedMotion: boolean): number {
    const previous = this.values.get(id) ?? 0;
    const value = reducedMotion ? target : target + (previous - target) * Math.exp(-18 * Math.max(0, Math.min(.1, dt)));
    if (value < .005 && target === 0) { this.values.delete(id); return 0; }
    this.values.set(id, value);
    return value;
  }
}
