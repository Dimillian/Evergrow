import type { CombatEvent, Enemy, EnemyKind, Player, Projectile, WorldQuery } from './model.ts';
import { applySlow, applyBurn } from './combat-status.ts';
import { segmentDistanceSquared } from './combat-geometry.ts';

export const MAX_PROJECTILES = 128;
export interface ProjectileContext {
  player: Player; enemies: Enemy[]; world: WorldQuery;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  hurt(amount: number, angle: number, sourceLevel: number, sourceKind?: EnemyKind): void;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  emit(event: CombatEvent): void;
}

function hit(projectile: Projectile, enemy: Enemy, context: ProjectileContext): void {
  const effects = projectile.effects;
  projectile.hitIds.add(enemy.id);
  const lifeBefore = enemy.hp;
  context.damage(enemy, projectile.damage, projectile.angle, false);
  if (enemy.state !== 'dead') {
    if (effects?.slowDuration) {
      applySlow(enemy, { duration: effects.slowDuration, factor: effects.slowFactor ?? .6 });
    }
    if (effects?.burnDuration) {
      applyBurn(enemy, { duration: effects.burnDuration, dps: effects.burnDps ?? 0 });
    }
  }
  const p = context.player;
  if (effects?.lifeSteal && !p.dead) {
    const healed = Math.min(p.maxHp - p.hp, Math.max(0, lifeBefore - enemy.hp) * effects.lifeSteal);
    p.hp += healed;
    if (healed > 0) context.emit({ type: 'heal', x: p.x, y: p.y, value: healed });
  }
}

function blast(projectile: Projectile, context: ProjectileContext): void {
  const radius = projectile.effects?.blastRadius ?? 0;
  context.emit({ type: 'blast', x: projectile.x, y: projectile.y, radius: radius || 14,
    style: projectile.effects?.style ?? 'arcane', skill: projectile.skill });
  if (!radius) return;
  for (const enemy of context.enemies) {
    if (enemy.state === 'dead' || projectile.hitIds.has(enemy.id)
      || Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > radius + enemy.radius
      || !context.visible(projectile.x, projectile.y, enemy.x, enemy.y)) continue;
    hit(projectile, enemy, context);
  }
}

/** Bounded swept missiles. Each target can be struck once, including after a ricochet. */
export function advanceProjectiles(projectiles: Projectile[], dt: number, context: ProjectileContext): void {
  const p = context.player;
  for (const projectile of projectiles) {
    projectile.life -= dt;
    if (projectile.life <= 0) continue;
    const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vy) * dt / 3));
    for (let i = 0; i < steps && projectile.life > 0; i++) {
      const oldX = projectile.x, oldY = projectile.y;
      projectile.x += projectile.vx * dt / steps;
      projectile.y += projectile.vy * dt / steps;
      if (projectile.owner === 'enemy' && context.world.isSanctuary?.(projectile.x, projectile.y)) { projectile.life = 0; break; }
      if (context.world.blocked(projectile.x, projectile.y, projectile.radius)) {
        projectile.x = oldX; projectile.y = oldY;
        if (projectile.owner === 'player') blast(projectile, context);
        projectile.life = 0; break;
      }
      if (projectile.owner === 'enemy') {
        if (segmentDistanceSquared(p.x, p.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + p.radius) ** 2) {
          context.hurt(projectile.damage, projectile.angle, projectile.sourceLevel, projectile.sourceKind); projectile.life = 0;
        }
        continue;
      }
      const candidates = context.enemies.filter(enemy => enemy.state !== 'dead' && !projectile.hitIds.has(enemy.id)
        && segmentDistanceSquared(enemy.x, enemy.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + enemy.radius) ** 2
        && context.visible(oldX, oldY, enemy.x, enemy.y));
      candidates.sort((a, b) => Math.hypot(a.x - oldX, a.y - oldY) - Math.hypot(b.x - oldX, b.y - oldY) || a.id - b.id);
      const enemy = candidates[0];
      if (!enemy) continue;
      hit(projectile, enemy, context);
      const effects = projectile.effects;
      if (effects?.blastRadius) { blast(projectile, context); projectile.life = 0; break; }
      if (effects && (effects.chain ?? 0) > 0) {
        const next = context.enemies.filter(target => target.state !== 'dead' && !projectile.hitIds.has(target.id)
          && Math.hypot(target.x - enemy.x, target.y - enemy.y) <= (effects?.chainRange ?? 180)
          && context.visible(projectile.x, projectile.y, target.x, target.y))
          .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id)[0];
        if (next) {
          effects.chain = (effects.chain ?? 0) - 1;
          projectile.angle = Math.atan2(next.y - projectile.y, next.x - projectile.x);
          const speed = Math.hypot(projectile.vx, projectile.vy);
          projectile.vx = Math.cos(projectile.angle) * speed; projectile.vy = Math.sin(projectile.angle) * speed;
          context.emit({ type: 'chain', x: projectile.x, y: projectile.y, toX: next.x, toY: next.y, style: effects.style, skill: projectile.skill });
          continue;
        }
      }
      if (effects && (effects.pierce ?? 0) > 0) { effects.pierce = (effects.pierce ?? 0) - 1; continue; }
      blast(projectile, context); projectile.life = 0;
    }
  }
}
