import { COMBAT_TIMING, ENEMY_AI_RULES, ENEMY_DEFINITIONS, type EnemyDefinition, type ProjectileDefinition } from './combat-content.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { canEnemyJoinAttack } from './encounter-director.ts';
import type { CombatEvent, Enemy, Player, ProjectileEffects, WorldQuery } from './model.ts';

/** Decisions own no RNG, loot, progression, or drawing. Simulation supplies bounded world mutations. */
export interface EnemyAIContext {
  player: Player;
  enemies: readonly Enemy[];
  world: WorldQuery;
  time: number;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  move(enemy: Enemy, vx: number, vy: number, dt: number): void;
  hurt(amount: number, angle: number, enemy: Enemy): void;
  shoot(enemy: Enemy, angle: number, definition: ProjectileDefinition, effects: ProjectileEffects): void;
  emit(event: CombatEvent): void;
}

export function transitionEnemy(enemy: Enemy, state: Enemy['state'], duration = 0): void {
  enemy.state = state; enemy.stateTime = 0; enemy.stateDuration = duration;
  enemy.vx = enemy.vy = 0;
  if (state === 'windup') { enemy.attackHit = false; enemy.interrupted = false; }
}

/** Direct hits are always noticed, even outside the normal view radius. */
export function alertEnemy(enemy: Enemy, player: Pick<Player, 'x' | 'y'>): void {
  if (enemy.state === 'dead') return;
  enemy.awareness = 1; enemy.lastSeenX = player.x; enemy.lastSeenY = player.y; enemy.lostSightTime = 0;
  if (enemy.state === 'idle' || enemy.state === 'patrol' || enemy.state === 'return') transitionEnemy(enemy, 'chase');
}

function separatedMotion(enemy: Enemy, vx: number, vy: number, context: EnemyAIContext): { vx: number; vy: number } {
  for (const other of context.enemies) {
    if (other === enemy || other.state === 'dead') continue;
    const dx = enemy.x - other.x, dy = enemy.y - other.y, distance = Math.hypot(dx, dy);
    const gap = enemy.radius + other.radius + ENEMY_AI_RULES.separationPadding;
    if (distance > .01 && distance < gap) {
      const force = (gap - distance) * 5;
      vx += dx / distance * force; vy += dy / distance * force;
    }
  }
  const maxSpeed = ENEMY_DEFINITIONS[enemy.kind].speed;
  const length = Math.hypot(vx, vy), scale = length > maxSpeed ? maxSpeed / length : 1;
  return { vx: vx * scale, vy: vy * scale };
}

function moveToward(enemy: Enemy, x: number, y: number, speed: number, dt: number, context: EnemyAIContext): void {
  const dx = x - enemy.x, dy = y - enemy.y, distance = Math.hypot(dx, dy);
  if (distance < .1) return;
  const velocity = separatedMotion(enemy, dx / distance * speed, dy / distance * speed, context);
  if (Math.hypot(velocity.vx, velocity.vy) > 1) enemy.angle = Math.atan2(velocity.vy, velocity.vx);
  context.move(enemy, velocity.vx, velocity.vy, dt);
}

function sense(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const p = context.player, definition = ENEMY_DEFINITIONS[enemy.kind];
  enemy.senseTime -= dt;
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  if (enemy.senseTime <= 0) {
    enemy.senseTime += ENEMY_AI_RULES.senseInterval;
    const range = enemy.awareness >= 1 ? definition.awarenessDistance * 1.35 : definition.awarenessDistance;
    enemy.seesPlayer = distance < range && context.visible(enemy.x, enemy.y, p.x, p.y);
  }
  if (enemy.seesPlayer) {
    enemy.lastSeenX = p.x; enemy.lastSeenY = p.y; enemy.lostSightTime = 0;
    enemy.awareness = Math.min(1, enemy.awareness + dt / ENEMY_AI_RULES.awarenessSeconds
      * (distance < ENEMY_AI_RULES.hearingDistance ? 2 : 1));
  } else {
    enemy.lostSightTime += dt;
    if (enemy.state === 'idle' || enemy.state === 'patrol') enemy.awareness = Math.max(0, enemy.awareness - dt * .6);
  }
}

