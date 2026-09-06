import type { Enemy, EnemyKind, Player } from './model.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { isEnemyInactive, isSpawnHidden, SPAWN_VISIBILITY_MARGIN, type SpawnExclusion } from './spawn-visibility.ts';

export const ROAMING_RULES = Object.freeze({
  warmupPopulation: 9, warmupInterval: .65, retryInterval: .45,
  minInterval: 2.2, maxInterval: 3.8, minTravel: 180, maxTravel: 280,
  minimumDistance: 300, leadMin: 30, leadMax: 90, groupRadius: 100, corridorHalfWidth: 140,
  retirementMargin: 650, behindDistance: 430, behindProjection: -220,
});
export const ROAMING_GROUPS: Readonly<Partial<Record<EnemyKind, readonly EnemyKind[]>>> = Object.freeze({
  stalker: Object.freeze(['stalker', 'stalker', 'hound'] as const),
  hound: Object.freeze(['hound', 'hound', 'hound'] as const),
  brute: Object.freeze(['brute', 'stalker', 'stalker'] as const),
  caster: Object.freeze(['caster', 'stalker', 'wisp'] as const),
  archer: Object.freeze(['archer', 'hound', 'archer'] as const),
  wisp: Object.freeze(['wisp', 'wisp', 'stalker'] as const),
});
type Position = Pick<Player, 'x' | 'y'>;
export interface TravelHeading { x: number; y: number }
const unit = (value: number) => Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(value) ? value : 0));
const groupClearance = ROAMING_RULES.groupRadius + Math.max(...Object.values(ENEMY_DEFINITIONS).map(enemy => enemy.radius));

/** Time paces encounters, but exploration earns them. Standing still cannot keep
 * refilling a cleared patch, and a blocked placement never spends travel credit. */
export class RoamingEncounters {
  private lastX = 0;
  private lastY = 0;
  private distance = 0;
  private requiredDistance: number = ROAMING_RULES.minTravel;
  private cooldown = 0;
  private warmup: number = ROAMING_RULES.warmupPopulation;
  readonly heading: TravelHeading = { x: 1, y: 0 };

  reset(x: number, y: number): void {
    this.lastX = x; this.lastY = y; this.distance = 0;
    this.requiredDistance = ROAMING_RULES.minTravel; this.cooldown = 0;
    this.warmup = ROAMING_RULES.warmupPopulation; this.heading.x = 1; this.heading.y = 0;
  }
  relocate(x: number, y: number): void { this.lastX = x; this.lastY = y; this.distance = 0; }
  advance(player: Position, dt: number): void {
    const dx = player.x - this.lastX, dy = player.y - this.lastY, length = Math.hypot(dx, dy);
    this.lastX = player.x; this.lastY = player.y;
    // Long discontinuities do not bank multiple future encounter waves.
    this.distance = Math.min(ROAMING_RULES.maxTravel, this.distance + Math.min(64, length));
    if (length > .02) { this.heading.x = dx / length; this.heading.y = dy / length; }
    this.cooldown = Math.max(0, this.cooldown - dt);
  }
  get ready(): boolean { return this.cooldown <= 0 && (this.warmup > 0 || this.distance >= this.requiredDistance); }
  groupSize(available: number, roll: number): number {
    const size = roll < .10 ? 1 : roll < .55 ? 2 : 3;
    return Math.max(0, Math.min(size, available, this.warmup > 0 ? this.warmup : 3));
  }
  resolved(count: number, random: () => number): void {
    if (!count) { this.cooldown = ROAMING_RULES.retryInterval; return; }
    this.warmup = Math.max(0, this.warmup - count);
    this.distance = 0;
    this.requiredDistance = ROAMING_RULES.minTravel + unit(random()) * (ROAMING_RULES.maxTravel - ROAMING_RULES.minTravel);
    this.cooldown = this.warmup > 0 ? ROAMING_RULES.warmupInterval
      : ROAMING_RULES.minInterval + unit(random()) * (ROAMING_RULES.maxInterval - ROAMING_RULES.minInterval);
  }
}

/** Sample beyond the actual camera rectangle, regardless of zoom or aspect ratio.
 * Most new groups lie ahead of travel; later attempts also search the flanks. */
export function roamingSpawnAnchor(player: Position, view: SpawnExclusion, heading: TravelHeading,
  random: () => number, attempt: number): { x: number; y: number; angle: number } {
  const forward = attempt < 18;
  const angle = forward ? Math.atan2(heading.y, heading.x) : unit(random()) * Math.PI * 2;
  // A fixed world-space corridor stays encounterable even when zoomed far out.
  // Angular scatter alone places groups hundreds of units beside the travel route.
  const lateral = forward ? (unit(random()) * 2 - 1) * ROAMING_RULES.corridorHalfWidth : 0;
  const originX = player.x - Math.sin(angle) * lateral;
  const originY = player.y + Math.cos(angle) * lateral;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  // Expand the rectangle for the whole group before intersecting the ray. Adding
  // only a radial distance leaves trailing members inside at shallow edge angles.
  const minX = view.x - SPAWN_VISIBILITY_MARGIN.horizontal - groupClearance;
  const maxX = view.x + view.width + SPAWN_VISIBILITY_MARGIN.horizontal + groupClearance;
  const minY = view.y - SPAWN_VISIBILITY_MARGIN.vertical - groupClearance;
  const maxY = view.y + view.height + SPAWN_VISIBILITY_MARGIN.vertical + groupClearance;
  const tx = Math.abs(dx) < 1e-8 ? Infinity : ((dx > 0 ? maxX : minX) - originX) / dx;
  const ty = Math.abs(dy) < 1e-8 ? Infinity : ((dy > 0 ? maxY : minY) - originY) / dy;
  const exit = Math.max(0, Math.min(tx, ty));
  const distance = Math.max(ROAMING_RULES.minimumDistance, exit)
    + ROAMING_RULES.leadMin + unit(random()) * (ROAMING_RULES.leadMax - ROAMING_RULES.leadMin);
  return { x: originX + dx * distance, y: originY + dy * distance, angle };
}

/** Only unseen, unengaged roamers can leave the active population. Camps have their
 * own exact ledger; retirement is never combat damage, a kill, or a loot reward. */
export function shouldRetireRoamer(enemy: Enemy, player: Pick<Player, 'x' | 'y' | 'vx' | 'vy'>,
  view: SpawnExclusion, heading: TravelHeading): boolean {
  if (enemy.campId || !isEnemyInactive(enemy)
    || !isSpawnHidden(enemy.x, enemy.y, view, enemy.radius)) return false;
  const dx = enemy.x - player.x, dy = enemy.y - player.y, distance = Math.hypot(dx, dy);
  if (distance > Math.max(ENCOUNTER_RULES.despawnDistance, Math.hypot(view.width, view.height) * .5 + ROAMING_RULES.retirementMargin)) return true;
  return Math.hypot(player.vx, player.vy) > 35 && distance > ROAMING_RULES.behindDistance
    && dx * heading.x + dy * heading.y < ROAMING_RULES.behindProjection;
}
