import { eventRecipe } from './event-recipes.ts';
import { eventLabel, type EventState } from './poi-content.ts';

/** Read-only projection of the admitted trial clock; never advances an event. */
export function eventProgress(state: EventState) {
  const trial = state.trial;
  if (!trial) return null;
  const site = state.sites[trial.siteId];
  if (!site || site.phase !== 'active') return null;
  const recipe = eventRecipe(site);
  if (!recipe) return null;
  const timed = recipe.mode === 'timed', duration = recipe.rules.duration;
  const fraction = timed ? 1 - trial.elapsed / duration : trial.cleared / recipe.rules.count;
  return { site, timed, label: eventLabel(site, state, false), fraction: Math.max(0, Math.min(1, fraction)), started: trial.started };
}