function patrol(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const phase = enemy.patrolPhase + context.time * .11;
  const radius = ENEMY_AI_RULES.patrolRadius * (.65 + .35 * Math.sin(enemy.patrolPhase * 2));
  const targetX = enemy.homeX + Math.cos(phase) * radius;
  const targetY = enemy.homeY + Math.sin(phase) * radius * .7;
  moveToward(enemy, targetX, targetY, ENEMY_DEFINITIONS[enemy.kind].speed * ENEMY_AI_RULES.patrolSpeed, dt, context);
}

function disengage(enemy: Enemy): void {
  transitionEnemy(enemy, 'return');
  enemy.awareness = 0; enemy.seesPlayer = false; enemy.attackHit = true;
}

function returnHome(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  // Returning foes commit to their home instead of oscillating at the tether edge.
  const distance = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  if (distance < ENEMY_AI_RULES.returnStopDistance) {
    enemy.lostSightTime = 0; enemy.senseTime = .35;
    transitionEnemy(enemy, 'idle', .6); return;
  }
  moveToward(enemy, enemy.homeX, enemy.homeY, ENEMY_DEFINITIONS[enemy.kind].speed * .85, dt, context);
}

function chase(enemy: Enemy, dt: number, context: EnemyAIContext, definition: EnemyDefinition): void {
  const p = context.player, hasSight = enemy.seesPlayer;
  const targetX = hasSight ? p.x : enemy.lastSeenX, targetY = hasSight ? p.y : enemy.lastSeenY;
  const dx = targetX - enemy.x, dy = targetY - enemy.y, distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  enemy.angle = angle;
  const available = canEnemyJoinAttack(enemy, context.enemies);
  const attackDistance = definition.attack === 'melee'
    ? definition.engageDistance ?? definition.range + p.radius - 3 : definition.maxAttackDistance;
  const minDistance = definition.attack === 'melee' ? 0 : definition.retreatDistance;
  if (hasSight && distance <= attackDistance && distance > minDistance && available
    && context.visible(enemy.x, enemy.y, p.x, p.y)) {
    enemy.attackAngle = angle; enemy.attackTargetX = p.x; enemy.attackTargetY = p.y;
    transitionEnemy(enemy, 'windup', definition.windup); return;
  }

  if (!hasSight) { moveToward(enemy, targetX, targetY, definition.speed * .8, dt, context); return; }
  const side = enemy.id % 2 ? 1 : -1;
  if (definition.role === 'ranged') {
    const radial = distance < definition.preferredDistance - 28 ? -.75
      : distance > definition.preferredDistance + 30 ? 1 : 0;
    const lateral = Math.abs(radial) < .1 ? .45 : .25;
    const velocity = separatedMotion(enemy,
      (Math.cos(angle) * radial - Math.sin(angle) * lateral * side) * definition.speed,
      (Math.sin(angle) * radial + Math.cos(angle) * lateral * side) * definition.speed, context);
    context.move(enemy, velocity.vx, velocity.vy, dt); return;
  }
  // The pack spreads around the target. Waiting attackers hold a wider support ring,
  // while a hound approaches its pounce lane instead of crowding melee feet.
  const spread = definition.role === 'heavy' ? 0 : ENEMY_AI_RULES.flankAngle * side;
  const ring = !available ? ENEMY_AI_RULES.supportDistance + enemy.radius
    : definition.role === 'skirmisher' ? definition.preferredDistance * .7 : 18;
  const around = Math.atan2(enemy.y - p.y, enemy.x - p.x) + spread;
  moveToward(enemy, p.x + Math.cos(around) * ring, p.y + Math.sin(around) * ring, definition.speed, dt, context);
  enemy.angle = angle;
}

