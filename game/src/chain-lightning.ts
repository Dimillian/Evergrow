import type { CombatEvent, Enemy, HitSnapshot, Player, ProjectileStyle } from './model.ts';
import type { SkillId } from './character-types.ts';
import { chainLifeOnHitMultiplier, type SkillExecution } from './skill-execution-content.ts';

export const CHAIN_FLIGHT_LIMIT = 24;
type ChainRecipe = Extract<SkillExecution, { kind: 'chain' }>;
export interface ChainFlight {
  x: number; y: number; toX: number; toY: number; targetId: number; remaining: number;
  damage: number; offense: HitSnapshot; recipe: ChainRecipe; skill: SkillId; color: string;
  contact: number; hitIds: Set<number>;
}
export interface ChainContext {
  player: Player; enemies: readonly Enemy[];
  onScreen(enemy: Enemy): boolean;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot): void;
  emit(event: CombatEvent): void;
}
export function chainTravelTime(distance: number, recipe: ChainRecipe): number {
  return Math.max(.09, Math.min(.3, distance / recipe.travelSpeed + .055));
}
function launch(flight: ChainFlight, target: Enemy, context: ChainContext): void {
  flight.targetId = target.id; flight.toX = target.x; flight.toY = target.y;
  flight.remaining = chainTravelTime(Math.hypot(target.x - flight.x, target.y - flight.y), flight.recipe);
  context.emit({ type: 'chain', x: flight.x, y: flight.y, toX: target.x, toY: target.y,
    chainTargetId: target.id, travelDuration: flight.remaining, duration: flight.recipe.duration,
    style: flight.recipe.style, skill: flight.skill, color: flight.color });
}
/** Paid casts snapshot their offense once. Each subsequent target is selected only after arrival. */
export function startChain(flights: ChainFlight[], from: { x: number; y: number }, target: Enemy,
  damage: number, offense: HitSnapshot, recipe: ChainRecipe, skill: SkillId, color: string, context: ChainContext): void {
  const flight: ChainFlight = { ...from, toX: target.x, toY: target.y, targetId: target.id, remaining: 0,
    damage, offense: { ...offense }, recipe: { ...recipe }, skill, color, contact: 0, hitIds: new Set() };
  launch(flight, target, context); flights.push(flight);
}
/** No timers or closures over old actors: death, travel and reset discard transient flights. */
export function advanceChains(flights: ChainFlight[], dt: number, context: ChainContext): void {
  if (context.player.dead) { flights.length = 0; return; }
  for (let i = flights.length - 1; i >= 0; i--) {
    const flight = flights[i]; flight.remaining -= dt;
    if (flight.remaining > 1e-9) continue;
    const target = context.enemies.find(enemy => enemy.id === flight.targetId);
    // A dead target still conducts from its last position, without granting a second hit/reward.
    if (target) { flight.toX = target.x; flight.toY = target.y; }
    if (!context.visible(flight.x, flight.y, flight.toX, flight.toY)) { flights.splice(i, 1); continue; }
    if (target && target.state !== 'dead') {
      context.damage(target, flight.damage, Math.atan2(target.y - flight.y, target.x - flight.x), false,
        flight.recipe.style, undefined, { ...flight.offense,
          lifeOnHit: flight.offense.lifeOnHit * chainLifeOnHitMultiplier(flight.contact, flight.hitIds.has(target.id)) });
    }
    flight.hitIds.add(flight.targetId); flight.contact++;
    flight.x = flight.toX; flight.y = flight.toY; flight.damage *= flight.recipe.falloff;
    if (flight.contact >= flight.recipe.jumps) { flights.splice(i, 1); continue; }
    let next: Enemy | undefined, nearest = Infinity;
    for (const enemy of context.enemies) {
      const distance = Math.hypot(enemy.x - flight.x, enemy.y - flight.y);
      if (enemy.state === 'dead' || enemy.id === flight.targetId || (!flight.recipe.revisit && flight.hitIds.has(enemy.id))
        || distance > flight.recipe.range + enemy.radius || distance >= nearest || !context.onScreen(enemy)
        || !context.visible(flight.x, flight.y, enemy.x, enemy.y)) continue;
      next = enemy; nearest = distance;
    }
    if (next) launch(flight, next, context); else flights.splice(i, 1);
  }
}
