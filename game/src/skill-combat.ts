import type { CombatEvent, Enemy, GroundEffect, Player, ProjectileEffects, WorldQuery } from './model.ts';
import type { SkillId } from './character-types.ts';
import { skillWeapon, SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { deriveAttackStats } from './equipment.ts';
import { BASIC_ATTACK_PHASES, SKILL_CAST_MOTION, type ProjectileDefinition } from './combat-content.ts';
import { circleIntersectsSector } from './combat-geometry.ts';

export interface SkillContext {
  player: Player; world: WorldQuery; enemies: Enemy[]; aimX: number; aimY: number;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill: SkillId, effects?: ProjectileEffects): void;
  schedule(effect: Omit<GroundEffect, 'id' | 'tick'>): void;
  emit(event: CombatEvent): void;
}

const TAU = Math.PI * 2;
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
  const slow = (enemy: Enemy, duration: number, factor: number) => {
    if (enemy.state === 'dead') return;
    enemy.slowTime = Math.max(enemy.slowTime, duration);
    enemy.slowFactor = Math.min(enemy.slowFactor, factor);
  };
  const stun = (enemy: Enemy, duration: number) => {
    if (enemy.state === 'dead') return;
    enemy.stagger = Math.max(enemy.stagger, duration); enemy.interrupted = true;
  };
  const blast = (radius: number, style: 'physical' | 'frost' = 'physical') => context.emit({ type: 'blast', x: p.x, y: p.y,
    skill: id, color, radius, duration: .45, ...(style === 'frost' ? { style: 'frost' as const } : {}) });
  const missile = (effects: ProjectileEffects, speed: number, offset = 0, range = attack.range) => {
    context.projectile(p.x, p.y, p.angle + offset,
      { owner: 'player', speed, life: Math.max(.1, range / speed), radius: effects.style === 'arrow' ? 3 : 5, damage }, id, effects);
  };
  const aimedPoint = () => {
    const dx = context.aimX - p.x, dy = context.aimY - p.y, distance = Math.hypot(dx, dy);
    const angle = Number.isFinite(distance) && distance > 0 ? Math.atan2(dy, dx) : p.angle;
    const reach = Math.min(900, attack.range, Number.isFinite(distance) && distance > 0 ? distance : attack.range);
    // A ground marker stops before solid geometry rather than appearing through a wall.
    let result = { x: p.x, y: p.y };
    const steps = Math.max(1, Math.ceil(reach / 4));
    for (let step = 1; step <= steps; step++) {
      const t = reach * step / steps, x = p.x + Math.cos(angle) * t, y = p.y + Math.sin(angle) * t;
      if (context.world.blocked(x, y, 1)) break;
      result = { x, y };
    }
    return result;
  };

  p.mana -= definition.manaCost;
  p.skillCooldowns[id] = definition.cooldown * p.derived.cooldownMultiplier;
  p.activeSkill = id;
  if (id === 'cleave' || id === 'whirlwind') {
    const duration = 1 / attack.attacksPerSecond;
    p.attack = { kind: 'melee', weapon, hand: weapon === p.equipment.mainHand ? 'main' : 'off', elapsed: 0, duration,
      activeStart: duration * BASIC_ATTACK_PHASES.activeStart, activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd,
      angle: p.angle, range: attack.range * (id === 'whirlwind' ? 1.25 : 1.4),
      arc: id === 'whirlwind' ? TAU : Math.PI * 1.4, damage, hitIds: new Set() };
    context.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle, skill: id, color });
    if (id === 'whirlwind') blast(attack.range * 1.25);
    return true;
  }

  p.castTime = SKILL_CAST_MOTION.duration; p.castAngle = p.angle;
  switch (id) {
    case 'lunge':
      p.dash = { angle: p.angle, remaining: .24, speed: 520, damage, radius: 23, skill: id, hitIds: new Set() };
      p.castTime = .24;
      break;
    case 'earthshatter':
      radial(125, (enemy, angle) => { context.damage(enemy, damage, angle, true); stun(enemy, 1.2); });
      blast(125);
      break;
    case 'shieldBash':
      for (const enemy of living()) if (circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, 68, Math.PI * .7) && visible(enemy)) {
        context.damage(enemy, damage, p.angle, true); stun(enemy, 1.1);
      }
      break;
    case 'bulwark': p.guardTime = Math.max(p.guardTime, 3); break;
    case 'backstab': {
      const target = living().filter(enemy => circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, Math.max(48, attack.range * 1.25), Math.PI / 2) && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (target) {
        const behind = angularDistance(Math.atan2(p.y - target.y, p.x - target.x), target.angle) > Math.PI * .6;
        context.damage(target, damage * (behind ? 2 : 1), p.angle, true);
      }
      break;
    }
    case 'volley': for (const offset of [-.23, 0, .23]) missile({ style: 'arrow' }, 550, offset); break;
    case 'piercingShot': missile({ style: 'arrow', pierce: 3 }, 680); break;
    case 'ricochet': missile({ style: 'arrow', chain: 3, chainRange: 150 }, 530); break;
    case 'rainOfArrows': {
      const point = aimedPoint();
      context.schedule({ kind: 'arrowRain', ...point, radius: 92, delay: .4, duration: 1.2, interval: .3, damage, skill: id });
      break;
    }
    case 'fireball': missile({ style: 'fire', blastRadius: 85, burnDuration: 3, burnDps: damage * .12 }, 320); break;
    case 'frostLance': missile({ style: 'frost', pierce: 3, slowFactor: .5, slowDuration: 2.5 }, 440); break;
    case 'siphon': missile({ style: 'spirit', lifeSteal: .35 }, 350); break;
    case 'iceNova':
      radial(115, (enemy, angle) => { context.damage(enemy, damage, angle, false); slow(enemy, 2.5, .5); });
      blast(115, 'frost');
      break;
    case 'meteor': {
      const point = aimedPoint();
      context.schedule({ kind: 'meteor', ...point, radius: 125, delay: .85, duration: 0, interval: 1, damage, skill: id });
      break;
    }
    case 'arcLightning': {
      const point = aimedPoint(), hit = new Set<number>();
      let from = { x: p.x, y: p.y }, amount = damage;
      let next = living().filter(enemy => Math.hypot(enemy.x - p.x, enemy.y - p.y) <= attack.range + enemy.radius && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      for (let jump = 0; next && jump < 5; jump++) {
        const target = next;
        context.emit({ type: 'chain', x: from.x, y: from.y, toX: target.x, toY: target.y, skill: id, color, style: 'lightning', duration: .28 });
        context.damage(target, amount, Math.atan2(target.y - from.y, target.x - from.x), false);
        hit.add(target.id); from = { x: target.x, y: target.y }; amount *= .78;
        next = living().filter(enemy => !hit.has(enemy.id) && Math.hypot(enemy.x - from.x, enemy.y - from.y) <= 145 + enemy.radius
          && context.visible(from.x, from.y, enemy.x, enemy.y))
          .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      }
      break;
    }
  }
  context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.angle, skill: id, color });
  return true;
}
