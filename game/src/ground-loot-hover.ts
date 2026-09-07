import type { GroundItem } from './character-types.ts';
import type { Enemy, Player, Projectile } from './model.ts';
import { enemyInCombatViewport, type CombatViewport } from './combat-visibility.ts';

export interface GroundLootLabel { id: number; x: number; y: number; width: number; height: number; anchorX: number; anchorY: number; }
export const LOOT_INSPECTION_RADIUS = 420;

/** Passive inspection is available only in a quiet area, including threats just offscreen. */
export function groundLootIsSafe(player: Player, drop: GroundItem, enemies: readonly Enemy[], projectiles: readonly Projectile[], view: CombatViewport): boolean {
  if (player.dead || player.attack || player.castTime > 0 || player.dash || player.dodgeTime > 0 || player.hitFlash > 0) return false;
  const near = (x: number, y: number) => Math.hypot(x - player.x, y - player.y) < LOOT_INSPECTION_RADIUS
    || Math.hypot(x - drop.x, y - drop.y) < LOOT_INSPECTION_RADIUS;
  return !enemies.some(e => e.state !== 'dead' && e.hp > 0 && (near(e.x, e.y) || enemyInCombatViewport(e, view)))
    && !projectiles.some(p => p.owner === 'enemy' && p.life > 0 && near(p.x, p.y));
}

export function hoveredGroundLoot(labels: readonly GroundLootLabel[], x: number, y: number): GroundLootLabel | undefined {
  // Labels win over neighboring item silhouettes in a crowded pile.
  return labels.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
    ?? labels.find(b => Math.abs(x - b.anchorX) <= 15 && y >= b.anchorY - 20 && y <= b.anchorY + 6);
}
