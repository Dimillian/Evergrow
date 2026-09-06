import { siteHash, type WildernessSite, type WildernessKind } from './wilderness-sites.ts';
import type { BiomeId } from './biomes.ts';
import type { EnemyKind, Enemy, WorldQuery, Player } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { getZoneAt } from './zone-progression.ts';
import type { WorldPOI } from './world-pois.ts';
export type EventKind = WildernessKind | 'reliquary';
export function isEventKind(kind: string): kind is EventKind {
  return ['camp', 'caravan', 'watchtower', 'graveyard', 'standingStones', 'reliquary'].includes(kind);
}
export type BlessingKind = 'haste' | 'wellspring' | 'bulwark' | 'fleet';
export interface Blessing {
  kind: BlessingKind;
  remaining: number;
}
export type EventChoice = 'goods' | 'coin' | BlessingKind;
export interface EventSite {
  id: string;
  kind: EventKind;
  name: string;
  x: number;
  y: number;
  seed: number;
  biome: BiomeId;
  level: number;
}
export interface EventRecord extends EventSite {
  phase: 'active' | 'completed' | 'claimed';
  choice: EventChoice | null;
  delivered: number;
  bonusGranted: boolean;
  beaconTarget?: WorldPOI;
}
export interface GuardianRecord {
  kind: EnemyKind;
  rank: EnemyRank;
  seed: number;
  hp: number;
  x: number;
  y: number;
  admitted: boolean;
  dead: boolean;
}
export interface Trial {
  siteId: string;
  wave: number;
  guardians: GuardianRecord[];
}
export interface EventState {
  /** Exact receipts; recent claims and beacon projections remain in sites. */
  claimed?: string[];
  sites: Record<string, EventRecord>;
  trial: Trial | null;
}
export const EVENT_RULES = Object.freeze({ reach: 78, channel: 1, beaconChannel: 2, blessingDuration: 90 });
export const freshEvents = (): EventState => ({ claimed: [], sites: {}, trial: null });
export const BLESSINGS: Readonly<Record<BlessingKind, {
  name: string;
  description: string;
  color: string;
}>> = Object.freeze({
  haste: { name: 'Haste', description: '+15% attack and cast speed', color: '#e4ca92' },
  wellspring: { name: 'Wellspring', description: '20% mana-cost reduction', color: '#8fc8ee' },
  bulwark: { name: 'Bulwark', description: '+40% armor', color: '#b4c8b6' },
  fleet: { name: 'Fleet', description: '+15% movement speed', color: '#a3dec5' },
});
export function blessingChoices(site: EventSite): BlessingKind[] {
  const favored: Record<BiomeId, BlessingKind> = { deadwood: 'haste', verdant: 'fleet', swamp: 'wellspring', frostpine: 'bulwark', emberfall: 'haste', autumn: 'fleet', highlands: 'bulwark' };
  const first = favored[site.biome], others = (Object.keys(BLESSINGS) as BlessingKind[]).filter(k => k !== first);
  return [first, others[siteHash(site.seed, 0, 39) % others.length]];
}
export function eventSite(site: WildernessSite, worldSeed = 7319): EventSite {
  // All interaction anchors sit in the existing open southern approach, away from solid props.
  return { id: site.id, kind: site.kind, name: site.name, x: site.x, y: site.y + site.radius - 22,
    seed: site.seed, biome: site.biome, level: getZoneAt(site.x, site.y, worldSeed).level };
}
export function eventLabel(site: Pick<EventSite, 'id' | 'kind'>, state: EventState, campCleared: boolean): string {
  const record = state.sites[site.id];
  if (eventClaimed(state, site.id))
    return site.kind === 'watchtower' ? 'Beacon lit' : 'Claimed';
  if (record?.phase === 'completed')
    return 'Reward waiting';
  if (record?.phase === 'active') {
    const trial = state.trial;
    if (!trial || trial.siteId !== site.id)
      return 'Active';
    const wave = trial.guardians.slice(trial.wave * 3, trial.wave * 3 + 3);
    return wave.some(g => !g.admitted && !g.dead) ? 'Guardians approaching' : `Guardians ${trial.guardians.filter(g => g.dead).length} / ${trial.guardians.length}`;
  }
  if (site.kind === 'camp' && !campCleared)
    return 'Clear the camp';
  return ({ camp: 'Open strongbox', caravan: 'Recover cargo', watchtower: 'Light beacon', graveyard: 'Disturb the vigil', standingStones: 'Choose blessing', reliquary: 'Open reliquary' })[site.kind];
}
export function focusEvent(sites: readonly EventSite[], player: Pick<Player, 'x' | 'y' | 'dead'>, world: WorldQuery, pointer?: {
  x: number;
  y: number;
}): EventSite | undefined {
  if (player.dead)
    return;
  return sites.filter(s => Math.hypot(s.x - player.x, s.y - player.y) <= EVENT_RULES.reach
    && (!pointer || Math.hypot(s.x - pointer.x, s.y - 12 - pointer.y) < 34)
    && hasLineOfSight(world, player.x, player.y, s.x, s.y))
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
}
export function syncTrial(state: EventState, enemies: readonly Enemy[]): void {
  const trial = state.trial;
  if (!trial)
    return;
  trial.guardians.forEach((g, i) => {
    const actor = enemies.find(e => e.campId === `event:${trial.siteId}` && e.campMemberId === String(i));
    if (actor) {
      g.hp = actor.hp;
      g.x = actor.x;
      g.y = actor.y;
      g.dead = actor.state === 'dead';
    }
  });
  if (trial.guardians.slice(trial.wave * 3, trial.wave * 3 + 3).every(g => g.dead))
    trial.wave++;
  if (trial.guardians.every(g => g.dead)) {
    state.sites[trial.siteId].phase = 'completed';
    state.trial = null;
  }
}

export function eventClaimed(state: EventState, id: string): boolean {
  return state.sites[id]?.phase === 'claimed' || !!state.claimed?.includes(id);
}
/** Keep recent art/choice records, unfinished rewards, and durable beacon map projections. */
export function compactEvents(state: EventState): void {
  const retired = new Set(state.claimed ?? []);
  const claims = Object.values(state.sites).filter(r => r.phase === 'claimed' && r.kind !== 'watchtower');
  for (const record of claims.slice(0, -32)) {
    retired.add(record.id);
    delete state.sites[record.id];
  }
  state.claimed = [...retired];
}
