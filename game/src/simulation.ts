import type { Attack, CombatEvent, Enemy, EnemyKind, Input, Player, Projectile, SimulationOptions, WorldQuery } from './model.ts';
import type { Pickup } from './model.ts';
import { createBaseStats, createStartingEquipment, deriveAttackStats } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { BASIC_ATTACK_PHASES, COMBAT_TIMING, SKILL_CAST_MOTION, ENEMY_DEFINITIONS, LOOT_RULES, PLAYER_ABILITIES,
  PLAYER_DEFAULTS, PLAYER_MOVEMENT, type ProjectileDefinition } from './combat-content.ts';
import { canEnemyJoinAttack, chooseEncounterEnemy, ENCOUNTER_RULES, livingEnemyCount } from './encounter-director.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { awardCharacterExperience, refreshCharacter } from './character.ts';
import { createCharacterSheet, generateItem, TIER_COLORS } from './items.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { addInventoryItem } from './inventory.ts';
import { activateSkill } from './skill-combat.ts';
import type { GroundItem, SkillId } from './character-types.ts';

export const FIXED_STEP = COMBAT_TIMING.fixedStep;
export const HIT_FLASH_DURATION = COMBAT_TIMING.hitFlashDuration;
const TAU = Math.PI * 2;

function initialPlayer(x: number, y: number): Player {
  const character = createCharacterSheet();
  return {
    character, derived: deriveCharacterStats(character), skillCooldowns: {}, activeSkill: null,
    x, y, prevX: x, prevY: y, vx: 0, vy: 0, angle: 0,
    hp: PLAYER_DEFAULTS.maxHp, maxHp: PLAYER_DEFAULTS.maxHp, mana: PLAYER_DEFAULTS.maxMana, maxMana: PLAYER_DEFAULTS.maxMana,
    level: 1, xp: 0,
    stats: createBaseStats(), equipment: createStartingEquipment(),
    attack: null, dodgeTime: 0, dodgeAngle: 0, dodgeCharges: PLAYER_ABILITIES.dodge.charges, dodgeRecharge: 0,
    invulnerable: 0, flasks: PLAYER_ABILITIES.heal.charges, healCooldown: 0, castTime: 0,
    castAngle: 0, healFlash: 0, hitFlash: 0, hitAngle: 0, walkTime: 0, radius: PLAYER_DEFAULTS.radius, dead: false,
  };
}

