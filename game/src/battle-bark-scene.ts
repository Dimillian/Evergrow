import { BattleBarks } from './battle-barks.ts';
import { GAME_FEATURES } from './game-features.ts';
import { drawBattleBark, measureBattleBark } from './battle-bark-art.ts';
import { placeBattleBark, type BarkRect } from './battle-bark-layout.ts';
import { enemyEngaged } from './enemy-engagement.ts';
import { ENEMY_BODY_BOUNDS, ENEMY_SPEECH_TOP } from './enemy-body.ts';
import { canBark } from './battle-bark-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { WARDEN_RULES } from './dungeon-boss.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { worldToScreen, type CameraView } from './camera.ts';
import { propDefinition } from './biome-props.ts';
import type { Simulation } from './simulation.ts';
import type { World } from './world.ts';
import type { SceneVisibility } from './scene-visibility.ts';
import type { CombatEvent, Enemy } from './model.ts';

function speechTop(enemy: Enemy): number {
  const body = ENEMY_BODY_BOUNDS[enemy.kind];
  const head = canBark(enemy.kind) ? ENEMY_SPEECH_TOP[enemy.kind] : body.top;
  return Math.min(head, enemy.rank !== 'normal' ? body.top - 26
    : enemy.hp < enemy.maxHp || enemy.state === 'windup' ? body.top - 12 : head);
}

/** Actual interpolated silhouettes and world obstruction feed the presentation policy. */
export class BattleBarkScene {
  private barks: BattleBarks;
  constructor(random: () => number = Math.random) { this.barks = new BattleBarks(random); }
  reset(): void { this.barks.reset(); }
  noteEvents(events: readonly CombatEvent[]): void { this.barks.noteEvents(events); }
  draw(c: CanvasRenderingContext2D, sim: Simulation, world: World, view: CameraView,
    enabled: boolean, props: SceneVisibility['props'], reserved: BarkRect[],
    crownOpacity?: ReadonlyMap<string, number>): void {
    if (!GAME_FEATURES.battleBarks) { this.reset(); return; }
    const project = (x: number, y: number) => worldToScreen(view, x, y);
    const width = view.width * view.zoom, height = view.height * view.zoom;
    const alpha = sim.interpolationAlpha;
    const interpolate = (actor: { prevX: number; prevY: number; x: number; y: number }) => ({
      x: actor.prevX + (actor.x - actor.prevX) * alpha, y: actor.prevY + (actor.y - actor.prevY) * alpha,
    });
    const rectangle = (x: number, y: number, w: number, h: number): BarkRect => ({ ...project(x, y), width: w * view.zoom, height: h * view.zoom });
    const reserveLane = (x: number, y: number, angle: number, length: number, radius: number) => {
      const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
      reserved.push(rectangle(x + Math.min(0, dx) - radius, y + Math.min(0, dy) - radius,
        Math.abs(dx) + radius * 2, Math.abs(dy) + radius * 2));
    };
    const p = interpolate(sim.player), actors = new Map(sim.enemies.filter(e => e.hp > 0).map(e => [e.id, e]));
    const positions = new Map([...actors].map(([id, e]) => [id, interpolate(e)]));
    // Include equipment clearance, not just collision feet. Player actions retain priority.
    reserved.push(rectangle(p.x - 38, p.y - 85, 76, 95));
    for (const [id, e] of actors) {
      const at = positions.get(id)!, body = ENEMY_BODY_BOUNDS[e.kind];
      const top = canBark(e.kind) ? ENEMY_SPEECH_TOP[e.kind] : body.top;
      reserved.push(rectangle(at.x - body.radiusX - 10, at.y + top,
        (body.radiusX + 10) * 2, body.bottom - top + 8));
      if (e.rank !== 'normal') reserved.push(rectangle(at.x - 14, at.y + body.top - 24, 28, 22));
      if (e.hp < e.maxHp || e.state === 'windup') reserved.push(rectangle(at.x - 22, at.y + body.top - 6, 44, 6));
      if (e.state === 'windup' || e.state === 'attack') {
        const definition = ENEMY_DEFINITIONS[e.kind];
        if (e.kind === 'warden' && e.bossMove === 'fracture') {
          for (const offset of [-.5, 0, .5]) reserveLane(e.x, e.y, e.attackAngle + offset, WARDEN_RULES.fractureLength, WARDEN_RULES.fractureWidth);
        } else if (definition.attack === 'ground') {
          const radius = definition.blastRadius;
          reserved.push(rectangle(e.attackTargetX - radius, e.attackTargetY - radius, radius * 2, radius * 2));
        } else if (definition.attack === 'projectile') {
          for (const offset of definition.shotOffsets) reserveLane(at.x, at.y, e.attackAngle + offset, definition.range, 3);
        } else if (definition.engageDistance) {
          const remaining = Math.max(0, definition.active - (e.state === 'attack' ? e.stateTime : 0));
          reserveLane(at.x, at.y, e.attackAngle, definition.lungeSpeed * remaining + definition.range, 12);
        } else {
          // Conservative full tell envelope: speech yields even to the rear of a sweep.
          const radius = definition.range;
          reserved.push(rectangle(at.x - radius, at.y - radius, radius * 2, radius * 2));
        }
      }
    }
    for (const effect of sim.groundEffects) reserved.push(rectangle(effect.x - effect.radius, effect.y - effect.radius, effect.radius * 2, effect.radius * 2));
    // Admission uses the current head position during the bounded greeting window.
    const visible = (id: number) => {
      const enemy = actors.get(id), at = positions.get(id);
      if (!enemy || !at || !enemyEngaged(enemy) || sim.player.dead) return false;
      const body = ENEMY_BODY_BOUNDS[enemy.kind], head = project(at.x, at.y + body.top);
      const feet = project(at.x, at.y + body.bottom);
      if (head.x < body.radiusX * view.zoom || head.x > width - body.radiusX * view.zoom || head.y < 0 || feet.y > height) return false;
      if (!hasLineOfSight(world, p.x, p.y, at.x, at.y)) return false;
      // Bare branches and foliage faded by the renderer do not hide an otherwise visible speaker.
      if (world.getBuildingAt(at.x, at.y)) return false;
      const headY = at.y + body.top;
      return !props.some(prop => {
        if (prop.y < at.y) return false;
        if (prop.kind === 'deadTree' || prop.kind === 'charredTree' || (crownOpacity?.get(prop.id) ?? 1) < .5) return false;
        const crown = propDefinition(prop.kind).canopy;
        return !!crown && Math.abs(at.x - prop.x - crown.offsetX * prop.scale) < crown.radius * prop.scale
          && headY > prop.y - (crown.height + crown.radius) * prop.scale
          && headY < prop.y - (crown.height - crown.radius) * prop.scale;
      });
    };
    const placed = new Map<number, ReturnType<typeof placeBattleBark>>();
    this.barks.update(sim.time, new Set(actors.keys()), enabled, visible, bark => {
      const at = positions.get(bark.id)!;
      const box = placeBattleBark(bark.text, project(at.x, at.y + speechTop(actors.get(bark.id)!)),
        { width, height }, line => measureBattleBark(c, line), reserved);
      if (!box) return false;
      reserved.push(box); placed.set(bark.id, box); return true;
    });
    if (enabled) for (const bark of this.barks.active) {
      const box = placed.get(bark.id); if (box) drawBattleBark(c, box, sim.time - bark.started);
    }
  }
}
