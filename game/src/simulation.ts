import type { Attack, CombatEvent, Enemy, EnemyKind, Input, Player, Projectile, SimulationOptions, WorldQuery } from './model.ts';
import type { Pickup } from './model.ts';
import { createBaseStats, createStartingEquipment, deriveAttackStats } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';

export const FIXED_STEP = 1 / 120;
export const HIT_FLASH_DURATION = .16;
const TAU = Math.PI * 2;
const BUFFER = 0.11;
const ATTACK_BUFFER = 0.22;
const DODGE_DURATION = 0.22;
const MAX_ENEMIES = 12;
const MOVE_SPEED = 165;
const KNOCKBACK_DECAY = 0.065;
/** Normalized phases of the one basic attack, scaled by derived attack speed. */
export const BASIC_ATTACK_PHASES = { activeStart: .19, activeEnd: .45 } as const;
const ENEMY_STATS = {
  stalker: { hp: 48, radius: 10, speed: 112, windup: 0.32, active: 0.18, recovery: 0.65, range: 28, damage: 8 },
  brute: { hp: 138, radius: 17, speed: 69, windup: 0.75, active: 0.13, recovery: 0.9, range: 48, damage: 22 },
  caster: { hp: 56, radius: 11, speed: 82, windup: 0.65, active: 0.15, recovery: 0.7, range: 240, damage: 13 },
};

export function angleDifference(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function segmentDistanceSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** Exact circle/sector overlap including both radial edges and the outer arc. */
export function circleIntersectsSector(x: number, y: number, radius: number, originX: number, originY: number, angle: number, range: number, arc: number): boolean {
  const dx = x - originX;
  const dy = y - originY;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return true;
  if (distance > range + radius) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), angle)) <= arc / 2) return true;
  for (const edge of [angle - arc / 2, angle + arc / 2]) {
    if (segmentDistanceSquared(x, y, originX, originY, originX + Math.cos(edge) * range, originY + Math.sin(edge) * range) <= radius * radius) return true;
  }
  return false;
}

function initialPlayer(x: number, y: number): Player {
  return {
    x, y, prevX: x, prevY: y, vx: 0, vy: 0, angle: 0, hp: 100, maxHp: 100, mana: 100, maxMana: 100,
    stats: createBaseStats(), equipment: createStartingEquipment(),
    attack: null, dodgeTime: 0, dodgeAngle: 0, dodgeCharges: 2, dodgeRecharge: 0,
    invulnerable: 0, flasks: 2, healCooldown: 0, castCooldown: 0, castTime: 0,
    castAngle: 0, healFlash: 0, hitFlash: 0, hitAngle: 0, walkTime: 0, radius: 9, dead: false,
  };
}

export class Simulation {
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  time = 0;
  kills = 0;
  readonly world: WorldQuery;
  private options: SimulationOptions;
  private randomState = 1;
  private accumulator = 0;
  private nextId = 1;
  private events: CombatEvent[] = [];
  private attackBuffer = -1;
  private castBuffer = -1;
  private dodgeBuffer = -1;
  private healBuffer = -1;
  private hurtGuard = 0;
  private castReleased = false;
  private spawnTimer = 0;
  private killRecharge = 0;

  constructor(world: WorldQuery, options: SimulationOptions = {}) {
    this.world = world;
    this.options = { seed: 74319, spawn: true, startX: 0, startY: 0, ...options };
    this.player = initialPlayer(this.options.startX!, this.options.startY!);
    this.reset();
  }

  reset(): void {
    this.player = initialPlayer(this.options.startX!, this.options.startY!);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.time = 0;
    this.kills = 0;
    this.accumulator = 0;
    this.nextId = 1;
    this.events = [];
    this.randomState = this.options.seed! >>> 0;
    this.attackBuffer = this.castBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.hurtGuard = this.killRecharge = 0;
    this.castReleased = false;
    this.spawnTimer = 2;
    if (this.options.spawn) for (let i = 0; i < 3; i++) this.spawnAroundPlayer('stalker', 220, 270);
  }

