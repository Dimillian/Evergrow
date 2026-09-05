import { advanceGold, type GroundGold } from './gold.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Attack, CombatEvent, Enemy, EnemyKind, Input, Player, Projectile, ProjectileEffects, GroundEffect, SimulationOptions, WorldQuery } from './model.ts';
import type { Pickup } from './model.ts';
import { createBaseStats, createStartingEquipment, deriveAttackStats } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { BASIC_ATTACK_PHASES, COMBAT_TIMING, SKILL_CAST_MOTION, ENEMY_DEFINITIONS, LOOT_RULES, PLAYER_ABILITIES,
  PLAYER_DEFAULTS, PLAYER_MOVEMENT, type ProjectileDefinition } from './combat-content.ts';
import { chooseEncounterEnemy, chooseEncounterRank, ENCOUNTER_RULES, livingEnemyCount, encounterPopulationTarget, type EncounterActor } from './encounter-director.ts';
import { circleIntersectsSector, segmentDistanceSquared, hasLineOfSight } from './combat-geometry.ts';
import { refreshCharacter } from './character.ts';
import { createCharacterSheet, TIER_COLORS } from './items.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { addInventoryItem } from './inventory.ts';
import { damageEnemy, damagePlayer } from './combat-damage.ts';
import { awardKillRewards } from './combat-rewards.ts';
import { advanceEnemyStatuses } from './combat-status.ts';
import { scheduleGroundEffect, advanceGroundEffects, type ActiveGroundEffect } from './ground-effects.ts';
import { activateSkill } from './skill-combat.ts';
import { advanceProjectiles, MAX_PROJECTILES } from './projectile-combat.ts';
import type { GroundItem, SkillId } from './character-types.ts';
import type { EnemyRank } from './progression-content.ts';
import { enemyLootSeed, getZoneAt, scaledEnemyStats } from './zone-progression.ts';
import { CampPopulation, CAMP_POPULATION_RULES, type CampSpawnSource, type CampState } from './camp-population.ts';
import { sampleBiome } from './biomes.ts';
import { RoamingEncounters, ROAMING_GROUPS, roamingSpawnAnchor, shouldRetireRoamer } from './roaming-encounters.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { updateEnemyAI, type EnemyAIContext } from './enemy-ai.ts';

export const FIXED_STEP = COMBAT_TIMING.fixedStep;
export const HIT_FLASH_DURATION = COMBAT_TIMING.hitFlashDuration;
const TAU = Math.PI * 2;

export function initialPlayer(x: number, y: number): Player {
  const character = createCharacterSheet();
  return {
    character, derived: deriveCharacterStats(character), skillCooldowns: {}, activeSkill: null,
    nextAttackHand: 'main', guardTime: 0, dash: null,
    x, y, prevX: x, prevY: y, vx: 0, vy: 0, angle: 0,
    hp: PLAYER_DEFAULTS.maxHp, maxHp: PLAYER_DEFAULTS.maxHp, mana: PLAYER_DEFAULTS.maxMana, maxMana: PLAYER_DEFAULTS.maxMana,
    level: 1, xp: 0,
    stats: createBaseStats(), equipment: createStartingEquipment(),
    attack: null, dodgeTime: 0, dodgeAngle: 0, dodgeCharges: PLAYER_ABILITIES.dodge.charges, dodgeRecharge: 0,
    invulnerable: 0, flasks: PLAYER_ABILITIES.potion.charges, healCooldown: 0, castTime: 0, castDuration: 0,
    castAngle: 0, healFlash: 0, hitFlash: 0, hitAngle: 0, walkTime: 0, radius: PLAYER_DEFAULTS.radius, dead: false,
  };
}

