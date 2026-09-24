import { BLESSINGS, EVENT_RULES, blessingChoices, type EventChoice, type EventSite } from './poi-content.ts';
import { eventRecipe } from './event-recipes.ts';
import { eventRewardItemCount } from './poi-rewards.ts';
import { dungeonTheme } from './dungeon-content.ts';
import { encounterRewardLevel } from './encounter-scaling.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { escapeUI, uiIcon, type UIIconName } from './ui-components.ts';

export interface EventChoiceRow {
  id: EventChoice | null;
  icon: UIIconName;
  title: string;
  detail: string;
  reward: string;
  rewardIcon: UIIconName;
}
export interface EventChoicePresentation {
  heading: string;
  place: string;
  level: number;
  type: string;
  icon: UIIconName;
  facts: string[];
  objective: string;
  choices: EventChoiceRow[];
}

/** Read-only player-facing descriptions. Quantities and timing follow runtime rules. */
export function eventChoicePresentation(site: EventSite): EventChoicePresentation {
  const recipe = eventRecipe(site);
  const count = (wavesCleared = 0, choice: EventChoice | null = null) => eventRewardItemCount({ ...site, wavesCleared, choice });
  const base = { heading: 'Begin event', place: site.name, level: site.level };
  if (site.kind === 'caravan') return {
    ...base, heading: 'Choose your reward', type: 'Recovered cargo', icon: 'inventory', facts: ['Choose 1 reward', 'Immediate reward'],
    objective: 'The cargo is yours. Take equipment or gold.',
    choices: [
      { id: 'goods', icon: 'inventory', title: 'Recover goods', detail: 'Recover equipment from the abandoned cargo.', reward: `${count(0, 'goods')} equipment items`, rewardIcon: 'inventory' },
      { id: 'coin', icon: 'gold', title: 'Take coin', detail: 'Receive gold instead of equipment.', reward: 'Gold cache', rewardIcon: 'gold' },
    ],
  };
  if (site.kind === 'standingStones' && recipe) return {
    ...base, heading: 'Choose your reward', type: 'Blessing ritual', icon: 'shield', facts: [`${recipe.rules.count} waves`, `${recipe.rules.hold}s in the circle per wave`],
    objective: 'Choose a blessing, then defeat the waves while defending the circle to earn it.',
    choices: blessingChoices(site).map(id => ({ id, icon: ({ haste: 'sword', wellspring: 'potion', bulwark: 'shield', fleet: 'dodge' } as const)[id], title: BLESSINGS[id].name, detail: BLESSINGS[id].description, reward: `${EVENT_RULES.blessingDuration}s blessing after victory`, rewardIcon: 'star' })),
  };
  if (recipe?.mode === 'timed') {
    const milestones = Array.from({ length: recipe.rules.count }, (_, i) => i + 1).filter(wave => count(wave) > count(wave - 1));
    return { ...base, type: 'Timed battle', icon: 'hourglass', facts: [`${recipe.rules.duration} seconds`, 'Growing enemy waves'],
      objective: `Defeat as many complete waves as you can before the ${recipe.rules.duration}-second timer ends.`,
      choices: [{ id: null, icon: 'hourglass', title: recipe.action, detail: `First wave: ${count(1)} item. Earn another at ${milestones.slice(1, 4).join(', ')}… waves, up to ${count(recipe.rules.count)} items.`, reward: 'Every completed wave adds gold', rewardIcon: 'gold' }],
    };
  }
  if (recipe) {
    const mode = recipe.mode;
    const icon: UIIconName = mode === 'seals' ? 'seal' : mode === 'defend' ? 'shield' : 'sword';
    const objective = mode === 'seals' ? `${recipe.objective}. Defeat each group, then interact with its objective.`
      : mode === 'defend' ? `Defeat all ${recipe.rules.count} waves and spend ${recipe.rules.hold} seconds inside the marked area each wave.`
      : `${recipe.objective} across ${recipe.rules.count} waves. Defeat every enemy to finish.`;
    return { ...base, type: mode === 'seals' ? 'Break seals' : mode === 'defend' ? 'Hold ground' : 'Clear enemies', icon,
      facts: [`${recipe.rules.count} ${mode === 'seals' ? 'objectives' : 'waves'}`, mode === 'defend' ? `${recipe.rules.hold}s hold per wave` : 'No time limit'], objective,
      choices: [{ id: null, icon, title: recipe.action, detail: 'Complete every objective to earn the event reward.', reward: `${count()} equipment ${count() === 1 ? 'item' : 'items'}${site.kind === 'graveyard' ? '' : ' + gold'} + XP`, rewardIcon: 'inventory' }],
    };
  }
  const beacon = site.kind === 'watchtower', camp = site.kind === 'camp';
  return { ...base, heading: beacon ? 'Light beacon' : 'Claim reward', type: beacon ? 'Exploration beacon' : camp ? 'Camp strongbox' : 'Reliquary', icon: beacon ? 'lantern' : 'inventory', facts: [beacon ? `${EVENT_RULES.beaconChannel}s channel` : 'Immediate reward'],
    objective: beacon ? 'Light the beacon to reveal nearby terrain and a distant landmark.' : 'Open the cache to release its treasure.',
    choices: [{ id: null, icon: beacon ? 'lantern' : 'inventory', title: beacon ? 'Light beacon' : camp ? 'Open strongbox' : 'Open reliquary', detail: beacon ? 'Discover more of the surrounding world.' : 'Collect the items and coins from the ground.', reward: beacon ? 'Terrain + landmark revealed' : camp ? `${count()} equipment item + gold` : 'Gold + chance of equipment', rewardIcon: beacon ? 'map' : 'inventory' }],
  };
}

