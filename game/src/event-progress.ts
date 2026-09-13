import { eventRecipe } from './event-recipes.ts';
import type { EventState } from './poi-content.ts';

/** Read-only projection of the admitted trial clock; never advances an event. */
export function cursedChestProgress(state: EventState) {
  const trial = state.trial;
  if (!trial) return null;
  const site = state.sites[trial.siteId];
  if (!site || site.kind !== 'cursedChest' || site.phase !== 'active') return null;
  const recipe = eventRecipe(site);
  if (!recipe || recipe.mode !== 'timed' || recipe.rules.duration <= 0) return null;
  const duration = recipe.rules.duration;
  const elapsed = Math.min(duration, Math.max(0, trial.elapsed));
  return { site, duration, elapsed, remaining: duration - elapsed, fraction: (duration - elapsed) / duration, started: trial.started };
}
