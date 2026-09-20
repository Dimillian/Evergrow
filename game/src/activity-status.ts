import { eventClaimed, eventLabel, isEventKind, type EventState } from './poi-content.ts';
import { dungeonChestClaimed } from './expedition-route.ts';
import type { Expeditions } from './dungeon-state.ts';

interface ActivitySource { id: string; kind: string }
interface ActivityFacts { events: EventState; expeditions: Expeditions; campCleared(id: string): boolean }
export interface ActivityStatus { label: string; rewardsClaimed: boolean }

/** Reward ownership, never combat victory or presentation text, finishes an activity. */
export function activityRewardsClaimed(source: ActivitySource, facts: Pick<ActivityFacts, 'events' | 'expeditions'>): boolean {
  if (source.kind === 'dungeon') return !!facts.expeditions.cleared?.includes(source.id)
    || facts.expeditions.runs.some(run => run.entrance.id === source.id && dungeonChestClaimed(run, 2));
  return isEventKind(source.kind) && eventClaimed(facts.events, source.id);
}

/** Shared overworld/minimap status, including reward-bearing dungeons. */
export function activityStatus(source: ActivitySource, facts: ActivityFacts): ActivityStatus | null {
  const rewardsClaimed = activityRewardsClaimed(source, facts);
  if (source.kind === 'dungeon') {
    if (rewardsClaimed) return { label: 'Claimed', rewardsClaimed };
    const run = facts.expeditions.runs.find(run => run.entrance.id === source.id);
    return run ? { label: run.states.warden.hp <= 0 ? 'Reward waiting' : 'Expedition active', rewardsClaimed } : null;
  }
  if (!isEventKind(source.kind)) return null;
  const site = facts.events.sites[source.id] ?? { id: source.id, kind: source.kind };
  return { label: eventLabel(site, facts.events, facts.campCleared(source.id)), rewardsClaimed };
}
