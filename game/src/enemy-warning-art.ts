import type { Enemy } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { WARDEN_RULES } from './dungeon-boss.ts';
import { drawAttackWarning, type WarningShape } from './attack-warning-art.ts';
import { drawGlow, type PointLight } from './lighting.ts';

interface Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
export function enemyWarnings(e: Enemy, alpha = 1): Warning[] {
  if (e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const d = ENEMY_DEFINITIONS[e.kind], x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const base = { x, y, angle: e.attackAngle, progress, locked: e.state === 'attack' || e.stateTime >= d.aimLock, color: '#f34e60' };
  if (e.kind === 'warden') {
    if (e.bossMove === 'fracture') return [-.5, 0, .5].map(offset => ({ ...base, angle: e.attackAngle + offset,
      shape: { kind: 'lane', length: WARDEN_RULES.fractureLength, width: WARDEN_RULES.fractureWidth } }));
    if (e.bossMove === 'sweep') return [{ ...base, shape: { kind: 'sector', radius: WARDEN_RULES.reach, arc: Math.PI * 1.3 } }];
    return []; // Summoning has no damage footprint; show an aura rather than a false hit boundary.
  }
  if (d.attack === 'ground') return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, color: '#e83d59', shape: { kind: 'circle', radius: d.blastRadius } }];
  if (d.attack === 'projectile') return d.shotOffsets.map(offset => ({ ...base, angle: e.attackAngle + offset,
    color: '#ff6676', shape: { kind: 'lane', length: d.projectile.speed * d.projectile.life, width: d.projectile.radius } }));
  if (d.engageDistance) return [{ ...base, shape: { kind: 'lane', width: 11,
    length: d.lungeSpeed * Math.max(0, d.active - (e.state === 'attack' ? e.stateTime : 0)) + d.range } }];
  return [{ ...base, shape: { kind: 'sector', radius: d.range, arc: d.arc } }];
}
export function drawEnemyWarning(c: CanvasRenderingContext2D, e: Enemy, alpha: number, time: number, reduced: boolean): void {
  if (e.kind === 'warden' && e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 25, 70, '#e83d59', .25 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  for (const w of enemyWarnings(e, alpha)) {
    c.save(); c.translate(w.x, w.y); c.rotate(w.angle);
    drawAttackWarning(c, w.shape, w.progress, w.color, time + e.id * .137, reduced, w.locked, '#ffd1da'); c.restore();
  }
}
export function enemyWarningLight(e: Enemy): PointLight | null {
  const w = enemyWarnings(e)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
