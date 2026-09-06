import { WaterSimulation, type WaterSampler } from './water-simulation.ts';
import type { CombatEvent } from './model.ts';
interface Actor { id: number; x: number; y: number; }
/** Converts actual movement/contact events into bounded impulses; never advances or mutates combat. */
export class WaterPresentation {
  readonly fluid = new WaterSimulation();
  private previous = new Map<number, { x: number; y: number; distance: number; side: number }>();
  private events: CombatEvent[] = [];
  private world: object | undefined;
  reset() { this.fluid.reset(); this.previous.clear(); this.events.length = 0; this.world = undefined; }
  handleEvents(events: readonly CombatEvent[], reduced: boolean) {
    if (reduced) return;
    for (const e of events) if (['hit', 'hurt', 'kill', 'blast', 'ground', 'dodge'].includes(e.type) && this.events.length < 32) this.events.push(e);
  }
  update(world: object, bounds: { x: number; y: number; width: number; height: number }, sample: WaterSampler,
    actors: readonly Actor[], dt: number, reduced: boolean, blade?: { x: number; y: number }) {
    if (world !== this.world) { const events = this.events; this.reset(); this.events = events; this.world = world; }
    this.fluid.fit(bounds, sample);
    this.fluid.update(dt, reduced);
    if (reduced || dt <= 0) { this.events.length = 0; this.previous.clear(); return; }
    const alive = new Set<number>();
    for (const actor of actors.slice(0, 25)) {
      alive.add(actor.id);
      const old = this.previous.get(actor.id), distance = old ? Math.hypot(actor.x - old.x, actor.y - old.y) : 0;
      if (old && distance <= 120) {
        old.distance += distance;
        if (old.distance >= 18) {
          old.distance %= 18; old.side *= -1;
          const angle = Math.atan2(actor.y - old.y, actor.x - old.x);
          this.fluid.disturb({ x: actor.x - Math.sin(angle) * old.side * 5, y: actor.y + Math.cos(angle) * old.side * 4,
            radius: 22, strength: Math.min(1.1, .45 + distance / Math.max(.001, dt) / 550) });
        }
        old.x = actor.x; old.y = actor.y;
      } else this.previous.set(actor.id, { x: actor.x, y: actor.y, distance: 0, side: 1 });
    }
    for (const id of this.previous.keys()) if (!alive.has(id)) this.previous.delete(id);
    for (const e of this.events) {
      const radius = e.type === 'blast' || e.type === 'ground' ? e.radius : e.type === 'kill' ? 45 : 28;
      this.fluid.disturb({ x: e.x, y: e.y, radius, strength: e.type === 'blast' || e.type === 'ground' ? 2.2 : e.type === 'kill' ? 1.6 : 1 });
    }
    this.events.length = 0;
    // Actual active blade position is sampled by the renderer, not guessed from a windup event.
    if (blade) this.fluid.disturb({ ...blade, radius: 20, strength: .38 }, false);
  }
}