  /** Call when focus/control context changes, including pause and resume. */
  clearInput(): void {
    this.attackBuffer = this.castBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.player.vx = this.player.vy = 0;
    this.accumulator = 0;
    this.capturePositions();
  }

  /** UI hover cancels queued weapons while movement and current actions continue. */
  clearCombatInput(): void {
    this.attackBuffer = this.castBuffer = -1;
  }

  /** Fraction between the two most recent fixed-tick positions for rendering. */
  get interpolationAlpha(): number {
    return Math.max(0, Math.min(1, this.accumulator / FIXED_STEP));
  }

  drainEvents(): CombatEvent[] {
    const result = this.events;
    this.events = [];
    return result;
  }

  update(dt: number, input: Input): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.player.dead) return;
    if (input.attack) this.attackBuffer = this.time + ATTACK_BUFFER;
    if (input.cast) this.castBuffer = this.time + BUFFER;
    if (input.dodge) this.dodgeBuffer = this.time + BUFFER;
    if (input.heal) this.healBuffer = this.time + BUFFER;
    // Bound catch-up after a suspended tab; normal frames always run at 120 Hz.
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP && !this.player.dead) {
      this.accumulator -= FIXED_STEP;
      this.step(FIXED_STEP, input);
    }
  }

  /** Useful for authored encounters and deterministic headless tests. */
  spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy | null {
    const stats = ENEMY_STATS[kind];
    if (this.enemies.filter(e => e.state !== 'dead').length >= MAX_ENEMIES || this.world.blocked(x, y, stats.radius)) return null;
    const enemy: Enemy = {
      id: this.nextId++, x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, angle: 0, hp: stats.hp, maxHp: stats.hp,
      kind, state: 'idle', stateTime: 0, stateDuration: 0.45 + this.random() * 0.35,
      attackAngle: 0, hitFlash: 0, hitAngle: 0, radius: stats.radius, stagger: 0,
      attackHit: false, interrupted: false,
    };
    this.enemies.push(enemy);
    this.events.push({ type: 'spawn', x, y, enemyKind: kind });
    return enemy;
  }

  private random(): number {
    this.randomState = (this.randomState + 0x6D2B79F5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  private step(dt: number, input: Input): void {
    this.capturePositions();
    // Decrement before damage resolves so every new impact gets a full flash.
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);
    for (const enemy of this.enemies) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    this.time += dt;
    if (input.attack) this.attackBuffer = this.time + ATTACK_BUFFER;
    if (input.cast) this.castBuffer = this.time + BUFFER;
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    if (this.player.dead) {
      // A death may clear input midway through this tick; freeze its final poses.
      this.capturePositions();
      return;
    }
    this.updateSpawns(dt);
    this.enemies = this.enemies.filter(e => (e.state !== 'dead' || e.stateTime < 0.5) && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 850);
  }

  private capturePositions(): void {
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    for (const enemy of this.enemies) {
      enemy.prevX = enemy.x;
      enemy.prevY = enemy.y;
    }
    for (const projectile of this.projectiles) {
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
    }
  }

  private updatePlayer(dt: number, input: Input): void {
    const p = this.player;
    let completedAttackTime = 0;
    this.hurtGuard = Math.max(0, this.hurtGuard - dt);
    p.healCooldown = Math.max(0, p.healCooldown - dt);
    p.castCooldown = Math.max(0, p.castCooldown - dt);
    p.healFlash = Math.max(0, p.healFlash - dt);
    p.mana = Math.min(p.maxMana, p.mana + 9 * dt);
    if (p.dodgeCharges < 2) {
      p.dodgeRecharge += dt;
      if (p.dodgeRecharge + 1e-9 >= 1.8) {
        p.dodgeCharges++;
        p.dodgeRecharge -= 1.8;
        if (p.dodgeCharges === 2) p.dodgeRecharge = 0;
      }
    }
    if (input.aimX !== p.x || input.aimY !== p.y) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (this.healBuffer >= this.time && p.flasks > 0 && p.hp < p.maxHp && p.healCooldown <= 0) {
      const healed = Math.min(42, p.maxHp - p.hp);
      p.hp += healed;
      p.flasks--;
      p.healCooldown = 0.8;
      p.healFlash = 0.5;
      this.healBuffer = -1;
      this.events.push({ type: 'heal', x: p.x, y: p.y, value: healed });
    }

    if (p.attack) {
      const previousElapsed = p.attack.elapsed;
      // Let aim corrections steer anticipation, then lock the actual contact arc.
      if (p.attack.elapsed < p.attack.activeStart) p.attack.angle = p.angle;
      p.attack.elapsed += dt;
      if (p.attack.elapsed >= p.attack.activeStart && previousElapsed < p.attack.activeEnd) this.resolveMelee(p.attack, previousElapsed);
      if (p.attack.elapsed + 1e-9 >= p.attack.duration) {
        // Carry sub-tick recovery time so repeated swings keep the derived rate.
        completedAttackTime = Math.max(0, p.attack.elapsed - p.attack.duration);
        p.attack = null;
      }
    }
    if (p.castTime > 0) {
      p.castTime = Math.max(0, p.castTime - dt);
      if (!this.castReleased && p.castTime <= 0.145) {
        this.castReleased = true;
        this.projectile(p.x, p.y, p.castAngle, 'player');
        this.events.push({ type: 'cast', x: p.x, y: p.y, angle: p.castAngle });
      }
    }

    const canCancel = (!p.attack || p.attack.elapsed >= p.attack.activeEnd) && p.castTime <= 0.145;
    if (this.dodgeBuffer >= this.time && p.dodgeTime <= 0 && p.dodgeCharges > 0 && canCancel) {
      const moving = Math.hypot(input.moveX, input.moveY) > 0.01;
      p.dodgeAngle = moving ? Math.atan2(input.moveY, input.moveX) : p.angle;
      p.dodgeTime = DODGE_DURATION;
      p.dodgeCharges--;
      p.attack = null;
      p.castTime = 0;
      this.dodgeBuffer = -1;
      this.events.push({ type: 'dodge', x: p.x, y: p.y, angle: p.dodgeAngle });
    }

    if (p.dodgeTime <= 0 && p.castTime <= 0) {
      if ((!p.attack || p.attack.elapsed >= p.attack.activeEnd) && this.castBuffer >= this.time && p.castCooldown <= 0 && p.mana >= 20) {
        p.attack = null;
        p.mana -= 20;
        p.castCooldown = 0.45;
        p.castTime = 0.22;
        p.castAngle = p.angle;
        this.castReleased = false;
        this.castBuffer = -1;
      } else if (this.attackBuffer >= this.time && !p.attack) {
        this.startAttack(completedAttackTime);
        this.attackBuffer = -1;
      }
    }

    let targetVX = 0;
    let targetVY = 0;
    if (p.dodgeTime > 0) {
      p.vx = Math.cos(p.dodgeAngle) * 360;
      p.vy = Math.sin(p.dodgeAngle) * 360;
      p.dodgeTime = Math.max(0, p.dodgeTime - dt);
    } else {
      const length = Math.hypot(input.moveX, input.moveY);
      const factor = p.attack
        ? p.attack.elapsed < p.attack.activeStart ? 0.92
          : p.attack.elapsed < p.attack.activeEnd ? 0.87 : 0.96
        : p.castTime > 0 ? 0.88 : 1;
      if (length > 0) {
        targetVX = input.moveX / Math.max(1, length) * MOVE_SPEED * factor;
        targetVY = input.moveY / Math.max(1, length) * MOVE_SPEED * factor;
      }
      const reversing = p.vx * targetVX + p.vy * targetVY < 0;
      const responseTime = length === 0 ? 0.025 : reversing ? 0.028 : 0.045;
      const easing = 1 - Math.exp(-dt / responseTime);
      p.vx += (targetVX - p.vx) * easing;
      p.vy += (targetVY - p.vy) * easing;
      if (length === 0 && Math.hypot(p.vx, p.vy) < 0.4) p.vx = p.vy = 0;
    }
    const destination = this.world.move(p.x, p.y, p.vx * dt, p.vy * dt, p.radius);
    p.walkTime += Math.hypot(destination.x - p.x, destination.y - p.y) / 22;
    p.x = destination.x;
    p.y = destination.y;
    const dodgeElapsed = DODGE_DURATION - p.dodgeTime;
    p.invulnerable = Math.max(this.hurtGuard, p.dodgeTime > 0 && dodgeElapsed >= 0.02 && dodgeElapsed < 0.18 ? 0.18 - dodgeElapsed : 0);
  }

  private startAttack(elapsed = 0): void {
    const stats = deriveAttackStats(this.player.stats, this.player.equipment.mainHand);
    const duration = 1 / stats.attacksPerSecond;
    this.player.attack = {
      elapsed, duration, activeStart: duration * BASIC_ATTACK_PHASES.activeStart,
      activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd, angle: this.player.angle,
      range: stats.range, arc: stats.arc, damage: stats.damage, hitIds: new Set<number>(),
    };
    this.events.push({ type: 'swing', x: this.player.x, y: this.player.y, angle: this.player.angle });
  }

  private resolveMelee(attack: Attack, previousElapsed: number): void {
    const p = this.player;
    const activeDuration = attack.activeEnd - attack.activeStart;
    const before = getActiveSwingOffset((previousElapsed - attack.activeStart) / activeDuration, attack.arc);
    const after = getActiveSwingOffset((attack.elapsed - attack.activeStart) / activeDuration, attack.arc);
    // A small blade width is included, while keeping the advertised arc bounds.
    const from = Math.max(-attack.arc / 2, before - .055);
    const to = Math.min(attack.arc / 2, after + .055);
    const angle = attack.angle + (from + to) / 2;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead' || attack.hitIds.has(enemy.id)) continue;
      if (!circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, angle, attack.range, to - from)) continue;
      if (!this.lineOfSight(p.x, p.y, enemy.x, enemy.y)) continue;
      attack.hitIds.add(enemy.id);
      this.damageEnemy(enemy, attack.damage, Math.atan2(enemy.y - p.y, enemy.x - p.x), true);
    }
  }

  private lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const count = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < count; i++) if (this.world.blocked(ax + (bx - ax) * i / count, ay + (by - ay) * i / count, 1)) return false;
    return true;
  }

  private damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean): void {
    if (enemy.state === 'dead') return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlash = HIT_FLASH_DURATION;
    enemy.hitAngle = angle;
    const shove = enemy.kind === 'brute' ? 5 : 14;
    enemy.knockbackX += Math.cos(angle) * shove / KNOCKBACK_DECAY;
    enemy.knockbackY += Math.sin(angle) * shove / KNOCKBACK_DECAY;
    this.events.push({ type: 'hit', x: enemy.x, y: enemy.y, angle, value: damage,
      targetId: enemy.id, remainingHp: enemy.hp, enemyKind: enemy.kind });
    if (enemy.hp <= 0) {
      this.transition(enemy, 'dead', 0.5);
      this.kills++;
      this.killRecharge++;
      if (this.killRecharge >= 8) {
        this.killRecharge -= 8;
        this.player.flasks = Math.min(2, this.player.flasks + 1);
      }
      const health = this.kills % 3 === 0;
      if (this.pickups.length < 32) this.pickups.push({ id: this.nextId++, x: enemy.x, y: enemy.y, kind: health ? 'health' : 'mana', value: health ? 12 : 16, life: 20, radius: 4 });
      this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, angle,
        targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind });
    } else if (enemy.kind !== 'brute' && melee) {
      enemy.stagger = .16;
      if (enemy.state === 'windup') {
        enemy.interrupted = true;
        this.transition(enemy, 'recover', 0.3);
      }
    }
  }

  private transition(enemy: Enemy, state: Enemy['state'], duration: number): void {
    enemy.state = state;
    enemy.stateTime = 0;
    enemy.stateDuration = duration;
    enemy.vx = enemy.vy = 0;
    if (state === 'windup') {
      enemy.attackHit = false;
      enemy.interrupted = false;
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const enemy of this.enemies) {
      const stats = ENEMY_STATS[enemy.kind];
      this.updateKnockback(enemy, dt);
      enemy.stateTime += dt;
      if (enemy.state === 'dead') continue;
      if (enemy.stagger > 0) {
        enemy.stagger = Math.max(0, enemy.stagger - dt);
        enemy.vx = enemy.vy = 0;
        continue;
      }
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx);
      if (enemy.state === 'idle' || enemy.state === 'recover') {
        if (enemy.stateTime >= enemy.stateDuration) this.transition(enemy, 'chase', 0);
      } else if (enemy.state === 'chase') {
        enemy.angle = targetAngle;
        const attackDistance = enemy.kind === 'caster' ? 215 : stats.range + p.radius - 3;
        if (distance <= attackDistance && distance > (enemy.kind === 'caster' ? 100 : 0) && this.canEnemyAttack(enemy) && this.lineOfSight(enemy.x, enemy.y, p.x, p.y)) {
          enemy.attackAngle = targetAngle;
          this.transition(enemy, 'windup', stats.windup);
        } else {
          const retreat = enemy.kind === 'caster' && distance < 125;
          let vx = Math.cos(targetAngle) * stats.speed * (retreat ? -0.7 : 1);
          let vy = Math.sin(targetAngle) * stats.speed * (retreat ? -0.7 : 1);
          if (enemy.kind !== 'caster' && distance < enemy.radius + p.radius + 3) vx = vy = 0;
          for (const other of this.enemies) {
            if (other === enemy || other.state === 'dead') continue;
            const separation = Math.hypot(enemy.x - other.x, enemy.y - other.y);
            const gap = enemy.radius + other.radius + 8;
            if (separation > 0.01 && separation < gap) {
              const force = (gap - separation) * 5;
              vx += (enemy.x - other.x) / separation * force;
              vy += (enemy.y - other.y) / separation * force;
            }
          }
          this.moveEnemy(enemy, vx, vy, dt);
        }
      } else if (enemy.state === 'windup') {
        const lockTime = enemy.kind === 'brute' ? 0.3 : enemy.kind === 'caster' ? 0.43 : 0.16;
        if (enemy.stateTime < lockTime) enemy.attackAngle = targetAngle;
        enemy.angle = enemy.attackAngle;
        if (enemy.stateTime >= enemy.stateDuration) {
          this.transition(enemy, 'attack', stats.active);
          if (enemy.kind === 'caster') {
            this.projectile(enemy.x, enemy.y, enemy.attackAngle, 'enemy');
            this.events.push({ type: 'cast', x: enemy.x, y: enemy.y, angle: enemy.attackAngle, enemyKind: enemy.kind });
          }
        }
      } else if (enemy.state === 'attack') {
        if (enemy.kind === 'stalker') this.moveEnemy(enemy, Math.cos(enemy.attackAngle) * 48, Math.sin(enemy.attackAngle) * 48, dt);
        if (enemy.kind !== 'caster' && !enemy.attackHit && circleIntersectsSector(p.x, p.y, p.radius, enemy.x, enemy.y, enemy.attackAngle, stats.range, enemy.kind === 'brute' ? Math.PI * 1.25 : Math.PI * 0.7) && this.lineOfSight(enemy.x, enemy.y, p.x, p.y)) {
          enemy.attackHit = true;
          this.damagePlayer(stats.damage, enemy.attackAngle, enemy.kind);
        }
        if (enemy.stateTime >= enemy.stateDuration) this.transition(enemy, 'recover', stats.recovery);
      }
      if (p.dead) break;
    }
    for (const enemy of this.enemies) {
      enemy.vx = (enemy.x - enemy.prevX) / dt;
      enemy.vy = (enemy.y - enemy.prevY) / dt;
    }
  }

  private updateKnockback(enemy: Enemy, dt: number): void {
    if (enemy.knockbackX === 0 && enemy.knockbackY === 0) return;
    const decay = Math.exp(-dt / KNOCKBACK_DECAY);
    // Integrating the exponential preserves the old shove distance across ticks.
    const travel = KNOCKBACK_DECAY * (1 - decay);
    const destination = this.world.move(enemy.x, enemy.y, enemy.knockbackX * travel, enemy.knockbackY * travel, enemy.radius);
    enemy.x = destination.x;
    enemy.y = destination.y;
    enemy.knockbackX *= decay;
    enemy.knockbackY *= decay;
    if (Math.hypot(enemy.knockbackX, enemy.knockbackY) < 0.4) enemy.knockbackX = enemy.knockbackY = 0;
  }

  private moveEnemy(enemy: Enemy, vx: number, vy: number, dt: number): void {
    let destination = this.world.move(enemy.x, enemy.y, vx * dt, vy * dt, enemy.radius);
    // Local steering lets pursuers slip around trunks without a pathfinding grid.
    const intendedDistance = Math.hypot(vx, vy) * dt;
    if (enemy.state === 'chase' && intendedDistance > 0 && Math.hypot(destination.x - enemy.x, destination.y - enemy.y) < intendedDistance * 0.35) {
      const heading = Math.atan2(vy, vx);
      const handedness = enemy.id % 2 === 0 ? 1 : -1;
      for (const turn of [0.7, -0.7, 1.3, -1.3]) {
        const candidate = this.world.move(enemy.x, enemy.y, Math.cos(heading + turn * handedness) * intendedDistance, Math.sin(heading + turn * handedness) * intendedDistance, enemy.radius);
        if (Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) > intendedDistance * 0.7) { destination = candidate; break; }
      }
    }
    enemy.vx = (destination.x - enemy.x) / dt;
    enemy.vy = (destination.y - enemy.y) / dt;
    enemy.x = destination.x;
    enemy.y = destination.y;
  }

  private canEnemyAttack(enemy: Enemy): boolean {
    const active = this.enemies.filter(e => e !== enemy && (e.state === 'windup' || e.state === 'attack'));
    return enemy.kind === 'stalker' ? active.filter(e => e.kind === 'stalker').length < 2 : !active.some(e => e.kind !== 'stalker');
  }

  private damagePlayer(amount: number, angle: number, kind?: EnemyKind): void {
    const p = this.player;
    if (p.dead || p.invulnerable > 0) return;
    p.hp = Math.max(0, p.hp - amount);
    p.hitFlash = HIT_FLASH_DURATION;
    p.hitAngle = angle;
    this.hurtGuard = 0.3;
    p.invulnerable = 0.3;
    this.events.push({ type: 'hurt', x: p.x, y: p.y, angle, value: amount,
      remainingHp: p.hp, enemyKind: kind, heavy: amount >= 20 });
    if (p.hp <= 0) {
      p.dead = true;
      p.attack = null;
      p.castTime = p.dodgeTime = 0;
      p.vx = p.vy = 0;
      this.clearInput();
    }
  }

  private projectile(x: number, y: number, angle: number, owner: Projectile['owner']): void {
    const speed = owner === 'player' ? 360 : 145;
    const life = owner === 'player' ? 1.4 : 2;
    this.projectiles.push({ id: this.nextId++, x, y, prevX: x, prevY: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, radius: 5, damage: owner === 'player' ? 36 : 13, life, maxLife: life, owner });
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      if (projectile.life <= 0) continue;
      const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vy) * dt / 3));
      for (let i = 0; i < steps && projectile.life > 0; i++) {
        const oldX = projectile.x;
        const oldY = projectile.y;
        projectile.x += projectile.vx * dt / steps;
        projectile.y += projectile.vy * dt / steps;
        if (this.world.blocked(projectile.x, projectile.y, projectile.radius)) { projectile.life = 0; break; }
        if (projectile.owner === 'player') {
          const candidates = this.enemies.filter(enemy => enemy.state !== 'dead' && segmentDistanceSquared(enemy.x, enemy.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + enemy.radius) ** 2);
          candidates.sort((a, b) => Math.hypot(a.x - oldX, a.y - oldY) - Math.hypot(b.x - oldX, b.y - oldY));
          const enemy = candidates[0];
          if (enemy) {
            this.damageEnemy(enemy, projectile.damage, projectile.angle, false);
            projectile.life = 0;
          }
        } else if (segmentDistanceSquared(p.x, p.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + p.radius) ** 2) {
          this.damagePlayer(projectile.damage, projectile.angle, 'caster');
          projectile.life = 0;
        }
      }
    }
    this.projectiles = this.projectiles.filter(projectile => projectile.life > 0);
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      const needed = pickup.kind === 'health' ? p.hp < p.maxHp : p.mana < p.maxMana;
      if (!needed || pickup.life <= 0 || p.dead) continue;
      const dx = p.x - pickup.x;
      const dy = p.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 18) {
        const before = pickup.kind === 'health' ? p.hp : p.mana;
        if (pickup.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + pickup.value);
        else p.mana = Math.min(p.maxMana, p.mana + pickup.value);
        const value = (pickup.kind === 'health' ? p.hp : p.mana) - before;
        pickup.life = 0;
        this.events.push({ type: 'pickup', x: pickup.x, y: pickup.y, value, heavy: pickup.kind === 'health' });
      } else if (distance < 55) {
        const destination = this.world.move(pickup.x, pickup.y, dx / distance * 100 * dt, dy / distance * 100 * dt, pickup.radius);
        pickup.x = destination.x;
        pickup.y = destination.y;
      }
    }
    this.pickups = this.pickups.filter(pickup => pickup.life > 0);
  }

  private updateSpawns(dt: number): void {
    if (!this.options.spawn) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 2;
    const live = this.enemies.filter(enemy => enemy.state !== 'dead');
    const target = Math.min(10, 5 + Math.floor(this.kills / 7));
    if (live.length >= target) return;
    const brutes = live.filter(enemy => enemy.kind === 'brute').length;
    const casters = live.filter(enemy => enemy.kind === 'caster').length;
    let kind: EnemyKind = 'stalker';
    if (this.kills >= 6 && casters === 0) kind = 'caster';
    else if (this.kills >= 3 && brutes === 0) kind = 'brute';
    else {
      const roll = this.random();
      if (this.kills >= 6 && casters < 2 && roll < 0.18) kind = 'caster';
      else if (this.kills >= 3 && brutes < 2 && roll < 0.38) kind = 'brute';
    }
    this.spawnAroundPlayer(kind, 300, 450);
  }

  private spawnAroundPlayer(kind: EnemyKind, minDistance: number, maxDistance: number): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.random() * TAU;
      const distance = minDistance + this.random() * (maxDistance - minDistance);
      const x = this.player.x + Math.cos(angle) * distance;
      const y = this.player.y + Math.sin(angle) * distance;
      if (this.world.blocked(x, y, ENEMY_STATS[kind].radius + 7)) continue;
      if (this.enemies.some(enemy => enemy.state !== 'dead' && Math.hypot(enemy.x - x, enemy.y - y) < 45)) continue;
      this.spawnEnemy(kind, x, y);
      return;
    }
  }
}
