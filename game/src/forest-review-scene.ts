import type { World } from './world.ts';
import type { Player } from './model.ts';
import { PLAYER_MOVEMENT } from './combat-content.ts';

/** A collision-checked pose path through actual seeded forest; never ticks gameplay. */
export function forestReviewScene(world: World) {
  const props = world.getProps(-5920, -3320, 1000, 880);
  const perches = props.filter(p => p.biome === 'verdant' && ['rock', 'stump', 'deadTree'].includes(p.kind));
  const options: { x: number; y: number; score: number }[] = [];
  for (const perch of perches) for (const offset of [35, 55, -35]) {
    const x = perch.x, y = perch.y + offset;
    if (world.getBuildings(x - 330, y - 250, 660, 460).length || world.sampleBiome(x, y).id !== 'verdant') continue;
    let clear = true;
    for (let dx = -95; dx <= 95; dx += 5) if (world.blocked(x + dx, y, 14)) { clear = false; break; }
    if (!clear) continue;
    const forest = props.filter(p => Math.abs(p.x - x) < 280 && Math.abs(p.y - y) < 190);
    const score = forest.filter(p => p.kind === 'canopy').length * 3
      + forest.filter(p => p.kind === 'fern' || p.kind === 'flowers').length * 2
      - Math.hypot(x + 5520, y + 2880) * .008;
    options.push({ x, y, score });
  }
  options.sort((a, b) => b.score - a.score);
  if (!options[0]) throw new Error('No clear forest review path found.');
  return { x: options[0].x, y: options[0].y, width: 720, height: 440, duration: 14 };
}

export function stageForestPlayer(player: Player, scene: { x: number; y: number }, time: number) {
  // Stand, walk past a perch, watch, return, then settle before the next loop.
  const distance = time < 2 ? 0 : time < 6 ? (time - 2) * 45 : time < 8 ? 180
    : time < 12 ? 180 - (time - 8) * 45 : 0;
  const vx = time >= 2 && time < 6 ? 45 : time >= 8 && time < 12 ? -45 : 0;
  player.x = player.prevX = scene.x - 90 + distance; player.y = player.prevY = scene.y;
  player.vx = vx; player.vy = 0;
  player.angle = vx < 0 ? Math.PI : vx > 0 ? 0 : -Math.PI / 2;
  const traveled = time < 8 ? distance : 360 - distance;
  player.walkTime = traveled / PLAYER_MOVEMENT.gaitDistance;
}
