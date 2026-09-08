import { eventRecipe, sealPoint, isTrialKind } from './event-recipes.ts';
import type { WaveProgress } from './wave-system.ts';
import { siteHash, type WildernessSite, type WildernessKind } from './wilderness-sites.ts';
import type { BiomeId } from './biomes.ts';
import type { EnemyKind, Enemy, WorldQuery, Player } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { getZoneAt } from './zone-progression.ts';
import type { WorldPOI } from './world-pois.ts';
export type EventKind = WildernessKind | 'reliquary';
export function isEventKind(kind: string): kind is EventKind {
  return ['bossLair', 'camp', 'caravan', 'watchtower', 'graveyard', 'standingStones', 'reliquary', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove'].includes(kind);
}
export type BlessingKind = 'haste' | 'wellspring' | 'bulwark' | 'fleet';
export interface Blessing {
  kind: BlessingKind;
  remaining: number;
}
export type EventChoice = 'goods' | 'coin' | BlessingKind;
export interface EventSite {
  scaling?: import('./encounter-scaling.ts').EncounterScale;
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
  phase: 'active' | 'paused' | 'completed' | 'claimed';
  pausedTrial?: Trial;
  choice: EventChoice | null;
  delivered: number;
  wavesCleared: number;
  bonusGranted: boolean;
  beaconTarget?: WorldPOI;
  seals?: { x: number; y: number }[];
}
export interface GuardianRecord {
  wave: number;
  kind: EnemyKind;
  rank: EnemyRank;
  seed: number;
  hp: number;
  x: number;
  y: number;
  admitted: boolean;
  dead: boolean;
}
export interface Trial extends WaveProgress {
  sealReady: boolean;
  siteId: string;
  guardians: GuardianRecord[];
}
export interface EventState {
  /** Exact receipts; recent claims and beacon projections remain in sites. */
  claimed?: string[];
  sites: Record<string, EventRecord>;
  trial: Trial | null;
}
export const EVENT_RULES = Object.freeze({ reach: 78, channel: 1, beaconChannel: 2, blessingDuration: 90, trialRadius: 1800, abandonRadius: 700 });
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
  const favored: Record<BiomeId, BlessingKind> = { steppe: 'fleet', sunscar: 'wellspring', deadwood: 'haste', verdant: 'fleet', swamp: 'wellspring', frostpine: 'bulwark', emberfall: 'haste', autumn: 'fleet', highlands: 'bulwark' };
  const first = favored[site.biome], others = (Object.keys(BLESSINGS) as BlessingKind[]).filter(k => k !== first);
  return [first, others[siteHash(site.seed, 0, 39) % others.length]];
}
export function eventSite(site: WildernessSite, worldSeed = 7319): EventSite {
  if(site.kind==='bossLair')return {id:site.id,kind:site.kind,name:site.name,x:site.x,y:site.y+155,seed:site.seed,biome:site.biome,level:getZoneAt(site.x,site.y,worldSeed).level};
  // Interactions sit just inside each oriented, open approach.
  return { id: site.id, kind: site.kind, name: site.name, x: site.x+(site.entrance.x-site.x)*(1-22/site.radius), y: site.y+(site.entrance.y-site.y)*(1-22/site.radius),
    seed: site.seed, biome: site.biome, level: getZoneAt(site.x, site.y, worldSeed).level };
}
export function eventLabel(site: Pick<EventSite, 'id' | 'kind'>, state: EventState, campCleared: boolean): string {
  const record = state.sites[site.id];
  if (eventClaimed(state, site.id))
    return site.kind === 'watchtower' ? 'Beacon lit' : 'Claimed';
  if (record?.phase === 'completed')
    return 'Reward waiting';
  if (record?.phase === 'paused') return 'Resume trial';
  if (record?.phase === 'active') {
    const trial = state.trial;
    if (!trial || trial.siteId !== site.id)
      return 'Active';
    const r = eventRecipe(state.sites[site.id])!;
    if (trial.sealReady) return `${({beastDen:'Destroy nest',hamlet:'Dismantle standard',corruptedGrove:'Cleanse root'} as Partial<Record<EventKind,string>>)[site.kind]??'Break seal'} · ${trial.wave+1}/3`;
    const wave = trial.guardians.filter(g => g.wave === trial.wave);
    const progress = r.mode === 'timed' ? `${Math.max(0,Math.ceil(r.rules.duration-trial.elapsed))}s · ${trial.cleared} waves` : `Wave ${Math.min(trial.wave+1,r.rules.count)} / ${r.rules.count}`;
    const hold=r.mode==='defend'&&trial.held<r.rules.hold?` · Hold ${Math.ceil(r.rules.hold-trial.held)}s`:'';
    return `${progress} · ${wave.filter(g=>g.dead).length} / ${wave.length}${hold}`;
  }
  if (site.kind === 'camp' && !campCleared)
    return 'Clear the camp';
  if(site.kind==='bossLair')return 'Defeat the boss';
  const recipe = eventRecipe(site as EventSite);
  if (recipe) return recipe.action;
  return ({ camp: 'Open strongbox', caravan: 'Recover cargo', watchtower: 'Light beacon', graveyard: 'Disturb the vigil', standingStones: 'Choose blessing', reliquary: 'Open reliquary' } as Partial<Record<EventKind,string>>)[site.kind] ?? 'Interact';
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
  // Visit live actors only; distant parked trials require no per-tick work.
  for(const actor of enemies){
    if(!actor.campId?.startsWith('event:'))continue;
    const id=actor.campId.slice(6),trial=state.trial?.siteId===id?state.trial:state.sites[id]?.pausedTrial;
    const guardian=trial?.guardians[Number(actor.campMemberId)];
    if(guardian){guardian.hp=actor.hp;guardian.x=actor.x;guardian.y=actor.y;guardian.dead=actor.state==='dead';}
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

export function eventInteractionSites(sites: readonly EventSite[],state:EventState):EventSite[] {
  sites=sites.filter(site=>site.kind!=='bossLair'&&(!isTrialKind(site.kind)||(!eventClaimed(state,site.id)&&state.sites[site.id]?.phase!=='completed')));
  const trial=state.trial;if(!trial?.sealReady)return [...sites];
  const site=state.sites[trial.siteId],point=sealPoint(site,trial.wave);
  return [...sites.filter(s=>s.id!==site.id),{...site,...point}];
}

/** Release the active slot: bank timed scores, or park exact finite-trial progress. */
export function interruptTrial(state:EventState,actors:{campId?:string;memberId?:string;campMemberId?:string}[]):void {
  const trial=state.trial;if(!trial)return;const site=state.sites[trial.siteId];
  if(eventRecipe(site)?.mode!=='timed'){site.phase='paused';site.pausedTrial=trial;state.trial=null;return;}
  site.wavesCleared=trial.cleared;site.phase='completed';
  for(const actor of actors)if(actor.campId===`event:${site.id}`){delete actor.campId;delete actor.memberId;delete actor.campMemberId;}
  state.trial=null;
}
