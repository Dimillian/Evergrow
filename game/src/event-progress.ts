import { eventRecipe } from './event-recipes.ts';
import type { EventKind, EventState } from './poi-content.ts';

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
  const timer = timed ? `${Math.max(0, Math.ceil(duration - Math.max(0, trial.elapsed)))}s` : null;
  const wave = `Wave ${Math.min(trial.wave + 1, recipe.rules.count)}/${recipe.rules.count}`;
  const enemiesLeft = trial.guardians.filter(g => g.wave === trial.wave && !g.dead).length;
  const objective = trial.sealReady
    ? `${({ beastDen: 'Destroy nest', hamlet: 'Dismantle standard', corruptedGrove: 'Cleanse root' } as Partial<Record<EventKind, string>>)[site.kind] ?? 'Break seal'} · ${trial.wave + 1}/${recipe.rules.count}`
    : recipe.mode === 'defend' && trial.held < recipe.rules.hold ? `Hold ${Math.ceil(recipe.rules.hold - trial.held)}s` : null;
  const label = `${wave} · Enemies Left: ${enemiesLeft}${objective ? ` · ${objective}` : ''}`;
  return { site, timed, timer, wave, enemiesLeft, objective, label, fraction: Math.max(0, Math.min(1, fraction)), started: trial.started };
}
