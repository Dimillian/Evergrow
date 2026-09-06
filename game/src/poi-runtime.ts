import { type EventState, type EventSite, type EventChoice, EVENT_RULES, syncTrial } from './poi-content.ts';
import type { Enemy, Input, Player, WorldQuery } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import type { CampSpawnSource } from './camp-population.ts';
export class EventChannel {
  site: EventSite | null = null;
  choice: EventChoice | null = null;
  elapsed = 0;
  get duration() { return this.site?.kind === 'watchtower' ? EVENT_RULES.beaconChannel : EVENT_RULES.channel; }
  get ready() { return !!this.site && this.elapsed + 1e-9 >= this.duration; }
  cancel() { this.site = null; this.choice = null; this.elapsed = 0; }
  start(site: EventSite, choice: EventChoice | null) { this.site = site; this.choice = choice; this.elapsed = 0; }
  advance(dt: number, p: Player, input: Input) {
    if (!this.site)
      return;
    if (p.dead || input.moveX || input.moveY || input.attack || input.dodge || input.skillSlot !== null
      || p.attack || p.castTime > 0 || p.dash || p.dodgeTime > 0 || Math.hypot(p.vx, p.vy) > 1
      || Math.hypot(p.x - this.site.x, p.y - this.site.y) > EVENT_RULES.reach) {
      this.cancel();
      return;
    }
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
  }
}
export interface TrialContext {
  state: EventState;
  player: Player;
  enemies: Enemy[];
  world: WorldQuery;
  view: SpawnExclusion | null;
  spawn(kind: Enemy['kind'], x: number, y: number, rank: Enemy['rank'], source: CampSpawnSource): Enemy | null;
}
/** Explicit trials share the actor budget but never become ambient refill candidates. */
export function advanceTrial(context: TrialContext): void {
  const { state, player, enemies, world, view } = context;
  syncTrial(state, enemies);
  const trial = state.trial;
  if (!trial)
    return;
  const site = state.sites[trial.siteId];
  const far = player.dead || world.isSanctuary?.(player.x, player.y) || Math.hypot(player.x - site.x, player.y - site.y) > 1800;
  if (far) {
    for (let i = enemies.length - 1; i >= 0; i--)
      if (enemies[i].campId === `event:${site.id}` && view && isSpawnHidden(enemies[i].x, enemies[i].y, view, enemies[i].radius))
        enemies.splice(i, 1);
    return;
  }
  if (!view)
    return;
  const missing = trial.guardians.map((g, i) => ({ g, i })).filter(({ g, i }) => i >= trial.wave * 3 && i < trial.wave * 3 + 3 && !g.dead
    && !enemies.some(e => e.campId === `event:${site.id}` && e.campMemberId === String(i)));
  if (!missing.length)
    return;
  const live = enemies.filter(e => e.state !== 'dead');
  if (live.length + missing.length > ENCOUNTER_RULES.hardPopulationCap || live.filter(e => e.campId).length + missing.length > ENCOUNTER_RULES.hardPopulationCap - ENCOUNTER_RULES.roamingReserve)
    return;
  for (const rank of ['veteran', 'elite'] as const)
    if (live.filter(e => e.rank === rank).length + missing.filter(({ g }) => g.rank === rank).length > (rank === 'veteran' ? ENCOUNTER_RULES.veteranCap : ENCOUNTER_RULES.eliteCap))
      return;
  // Preflight a whole wave, with bounded offscreen routes into the site's clear approach.
  const placements: {
    x: number;
    y: number;
    index: number;
  }[] = [];
  for (const { g, i } of missing) {
    const valid = (x: number, y: number) => isSpawnHidden(x, y, view, ENEMY_DEFINITIONS[g.kind].radius)
      && !world.blocked(x, y, ENEMY_DEFINITIONS[g.kind].radius + 8) && !world.isSanctuary?.(x, y)
      && hasLineOfSight(world, x, y, site.x, site.y) && [...live, ...placements].every(e => Math.hypot(e.x - x, e.y - y) > 45);
    let point = g.admitted && valid(g.x, g.y) ? { x: g.x, y: g.y } : null;
    // Previously admitted survivors keep their exact location; wait until hidden rather than teleporting them.
    if (g.admitted && !point)
      return;
    for (let attempt = 0; !point && attempt < 32; attempt++) {
      const angle = (attempt / 32 + i * .09) * Math.PI * 2;
      const r = Math.hypot(view.width, view.height) * .5 + 230 + i * 55;
      const x = player.x + Math.cos(angle) * r, y = player.y + Math.sin(angle) * r;
      if (valid(x, y))
        point = { x, y };
    }
    if (!point)
      return;
    placements.push({ ...point, index: i });
  }
  for (const point of placements) {
    const g = trial.guardians[point.index];
    const actor = context.spawn(g.kind, point.x, point.y, g.rank, { campId: `event:${site.id}`, memberId: String(point.index), lootSeed: g.seed });
    if (!actor)
      throw new Error('Preflighted event guardian could not be admitted');
    Object.assign(actor, scaledEnemyStats(g.kind, site.level, g.rank), { level: site.level, biome: site.biome, hp: g.hp, homeX: site.x, homeY: site.y, state: 'return' });
    g.admitted = true;
    g.x = actor.x;
    g.y = actor.y;
  }
}
