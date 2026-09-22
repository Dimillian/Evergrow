import { propDefinition } from './biome-props.ts';
import { enemyBodyBounds } from './enemy-body.ts';
import { enemyEngaged } from './enemy-engagement.ts';
import type { CameraView } from './camera.ts';
import type { Enemy } from './model.ts';
import type { Prop } from './world.ts';

interface CanopyTarget { x: number; y: number; left: number; right: number; top: number; bottom: number; }

/** Filter once per frame. Canopies only need numeric bounds, never a second actor draw. */
export function canopyCombatTargets(enemies: readonly Enemy[], view: Pick<CameraView, 'left' | 'top' | 'width' | 'height'>,
  alpha: number, playerX: number, playerY: number, indoors: (x: number, y: number) => boolean): CanopyTarget[] {
  const targets: CanopyTarget[] = [];
  for (const enemy of enemies) {
    if (!enemyEngaged(enemy)) continue;
    const x = enemy.prevX + (enemy.x - enemy.prevX) * alpha, y = enemy.prevY + (enemy.y - enemy.prevY) * alpha;
    if ((x - playerX) ** 2 + (y - playerY) ** 2 >= 720 ** 2) continue;
    const body = enemyBodyBounds(enemy);
    const left = x - body.radiusX, right = x + body.radiusX, top = y + body.top, bottom = y + body.bottom;
    if (right <= view.left || left >= view.left + view.width || bottom <= view.top || top >= view.top + view.height
      || indoors(x, y)) continue;
    targets.push({ x, y, left, right, top, bottom });
  }
  return targets;
}

export function canopyNeedsFade(prop: Prop, playerX: number, playerY: number, enemies: readonly CanopyTarget[]): boolean {
  const crown = propDefinition(prop.kind).canopy;
  if (!crown) return false;
  const x = prop.x + crown.offsetX * prop.scale, radius = crown.radius * prop.scale;
  const top = prop.y - (crown.height + crown.radius) * prop.scale;
  // Preserve the player's established clearance, including their approach to the trunk.
  if (playerY < prop.y + 8 && playerY > top && Math.abs(playerX - x) < radius) return true;
  const bottom = prop.y - (crown.height - crown.radius) * prop.scale;
  for (const enemy of enemies) {
    // Props at equal depth draw before actors, so they cannot cover that actor.
    if (enemy.y < prop.y && enemy.right > x - radius && enemy.left < x + radius
      && enemy.bottom > top && enemy.top < bottom) return true;
  }
  return false;
}
