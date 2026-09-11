import { projectileDamageType } from './resistance-content.ts';
import { metric } from './chronicle.ts';
import { primeSpellweave, primeAfterguard, effectiveArmor } from './affix-combat.ts';
import { applyElementalContact, applyStun } from './combat-status.ts';
import { enemyThreat } from './enemy-threat.ts';
import type { HitSnapshot, CombatEvent, Enemy, EnemyKind, Player, ProjectileStyle, WorldQuery, DamageType } from './model.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { armorReduction } from './progression-content.ts';
import { alertEnemy, transitionEnemy, interruptStaggeredEnemy } from './enemy-state.ts';

export interface EnemyDamageContext {
  player: Player; enemies: readonly Enemy[];
  random(): number; visible(ax: number, ay: number, bx: number, by: number): boolean;
  emit(event: CombatEvent): void; killed(enemy: Enemy): void;
}
export interface PlayerDamageContext {
  player: Player; world: Pick<WorldQuery, 'isSanctuary'>;
  random(): number; emit(event: CombatEvent): void;
}

/** One contact owner: damage, awareness, impulse, interruption and death commitment. */
export function damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean,
  context: EnemyDamageContext, periodic = false, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot, authoredBurn = false): void {
  if (enemy.state === 'dead') return;
  if (!periodic) {
    alertEnemy(enemy, context.player);
    // A camp shares danger only with nearby members who can see the struck ally.
    if (enemy.campId) for (const ally of context.enemies) if (ally !== enemy && ally.campId === enemy.campId
      && ally.state !== 'dead' && Math.hypot(ally.x - enemy.x, ally.y - enemy.y) < 190
      && context.visible(ally.x, ally.y, enemy.x, enemy.y)) alertEnemy(ally, context.player);
  }
  // Contact status uses the elemental portion, never physical damage or recursive burn ticks.
  const statusDamage = elementalDamage ?? (style === 'fire' || style === 'frost' || style === 'lightning' ? damage : 0);
  if (!periodic) primeSpellweave(context.player, melee, style);
  if (!periodic && !(style === 'fire' && authoredBurn)) applyElementalContact(enemy, style, statusDamage);
  const elementFraction=style && projectileDamageType(style)==='arcane'?1:Math.min(1,Math.max(0,statusDamage/Math.max(1,damage)));
  const hitStats = offense ?? context.player.derived;
  const critical = !periodic && hitStats.critChance > 0 && context.random() < hitStats.critChance;
  damage = Math.max(1, Math.round(damage * (critical ? hitStats.critMultiplier : 1)));
  const actualValue = Math.min(enemy.hp, damage);
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (!periodic && !context.player.dead) metric(context.player.chronicle,'healing',Math.min(context.player.maxHp-context.player.hp,hitStats.lifeOnHit));
  if (!periodic && !context.player.dead) context.player.hp = Math.min(context.player.maxHp, context.player.hp + hitStats.lifeOnHit);
  enemy.hitFlash = COMBAT_TIMING.hitFlashDuration;
  enemy.hitAngle = angle;
  const definition = ENEMY_DEFINITIONS[enemy.kind];
  const shove = definition.knockbackDistance * enemyThreat(enemy).knockback;
  if (!periodic) {
    enemy.knockbackX += Math.cos(angle) * shove / COMBAT_TIMING.knockbackDecay;
    enemy.knockbackY += Math.sin(angle) * shove / COMBAT_TIMING.knockbackDecay;
  }
  context.emit({ ...(style ? { style } : {}), type: 'hit', actualValue, elementalValue:actualValue*elementFraction, melee, periodic, ...(offense?.skill?{skill:offense.skill}:{}), x: enemy.x, y: enemy.y, angle, value: damage,
    targetId: enemy.id, remainingHp: enemy.hp, enemyKind: enemy.kind, heavy: critical });
  if (enemy.hp <= 0) {
    transitionEnemy(enemy, 'dead', ENCOUNTER_RULES.corpseDuration);
    context.killed(enemy);
    context.emit({ ...(style ? { style } : {}), type: 'kill', x: enemy.x, y: enemy.y, angle, facing: enemy.angle,
      targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind });
  } else if (definition.interruptible && melee) {
    applyStun(enemy, COMBAT_TIMING.staggerDuration, 'stagger');
    interruptStaggeredEnemy(enemy);
  }
}

/** Returns whether damage landed; the clock owner handles input/fixed-step cancellation. */
export function damagePlayer(amount: number, angle: number, sourceLevel: number, damageType: DamageType, context: PlayerDamageContext, kind?: EnemyKind): boolean {
  const p = context.player;
  if (p.dead || p.invulnerable > 0 || context.world.isSanctuary?.(p.x, p.y)) return false;
  const reduction = damageType === 'physical' ? armorReduction(effectiveArmor(p), sourceLevel) : p.derived.resistances[damageType];
  amount = Math.max(1, Math.round(amount * (1 - reduction)));
  if (p.equipment.offHand?.kind === 'shield' && (p.guardTime > 0 || context.random() < p.derived.blockChance)) {
    const reduction = p.guardTime > 0 ? Math.max(p.guardReduction, p.derived.blockReduction) : p.derived.blockReduction;
    const blocked = Math.floor(amount * reduction);
    amount = Math.max(1, amount - blocked);
    primeAfterguard(p);
    context.emit({ type: 'block', x: p.x, y: p.y, angle, value: blocked, color: '#a9daca' });
  }
  const actualValue = Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - amount);
  p.hitFlash = COMBAT_TIMING.hitFlashDuration;
  p.hitAngle = angle;
  p.invulnerable = COMBAT_TIMING.hurtGuard;
  context.emit({ type: 'hurt', ...(damageType === 'physical' ? {} : { style: damageType }), actualValue, x: p.x, y: p.y, angle, value: amount,
    remainingHp: p.hp, enemyKind: kind, heavy: amount >= 20 });
  if (p.hp <= 0) {
    p.dead = true; p.affixBuffs = undefined;
    p.attack = null;
    p.dash = null; p.guardTime = 0;
    p.castTime = p.dodgeTime = 0;
    p.vx = p.vy = 0;
  }
  return true;
}
