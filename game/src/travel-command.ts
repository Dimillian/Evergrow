import { interruptTrial } from './poi-content.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Simulation } from './simulation.ts';
import { portalDepartureProblem, portalLanding, withinPortalReach, type PortalAnchor } from './travel.ts';
import type { WorldPOI } from './world-pois.ts';

type Result = { ok: boolean; message: string };
type Persist = (checkpoint: CharacterCheckpoint) => Result | Promise<Result>;
export type TravelDiscoveries = { getDiscoveredPOI(id: string): WorldPOI | undefined };

export function mapTravelProblem(sim: Simulation, discoveries: TravelDiscoveries, id: string): string | null {
  if (sim.player.dead) return 'You cannot travel while defeated.';
  if (sim.dungeonFloor || sim.expeditions.location) return 'Leave the dungeon or rift before using map travel.';
  const poi = discoveries.getDiscoveredPOI(id);
  if (!poi || poi.sighted) return 'Visit this location first to unlock teleporting.';
  if (![poi.x, poi.y].every(n => Number.isFinite(n) && Math.abs(n) <= 4e7)) return 'This destination is unavailable.';
  return null;
}

/** Resolve an ID against the character's chart, never coordinates supplied by UI.
 * Preserve home/return ownership, resources and encounter contents on every trip. */
export async function executeMapTravel(sim: Simulation, discoveries: TravelDiscoveries, id: string, persist: Persist): Promise<Result> {
  const problem = mapTravelProblem(sim, discoveries, id);
  if (problem) return { ok: false, message: problem };
  const poi = discoveries.getDiscoveredPOI(id)!;
  const point = portalLanding(sim.world, { x: poi.x, y: poi.y + 42 }, sim.player.radius);
  if (!point) return { ok: false, message: 'No clear landing near this location.' };
  const checkpoint = sim.captureCheckpoint();
  interruptTrial(checkpoint.events!, checkpoint.actors ?? []);
  checkpoint.x = point.x; checkpoint.y = point.y;
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  interruptTrial(sim.eventState, sim.enemies);
  sim.eventChannel.cancel(); sim.relocate(point.x, point.y);
  return { ok: true, message: poi.name };
}
/** Stage position and portal ownership in one checkpoint, then publish only after durable storage. */
export async function executePortalTravel(sim: Simulation, anchor: PortalAnchor, returning: boolean, persist: Persist): Promise<Result> {
  const p = sim.player, link = sim.travel.returnTo;
  if (returning) {
    if (!link || link.town !== anchor.band || !withinPortalReach(p, anchor, sim.world)) return { ok: false, message: 'Return portal is out of reach.' };
  } else {
    if (!sim.portal.ready || anchor.band !== sim.travel.homeTown) return { ok: false, message: 'The portal is not ready.' };
    const problem = portalDepartureProblem(p, sim.world);
    if (problem) { sim.portal.cancel(); return { ok: false, message: problem }; }
  }
  const point = portalLanding(sim.world, returning ? link! : { x: anchor.x, y: anchor.y + 35 }, p.radius);
  if (!point || (!returning && !sim.world.isSanctuary?.(point.x, point.y))) {
    sim.portal.cancel(); return { ok: false, message: returning ? 'Return point blocked.' : 'Town arrival blocked.' };
  }
  const checkpoint = sim.captureCheckpoint();
  if(!returning)interruptTrial(checkpoint.events!,checkpoint.actors??[]);
  checkpoint.x = point.x; checkpoint.y = point.y;
  checkpoint.travel = { ...sim.travel, returnTo: returning ? null : { x: p.x, y: p.y, town: anchor.band } };
  const result = await persist(checkpoint);
  if (!result.ok) { sim.portal.cancel(); return result; }
  if(!returning)interruptTrial(sim.eventState,sim.enemies);
  sim.travel = checkpoint.travel; sim.relocate(point.x, point.y);
  return { ok: true, message: returning ? 'Returned to your expedition.' : anchor.name };
}
export async function activatePortalAnchor(sim: Simulation, anchor: PortalAnchor, persist: Persist): Promise<Result> {
  if (!withinPortalReach(sim.player, anchor, sim.world)) return { ok: false, message: 'Town anchor is out of reach.' };
  if (sim.travel.homeTown === anchor.band) return { ok: true, message: `${anchor.name} is your home town.` };
  const checkpoint = sim.captureCheckpoint(); checkpoint.travel = { ...sim.travel, homeTown: anchor.band };
  const result = await persist(checkpoint); if (result.ok) sim.travel = checkpoint.travel;
  return result.ok ? { ok: true, message: `Home town · ${anchor.name}` } : result;
}
