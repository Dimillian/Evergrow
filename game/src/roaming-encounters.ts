import type { Enemy, EnemyKind, Player } from './model.ts';
import { ENCOUNTER_RULES, chooseEncounterRank, encounterRankChances } from './encounter-director.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { isEnemyInactive, isSpawnHidden, SPAWN_VISIBILITY_MARGIN, type SpawnExclusion } from './spawn-visibility.ts';

export const ROAMING_RULES = Object.freeze({
  warmupPopulation: ENCOUNTER_RULES.basePopulation, warmupInterval: .65, maxGroupSize: 20, retryInterval: .45,
  memberPlacementAttempts: 4, placementBudget: 256, outerRadius: 190, placementNudge: 20,
  minInterval: 2.2, maxInterval: 3.8, minTravel: 180, maxTravel: 280,
  minimumDistance: 300, leadMin: 30, leadMax: 90, groupRadius: 100, corridorHalfWidth: 140,
  retirementMargin: 650, behindDistance: 430, behindProjection: -220,
});
export const ROAMING_PACK_BANDS = Object.freeze([
  Object.freeze({ through:12, min:4, max:6 }), Object.freeze({ through:25, min:6, max:9 }),
  Object.freeze({ through:40, min:8, max:12 }), Object.freeze({ through:60, min:11, max:16 }),
  Object.freeze({ through:1_000_000, min:14, max:20 }),
]);
export function roamingPackBand(level:number) {
  return ROAMING_PACK_BANDS.find(b=>normalizeLevel(level)<=b.through)!;
}
/** Extra members retain a chance of every rank, with ordinary foes favored. */
export function roamingMemberRank(level:number, index:number, roll:number):EnemyRank {
  if(index<6)return chooseEncounterRank(level,roll);
  const odds=encounterRankChances(level);
  return roll<odds.elite*.25?'elite':roll<odds.elite*.25+odds.veteran*.5?'veteran':'normal';
}
export function roamingFormationRadius(size:number):number {
  return (size>8?ROAMING_RULES.outerRadius:ROAMING_RULES.groupRadius)+ROAMING_RULES.placementNudge;
}
/** Two loose rings give large groups space without making a giant empty circle. */
export function roamingMemberOffset(size:number,index:number,heading:number,random:()=>number,attempt=0) {
  let x=0,y=0;
  if(index>0){
    const inner=size>8?6:size-1, outer=index>inner;
    const count=outer?size-1-inner:inner, slot=outer?index-inner-1:index-1;
    const step=Math.PI*2/count, angle=heading+slot*step+(outer?step*.5:0)+(unit(random())-.5)*step*.12;
    const radius=(outer?ROAMING_RULES.outerRadius:ROAMING_RULES.groupRadius)*(.93+unit(random())*.07);
    x=Math.cos(angle)*radius;y=Math.sin(angle)*radius;
  }
  if(attempt){const angle=unit(random())*Math.PI*2;x+=Math.cos(angle)*ROAMING_RULES.placementNudge;y+=Math.sin(angle)*ROAMING_RULES.placementNudge;}
  return {x,y};
}
export const ROAMING_GROUPS: Readonly<Partial<Record<EnemyKind, readonly EnemyKind[]>>> = Object.freeze({
  thornReaver: Object.freeze(['thornReaver', 'hound', 'thornReaver', 'stalker', 'thornReaver', 'hound'] as const),
  mireSpitter: Object.freeze(['mireSpitter', 'thornReaver', 'stalker', 'mireSpitter', 'stalker', 'wisp'] as const),
  frostRevenant: Object.freeze(['frostRevenant', 'hound', 'frostRevenant', 'wisp', 'hound', 'frostRevenant'] as const),
  emberAcolyte: Object.freeze(['emberAcolyte', 'brute', 'duneScuttler', 'emberAcolyte', 'stalker', 'brute'] as const),
  duneScuttler: Object.freeze(['duneScuttler', 'duneScuttler', 'duneScuttler', 'archer', 'duneScuttler', 'hound'] as const),
  stormSentinel: Object.freeze(['stormSentinel', 'brute', 'frostRevenant', 'stormSentinel', 'archer', 'brute'] as const),
  stalker: Object.freeze(['stalker', 'stalker', 'hound', 'stalker', 'hound', 'stalker'] as const),
  hound: Object.freeze(['hound', 'hound', 'hound', 'hound', 'hound', 'stalker'] as const),
  brute: Object.freeze(['brute', 'stalker', 'stalker', 'hound', 'stalker', 'stalker'] as const),
  caster: Object.freeze(['caster', 'stalker', 'wisp', 'stalker', 'hound', 'stalker'] as const),
  archer: Object.freeze(['archer', 'hound', 'archer', 'hound', 'stalker', 'hound'] as const),
  wisp: Object.freeze(['wisp', 'wisp', 'stalker', 'hound', 'stalker', 'stalker'] as const),
});
/** Replace existing escort slots, never add actors: ranged leaders gain a heavy
 * screen, melee leaders gain ranged pressure, and either gains a flanker. */
export function roamingEscortRole(leader: Pick<Enemy,'kind'|'rank'> | undefined, index: number) {
  if (leader?.rank !== 'elite') return undefined;
  if (index === 1) return ENEMY_DEFINITIONS[leader.kind].role === 'ranged' ? 'heavy' as const : 'ranged' as const;
  if (index === 2) return 'flanker' as const;
  return undefined;
}
type Position = Pick<Player, 'x' | 'y'>;
export interface TravelHeading { x: number; y: number }
const unit = (value: number) => Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(value) ? value : 0));
const largestBody = Math.max(...Object.values(ENEMY_DEFINITIONS).map(enemy => enemy.radius));

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

  capture() { return { warmup:this.warmup,cooldown:this.cooldown,requiredDistance:this.requiredDistance }; }
  restore(value:{warmup:number;cooldown:number;requiredDistance:number},x:number,y:number) { this.warmup=value.warmup;this.cooldown=value.cooldown;this.requiredDistance=value.requiredDistance;this.relocate(x,y); }
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
  groupSize(level: number, roll: number): number {
    const band=roamingPackBand(level);
    const size=band.max===6?(roll<.25?4:roll<.75?5:6):band.min+Math.floor(unit(roll)*(band.max-band.min+1));
    return Math.min(size,this.warmup>0?this.warmup:ROAMING_RULES.maxGroupSize);
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
  random: () => number, attempt: number, formationRadius:number=ROAMING_RULES.groupRadius): { x: number; y: number; angle: number } {
  const groupClearance=formationRadius+largestBody;
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
