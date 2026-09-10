import { currentDungeon, type Expeditions } from './dungeon-state.ts';
import { dungeonChestMask } from './expedition-route.ts';
import { dungeonTheme } from './dungeon-content.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { JourneyMarker } from './journey-marker.ts';

export interface DungeonJourney {
  id: string;
  name: string;
  level: number;
  objective: string;
  phase: 'boss' | 'chest' | 'exit';
  marker: JourneyMarker | null;
  stage?: number;
}
/** Temporary local guidance; never replaces the player's saved surface pin. */
export function dungeonJourney(state: Expeditions, floor: DungeonFloor | null | undefined): DungeonJourney | null {
  const run = currentDungeon(state);
  if (!run || !floor) return null;
  const boss = run.states.warden;
  const bossName = dungeonTheme(run.entrance.seed, run.entrance.theme).bossName ?? 'Hollow Warden';
  const phase = boss.hp > 0 ? 'boss' : run.chestMasks[2] === dungeonChestMask(run, 2) ? 'exit' : 'chest';
  const objective = phase === 'boss' ? `Defeat ${bossName}` : phase === 'chest' ? 'Claim the boss chest' : 'Return to the surface';
  const target = phase === 'boss' ? boss : phase === 'chest' ? floor.chests[2] : floor.exit;
  let marker: JourneyMarker | null = { x: target.x, y: target.y, name: objective, known: true };
  const bossRoom = floor.rooms.find(r => r.kind === 'boss');
  if (phase === 'boss' && bossRoom && !run.explored.includes(bossRoom.id)) {
    // Guide to the revealed doorway on the route to the boss, not to an arbitrary side room.
    const toward = new Map<number, number>(), queue = [bossRoom.id];
    const visited = new Set(queue);
    for (let i = 0; i < queue.length; i++) for (const [a,b] of floor.edges) {
      const next = a === queue[i] ? b : b === queue[i] ? a : undefined;
      if (next !== undefined && !visited.has(next)) { visited.add(next); toward.set(next, queue[i]); queue.push(next); }
    }
    const fromId = queue.find(id => run.explored.includes(id));
    const toId = fromId === undefined ? undefined : toward.get(fromId);
    const from = floor.rooms.find(r => r.id === fromId), to = floor.rooms.find(r => r.id === toId);
    const connection=floor.edges.findIndex(([a,b])=>a===fromId&&b===toId||a===toId&&b===fromId);
    const passage=floor.corridors.find(c=>c.connection===connection);
    const point=passage?.path?.[Math.floor(passage.path.length/2)];
    marker = point ? {...point,known:false,name:objective} : from && to ? { x: to.x+to.width/2, y: to.y+to.height/2, known:false, name:objective } : null;
  }
  return { id: run.entrance.id, name: run.entrance.name, level: run.entrance.level + 3, objective, phase, marker,
    ...(run.entrance.expedition ? {stage: run.entrance.expedition.stage + 1} : {}) };
}
