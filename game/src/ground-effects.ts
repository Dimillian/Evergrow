import type { CombatEvent, Enemy, GroundEffect } from './model.ts';
import { GROUND_EFFECT_RULES, groundEffectPulseCount } from './skill-execution-content.ts';
import { applyBurn } from './combat-status.ts';


export type ActiveGroundEffect = GroundEffect & { pulsesLeft: number };
export type GroundEffectRequest = Omit<GroundEffect, 'id' | 'tick'>;
interface ScheduleContext { nextId(): number; emit(event: CombatEvent): void }
export interface GroundEffectContext {
  enemies: readonly Enemy[];
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean): void;
  emit(event: CombatEvent): void;
}

/** Copy the entire payload at release; later content/gear changes cannot rewrite a scheduled attack. */
export function scheduleGroundEffect(effects: ActiveGroundEffect[], effect: GroundEffectRequest, context: ScheduleContext): void {
  if (effects.length >= GROUND_EFFECT_RULES.maximum) return;
  effects.push({ ...effect, ...(effect.burn ? { burn: { ...effect.burn } } : {}), id: context.nextId(), tick: 0,
    pulsesLeft: groundEffectPulseCount(effect) });
  context.emit({ type: 'ground', x: effect.x, y: effect.y, radius: effect.radius,
    duration: effect.delay + effect.duration, style: effect.style, skill: effect.skill });
}

/** Fixed-tick delayed pulses, including the partial tick crossing the delay boundary. */
export function advanceGroundEffects(effects: ActiveGroundEffect[], dt: number, context: GroundEffectContext): ActiveGroundEffect[] {
  for (const effect of effects) {
    const beforeDelay = effect.delay;
    effect.delay -= dt;
    if (effect.delay > 0) continue;
    const activeDt = beforeDelay > 0 ? Math.max(0, dt - beforeDelay) : dt;
    effect.tick -= activeDt;
    if (effect.tick <= 1e-9) {
      for (const enemy of context.enemies) if (enemy.state !== 'dead'
        && Math.hypot(enemy.x - effect.x, enemy.y - effect.y) <= effect.radius + enemy.radius
        && context.visible(effect.x, effect.y, enemy.x, enemy.y)) {
        context.damage(enemy, effect.damage, Math.atan2(enemy.y - effect.y, enemy.x - effect.x), false);
        if (effect.burn) applyBurn(enemy, effect.burn);
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
