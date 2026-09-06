import type { World } from './world.ts';
import type { Simulation } from './simulation.ts';
import type { CombatEvent } from './model.ts';
import { BASIC_ATTACK_PHASES, PLAYER_MOVEMENT } from './combat-content.ts';
import { deriveAttackStats } from './equipment.ts';
export interface WaterReviewScene { x: number; y: number; nx: number; ny: number; width: number; kind: 'river' | 'lake'; }
export function waterReviewScene(world: World, kind: 'river' | 'lake'): WaterReviewScene {
  const features = world.hydrology.query(-16000, -16000, 32000, 32000).filter(f => f.kind === kind);
  const candidates = features.map(f => {
    const index = Math.floor(f.points.length * .55), p = f.points[index];
    const q = f.points[Math.min(f.points.length - 1, index + 1)], length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const nx = kind === 'river' ? -(q.y - p.y) / length : 1, ny = kind === 'river' ? (q.x - p.x) / length : 0;
    const x = kind === 'lake' ? p.x - p.width * .79 : p.x, y = p.y;
    const biome = world.sampleBiome(x, y).weights;
    return { x, y, nx, ny, width: kind === 'lake' ? 85 : p.width,
      kind, score: Math.hypot(x, y) - (biome.verdant + biome.autumn) * 30000 };
  }).filter(p => world.sampleWater(p.x, p.y).coverage > .9 && !world.isSanctuary(p.x, p.y));
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates[0]) throw new Error('No water review site for this seed.');
  return candidates[0];
}
/** Authored poses and contacts only: no gameplay updates, damage, rewards or persistence. */
export function stageWaterScene(sim: Simulation, scene: WaterReviewScene, before: number, time: number): CombatEvent[] {
  const p = sim.player, span = scene.kind === 'river' ? scene.width + 48 : 120;
  const distance = time < 1 ? -span : time < 4 ? -span + (time - 1) * span / 3 : time < 10 ? 0 : Math.min(span, (time - 10) * span / 3);
  const speed = time >= 1 && time < 4 || time >= 10 && time < 13 ? span / 3 : 0;
  p.x = p.prevX = scene.x + scene.nx * distance; p.y = p.prevY = scene.y + scene.ny * distance;
  p.vx = scene.nx * speed; p.vy = scene.ny * speed; p.angle = Math.atan2(scene.ny, scene.nx);
  p.walkTime = (distance + span) / PLAYER_MOVEMENT.gaitDistance;
  sim.time = time; p.attack = null;
  if (time >= 5 && time < 5.625 || time >= 6.2 && time < 6.825) {
    const elapsed = time >= 6.2 ? time - 6.2 : time - 5;
    const weapon = p.equipment.mainHand, stats = deriveAttackStats(p.stats, weapon), duration = 1 / stats.attacksPerSecond;
    p.attack = { kind: 'melee', weapon, hand: 'main', elapsed, duration, activeStart: duration * BASIC_ATTACK_PHASES.activeStart,
      activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd, angle: p.angle, range: stats.range, arc: stats.arc, damage: 0, hitIds: new Set() };
  }
  const out: CombatEvent[] = [];
  if (before < 8 && time >= 8) out.push({ type: 'blast', x: scene.x + 40, y: scene.y - 25, radius: 75, color: '#8cc8e6', style: 'frost' });
  if (before < 9.2 && time >= 9.2) out.push({ type: 'blast', x: scene.x - 50, y: scene.y + 25, radius: 48, color: '#edb771', style: 'fire' });
  return out;
}
