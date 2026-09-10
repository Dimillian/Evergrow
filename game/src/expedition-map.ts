import type { DungeonEntrance } from './dungeon.ts';
import type { Expeditions } from './dungeon-state.ts';
import { expeditionChoices, type ExpeditionRoute } from './expedition-route.ts';

export interface ExpeditionMapNode {
  id: string;
  stage: number;
  choice: number;
  x: number;
  y: number;
  state: 'cleared' | 'skipped' | 'available';
  entry?: DungeonEntrance;
}

/** Revealed trail only. Never generate or expose future choices in the map projection. */
export function expeditionMap(route: ExpeditionRoute, runs: Expeditions['runs']): ExpeditionMapNode[][] {
  return Array.from({ length: Math.min(10, route.cleared + 1) }, (_, stage) => {
    const y = 180 + (route.cleared - stage) * 170;
    const x = 300 + (stage < route.cleared ? Math.sin(stage * 2.1) * 65 : 0);
    const visited = runs.find(r => r.entrance.expedition?.attempt === route.attempt && r.entrance.expedition.stage === stage);
    if (stage < route.cleared) return [{
      id: `cleared-${stage}`, stage, choice: visited?.entrance.expedition?.choice ?? -1,
      x, y, state: 'cleared', entry: visited?.entrance,
    }];
    // Once entered, only the saved branch remains selectable for resuming.
    const entries = visited ? [visited.entrance] : expeditionChoices(route);
    return entries.map((entry, index) => ({
      id: `${stage}-${entry.expedition!.choice}`, stage, choice: entry.expedition!.choice,
      x: entries.length === 2 ? 190 + index * 220 : 300, y, entry,
      state: route.choice === null || route.choice === entry.expedition!.choice ? 'available' : 'skipped',
    }));
  });
}
