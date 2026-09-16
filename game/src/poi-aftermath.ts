import type { CampState } from './camp-population.ts';
import type { EventState } from './poi-content.ts';
import type { WildernessSite } from './wilderness-sites.ts';

export type SiteAftermath = 'none' | 'abandoned' | 'cleansed' | 'sanctified' | 'emptied' | 'quieted'
  | 'unbound' | 'depleted' | 'liberated' | 'opened' | 'recovered' | 'secured' | 'blessed';

/** Pure visual consequence derived from the existing camp and event owners. */
export function siteAftermath(
  site: Pick<WildernessSite, 'id' | 'kind'>,
  events: EventState,
  campState: (id: string) => CampState,
  claimed = new Set(events.claimed ?? []),
): SiteAftermath {
  if (site.kind === 'camp') return campState(site.id) === 'cleared' ? 'abandoned' : 'none';
  const phase = events.sites[site.id]?.phase;
  if (phase !== 'completed' && phase !== 'claimed' && !claimed.has(site.id)) return 'none';
  if (site.kind === 'corruptedGrove') return 'cleansed';
  if (site.kind === 'ruinedChapel') return 'sanctified';
  if (site.kind === 'beastDen') return 'emptied';
  if (site.kind === 'graveyard') return 'quieted';
  if (site.kind === 'cursedChest') return 'unbound';
  if (site.kind === 'quarry') return 'depleted';
  if (site.kind === 'hamlet') return 'liberated';
  if (site.kind === 'crossing') return 'opened';
  if (site.kind === 'caravan') return 'recovered';
  if (site.kind === 'watchtower') return 'secured';
  if (site.kind === 'standingStones') return 'blessed';
  return 'none';
}

export function projectSiteAftermath(
  sites: readonly Pick<WildernessSite, 'id' | 'kind'>[],
  events: EventState,
  campState: (id: string) => CampState,
): ReadonlyMap<string, SiteAftermath> {
  const claimed = new Set(events.claimed ?? []);
  return new Map(sites.map(site => [site.id, siteAftermath(site, events, campState, claimed)]));
}