export class Simulation {
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  groundItems: GroundItem[] = [];
  groundGold: GroundGold[] = [];
  groundEffects: ActiveGroundEffect[] = [];
  private lootNoticeAt = -10;
  private skillBuffer: { slot: number; until: number } | null = null;
  time = 0;
  kills = 0;
  readonly world: WorldQuery;
  private options: SimulationOptions;
  private randomState = 1;
  private accumulator = 0;
  private nextId = 1;
  private spawnOrdinal = 0;
  private events: CombatEvent[] = [];
  private attackBuffer = -1;
  private dodgeBuffer = -1;
  private healBuffer = -1;
  private hurtGuard = 0;
  private roaming = new RoamingEncounters();
  private campTimer = 0;
  private camps = new CampPopulation();
  private spawnExclusion: SpawnExclusion | null = null;
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
    this.groundEffects = [];
    this.pickups = [];
    this.groundItems = []; this.groundGold = []; this.lootNoticeAt = -10; this.skillBuffer = null;
    refreshCharacter(this.player);
    this.time = 0;
    this.kills = 0;
    this.accumulator = 0;
    this.nextId = 1;
    this.spawnOrdinal = 0; this.camps.reset(); this.campTimer = 0;
    this.events = [];
    this.randomState = this.options.seed! >>> 0;
    this.attackBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.hurtGuard = this.killRecharge = 0;
    this.spawnExclusion = null;
    this.roaming.reset(this.player.x, this.player.y);
  }

  captureCheckpoint(): CharacterCheckpoint {
    const p = this.player;
    return JSON.parse(JSON.stringify({ character: p.character, level: p.level, xp: p.xp,
      x: p.x, y: p.y, angle: p.angle, hp: p.hp, mana: p.mana, dead: p.dead,
      flasks: p.flasks, healCooldown: p.healCooldown, dodgeCharges: p.dodgeCharges, dodgeRecharge: p.dodgeRecharge,
      skillCooldowns: p.skillCooldowns, time: this.time, kills: this.kills,
      randomState: this.randomState, spawnOrdinal: this.spawnOrdinal, killRecharge: this.killRecharge,
      clearedCamps: this.camps.clearedIds(), defeatedCampMembers: this.camps.defeatedMembers(), groundItems: this.groundItems, groundGold: this.groundGold })) as CharacterCheckpoint;
  }

  /** Apply only a decoded checkpoint. Active encounters/attacks restart; character progress does not. */
  restoreCheckpoint(checkpoint: CharacterCheckpoint): void {
    this.reset();
    const saved = JSON.parse(JSON.stringify(checkpoint)) as CharacterCheckpoint;
    const p = this.player;
    Object.assign(p, { character: saved.character, level: saved.level, xp: saved.xp,
      x: saved.x, y: saved.y, angle: saved.angle, hp: saved.hp, mana: saved.mana, dead: saved.dead,
      flasks: saved.flasks, healCooldown: saved.healCooldown, dodgeCharges: saved.dodgeCharges,
      dodgeRecharge: saved.dodgeRecharge, skillCooldowns: saved.skillCooldowns });
    refreshCharacter(p);
    if (this.world.blocked(p.x, p.y, p.radius)) {
      let found = false;
      for (let r = 24; r <= 240 && !found; r += 24) for (let i = 0; i < 16 && !found; i++) {
        const x = saved.x + Math.cos(i * Math.PI / 8) * r, y = saved.y + Math.sin(i * Math.PI / 8) * r;
        if (!this.world.blocked(x, y, p.radius)) { p.x = x; p.y = y; found = true; }
      }
      if (!found) { p.x = this.options.startX!; p.y = this.options.startY!; }
    }
    p.prevX = p.x; p.prevY = p.y;
    this.time = saved.time; this.kills = saved.kills;
    this.randomState = saved.randomState; this.spawnOrdinal = saved.spawnOrdinal; this.killRecharge = saved.killRecharge;
    this.camps.restoreCleared(saved.clearedCamps); this.camps.restoreDefeated(saved.defeatedCampMembers); this.groundItems = saved.groundItems;
    this.groundGold = saved.groundGold ?? [];
    this.nextId = Math.max(1, ...saved.groundItems.map(item => item.id + 1), ...this.groundGold.map(pile => pile.id + 1));
    this.roaming.reset(p.x, p.y);
  }

  revive(): void {
    const saved = this.captureCheckpoint();
    saved.x = this.options.startX!; saved.y = this.options.startY!; saved.dead = false;
    saved.hp = this.player.maxHp; saved.mana = this.player.maxMana;
    saved.flasks = PLAYER_ABILITIES.potion.charges; saved.healCooldown = 0;
    saved.dodgeCharges = PLAYER_ABILITIES.dodge.charges; saved.dodgeRecharge = 0; saved.skillCooldowns = {};
    this.restoreCheckpoint(saved);
  }

  /** Automatic population waits for the camera's current/pending visible envelope. */
  setSpawnExclusion(bounds: { x: number; y: number; width: number; height: number } | null): void {
    this.spawnExclusion = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      && bounds.width > 0 && bounds.height > 0 ? { ...bounds } : null;
  }

  getCampState(id: string): CampState { return this.camps.getState(id); }

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
  spawnEnemy(kind: EnemyKind, x: number, y: number, rank: EnemyRank = 'normal', source?: CampSpawnSource): Enemy | null {
    const stats = ENEMY_DEFINITIONS[kind];
    if (this.world.isSanctuary?.(x, y)) return null;
    if (livingEnemyCount(this.enemies) >= ENCOUNTER_RULES.hardPopulationCap || this.world.blocked(x, y, stats.radius)) return null;
    const level = getZoneAt(x, y).level, scaled = scaledEnemyStats(kind, level, rank);
    const biome = (this.world.sampleBiome?.(x, y) ?? sampleBiome(x, y)).id;
    const lootSeed = source?.lootSeed ?? enemyLootSeed(this.options.seed!, ++this.spawnOrdinal, x, y);
    const enemy: Enemy = {
      id: this.nextId++, level, rank, biome, lootSeed, ...scaled,
      ...(source ? { campId: source.campId, campMemberId: source.memberId } : {}),
      x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, angle: 0, hp: scaled.maxHp,
      kind, state: 'idle', stateTime: 0, stateDuration: ENCOUNTER_RULES.initialIdleMin + this.random() * ENCOUNTER_RULES.initialIdleRange,
      attackAngle: 0, attackTargetX: x, attackTargetY: y, homeX: x, homeY: y, awareness: 0, lostSightTime: 0,
      lastSeenX: x, lastSeenY: y, senseTime: 0, seesPlayer: false, patrolPhase: (this.nextId * 2.399963) % TAU,
      hitFlash: 0, hitAngle: 0, radius: stats.radius, stagger: 0,
      attackHit: false, interrupted: false,
      slowTime: 0, slowFactor: 1, burnTime: 0, burnDps: 0, burnTick: 0,
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
    this.updateGroundEffects(dt);
    this.updatePickups(dt);
    this.groundGold = advanceGold(this.groundGold, this.player, this.world, dt, event => this.events.push(event));
    this.collectGroundItems();
    if (this.player.dead) {
      // A death may clear input midway through this tick; freeze its final poses.
      this.capturePositions();
      return;
    }
    this.updateSpawns(dt);
    this.enemies = this.enemies.filter(e => e.state !== 'dead' || e.stateTime < ENCOUNTER_RULES.corpseDuration);
    if (this.spawnExclusion) this.enemies = this.enemies.filter(enemy =>
      !shouldRetireRoamer(enemy, this.player, this.spawnExclusion!, this.roaming.heading));
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
    p.guardTime = Math.max(0, p.guardTime - dt);
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
    const direction = p.equipment.mainHand.attackKind !== 'melee' && input.rangedAim
      && Number.isFinite(input.rangedAim.x) && Number.isFinite(input.rangedAim.y) ? input.rangedAim : { x: input.aimX, y: input.aimY };
    if (direction.x !== p.x || direction.y !== p.y) p.angle = Math.atan2(direction.y - p.y, direction.x - p.x);
    if (this.healBuffer >= this.time && p.flasks > 0 && (p.hp < p.maxHp || p.mana < p.maxMana) && p.healCooldown <= 0) {
      const healed = Math.min(p.maxHp * PLAYER_ABILITIES.potion.lifeFraction, p.maxHp - p.hp);
      const mana = Math.min(p.maxMana * PLAYER_ABILITIES.potion.manaFraction, p.maxMana - p.mana);
      p.hp += healed; p.mana += mana;
      p.flasks--;
      p.healCooldown = PLAYER_ABILITIES.potion.cooldown * p.derived.cooldownMultiplier;
      p.healFlash = PLAYER_ABILITIES.potion.flashDuration;
      this.healBuffer = -1;
      this.events.push({ type: 'potion', x: p.x, y: p.y, life: healed, mana, color: '#a9bfea' });
    }

    if (p.attack) {
      const previousElapsed = p.attack.elapsed;
      // Let aim corrections steer anticipation, then lock the actual contact arc.
      if (p.attack.elapsed < p.attack.activeStart) p.attack.angle = p.angle;
      p.attack.elapsed += dt;
      if (p.attack.kind === 'melee' && p.attack.elapsed >= p.attack.activeStart && previousElapsed < p.attack.activeEnd) this.resolveMelee(p.attack, previousElapsed);
      if (p.attack.kind === 'ranged' && !p.attack.released && p.attack.elapsed >= p.attack.activeStart) {
        const attack = p.attack, style = attack.projectile?.style ?? 'arrow';
        const speed = style === 'arrow' ? 560 : 380;
        this.projectile(p.x, p.y, attack.angle,
          { owner: 'player', damage: attack.damage, speed, life: attack.range / speed, radius: style === 'arrow' ? 2 : 5 },
          undefined, attack.projectile);
        attack.released = true;
        this.events.push({ type: 'cast', x: p.x, y: p.y, angle: attack.angle, style });
      }
      if (p.attack.elapsed + 1e-9 >= p.attack.duration) {
        // Carry sub-tick recovery time so repeated swings keep the derived rate.
        completedAttackTime = Math.max(0, p.attack.elapsed - p.attack.duration);
        p.attack = null;
      }
    }
    p.castTime = Math.max(0, p.castTime - dt);
    if (!p.attack && !p.dash && p.castTime <= 0) p.activeSkill = null;

    const canCancel = (!p.attack || p.attack.elapsed >= p.attack.activeEnd) && p.castTime <= (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction);
    if (this.dodgeBuffer >= this.time && p.dodgeTime <= 0 && p.dodgeCharges > 0 && canCancel) {
      const moving = Math.hypot(input.moveX, input.moveY) > 0.01;
      p.dodgeAngle = moving ? Math.atan2(input.moveY, input.moveX) : p.angle;
      p.dodgeTime = PLAYER_ABILITIES.dodge.duration;
      p.dodgeCharges--;
      p.attack = null;
      p.dash = null;
      p.castTime = 0;
      this.dodgeBuffer = -1;
      this.events.push({ type: 'dodge', x: p.x, y: p.y, angle: p.dodgeAngle });
    }

    if (this.skillBuffer && this.skillBuffer.until >= this.time && activateSkill({
      player: p, world: this.world, enemies: this.enemies,
      aimX: input.aimX, aimY: input.aimY,
      damage: (enemy, amount, angle, melee) => this.damageEnemy(enemy, amount, angle, melee),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      projectile: (x, y, angle, definition, skill, effects) => this.projectile(x, y, angle, definition, skill, effects),
      schedule: effect => this.scheduleGroundEffect(effect),
      emit: event => this.events.push(event),
    }, this.skillBuffer.slot)) this.skillBuffer = null;

    if (p.dodgeTime <= 0 && p.castTime <= 0 && !p.dash && this.attackBuffer >= this.time && !p.attack) {
      this.startAttack(completedAttackTime);
      this.attackBuffer = -1;
    }

    let targetVX = 0;
    let targetVY = 0;
    if (p.dash) {
      const dash = p.dash, startX = p.x, startY = p.y, delta = Math.min(dt, dash.remaining);
      const steps = Math.max(1, Math.ceil(dash.speed * delta / 4));
      for (let i = 0; i < steps; i++) {
        const to = this.world.move(p.x, p.y, Math.cos(dash.angle) * dash.speed * delta / steps,
          Math.sin(dash.angle) * dash.speed * delta / steps, p.radius);
        p.x = to.x; p.y = to.y;
      }
      for (const enemy of this.enemies) if (enemy.state !== 'dead' && !dash.hitIds.has(enemy.id)
        && segmentDistanceSquared(enemy.x, enemy.y, startX, startY, p.x, p.y) <= (enemy.radius + dash.radius) ** 2
        && this.lineOfSight(p.x, p.y, enemy.x, enemy.y)) {
        dash.hitIds.add(enemy.id); this.damageEnemy(enemy, dash.damage, dash.angle, true);
      }
      dash.remaining = Math.max(0, dash.remaining - dt);
      p.walkTime += Math.hypot(p.x - startX, p.y - startY) / PLAYER_MOVEMENT.gaitDistance;
      p.vx = p.vy = 0;
      if (dash.remaining <= 0) p.dash = null;
    } else if (p.dodgeTime > 0) {
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
    const p = this.player, off = p.equipment.offHand;
    const dual = off?.kind === 'weapon' && p.equipment.mainHand.hands === 1;
    const hand = dual ? p.nextAttackHand : 'main';
    const weapon = hand === 'off' && off?.kind === 'weapon' ? off.weapon : p.equipment.mainHand;
    const stats = deriveAttackStats(p.stats, weapon);
    const duration = 1 / stats.attacksPerSecond;
    const ranged = weapon.attackKind !== 'melee';
    const style = weapon.attackKind === 'arrow' ? 'arrow' : weapon.damageType === 'physical' ? 'arcane' : weapon.damageType;
    this.player.attack = {
      kind: ranged ? 'ranged' : 'melee', weapon, hand,
      elapsed, duration, activeStart: duration * (ranged ? .42 : BASIC_ATTACK_PHASES.activeStart),
      activeEnd: duration * (ranged ? .5 : BASIC_ATTACK_PHASES.activeEnd), angle: this.player.angle,
      range: stats.range, arc: stats.arc, damage: stats.damage, hitIds: new Set<number>(),
      ...(ranged ? { projectile: { style, ...(style === 'frost' ? { slowFactor: .8, slowDuration: 1 } : {}) } } : {}),
    };
    p.nextAttackHand = hand === 'main' ? 'off' : 'main';
    if (!ranged) this.events.push({ type: 'swing', x: p.x, y: p.y, angle: p.angle });
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
    return hasLineOfSight(this.world, ax, ay, bx, by);
  }

  private damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean, periodic = false): void {
    damageEnemy(enemy, damage, angle, melee, {
      player: this.player, enemies: this.enemies, random: () => this.random(),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by), emit: event => this.events.push(event),
      killed: actor => {
        const reward = awardKillRewards(actor, this.kills, this.killRecharge, {
          player: this.player, groundGold: this.groundGold, groundItems: this.groundItems, pickups: this.pickups,
          nextId: () => this.nextId++, emit: event => this.events.push(event),
        });
        this.kills = reward.kills; this.killRecharge = reward.recharge;
      },
    }, periodic);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const context: EnemyAIContext = {
      player: p, enemies: this.enemies, world: this.world, time: this.time,
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      move: (actor, vx, vy, delta) => this.moveEnemy(actor, vx, vy, delta),
      hurt: (amount, angle, actor) => this.damagePlayer(amount, angle, actor.level, actor.kind),
      shoot: (actor, angle, definition, effects) => this.projectile(actor.x, actor.y, angle,
        definition, undefined, effects, actor.level, actor.kind),
      emit: event => this.events.push(event),
    };
    for (const enemy of this.enemies) {
      this.updateKnockback(enemy, dt);
      enemy.stateTime += dt;
      if (enemy.state === 'dead') continue;
      if (!advanceEnemyStatuses(enemy, dt,
        (actor, amount) => this.damageEnemy(actor, amount, 0, false, true))) continue;
      updateEnemyAI(enemy, dt, context);
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
    let destination = this.world.move(enemy.x, enemy.y, enemy.knockbackX * travel, enemy.knockbackY * travel, enemy.radius);
    if (this.world.isSanctuary?.(destination.x, destination.y)
      && !this.world.isSanctuary(enemy.x, enemy.y)) destination = { x: enemy.x, y: enemy.y };
    enemy.x = destination.x;
    enemy.y = destination.y;
    enemy.knockbackX *= decay;
    enemy.knockbackY *= decay;
    if (Math.hypot(enemy.knockbackX, enemy.knockbackY) < 0.4) enemy.knockbackX = enemy.knockbackY = 0;
  }

  private moveEnemy(enemy: Enemy, vx: number, vy: number, dt: number): void {
    vx *= enemy.slowFactor; vy *= enemy.slowFactor;
    let destination = this.world.move(enemy.x, enemy.y, vx * dt, vy * dt, enemy.radius);
    // Local steering lets pursuers slip around trunks without a pathfinding grid.
    const intendedDistance = Math.hypot(vx, vy) * dt;
    if ((enemy.state === 'chase' || enemy.state === 'return' || enemy.state === 'patrol' || enemy.state === 'recover') && intendedDistance > 0 && Math.hypot(destination.x - enemy.x, destination.y - enemy.y) < intendedDistance * 0.35) {
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

  private damagePlayer(amount: number, angle: number, sourceLevel: number, kind?: EnemyKind): void {
    if (!damagePlayer(amount, angle, sourceLevel, {
      player: this.player, world: this.world, random: () => this.random(), emit: event => this.events.push(event),
    }, kind)) return;
    this.hurtGuard = COMBAT_TIMING.hurtGuard;
    if (this.player.dead) this.clearInput();
  }

  private projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill?: SkillId, effects?: ProjectileEffects, sourceLevel = this.player.level, sourceKind?: EnemyKind): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const { speed, life, radius, damage, owner } = definition;
    this.projectiles.push({ id: this.nextId++, sourceLevel, sourceKind, x, y, prevX: x, prevY: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, radius, damage, life, maxLife: life, owner, skill,
      effects: effects ? { ...effects } : undefined, hitIds: new Set() });
  }

  private updateProjectiles(dt: number): void {
    advanceProjectiles(this.projectiles, dt, {
      player: this.player, enemies: this.enemies, world: this.world,
      damage: (enemy, amount, angle, melee) => this.damageEnemy(enemy, amount, angle, melee),
      hurt: (amount, angle, sourceLevel, sourceKind) => this.damagePlayer(amount, angle, sourceLevel, sourceKind),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      emit: event => this.events.push(event),
    });
    this.projectiles = this.projectiles.filter(projectile => projectile.life > 0);
  }

  private scheduleGroundEffect(effect: Omit<GroundEffect, 'id' | 'tick'>): void {
    scheduleGroundEffect(this.groundEffects, effect, {
      nextId: () => this.nextId++, emit: event => this.events.push(event),
    });
  }

  private updateGroundEffects(dt: number): void {
    this.groundEffects = advanceGroundEffects(this.groundEffects, dt, {
      enemies: this.enemies, visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      damage: (enemy, amount, angle, melee) => this.damageEnemy(enemy, amount, angle, melee),
      emit: event => this.events.push(event),
    });
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
        if (pickup.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * pickup.restoreFraction);
        else p.mana = Math.min(p.maxMana, p.mana + p.maxMana * pickup.restoreFraction);
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
          this.events.push({ type: 'notice', x: drop.x, y: drop.y, message: 'Inventory full · item left on the ground' });
          this.lootNoticeAt = this.time;
        }
        return true;
      }
      this.events.push({ type: 'loot', x: drop.x, y: drop.y, item: drop.item, color: TIER_COLORS[drop.item.tier] });
      return false;
    });
  }

  private updateSpawns(dt: number): void {
    const view = this.spawnExclusion;
    if (!this.options.spawn || !view) return;
    this.roaming.advance(this.player, dt);
    this.campTimer -= dt;
    if (this.campTimer <= 0 && this.world.getEnemyCamps) {
      this.campTimer = CAMP_POPULATION_RULES.updateInterval;
      const radius = Math.min(CAMP_POPULATION_RULES.maximumActivationDistance, Math.max(
        CAMP_POPULATION_RULES.activationDistance, Math.hypot(view.width, view.height) * .5 + 350));
      const camps = this.world.getEnemyCamps(this.player.x - radius, this.player.y - radius, radius * 2, radius * 2);
      this.camps.update(camps, this.player, this.enemies, this.world,
        (member, x, y, source) => this.spawnEnemy(member.kind, x, y, member.rank, source), radius, view);
    }
    if (this.world.isSanctuary?.(this.player.x, this.player.y) || !this.roaming.ready) return;
    this.roaming.resolved(this.spawnRoamingGroup(view), () => this.random());
  }

  private spawnRoamingGroup(view: SpawnExclusion): number {
    const living = this.enemies.filter(enemy => enemy.state !== 'dead');
    const roamingCount = living.filter(enemy => !enemy.campId).length;
    const room = Math.min(encounterPopulationTarget(getZoneAt(this.player.x, this.player.y).level) - roamingCount,
      ENCOUNTER_RULES.hardPopulationCap - living.length);
    if (room <= 0) return 0;
    const size = this.roaming.groupSize(room, this.random());
    for (let attempt = 0; attempt < ENCOUNTER_RULES.maxSpawnAttempts; attempt++) {
      const anchor = roamingSpawnAnchor(this.player, view, this.roaming.heading, () => this.random(), attempt);
      const members: Array<{ kind: EnemyKind; rank: EnemyRank; x: number; y: number }> = [];
      const population: EncounterActor[] = [...living];
      for (let index = 0; index < size; index++) {
        const angle = anchor.angle + index * 2.399963;
        const radius = index === 0 ? 0 : 65 + this.random() * 35;
        const x = anchor.x + Math.cos(angle) * radius, y = anchor.y + Math.sin(angle) * radius;
        const zone = getZoneAt(x, y), biome = (this.world.sampleBiome?.(x, y) ?? sampleBiome(x, y)).id;
        const preferred = index ? ROAMING_GROUPS[members[0].kind][index] : undefined;
        const kind = chooseEncounterEnemy(population, zone.level, biome, () => this.random(), preferred);
        if (!kind || !isSpawnHidden(x, y, view, ENEMY_DEFINITIONS[kind].radius)
          || this.world.isSanctuary?.(x, y)
          || this.world.blocked(x, y, ENEMY_DEFINITIONS[kind].radius + ENCOUNTER_RULES.spawnClearance)
          || this.world.getEnemyCamps?.(x - 60, y - 60, 120, 120)
            .some(camp => Math.hypot(camp.x - x, camp.y - y) < camp.radius + 60)
          || [...living, ...members].some(enemy => Math.hypot(enemy.x - x, enemy.y - y) < ENCOUNTER_RULES.minimumSeparation)) break;
        const rank = chooseEncounterRank(population, zone.level, this.random());
        members.push({ kind, rank, x, y }); population.push({ kind, rank, state: 'idle' });
      }
      if (members.length !== size) continue;
      // A loose encounter is validated together, so a single blocked member does
      // not scatter a half-formed group through several unrelated candidates.
      const created: Enemy[] = [], firstEvent = this.events.length;
      for (const member of members) {
        const enemy = this.spawnEnemy(member.kind, member.x, member.y, member.rank);
        if (enemy) {
          enemy.angle = anchor.angle + Math.PI + (this.random() - .5) * .9;
          created.push(enemy);
        }
      }
      if (created.length === members.length) return created.length;
      this.enemies = this.enemies.filter(enemy => !created.includes(enemy));
      this.events.splice(firstEvent);
    }
    return 0;
  }
}
