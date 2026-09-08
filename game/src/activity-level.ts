import { getZoneAt } from './zone-progression.ts';
import { encounterScaleAt, encounterRewardLevel } from './encounter-scaling.ts';
import type { JourneyFacts } from './journey-director.ts';
export function activityLevel(goal: { id: string; kind: string; x: number; y: number }, facts: JourneyFacts, seed: number): number {
  const record = facts.events.sites[goal.id];
  if (record) return record.level;
  const run = facts.expeditions.runs.find(r => r.entrance.id === goal.id);
  if (run) return run.entrance.scaling ? encounterRewardLevel(run.entrance.scaling, 3) : run.entrance.level;
  const saved = facts.encounterScale?.(goal.id);
  if (!saved && goal.kind === 'camp' && facts.campCleared(goal.id)) return getZoneAt(goal.x,goal.y,seed).originalLevel;
  const scale = saved ?? encounterScaleAt(goal.x, goal.y, seed, facts.level);
  return encounterRewardLevel(scale, goal.kind === 'bossLair' || goal.kind === 'dungeon' ? 3 : 0);
}
