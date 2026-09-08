import { encounterMemberLevel } from './encounter-scaling.ts';
import { eventRecipe } from './event-recipes.ts';
import { advanceWaves } from './wave-system.ts';
import { alertEnemy } from './enemy-state.ts';
import { type EventState, type EventSite, type EventChoice, EVENT_RULES, syncTrial, interruptTrial } from './poi-content.ts';
import type { Enemy, Input, Player, WorldQuery } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { encounterApproaches } from './encounter-approaches.ts';
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
  dt?: number;
  state: EventState;
  player: Player;
  enemies: Enemy[];
  world: WorldQuery;
  view: SpawnExclusion | null;
  spawn(kind: Enemy['kind'], x: number, y: number, rank: Enemy['rank'], source: CampSpawnSource): Enemy | null;
}
/** Explicit trials admit independently of ambient population and never become refill candidates. */
export function advanceTrial(context: TrialContext): void {
  const { state, player, enemies, world, view } = context;
  syncTrial(state, enemies);
  const active=state.trial,site=active?state.sites[active.siteId]:undefined;
  if(site&&(player.dead||world.isSanctuary?.(player.x,player.y)||Math.hypot(player.x-site.x,player.y-site.y)>EVENT_RULES.abandonRadius))
    interruptTrial(state,enemies);
  // Park only hidden survivors. Visible opponents keep fighting and retain their
  // identity; syncing parked trials preserves any later wounds or kills.
  if(view)for(let i=enemies.length-1;i>=0;i--){
    const enemy=enemies[i],record=enemy.campId?.startsWith('event:')?state.sites[enemy.campId.slice(6)]:undefined;
    if(record?.phase==='paused'&&isSpawnHidden(enemy.x,enemy.y,view,enemy.radius))enemies.splice(i,1);
  }
  const trial=state.trial;
  if(!trial||!site)return;
  if (!view)
    return;
  const recipe = eventRecipe(site)!;
  const current = trial.guardians.filter(g=>g.wave===trial.wave);
  const defeated = current.length>0 && current.every(g=>g.dead);
  if(recipe.mode==='seals'&&defeated) trial.sealReady=true;
  advanceWaves(trial,recipe.rules,context.dt??.5,{admitted:current.some(g=>g.admitted),defeated:defeated&&recipe.mode!=='seals',inObjective:Math.hypot(player.x-site.x,player.y-site.y)<180});
  if(trial.finished) { finishTrial(context); return; }
  if(trial.rest>0||trial.sealReady)return;
  const missing = trial.guardians.map((g,i)=>({g,i})).filter(({g,i})=>g.wave===trial.wave&&!g.dead&&!enemies.some(e=>e.campId===`event:${site.id}`&&e.campMemberId===String(i)));
  if(!missing.length)return;
  const live=enemies.filter(e=>e.state!=='dead');
  const clearance = Math.max(...missing.map(({ g }) => ENEMY_DEFINITIONS[g.kind].radius)) + 2;
  const approaches = encounterApproaches(world, view, player, site, clearance, EVENT_RULES.trialRadius);
  const placements: { x: number; y: number; index: number }[] = [];
  for (const { g, i } of missing) {
    const radius = ENEMY_DEFINITIONS[g.kind].radius;
    const clear = (x: number, y: number) => isSpawnHidden(x, y, view, radius)
      && !world.blocked(x, y, radius) && !world.isSanctuary?.(x, y);
    // Saved survivors keep their exact positions, health and identity.
    const point = g.admitted ? clear(g.x, g.y) ? { x: g.x, y: g.y } : null
      : approaches.find(p => clear(p.x, p.y) && live.every(e => Math.hypot(e.x - p.x, e.y - p.y) > Math.max(45, radius + e.radius + 8))
        && placements.every(e => Math.hypot(e.x - p.x, e.y - p.y) > 45));
    if (point) placements.push({ x: point.x, y: point.y, index: i });
  }
  for (const point of placements) {
    const g = trial.guardians[point.index];
    const actor = context.spawn(g.kind, point.x, point.y, g.rank, { campId: `event:${site.id}`, memberId: String(point.index), lootSeed: g.seed });
    if (!actor)
      throw new Error('Preflighted event guardian could not be admitted');
    const level = site.scaling ? encounterMemberLevel(site.scaling, g.rank, g.seed) : site.level;
    Object.assign(actor, scaledEnemyStats(g.kind, level, g.rank), { level, biome: site.biome, hp: g.hp, homeX: site.x, homeY: site.y });
    alertEnemy(actor, player);
    g.admitted = true;
    g.x = actor.x;
    g.y = actor.y;
  }
}

/** End the score challenge without deleting live opponents or their source rewards. */
export function finishTrial(context: TrialContext): void {
  const trial=context.state.trial;if(!trial)return;
  const site=context.state.sites[trial.siteId];
  site.wavesCleared=trial.cleared;site.phase='completed';
  for(const enemy of context.enemies)if(enemy.campId===`event:${site.id}`){delete enemy.campId;delete enemy.campMemberId;}
  context.state.trial=null;
}
