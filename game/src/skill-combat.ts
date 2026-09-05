import type { CombatEvent, Enemy, GroundEffect, Player, ProjectileEffects, WorldQuery } from './model.ts';
import type { SkillId } from './character-types.ts';
import { skillWeapon, SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { deriveAttackStats } from './equipment.ts';
import { BASIC_ATTACK_PHASES, SKILL_CAST_MOTION, type ProjectileDefinition } from './combat-content.ts';
import { SKILL_EXECUTION, SKILL_TARGETING, type SkillExecution } from './skill-execution-content.ts';
import { applySlow, applyStun } from './combat-status.ts';
import { circleIntersectsSector } from './combat-geometry.ts';

export interface SkillContext {
  player: Player; world: WorldQuery; enemies: Enemy[]; aimX: number; aimY: number;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill: SkillId, effects?: ProjectileEffects): void;
  schedule(effect: Omit<GroundEffect, 'id' | 'tick'>): void;
  emit(event: CombatEvent): void;
}

const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Rules and effects for every active skill; simulation owns collision, damage and effect timing. */
export function activateSkill(context: SkillContext, slot: number): boolean {
  const { player: p, enemies } = context;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5 || p.dead || p.attack || p.dash || p.dodgeTime > 0 || p.castTime > 0) return false;
  const id = p.character.skillSlots[slot];
  if (!id || !unlockedSkills(p.character.allocatedNodes).includes(id)) return false;
  const weapon = skillWeapon(id, p.equipment);
  if (!weapon) return false;
  const definition = SKILL_DEFINITIONS[id];
  const recipe: SkillExecution = SKILL_EXECUTION[id];
  if ((p.skillCooldowns[id] ?? 0) > 0 || p.mana < definition.manaCost) return false;

  const attack = deriveAttackStats(p.stats, weapon);
  // Staff weapon derivation already applies spell bonuses; applying them here again would square scaling.
  const damage = attack.damage * definition.damageMultiplier;
  const color = definition.color;
  const living = () => enemies.filter(enemy => enemy.state !== 'dead');
  const visible = (enemy: Enemy) => context.visible(p.x, p.y, enemy.x, enemy.y);
  const radial = (radius: number, hit: (enemy: Enemy, angle: number) => void) => {
    for (const enemy of living()) if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= radius + enemy.radius && visible(enemy)) {
      hit(enemy, Math.atan2(enemy.y - p.y, enemy.x - p.x));
    }
  };
  const blast = (radius: number, style?: ProjectileEffects['style']) => context.emit({ type: 'blast', x: p.x, y: p.y,
    skill: id, color, radius, duration: SKILL_TARGETING.blastDuration, ...(style ? { style } : {}) });
  const aimedPoint = () => {
    const dx = context.aimX - p.x, dy = context.aimY - p.y, distance = Math.hypot(dx, dy);
    const angle = Number.isFinite(distance) && distance > 0 ? Math.atan2(dy, dx) : p.angle;
    const reach = Math.min(SKILL_TARGETING.maximumRange, attack.range, Number.isFinite(distance) && distance > 0 ? distance : attack.range);
    // A ground marker stops before solid geometry rather than appearing through a wall.
    let result = { x: p.x, y: p.y };
    const steps = Math.max(1, Math.ceil(reach / SKILL_TARGETING.probeStep));
    for (let step = 1; step <= steps; step++) {
      const t = reach * step / steps, x = p.x + Math.cos(angle) * t, y = p.y + Math.sin(angle) * t;
      if (context.world.blocked(x, y, SKILL_TARGETING.probeRadius)) break;
      result = { x, y };
    }
    return result;
  };

  p.mana -= definition.manaCost;
  p.skillCooldowns[id] = definition.cooldown * p.derived.cooldownMultiplier;
  p.activeSkill = id;
  if (recipe.kind === 'sweep') {
    const duration = 1 / attack.attacksPerSecond;
    p.attack = { kind: 'melee', weapon, hand: weapon === p.equipment.mainHand ? 'main' : 'off', elapsed: 0, duration,
      activeStart: duration * BASIC_ATTACK_PHASES.activeStart, activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd,
      angle: p.angle, range: attack.range * recipe.reachMultiplier,
      arc: recipe.arc, damage, hitIds: new Set() };
    context.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle, skill: id, color });
    if (recipe.blast) blast(attack.range * recipe.reachMultiplier);
    return true;
  }

  p.castTime = SKILL_CAST_MOTION.duration; p.castAngle = p.angle;
  switch (recipe.kind) {
    case 'dash':
      p.dash = { angle: p.angle, remaining: recipe.duration, speed: recipe.speed, damage, radius: recipe.radius, skill: id, hitIds: new Set() };
      p.castTime = recipe.duration;
      break;
    case 'radial':
      radial(recipe.radius, (enemy, angle) => {
        context.damage(enemy, damage, angle, recipe.melee);
        if (recipe.stun) applyStun(enemy, recipe.stun);
        if (recipe.slow) applySlow(enemy, recipe.slow);
      });
      blast(recipe.radius, recipe.style);
      break;
    case 'cone':
      for (const enemy of living()) if (circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, recipe.radius, recipe.arc) && visible(enemy)) {
        context.damage(enemy, damage, p.angle, true); applyStun(enemy, recipe.stun);
      }
      break;
    case 'guard': p.guardTime = Math.max(p.guardTime, recipe.duration); break;
    case 'backstab': {
      const target = living().filter(enemy => circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, Math.max(recipe.minRange, attack.range * recipe.reachMultiplier), recipe.arc) && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (target) {
        const behind = angularDistance(Math.atan2(p.y - target.y, p.x - target.x), target.angle) > recipe.rearAngle;
        context.damage(target, damage * (behind ? recipe.rearMultiplier : 1), p.angle, true);
      }
      break;
    }
    case 'projectile': {
      const { burnDamageMultiplier, ...payload } = recipe.effects;
      const effects: ProjectileEffects = { ...payload,
        ...(burnDamageMultiplier !== undefined ? { burnDps: damage * burnDamageMultiplier } : {}) };
      for (const offset of recipe.offsets) context.projectile(p.x, p.y, p.angle + offset,
        { owner: 'player', speed: recipe.speed, life: Math.max(SKILL_TARGETING.minimumProjectileLife, attack.range / recipe.speed),
          radius: recipe.radius, damage }, id, effects);
      break;
    }
    case 'ground': {
      const point = aimedPoint();
      context.schedule({ kind: recipe.effect, ...point, radius: recipe.radius, delay: recipe.delay,
        duration: recipe.duration, interval: recipe.interval, damage, skill: id, style: recipe.style,
        ...(recipe.burn ? { burn: { duration: recipe.burn.duration, dps: damage * recipe.burn.damageMultiplier } } : {}) });
      break;
    }
    case 'chain': {
      const point = aimedPoint(), hit = new Set<number>();
      let from = { x: p.x, y: p.y }, amount = damage;
      let next = living().filter(enemy => Math.hypot(enemy.x - p.x, enemy.y - p.y) <= attack.range + enemy.radius && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      for (let jump = 0; next && jump < recipe.jumps; jump++) {
        const target = next;
        context.emit({ type: 'chain', x: from.x, y: from.y, toX: target.x, toY: target.y, skill: id, color, style: recipe.style, duration: recipe.duration });
        context.damage(target, amount, Math.atan2(target.y - from.y, target.x - from.x), false);
        hit.add(target.id); from = { x: target.x, y: target.y }; amount *= recipe.falloff;
        next = living().filter(enemy => !hit.has(enemy.id) && Math.hypot(enemy.x - from.x, enemy.y - from.y) <= recipe.range + enemy.radius
          && context.visible(from.x, from.y, enemy.x, enemy.y))
          .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      }
      break;
    }
    default: {
      // A new skill must implement behavior before its content can compile.
      const unimplemented: never = recipe;
      throw new Error(`Missing skill execution handler: ${unimplemented}`);
    }
  }
  context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.angle, skill: id, color });
  return true;
}
