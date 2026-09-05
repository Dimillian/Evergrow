import type { CombatEvent, Enemy, Player, WorldQuery } from './model.ts';
import type { SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { deriveAttackStats } from './equipment.ts';
import { BASIC_ATTACK_PHASES, SKILL_CAST_MOTION, SKILL_PROJECTILE_MOTION, type ProjectileDefinition } from './combat-content.ts';
import { segmentDistanceSquared } from './combat-geometry.ts';

interface SkillContext {
  player: Player; world: WorldQuery; enemies: Enemy[];
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill: SkillId): void;
  emit(event: CombatEvent): void;
}

/** Rules and effects for every unlockable active skill; simulation owns timing and collision. */
export function activateSkill(context: SkillContext, slot: number): boolean {
  const { player: p, world, enemies } = context;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5 || p.dead || p.attack || p.dodgeTime > 0 || p.castTime > 0) return false;
  const id = p.character.skillSlots[slot];
  if (!id || !unlockedSkills(p.character.allocatedNodes).includes(id)) return false;
  const definition = SKILL_DEFINITIONS[id];
  if ((p.skillCooldowns[id] ?? 0) > 0 || p.mana < definition.manaCost) return false;
  p.mana -= definition.manaCost;
  p.skillCooldowns[id] = definition.cooldown * p.derived.cooldownMultiplier;
  p.activeSkill = id;
  const attack = deriveAttackStats(p.stats, p.equipment.mainHand);
  const damage = attack.damage * definition.damageMultiplier;
  if (id === 'cleave') {
    const duration = 1 / attack.attacksPerSecond;
    p.attack = { elapsed: 0, duration, activeStart: duration * BASIC_ATTACK_PHASES.activeStart,
      activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd, angle: p.angle, range: attack.range * 1.4,
      arc: Math.PI * 1.4, damage, hitIds: new Set() };
    context.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle, skill: id, color: definition.color });
  } else {
    p.castTime = SKILL_CAST_MOTION.duration; p.castAngle = p.angle;
    if (id === 'lunge') {
      const start = { x: p.x, y: p.y };
      // Swept, collision-resolved movement: never teleport through a wall.
      for (let i = 0; i < 24; i++) {
        const next = world.move(p.x, p.y, Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, p.radius);
        p.x = next.x; p.y = next.y;
      }
      for (const enemy of enemies) if (enemy.state !== 'dead'
        && segmentDistanceSquared(enemy.x, enemy.y, start.x, start.y, p.x, p.y) <= (enemy.radius + 23) ** 2
        && context.visible(p.x, p.y, enemy.x, enemy.y)) context.damage(enemy, damage, p.angle, true);
    } else if (id === 'nova') {
      for (const enemy of enemies) if (enemy.state !== 'dead'
        && Math.hypot(enemy.x - p.x, enemy.y - p.y) <= 115 + enemy.radius
        && context.visible(p.x, p.y, enemy.x, enemy.y)) {
        context.damage(enemy, damage * p.derived.spellDamageMultiplier, Math.atan2(enemy.y - p.y, enemy.x - p.x), false);
      }
    } else {
      for (const offset of id === 'volley' ? [-.23, 0, .23] : [0]) context.projectile(p.x, p.y, p.angle + offset,
        { ...SKILL_PROJECTILE_MOTION, owner: 'player', damage: damage * (id === 'volley' ? 1 : p.derived.spellDamageMultiplier) }, id);
    }
    context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.angle, skill: id, color: definition.color });
  }
  return true;
}
