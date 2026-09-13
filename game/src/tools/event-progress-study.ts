import { eventRecipe, recipeMembers } from '../event-recipes.ts';
import { EVENT_RULES, freshEvents, type EventSite, type EventRecord } from '../poi-content.ts';
import { freshWaves } from '../wave-system.ts';

/** Authored presentation timeline. Finite fights have no runtime countdown. */
export function eventStudyProfile(site: EventSite) {
  const recipe = eventRecipe(site);
  if (recipe) return { duration: recipe.mode === 'timed' ? recipe.rules.duration : recipe.rules.count * 12, mode: recipe.mode,
    note: recipe.mode === 'timed' ? 'Real event duration; sample wave casualties, no combat.' : 'Staged waves and objectives: 12 preview seconds per wave, not a gameplay time limit.' };
  if (site.kind === 'watchtower') return { duration: EVENT_RULES.beaconChannel, mode: 'channel', note: 'Real beacon channel duration; no exploration or saves are changed.' };
  return { duration: 0, mode: 'instant', note: site.kind === 'camp' ? 'Clear the garrison, then open the strongbox instantly. There is no timed trial; select Opening to inspect the reward.' : 'This interaction resolves instantly. There is no in-progress timer; use View choices or select Opening.' };
}

export function stageEventProgress(site: EventSite, time: number) {
  const profile = eventStudyProfile(site), elapsed = Math.max(0, Math.min(profile.duration, Number.isFinite(time) ? time : 0));
  const state = freshEvents(), recipe = eventRecipe(site);
  if (!recipe) return { state, elapsed, profile };
  const position = recipe.mode === 'timed' ? elapsed / 15 : elapsed / 12;
  const wave = Math.min(recipe.rules.count - 1, Math.floor(position)), part = Math.min(1, position - wave);
  const cleared = Math.min(recipe.rules.count, Math.floor(position));
  const record: EventRecord = { ...site, phase: 'active', choice: site.kind === 'standingStones' ? 'haste' : null, wavesCleared: cleared, delivered: 0, bonusGranted: false };
  const members = recipeMembers(site), currentCount = members.filter(member => member.wave === wave).length;
  const deadCount = Math.min(currentCount, Math.floor(part / .7 * currentCount));
  let currentIndex = 0;
  const guardians = members.map(member => {
    const dead = member.wave < wave || member.wave === wave && currentIndex++ < deadCount;
    return { ...member, x: site.x, y: site.y, hp: dead ? 0 : 1, dead, admitted: member.wave <= wave };
  });
  state.sites[site.id] = record;
  state.trial = { ...freshWaves(), siteId: site.id, started: true, elapsed, wave, cleared, guardians,
    held: recipe.mode === 'defend' ? recipe.rules.hold * Math.min(1, part / .9) : 0,
    sealReady: recipe.mode === 'seals' && deadCount === currentCount };
  return { state, elapsed, profile };
}