export function dungeonChoicePresentation(entrance: DungeonEntrance): EventChoicePresentation {
  const boss = dungeonTheme(entrance.seed, entrance.theme).bossName ?? 'Hollow Warden';
  const bossLevel = entrance.scaling ? encounterRewardLevel(entrance.scaling, 3) : entrance.level;
  return { heading: 'Enter dungeon', place: entrance.name, level: entrance.level, type: 'Dungeon expedition', icon: 'portal', facts: ['Boss encounter'],
    objective: 'Explore the chambers and defeat the dungeon guardian.',
    choices: [{ id: null, icon: 'portal', title: 'Enter dungeon', detail: `${boss} · Lv ${bossLevel}`, reward: 'Loot from enemies and chests', rewardIcon: 'inventory' }],
  };
}

/** Shared by the runtime modal and the nonmodal, disposable tool study. No footnotes. */
export function eventChoiceMarkup(content: EventChoicePresentation, dungeon = false, modal = true): string {
  return `<section class="ui-window event-window" ${modal ? 'role="dialog" aria-modal="true"' : ''} aria-label="${escapeUI(content.heading)}">
    <header class="ui-window-header"><div class="event-heading"><span class="ui-header-emblem">${uiIcon(content.icon)}</span><h2 class="ui-title">${escapeUI(content.heading)}</h2></div><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close interaction">${uiIcon('close')}</button></header>
    <div class="ui-window-body event-body"><div class="event-place"><h3>${escapeUI(content.place)}</h3><div class="event-meta"><span class="event-level">Lv <strong>${content.level}</strong></span><span>${escapeUI(content.type)}</span>${content.facts.map(fact => `<span>${escapeUI(fact)}</span>`).join('')}</div></div>
    <p class="event-objective">${escapeUI(content.objective)}</p>${content.choices.length > 1 ? '<p class="event-choice-prompt">Choose one</p>' : ''}
    <div class="event-choices">${content.choices.map(choice => `<button type="button" class="ui-button event-choice" ${dungeon ? 'data-enter' : `data-choice="${choice.id ?? ''}"`}><span class="event-choice-mark">${uiIcon(choice.icon)}</span><span class="event-choice-copy"><strong>${escapeUI(choice.title)}</strong><span class="event-choice-detail">${escapeUI(choice.detail)}</span><span class="event-choice-reward">${uiIcon(choice.rewardIcon)}${escapeUI(choice.reward)}</span></span><span class="event-choice-indicator">${uiIcon('chevron')}</span></button>`).join('')}</div></div>
  </section>`;
}
