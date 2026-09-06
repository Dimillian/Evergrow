import { freshJourneys, type JourneyGoal, type JourneyKind, type JourneyState } from './journey-state.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Player } from './model.ts';
import { awardCharacterExperience } from './character.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { xpLevelFactor } from './progression.ts';

/** Bonus measured in normal same-level stalker kills, separate from the site's own reward. */
export const JOURNEY_XP: Readonly<Record<JourneyKind, number>> = Object.freeze({
  camp: 1.5, caravan: .5, watchtower: .5, graveyard: 1.5, standingStones: 1,
  reliquary: .25, dungeon: 3, town: .5, frontier: .5,
});
export interface JourneyCompletion { id: string; name: string; xp: number; }
export function journeyXP(kind: JourneyKind, sourceLevel: number, playerLevel: number): number {
  return Math.max(1, Math.round(scaledEnemyStats('stalker', sourceLevel, 'normal').xpReward * JOURNEY_XP[kind] * xpLevelFactor(playerLevel, sourceLevel)));
}
export function journeyWasCompleted(state: JourneyState, id: string): boolean {
  return !!state.completed?.includes(id) || [...state.accepted, ...state.offers, ...state.history].some(g => g.id === id && g.finishedAt !== undefined);
}
/** Mutates a staged checkpoint only. Source commands persist this alongside their own claim. */
export function stageJourneyCompletion(checkpoint: CharacterCheckpoint, goal: JourneyGoal, player: Player, time: number,
  preAwardLevel = player.level): JourneyCompletion | null {
  const state = checkpoint.journeys ??= freshJourneys();
  if (journeyWasCompleted(state, goal.id)) return null;
  const xp = journeyXP(goal.kind, goal.level, preAwardLevel);
  const finished = { ...goal, finishedAt: time, rewardXP: xp };
  const listed = [...state.accepted, ...state.offers].some(g => g.id === goal.id);
  state.accepted = state.accepted.map(g => g.id === goal.id ? finished : g);
  state.offers = state.offers.map(g => g.id === goal.id ? finished : g);
  if (!listed) state.history = [...state.history, finished].slice(-64);
  state.completed = [...state.completed ?? [], goal.id];
  if(state.recommended===goal.id)state.recommended=null;
  if (state.tracked === goal.id) state.tracked = null;
  const staged = { ...player, character: checkpoint.character, level: checkpoint.level, xp: checkpoint.xp };
  awardCharacterExperience(staged, xp);
  checkpoint.character = staged.character; checkpoint.level = staged.level; checkpoint.xp = staged.xp;
  return { id: goal.id, name: goal.name, xp };
}
