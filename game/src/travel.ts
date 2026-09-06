import type { WorldPOI } from './world-pois.ts';
import type { Input, Player, WorldQuery } from './model.ts';
import type { Settlement } from './settlements.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { getZoneAt } from './zone-progression.ts';

export const PORTAL_RULES = Object.freeze({ channel: 3, reach: 70, landingSearch: 80, protection: 1 });
export interface PortalAnchor { band: number; name: string; x: number; y: number; }
export interface TravelState { homeTown: number; returnTo: { x: number; y: number; town: number; dungeon?: string } | null; }
export const freshTravel = (): TravelState => ({ homeTown: 0, returnTo: null });
export function townPortalAnchor(town: Settlement): PortalAnchor {
  return { band: Number(town.id.split(':').at(-1)), name: town.name,
    x: town.plaza.x + town.plaza.width * .76, y: town.plaza.y + town.plaza.height * .55 };
}
export function validTravel(value: unknown): value is TravelState {
  if (!value || typeof value !== 'object') return false;
  const v = value as TravelState, band = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
  return band(v.homeTown) && (v.returnTo === null || typeof v.returnTo === 'object' && !!v.returnTo
    && (v.returnTo.dungeon === undefined || typeof v.returnTo.dungeon === 'string' && v.returnTo.dungeon.startsWith('dungeon:') && v.returnTo.dungeon.length <= 180) && band(v.returnTo.town) && [v.returnTo.x, v.returnTo.y].every(n => Number.isFinite(n) && Math.abs(n) <= 4e7));
}
export function withinPortalReach(player: Pick<Player, 'x' | 'y' | 'dead'>, anchor: PortalAnchor, world: WorldQuery): boolean {
  return !player.dead && !world.blocked(player.x, player.y, 0) && !world.blocked(anchor.x, anchor.y, 0)
    && Math.hypot(player.x - anchor.x, player.y - anchor.y) <= PORTAL_RULES.reach
    && hasLineOfSight(world, player.x, player.y, anchor.x, anchor.y);
}
export function portalDepartureProblem(player: Player, world: WorldQuery): string | null {
  if (player.dead) return 'You cannot travel while defeated.';
  if (world.isSanctuary?.(player.x, player.y)) return 'Use the return portal in town.';
  if (world.blocked(player.x, player.y, player.radius)) return 'No room for a portal here.';
  if (player.attack || player.castTime > 0 || player.dash || player.dodgeTime > 0 || Math.hypot(player.vx, player.vy) > 1)
    return 'Stand still to open a portal.';
  return null;
}
/** Fixed-step channel; damage cancels at the contact boundary, independently of healing. */
export class PortalChannel {
  origin: { x: number; y: number } | null = null;
  elapsed = 0;
  get active() { return this.origin !== null; }
  get ready() { return this.active && this.elapsed + 1e-9 >= PORTAL_RULES.channel; }
  get progress() { return Math.min(1, this.elapsed / PORTAL_RULES.channel); }
  start(player: Player, world: WorldQuery): string | null {
    if (this.active) { this.cancel(); return null; }
    const problem = portalDepartureProblem(player, world); if (problem) return problem;
    this.origin = { x: player.x, y: player.y }; this.elapsed = 0; return null;
  }
  cancel() { this.origin = null; this.elapsed = 0; }
  advance(dt: number, player: Player, input: Input): void {
    if (!this.origin) return;
    if (player.dead || input.moveX || input.moveY || input.attack || input.dodge || input.skillSlot !== null
      || player.attack || player.dash || player.castTime > 0 || player.dodgeTime > 0
      || Math.hypot(player.x - this.origin.x, player.y - this.origin.y) > .5) { this.cancel(); return; }
    this.elapsed = Math.min(PORTAL_RULES.channel, this.elapsed + dt);
  }
}
/** Bounded deterministic search never silently crosses a geographic level boundary. */
export function portalLanding(world: WorldQuery, point: { x: number; y: number }, radius: number): { x: number; y: number } | null {
  const level = getZoneAt(point.x, point.y, world.seed).level;
  const valid = (x: number, y: number) => [x, y].every(n => Number.isFinite(n) && Math.abs(n) <= 4e7)
    && getZoneAt(x, y, world.seed).level === level && !world.blocked(x, y, radius);
  if (valid(point.x, point.y)) return { ...point };
  for (let r = 16; r <= PORTAL_RULES.landingSearch; r += 16) for (let i = 0; i < 16; i++) {
    const x = point.x + Math.cos(i * Math.PI / 8) * r, y = point.y + Math.sin(i * Math.PI / 8) * r;
    if (valid(x, y)) return { x, y };
  }
  return null;
}

/** Explicitly known travel markers do not reveal the surrounding terrain. */
export function portalMapMarkers(state: TravelState, anchorAt: (band: number) => PortalAnchor): WorldPOI[] {
  const home = anchorAt(state.homeTown), link = state.returnTo;
  const markers: WorldPOI[] = [{ id: 'travel:home', kind: 'portal', x: home.x, y: home.y,
    name: `${home.name} · Home`, description: 'Town portal destination' }];
  if (link) {
    const anchor = anchorAt(link.town);
    if (link.town === state.homeTown) markers.length = 0;
    markers.push({ id: 'travel:return', kind: 'portal', x: anchor.x, y: anchor.y,
      name: `${anchor.name} · Return portal`, description: 'Interact in town to return to your expedition' });
    if (!link.dungeon) markers.push({ id: 'travel:departure', kind: 'portal', x: link.x, y: link.y,
      name: 'Expedition return point', description: 'Your saved return destination' });
  }
  return markers;
}
