import type { CombatEvent, Enemy, GroundEffect, Player } from './model.ts';
import { GROUND_EFFECT_RULES, groundEffectPulseCount } from './skill-execution-content.ts';
import { applyBurn, applySlow, applyStun } from './combat-status.ts';


export type ActiveGroundEffect = GroundEffect & { pulsesLeft: number };
export type GroundEffectRequest = Omit<GroundEffect, 'id' | 'tick'>;
interface ScheduleContext { nextId(): number; emit(event: CombatEvent): void }
export interface GroundEffectContext {
  player: Player;
  enemies: readonly Enemy[];
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  emit(event: CombatEvent): void;
}

/** Copy the entire payload at release; later content/gear changes cannot rewrite a scheduled attack. */
export function scheduleGroundEffect(effects: ActiveGroundEffect[], effect: GroundEffectRequest, context: ScheduleContext): void {
  if (effects.length >= GROUND_EFFECT_RULES.maximum) return;
  effects.push({ ...effect, ...(effect.burn ? { burn: { ...effect.burn } } : {}), ...(effect.slow ? { slow: { ...effect.slow } } : {}), id: context.nextId(), tick: 0,
    pulsesLeft: groundEffectPulseCount(effect) });
  context.emit({ type: 'ground', x: effect.x, y: effect.y, radius: effect.radius,
    duration: effect.delay + (effect.follow ? 0 : effect.duration), style: effect.style, skill: effect.skill });
}

/** Fixed-tick delayed pulses, including the partial tick crossing the delay boundary. */
export function advanceGroundEffects(effects: ActiveGroundEffect[], dt: number, context: GroundEffectContext): ActiveGroundEffect[] {
  for (const effect of effects) {
    if (effect.follow) {
      const p = context.player;
      if (p.dead || p.equipment.mainHand.attackKind !== 'bolt') { effect.pulsesLeft = 0; continue; }
      effect.x = p.x; effect.y = p.y;
    }
    const beforeDelay = effect.delay;
    effect.delay -= dt;
    if (effect.delay > 0) continue;
    const activeDt = beforeDelay > 0 ? Math.max(0, dt - beforeDelay) : dt;
    effect.tick -= activeDt;
    if (effect.tick <= 1e-9) {
      if (effect.upkeep) {
        const p = context.player;
        const cost = effect.upkeep * effect.interval;
        if (p.dead || p.mana < cost) { effect.pulsesLeft = 0; continue; }
        p.mana -= cost;
      }
      for (const enemy of context.enemies) if (enemy.state !== 'dead'
        && Math.hypot(enemy.x - effect.x, enemy.y - effect.y) <= effect.radius + enemy.radius
        && context.visible(effect.x, effect.y, enemy.x, enemy.y)) {
        context.damage(enemy, effect.damage, Math.atan2(enemy.y - effect.y, enemy.x - effect.x), false);
        if (effect.burn) applyBurn(enemy, effect.burn);
        if (effect.slow) applySlow(enemy, effect.slow);
        if (effect.stun) applyStun(enemy, effect.stun * (enemy.rank === 'elite' ? .2 : 1));
        if (effect.style === 'lightning') context.emit({ type: 'chain', x: effect.x, y: effect.y, toX: enemy.x, toY: enemy.y, style: effect.style, skill: effect.skill });
      }
      context.emit({ type: 'blast', x: effect.x, y: effect.y, radius: effect.radius,
        style: effect.style, skill: effect.skill });
      effect.tick += Math.max(GROUND_EFFECT_RULES.minimumInterval, effect.interval);
      effect.pulsesLeft--;
    }
    effect.duration -= activeDt;
  }
  return effects.filter(effect => effect.pulsesLeft > 0);
}
