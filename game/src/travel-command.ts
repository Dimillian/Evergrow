import type { CharacterCheckpoint } from './character-save.ts';
import type { Simulation } from './simulation.ts';
import { portalDepartureProblem, portalLanding, withinPortalReach, type PortalAnchor } from './travel.ts';

type Result = { ok: boolean; message: string };
type Persist = (checkpoint: CharacterCheckpoint) => Result;
/** Stage position and portal ownership in one checkpoint, then publish only after durable storage. */
export function executePortalTravel(sim: Simulation, anchor: PortalAnchor, returning: boolean, persist: Persist): Result {
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
  checkpoint.x = point.x; checkpoint.y = point.y;
  checkpoint.travel = { ...sim.travel, returnTo: returning ? null : { x: p.x, y: p.y, town: anchor.band } };
  const result = persist(checkpoint);
  if (!result.ok) { sim.portal.cancel(); return result; }
  sim.travel = checkpoint.travel; sim.relocate(point.x, point.y);
  return { ok: true, message: returning ? 'Returned to your expedition.' : anchor.name };
}
export function activatePortalAnchor(sim: Simulation, anchor: PortalAnchor, persist: Persist): Result {
  if (!withinPortalReach(sim.player, anchor, sim.world)) return { ok: false, message: 'Town anchor is out of reach.' };
  if (sim.travel.homeTown === anchor.band) return { ok: true, message: `${anchor.name} is your home town.` };
  const checkpoint = sim.captureCheckpoint(); checkpoint.travel = { ...sim.travel, homeTown: anchor.band };
  const result = persist(checkpoint); if (result.ok) sim.travel = checkpoint.travel;
  return result.ok ? { ok: true, message: `Home town · ${anchor.name}` } : result;
}