export class Simulation {
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  groundItems: GroundItem[] = [];
  private lootNoticeAt = -10;
  private skillBuffer: { slot: number; until: number } | null = null;
  time = 0;
  kills = 0;
  readonly world: WorldQuery;
  private options: SimulationOptions;
  private randomState = 1;
  private accumulator = 0;
  private nextId = 1;
  private events: CombatEvent[] = [];
  private attackBuffer = -1;
  private dodgeBuffer = -1;
  private healBuffer = -1;
  private hurtGuard = 0;
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
    this.groundItems = []; this.lootNoticeAt = -10; this.skillBuffer = null;
    refreshCharacter(this.player);
    this.time = 0;
    this.kills = 0;
    this.accumulator = 0;
    this.nextId = 1;
    this.events = [];
    this.randomState = this.options.seed! >>> 0;
    this.attackBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.hurtGuard = this.killRecharge = 0;
    this.spawnTimer = ENCOUNTER_RULES.spawnInterval;
    if (this.options.spawn) for (let i = 0; i < ENCOUNTER_RULES.initialCount; i++) {
      this.spawnAroundPlayer(ENCOUNTER_RULES.initialKind, ENCOUNTER_RULES.initialMinDistance, ENCOUNTER_RULES.initialMaxDistance);
    }
  }

  /** Call when focus/control context changes, including pause and resume. */
  clearInput(): void {
    this.attackBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.skillBuffer = null;
    this.player.vx = this.player.vy = 0;
    this.accumulator = 0;
    this.capturePositions();
  }

  /** UI hover cancels queued weapons while movement and current actions continue. */
  clearCombatInput(): void {
    this.attackBuffer = -1; this.skillBuffer = null;
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
    if (input.attack) this.attackBuffer = this.time + COMBAT_TIMING.attackBuffer;
    if (input.dodge) this.dodgeBuffer = this.time + COMBAT_TIMING.inputBuffer;
    if (input.skillSlot !== null) this.skillBuffer = { slot: input.skillSlot, until: this.time + COMBAT_TIMING.inputBuffer };
    if (input.heal) this.healBuffer = this.time + COMBAT_TIMING.inputBuffer;
    // Bound catch-up after a suspended tab; normal frames always run at 120 Hz.
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP && !this.player.dead) {
      this.accumulator -= FIXED_STEP;
      this.step(FIXED_STEP, input);
    }
  }

  /** Useful for authored encounters and deterministic headless tests. */
  spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy | null {
    const stats = ENEMY_DEFINITIONS[kind];
    if (this.world.isSanctuary?.(x, y)) return null;
    if (livingEnemyCount(this.enemies) >= ENCOUNTER_RULES.hardPopulationCap || this.world.blocked(x, y, stats.radius)) return null;
    const enemy: Enemy = {
      id: this.nextId++, x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, angle: 0, hp: stats.hp, maxHp: stats.hp,
      kind, state: 'idle', stateTime: 0, stateDuration: ENCOUNTER_RULES.initialIdleMin + this.random() * ENCOUNTER_RULES.initialIdleRange,
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
    if (input.attack) this.attackBuffer = this.time + COMBAT_TIMING.attackBuffer;
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.collectGroundItems();
    if (this.player.dead) {
      // A death may clear input midway through this tick; freeze its final poses.
      this.capturePositions();
      return;
    }
    this.updateSpawns(dt);
    this.enemies = this.enemies.filter(e => (e.state !== 'dead' || e.stateTime < ENCOUNTER_RULES.corpseDuration)
      && Math.hypot(e.x - this.player.x, e.y - this.player.y) < ENCOUNTER_RULES.despawnDistance);
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
    for (const id of Object.keys(p.skillCooldowns) as SkillId[]) p.skillCooldowns[id] = Math.max(0, p.skillCooldowns[id]! - dt);
    p.healFlash = Math.max(0, p.healFlash - dt);
    p.mana = Math.min(p.maxMana, p.mana + p.derived.manaRegeneration * dt);
    p.hp = Math.min(p.maxHp, p.hp + p.derived.lifeRegeneration * dt);
    if (p.dodgeCharges < PLAYER_ABILITIES.dodge.charges) {
      p.dodgeRecharge += dt / p.derived.cooldownMultiplier;
      if (p.dodgeRecharge + 1e-9 >= PLAYER_ABILITIES.dodge.recharge) {
        p.dodgeCharges++;
        p.dodgeRecharge -= PLAYER_ABILITIES.dodge.recharge;
        if (p.dodgeCharges === PLAYER_ABILITIES.dodge.charges) p.dodgeRecharge = 0;
      }
    }
    if (input.aimX !== p.x || input.aimY !== p.y) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (this.healBuffer >= this.time && p.flasks > 0 && p.hp < p.maxHp && p.healCooldown <= 0) {
      const healed = Math.min(PLAYER_ABILITIES.heal.restore, p.maxHp - p.hp);
      p.hp += healed;
      p.flasks--;
      p.healCooldown = PLAYER_ABILITIES.heal.cooldown * p.derived.cooldownMultiplier;
      p.healFlash = PLAYER_ABILITIES.heal.flashDuration;
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
    p.castTime = Math.max(0, p.castTime - dt);
    if (!p.attack && p.castTime <= 0) p.activeSkill = null;

    const canCancel = (!p.attack || p.attack.elapsed >= p.attack.activeEnd) && p.castTime <= SKILL_CAST_MOTION.releaseRemaining;
    if (this.dodgeBuffer >= this.time && p.dodgeTime <= 0 && p.dodgeCharges > 0 && canCancel) {
      const moving = Math.hypot(input.moveX, input.moveY) > 0.01;
      p.dodgeAngle = moving ? Math.atan2(input.moveY, input.moveX) : p.angle;
      p.dodgeTime = PLAYER_ABILITIES.dodge.duration;
      p.dodgeCharges--;
      p.attack = null;
      p.castTime = 0;
      this.dodgeBuffer = -1;
      this.events.push({ type: 'dodge', x: p.x, y: p.y, angle: p.dodgeAngle });
    }

    if (this.skillBuffer && this.skillBuffer.until >= this.time && activateSkill({
      player: p, world: this.world, enemies: this.enemies,
      damage: (enemy, amount, angle, melee) => this.damageEnemy(enemy, amount, angle, melee),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      projectile: (x, y, angle, definition, skill) => this.projectile(x, y, angle, definition, skill),
      emit: event => this.events.push(event),
    }, this.skillBuffer.slot)) this.skillBuffer = null;

    if (p.dodgeTime <= 0 && p.castTime <= 0 && this.attackBuffer >= this.time && !p.attack) {
      this.startAttack(completedAttackTime);
      this.attackBuffer = -1;
    }

    let targetVX = 0;
    let targetVY = 0;
    if (p.dodgeTime > 0) {
      p.vx = Math.cos(p.dodgeAngle) * PLAYER_ABILITIES.dodge.speed;
      p.vy = Math.sin(p.dodgeAngle) * PLAYER_ABILITIES.dodge.speed;
      p.dodgeTime = Math.max(0, p.dodgeTime - dt);
    } else {
      const length = Math.hypot(input.moveX, input.moveY);
      const factor = p.attack
        ? p.attack.elapsed < p.attack.activeStart ? PLAYER_MOVEMENT.attackMultiplier.windup
          : p.attack.elapsed < p.attack.activeEnd ? PLAYER_MOVEMENT.attackMultiplier.active : PLAYER_MOVEMENT.attackMultiplier.recovery
        : p.castTime > 0 ? PLAYER_MOVEMENT.castMultiplier : 1;
      if (length > 0) {
        targetVX = input.moveX / Math.max(1, length) * PLAYER_MOVEMENT.speed * p.derived.moveSpeedMultiplier * factor;
        targetVY = input.moveY / Math.max(1, length) * PLAYER_MOVEMENT.speed * p.derived.moveSpeedMultiplier * factor;
      }
      const reversing = p.vx * targetVX + p.vy * targetVY < 0;
      const responseTime = length === 0 ? PLAYER_MOVEMENT.response.stop
        : reversing ? PLAYER_MOVEMENT.response.reverse : PLAYER_MOVEMENT.response.accelerate;
      const easing = 1 - Math.exp(-dt / responseTime);
      p.vx += (targetVX - p.vx) * easing;
      p.vy += (targetVY - p.vy) * easing;
      if (length === 0 && Math.hypot(p.vx, p.vy) < PLAYER_MOVEMENT.stopThreshold) p.vx = p.vy = 0;
    }
    const destination = this.world.move(p.x, p.y, p.vx * dt, p.vy * dt, p.radius);
    p.walkTime += Math.hypot(destination.x - p.x, destination.y - p.y) / PLAYER_MOVEMENT.gaitDistance;
    p.x = destination.x;
    p.y = destination.y;
    const dodgeElapsed = PLAYER_ABILITIES.dodge.duration - p.dodgeTime;
    p.invulnerable = Math.max(this.hurtGuard,
      p.dodgeTime > 0 && dodgeElapsed >= PLAYER_ABILITIES.dodge.invulnerabilityStart && dodgeElapsed < PLAYER_ABILITIES.dodge.invulnerabilityEnd
        ? PLAYER_ABILITIES.dodge.invulnerabilityEnd - dodgeElapsed : 0);
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
    const from = Math.max(-attack.arc / 2, before - PLAYER_ABILITIES.basicAttack.bladeHalfAngle);
    const to = Math.min(attack.arc / 2, after + PLAYER_ABILITIES.basicAttack.bladeHalfAngle);
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
    const critical = this.player.derived.critChance > 0 && this.random() < this.player.derived.critChance;
    damage = Math.max(1, Math.round(damage * (critical ? this.player.derived.critMultiplier : 1)));
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (!this.player.dead) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.derived.lifeOnHit);
    enemy.hitFlash = HIT_FLASH_DURATION;
    enemy.hitAngle = angle;
    const definition = ENEMY_DEFINITIONS[enemy.kind];
    const shove = definition.knockbackDistance;
    enemy.knockbackX += Math.cos(angle) * shove / COMBAT_TIMING.knockbackDecay;
    enemy.knockbackY += Math.sin(angle) * shove / COMBAT_TIMING.knockbackDecay;
    this.events.push({ type: 'hit', x: enemy.x, y: enemy.y, angle, value: damage,
      targetId: enemy.id, remainingHp: enemy.hp, enemyKind: enemy.kind, heavy: critical });
    if (enemy.hp <= 0) {
      this.transition(enemy, 'dead', ENCOUNTER_RULES.corpseDuration);
      this.kills++;
      const levels = awardCharacterExperience(this.player, definition.xpReward);
      if (levels) this.events.push({ type: 'level', x: this.player.x, y: this.player.y,
        text: `Level ${this.player.level} · +${levels} skill point${levels > 1 ? 's' : ''} · +${levels * 5} attribute points`, color: '#c0acf0' });
      if ((this.kills === 1 || this.random() < LOOT_RULES.equipmentChance) && this.groundItems.length < LOOT_RULES.maxGroundItems) {
        const id = this.nextId++;
        const item = generateItem((Math.imul(id, 2654435761) ^ this.options.seed!) >>> 0, this.player.level);
        this.groundItems.push({ id, x: enemy.x, y: enemy.y, item });
      }
      this.killRecharge++;
      if (this.killRecharge >= PLAYER_ABILITIES.heal.killsPerCharge) {
        this.killRecharge -= PLAYER_ABILITIES.heal.killsPerCharge;
        this.player.flasks = Math.min(PLAYER_ABILITIES.heal.charges, this.player.flasks + 1);
      }
      const health = this.kills % LOOT_RULES.healthEveryKills === 0;
      if (this.pickups.length < LOOT_RULES.maxPickups) this.pickups.push({ id: this.nextId++, x: enemy.x, y: enemy.y,
        kind: health ? 'health' : 'mana', value: health ? LOOT_RULES.healthValue : LOOT_RULES.manaValue,
        life: LOOT_RULES.life, radius: LOOT_RULES.radius });
      this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, angle,
        targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind });
    } else if (definition.interruptible && melee) {
      enemy.stagger = COMBAT_TIMING.staggerDuration;
      if (enemy.state === 'windup') {
        enemy.interrupted = true;
        this.transition(enemy, 'recover', COMBAT_TIMING.interruptedRecovery);
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
    const sheltered = this.world.isSanctuary?.(p.x, p.y) ?? false;
    for (const enemy of this.enemies) {
      const stats = ENEMY_DEFINITIONS[enemy.kind];
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
      if (sheltered) {
        // Pursuers turn away from sanctuary instead of waiting inside its doors.
        if (enemy.state !== 'chase') this.transition(enemy, 'chase', 0);
        enemy.angle = targetAngle + Math.PI;
        this.moveEnemy(enemy, -Math.cos(targetAngle) * stats.speed * .7,
          -Math.sin(targetAngle) * stats.speed * .7, dt);
        continue;
      }
      if (enemy.state === 'idle' || enemy.state === 'recover') {
        if (enemy.stateTime >= enemy.stateDuration) this.transition(enemy, 'chase', 0);
      } else if (enemy.state === 'chase') {
        enemy.angle = targetAngle;
        const attackDistance = stats.attack === 'projectile' ? stats.maxAttackDistance : stats.range + p.radius - 3;
        const minDistance = stats.attack === 'projectile' ? stats.minAttackDistance : 0;
        if (distance <= attackDistance && distance > minDistance && canEnemyJoinAttack(enemy, this.enemies)
          && this.lineOfSight(enemy.x, enemy.y, p.x, p.y)) {
          enemy.attackAngle = targetAngle;
          this.transition(enemy, 'windup', stats.windup);
        } else {
          const retreat = stats.attack === 'projectile' && distance < stats.retreatDistance;
          let vx = Math.cos(targetAngle) * stats.speed * (retreat ? -0.7 : 1);
          let vy = Math.sin(targetAngle) * stats.speed * (retreat ? -0.7 : 1);
          if (stats.attack === 'melee' && distance < enemy.radius + p.radius + 3) vx = vy = 0;
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
        if (enemy.stateTime < stats.aimLock) enemy.attackAngle = targetAngle;
        enemy.angle = enemy.attackAngle;
        if (enemy.stateTime >= enemy.stateDuration) {
          this.transition(enemy, 'attack', stats.active);
          if (stats.attack === 'projectile') {
            this.projectile(enemy.x, enemy.y, enemy.attackAngle, stats.projectile);
            this.events.push({ type: 'cast', x: enemy.x, y: enemy.y, angle: enemy.attackAngle, enemyKind: enemy.kind });
          }
        }
      } else if (enemy.state === 'attack') {
        if (stats.attack === 'melee' && stats.lungeSpeed > 0) {
          this.moveEnemy(enemy, Math.cos(enemy.attackAngle) * stats.lungeSpeed, Math.sin(enemy.attackAngle) * stats.lungeSpeed, dt);
        }
        if (stats.attack === 'melee' && !enemy.attackHit
          && circleIntersectsSector(p.x, p.y, p.radius, enemy.x, enemy.y, enemy.attackAngle, stats.range, stats.arc)
          && this.lineOfSight(enemy.x, enemy.y, p.x, p.y)) {
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
    const decay = Math.exp(-dt / COMBAT_TIMING.knockbackDecay);
    // Integrating the exponential preserves the old shove distance across ticks.
    const travel = COMBAT_TIMING.knockbackDecay * (1 - decay);
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
    if (this.world.isSanctuary?.(destination.x, destination.y)
      && !this.world.isSanctuary(enemy.x, enemy.y)) destination = { x: enemy.x, y: enemy.y };
    enemy.vx = (destination.x - enemy.x) / dt;
    enemy.vy = (destination.y - enemy.y) / dt;
    enemy.x = destination.x;
    enemy.y = destination.y;
  }

  private damagePlayer(amount: number, angle: number, kind?: EnemyKind): void {
    const p = this.player;
    if (p.dead || p.invulnerable > 0 || this.world.isSanctuary?.(p.x, p.y)) return;
    amount = Math.max(1, Math.round(amount * (1 - p.derived.damageReduction)));
    p.hp = Math.max(0, p.hp - amount);
    p.hitFlash = HIT_FLASH_DURATION;
    p.hitAngle = angle;
    this.hurtGuard = COMBAT_TIMING.hurtGuard;
    p.invulnerable = COMBAT_TIMING.hurtGuard;
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

  private projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill?: SkillId): void {
    const { speed, life, radius, damage, owner } = definition;
    this.projectiles.push({ id: this.nextId++, x, y, prevX: x, prevY: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, radius, damage, life, maxLife: life, owner, skill });
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
        if (projectile.owner === 'enemy' && this.world.isSanctuary?.(projectile.x, projectile.y)) {
          projectile.life = 0; break;
        }
        if (this.world.blocked(projectile.x, projectile.y, projectile.radius)) { projectile.life = 0; break; }
        if (projectile.owner === 'player') {
          const candidates = this.enemies.filter(enemy => enemy.state !== 'dead' && segmentDistanceSquared(enemy.x, enemy.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + enemy.radius) ** 2);
          candidates.sort((a, b) => Math.hypot(a.x - oldX, a.y - oldY) - Math.hypot(b.x - oldX, b.y - oldY));
          const enemy = candidates[0];
          if (enemy) {
            this.damageEnemy(enemy, projectile.damage, projectile.angle, false);
            if (projectile.skill === 'siphon' && !p.dead) {
              const healed = Math.min(p.maxHp - p.hp, projectile.damage * .35);
              p.hp += healed;
              if (healed > 0) this.events.push({ type: 'heal', x: p.x, y: p.y, value: healed });
            }
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
      if (distance < LOOT_RULES.collectDistance) {
        const before = pickup.kind === 'health' ? p.hp : p.mana;
        if (pickup.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + pickup.value);
        else p.mana = Math.min(p.maxMana, p.mana + pickup.value);
        const value = (pickup.kind === 'health' ? p.hp : p.mana) - before;
        pickup.life = 0;
        this.events.push({ type: 'pickup', x: pickup.x, y: pickup.y, value, heavy: pickup.kind === 'health' });
      } else if (distance < LOOT_RULES.magnetDistance) {
        const destination = this.world.move(pickup.x, pickup.y, dx / distance * LOOT_RULES.magnetSpeed * dt,
          dy / distance * LOOT_RULES.magnetSpeed * dt, pickup.radius);
        pickup.x = destination.x;
        pickup.y = destination.y;
      }
    }
    this.pickups = this.pickups.filter(pickup => pickup.life > 0);
  }

  private collectGroundItems(): void {
    if (this.player.dead) return;
    this.groundItems = this.groundItems.filter(drop => {
      if (Math.hypot(drop.x - this.player.x, drop.y - this.player.y) > LOOT_RULES.equipmentCollectDistance
        || !this.lineOfSight(this.player.x, this.player.y, drop.x, drop.y)) return true;
      if (!addInventoryItem(this.player.character, drop.item)) {
        if (this.time - this.lootNoticeAt > 4) {
          this.events.push({ type: 'loot', x: drop.x, y: drop.y, text: 'Inventory full · item remains on the ground' });
          this.lootNoticeAt = this.time;
        }
        return true;
      }
      this.events.push({ type: 'loot', x: drop.x, y: drop.y, text: drop.item.name, color: TIER_COLORS[drop.item.tier] });
      return false;
    });
  }

  private updateSpawns(dt: number): void {
    if (!this.options.spawn) return;
    if (this.world.isSanctuary?.(this.player.x, this.player.y)) {
      this.spawnTimer = Math.max(this.spawnTimer, ENCOUNTER_RULES.sanctuaryDelay);
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = ENCOUNTER_RULES.spawnInterval;
    const kind = chooseEncounterEnemy(this.enemies, this.kills, () => this.random());
    if (kind) this.spawnAroundPlayer(kind, ENCOUNTER_RULES.spawnMinDistance, ENCOUNTER_RULES.spawnMaxDistance);
  }

  private spawnAroundPlayer(kind: EnemyKind, minDistance: number, maxDistance: number): void {
    for (let attempt = 0; attempt < ENCOUNTER_RULES.maxSpawnAttempts; attempt++) {
      const angle = this.random() * TAU;
      const distance = minDistance + this.random() * (maxDistance - minDistance);
      const x = this.player.x + Math.cos(angle) * distance;
      const y = this.player.y + Math.sin(angle) * distance;
      if (this.world.blocked(x, y, ENEMY_DEFINITIONS[kind].radius + ENCOUNTER_RULES.spawnClearance)) continue;
      if (this.enemies.some(enemy => enemy.state !== 'dead' && Math.hypot(enemy.x - x, enemy.y - y) < ENCOUNTER_RULES.minimumSeparation)) continue;
      this.spawnEnemy(kind, x, y);
      return;
    }
  }
}