/** Tick only a living, unstaggered actor; status/damage integration remains simulation-owned. */
export function updateEnemyAI(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const p = context.player, definition = ENEMY_DEFINITIONS[enemy.kind];
  if (context.world.isSanctuary?.(p.x, p.y)) {
    if (enemy.state !== 'return') disengage(enemy);
    const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (distance < 100) {
      const away = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      enemy.angle = away;
      context.move(enemy, Math.cos(away) * definition.speed * .7, Math.sin(away) * definition.speed * .7, dt);
    } else returnHome(enemy, dt, context);
    return;
  }
  if (enemy.state === 'return') { returnHome(enemy, dt, context); return; }
  sense(enemy, dt, context);
  const homeDistance = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
  if ((enemy.state === 'chase' || enemy.state === 'windup' || enemy.state === 'recover')
    && (homeDistance > ENEMY_AI_RULES.tetherDistance || enemy.lostSightTime > ENEMY_AI_RULES.loseSightAfter)) {
    disengage(enemy); returnHome(enemy, dt, context); return;
  }
  if (enemy.state === 'idle' || enemy.state === 'patrol') {
    if (enemy.awareness >= 1) { transitionEnemy(enemy, 'chase'); return; }
    if (enemy.state === 'idle' && enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'patrol');
    if (enemy.state === 'patrol') patrol(enemy, dt, context);
  } else if (enemy.state === 'recover') {
    // Ranged actors sidestep between committed shots; never move their telegraph.
    if (definition.role === 'ranged') {
      const side = enemy.id % 2 ? 1 : -1, angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      context.move(enemy, -Math.sin(angle) * definition.speed * .35 * side,
        Math.cos(angle) * definition.speed * .35 * side, dt);
    }
    if (enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'chase');
  } else if (enemy.state === 'chase') chase(enemy, dt, context, definition);
  else if (enemy.state === 'windup') {
    if (enemy.stateTime < definition.aimLock) {
      enemy.attackAngle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      enemy.attackTargetX = p.x; enemy.attackTargetY = p.y;
    }
    enemy.angle = enemy.attackAngle;
    if (enemy.stateTime + 1e-9 >= enemy.stateDuration) {
      transitionEnemy(enemy, 'attack', definition.active);
      if (definition.attack === 'projectile') {
        for (const offset of definition.shotOffsets) context.shoot(enemy, enemy.attackAngle + offset,
          { ...definition.projectile, damage: enemy.damage }, { style: definition.projectileStyle });
        context.emit({ type: 'cast', x: enemy.x, y: enemy.y, angle: enemy.attackAngle,
          enemyKind: enemy.kind, style: definition.projectileStyle });
      } else if (definition.attack === 'ground') {
        const tx = enemy.attackTargetX, ty = enemy.attackTargetY;
        context.emit({ type: 'blast', x: tx, y: ty, radius: definition.blastRadius, style: 'frost', enemyKind: enemy.kind });
        if (Math.hypot(p.x - tx, p.y - ty) <= definition.blastRadius + p.radius
          && context.visible(enemy.x, enemy.y, tx, ty) && context.visible(tx, ty, p.x, p.y)) {
          context.hurt(enemy.damage, Math.atan2(p.y - ty, p.x - tx), enemy);
        }
        enemy.attackHit = true;
      }
    }
  } else if (enemy.state === 'attack') {
    if (definition.attack === 'melee') {
      if (definition.lungeSpeed > 0) context.move(enemy,
        Math.cos(enemy.attackAngle) * definition.lungeSpeed, Math.sin(enemy.attackAngle) * definition.lungeSpeed, dt);
      if (!enemy.attackHit && circleIntersectsSector(p.x, p.y, p.radius,
        enemy.x, enemy.y, enemy.attackAngle, definition.range, definition.arc)
        && context.visible(enemy.x, enemy.y, p.x, p.y)) {
        enemy.attackHit = true; context.hurt(enemy.damage, enemy.attackAngle, enemy);
      }
    }
    if (enemy.stateTime + 1e-9 >= enemy.stateDuration) transitionEnemy(enemy, 'recover', definition.recovery);
  }
}

/** Shared interruption entrypoint for status skills without forcing every actor type into a kind branch. */
export function interruptStaggeredEnemy(enemy: Enemy): void {
  if (enemy.interrupted && (enemy.state === 'windup' || enemy.state === 'attack'))
    transitionEnemy(enemy, 'recover', COMBAT_TIMING.interruptedRecovery);
}
