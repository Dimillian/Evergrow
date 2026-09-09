import { metric } from './chronicle.ts';
import { skillWeapon } from './skill-content.ts';
import type { ProjectileStyle, HitSnapshot } from './model.ts';
import { strikeContainers, type ContainerAttackContext } from './breakable-containers.ts';
import type { CombatEvent, Enemy, GroundEffect, Player } from './model.ts';
import { GROUND_EFFECT_RULES, groundEffectPulseCount } from './skill-execution-content.ts';
import { applyBurn, applySlow, applyStun } from './combat-status.ts';


export type ActiveGroundEffect = GroundEffect & { pulsesLeft: number; initialDelay?: number };
export type GroundEffectRequest = Omit<GroundEffect, 'id' | 'tick'>;
interface ScheduleContext { nextId(): number; emit(event: CombatEvent): void }
export interface GroundEffectContext {
  containers?: ContainerAttackContext;
  player: Player;
  enemies: readonly Enemy[];
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean, style?: ProjectileStyle, periodic?: boolean, offense?: HitSnapshot): void;
  emit(event: CombatEvent): void;
}

/** Copy the entire payload at release; later content/gear changes cannot rewrite a scheduled attack. */
export function scheduleGroundEffect(effects: ActiveGroundEffect[], effect: GroundEffectRequest, context: ScheduleContext): void {
  if (effects.length >= GROUND_EFFECT_RULES.maximum) return;
  effects.push({ ...effect, ...(effect.offense ? { offense: { ...effect.offense } } : {}), initialDelay: effect.delay,
    ...(effect.scorch ? { scorch: { ...effect.scorch } } : {}), ...(effect.burn ? { burn: { ...effect.burn } } : {}), ...(effect.slow ? { slow: { ...effect.slow } } : {}), id: context.nextId(), tick: 0,
    pulsesLeft: groundEffectPulseCount(effect) });
  context.emit({ type: 'ground', x: effect.x, y: effect.y, radius: effect.radius,
    duration: effect.delay + (effect.follow ? 0 : effect.duration), style: effect.style, skill: effect.skill });
}

/** Fixed-tick delayed pulses, including the partial tick crossing the delay boundary. */
export function advanceGroundEffects(effects: ActiveGroundEffect[], dt: number, context: GroundEffectContext): ActiveGroundEffect[] {
  for (const effect of effects) {
    const p = context.player;
    if (effect.kind === 'storm' && (p.dead || !skillWeapon(effect.skill, p.equipment))) {
      effect.pulsesLeft = 0;
      context.emit({ type: 'notice', x: p.x, y: p.y, message: p.dead ? 'Storm ended.' : 'Storm ended: casting weapon removed.' });
      continue;
    }
    if (effect.follow) { effect.x = p.x; effect.y = p.y; }
    const beforeDelay = effect.delay;
    effect.delay -= dt;
    if (effect.delay > 1e-9) continue;
    const activeDt = beforeDelay > 0 ? Math.max(0, dt - beforeDelay) : dt;
    effect.tick -= activeDt;
    if (effect.tick <= 1e-9 && effect.pulsesLeft > 0) {
      if (effect.upkeep) {
        const p = context.player;
        const cost = effect.upkeep * effect.interval;
        if (p.dead || p.mana < cost) {
          effect.pulsesLeft = 0;
          context.emit({ type: 'notice', x: p.x, y: p.y, message: p.dead ? 'Storm ended.' : 'Storm ended: insufficient mana.' });
          continue;
        }
        p.mana -= cost; metric(p.chronicle, 'manaSpent', cost);
      }
      if (effect.damage > 0) strikeContainers(context.containers, effect.x, effect.y, effect.radius);
      for (const enemy of context.enemies) if (enemy.state !== 'dead'
        && Math.hypot(enemy.x - effect.x, enemy.y - effect.y) <= effect.radius + enemy.radius
        && context.visible(effect.x, effect.y, enemy.x, enemy.y)) {
        if (effect.damage > 0) context.damage(enemy, effect.damage, Math.atan2(enemy.y - effect.y, enemy.x - effect.x), false, effect.style, effect.kind === 'embers', effect.offense);
        if (effect.burn) applyBurn(enemy, effect.burn);
        if (effect.slow) applySlow(enemy, effect.slow);
        if (effect.stun) applyStun(enemy, effect.stun * (enemy.rank === 'elite' ? .2 : 1), effect.style === 'frost' ? 'freeze' : 'stun');
        if (effect.style === 'lightning') context.emit({ type: 'chain', x: effect.x, y: effect.y, toX: enemy.x, toY: enemy.y, style: effect.style, skill: effect.skill });
      }
      if (effect.damage > 0) context.emit({ type: 'blast', groundKind: effect.kind, x: effect.x, y: effect.y, radius: effect.radius,
        style: effect.style, skill: effect.skill });
      effect.tick += Math.max(GROUND_EFFECT_RULES.minimumInterval, effect.interval);
      effect.pulsesLeft--;
      if (effect.pulsesLeft === 0 && effect.scorch) {
        // Reuse the reserved area slot: an impact cannot lose its aftermath at capacity.
        const scorch = effect.scorch;
        effect.kind = 'embers'; effect.damage = 0;
        effect.duration = scorch.duration;
        effect.interval = Math.max(GROUND_EFFECT_RULES.minimumInterval, scorch.interval);
        effect.tick = effect.interval;
        effect.burn = { duration: effect.interval * 2, dps: scorch.dps };
        effect.slow = undefined; effect.stun = undefined; effect.scorch = undefined;
        effect.pulsesLeft = groundEffectPulseCount(effect);
        continue;
      }
    }
    effect.duration -= activeDt;
  }
  return effects.filter(effect => effect.pulsesLeft > 0 || (effect.kind === 'embers' && effect.damage === 0 && effect.duration > 1e-9));
}
