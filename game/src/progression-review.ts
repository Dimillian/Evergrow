import './ui-kit.css';
import './typography.css';
import './progression-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { escapeUI } from './ui-components.ts';
import { BIOMES, type BiomeId } from './biomes.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { encounterRankChances } from './encounter-director.ts';
import { ENEMY_RANKS, MAX_CONTENT_LEVEL, normalizeLevel, itemPowerScale, itemPercentageScale, type EnemyRank } from './progression-content.ts';
import { getZoneAt, scaledEnemyStats, ZONE_RULES } from './zone-progression.ts';
import { enemyXPReward, xpForNextLevel, xpLevelFactor } from './progression.ts';
import { BIOME_PROFILE_WEIGHTS, ENEMY_ITEM_KIND_WEIGHTS, getLootTable } from './loot-content.ts';
import { lootItemLevel } from './loot.ts';
import { generateItem, TIER_COLORS, TIER_NAMES } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from './weapon-content.ts';
import type { ItemKind, ItemTier } from './character-types.ts';
import type { EnemyKind } from './model.ts';

// A local balancing surface over shared rules. No simulation, gameplay input, storage, or random combat runs.
if (!import.meta.env.DEV) throw new Error('Progression study is available only on the local development server.');
installUITheme();
const root = document.querySelector<HTMLElement>('#progression-review')!;
const abort = new AbortController();
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmt = (value: number) => number.format(value);
const yieldFmt = (value: number) => value > 0 && value < 1 ? value.toFixed(3) : fmt(value);
const pct = (value: number) => `${fmt(value * 100)}%`;
const tiers = Object.keys(TIER_NAMES) as ItemTier[];
const kinds = Object.keys(ENEMY_DEFINITIONS) as EnemyKind[];
const ranks = Object.keys(ENEMY_RANKS) as EnemyRank[];
const biomes = Object.keys(BIOMES) as BiomeId[];
const KIND_NAMES: Record<ItemKind, string> = { weapon: 'Weapon', grimoire: 'Grimoire', orb: 'Orb', shield: 'Shield', head: 'Head', chest: 'Chest',
  gloves: 'Gloves', legs: 'Legs', boots: 'Boots', cloak: 'Cloak', amulet: 'Amulet', ring: 'Ring' };
const params = new URLSearchParams(location.search);
const valid = <T extends string>(key: string, options: readonly T[], fallback: T): T => {
  const value = params.get(key); return options.find(option => option === value) ?? fallback;
};
const initialPlayer = normalizeLevel(Number(params.get('player') ?? 10));
const initialArea = normalizeLevel(Number(params.get('area') ?? initialPlayer));
const options = <T extends string>(values: readonly T[], label: (value: T) => string, selected: T) =>
  values.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeUI(label(value))}</option>`).join('');

function weightRows(entries: readonly [string, number][], total: number, color = 'var(--ui-jade)') {
  return entries.map(([name, value]) => `<div class="study-weight"><div><span>${escapeUI(name)}</span><b>${pct(value / total)}</b></div>
    <span class="study-weight-track"><i style="width:${value / total * 100}%;--weight-color:${color}"></i></span></div>`).join('');
}

function render() {
  const playerLevel = normalizeLevel(Number(root.querySelector<HTMLInputElement>('#study-player')!.value));
  const areaLevel = normalizeLevel(Number(root.querySelector<HTMLInputElement>('#study-area')!.value));
  const rank = root.querySelector<HTMLSelectElement>('#study-rank')!.value as EnemyRank;
  const kind = root.querySelector<HTMLSelectElement>('#study-kind')!.value as EnemyKind;
  const biome = root.querySelector<HTMLSelectElement>('#study-biome')!.value as BiomeId;
  const enemy = ENEMY_DEFINITIONS[kind], rankInfo = ENEMY_RANKS[rank];
  const stats = scaledEnemyStats(kind, areaLevel, rank);
  const rankChance = encounterRankChances(areaLevel)[rank];
  const xp = enemyXPReward(enemy.xpReward, playerLevel, areaLevel, rank);
  const threshold = xpForNextLevel(playerLevel), factor = xpLevelFactor(playerLevel, areaLevel);
  const table = getLootTable(rank), expectedItems = table.guaranteedItems + table.bonusItemChance;
  const itemLevel = lootItemLevel(areaLevel, rank);
  const common = generateItem(7329, itemLevel, 'weapon', 'longsword', 'common');
  const rare = generateItem(7329, itemLevel, 'weapon', 'longsword', 'rare');
  const zone = getZoneAt(ZONE_RULES.originX + (areaLevel - 1) * ZONE_RULES.bandWidth, ZONE_RULES.originY);
  const html = `<div class="study-summary">
    <section class="ui-window study-card">
      <header><p class="ui-kicker">01 · Encounter</p><span class="study-rank" style="color:${rankInfo.color}">${rankInfo.name} · Lv ${fmt(areaLevel)}</span></header>
      <h2>${enemy.name}</h2><div class="study-big">${fmt(stats.maxHp)}<span>life</span></div>
      <div class="study-pair"><span>Raw incoming hit</span><b>${fmt(stats.damage)}</b></div>
      <div class="study-pair"><span>Rank life / damage</span><b>×${fmt(rankInfo.healthMultiplier)} / ×${fmt(rankInfo.damageMultiplier)}</b></div>
      <div class="study-pair"><span>Rank roll before caps</span><b>${rankChance ? pct(rankChance) : '0% · hypothetical here'}</b></div>
      <p class="study-note">Area ${fmt(zone.level)} · ${fmt(zone.minDistance)}–${fmt(zone.maxDistance)} units from the origin. Geography fixes threat; your level never moves it.</p>
    </section>
    <section class="ui-window study-card study-xp">
      <header><p class="ui-kicker">02 · Experience</p><span class="study-rank">Character Lv ${fmt(playerLevel)}</span></header>
      <h2>Reward for this kill</h2><div class="study-big">${fmt(xp)}<span>XP</span></div>
      <div class="study-xp-track"><i style="width:${Math.min(100, xp / threshold * 100)}%"></i></div>
      <div class="study-pair"><span>Next level</span><b>${fmt(threshold)} XP</b></div>
      <div class="study-pair"><span>Level-gap reward</span><b>${pct(factor)}</b></div>
      <p class="study-note">${fmt(Math.ceil(threshold / xp))} of this foe from zero XP. Each level grants 1 skill point and 5 attribute points.</p>
    </section>
    <section class="ui-window study-card">
      <header><p class="ui-kicker">03 · Equipment</p><span class="study-rank">Item level ${fmt(itemLevel)}</span></header>
      <h2>Weapon power reference</h2><div class="study-item-probes">
        <div>${itemIconSVG(common, 44)}<span>Common longsword<b>${fmt(common.weapon!.damage)} damage</b></span></div>
        <div>${itemIconSVG(rare, 44)}<span style="color:${TIER_COLORS.rare}">Rare longsword<b>${fmt(rare.weapon!.damage)} damage</b></span></div>
      </div>
      <div class="study-pair"><span>Equip requirement</span><b>Lv ${fmt(common.requiredLevel)}</b></div>
      <div class="study-pair"><span>Flat / percentage budget</span><b>×${fmt(itemPowerScale(itemLevel))} / ×${fmt(itemPercentageScale(itemLevel))}</b></div>
      <p class="study-note">Benchmark weapons before attributes and affixes. These examples compare power; the loot table below determines which tiers can actually drop.</p>
    </section>
  </div>
  <section class="ui-window study-loot" id="loot-table">
    <header class="study-section-header"><div><p class="ui-kicker">Drop table · ${rankInfo.name}</p><h2>${fmt(expectedItems * 100)} items per 100 kills</h2></div>
      <p>${table.guaranteedItems ? '1 guaranteed item + ' : ''}${pct(table.bonusItemChance)} ${table.guaranteedItems ? 'second-item' : 'item'} chance<br><span class="ui-muted">Average yield · first-kill guarantee excluded</span></p></header>
    <div class="study-tier-row">${tiers.map(tier => `<div style="--tier:${TIER_COLORS[tier]}"><span>${TIER_NAMES[tier]}</span><b>${fmt(table.tierWeights[tier])}%</b><small>${yieldFmt(expectedItems * table.tierWeights[tier])} / 100 kills</small><i style="width:${table.tierWeights[tier]}%"></i></div>`).join('')}</div>
    <p class="study-footnote">Rarity percentages apply to each dropped item. The first kill of a run guarantees at least one piece of gear.</p>
  </section>
  <section class="ui-window study-comparison" id="level-curve">
    <header class="study-section-header"><div><p class="ui-kicker">Matching-level comparison</p><h2>The curve at a glance</h2></div><p class="ui-muted">${rankInfo.name} ${enemy.name} · character level equals area level</p></header>
    <div class="study-table-scroll"><table><thead><tr><th scope="col">Area / character</th><th scope="col">Monster life</th><th scope="col">Raw hit</th><th scope="col">XP / kill</th><th scope="col">XP to level</th><th scope="col">Kills to level</th><th scope="col">Drop iLvl</th><th scope="col">Common blade</th></tr></thead>
      <tbody>${[1, 5, 10, 20, 50].map(level => {
        const comparison = scaledEnemyStats(kind, level, rank), reward = enemyXPReward(enemy.xpReward, level, level, rank);
        const next = xpForNextLevel(level), dropLevel = lootItemLevel(level, rank);
        const blade = generateItem(7329, dropLevel, 'weapon', 'longsword', 'common');
        return `<tr${level === areaLevel && level === playerLevel ? ' class="is-selected"' : ''}><th scope="row">Lv ${level}</th><td>${fmt(comparison.maxHp)}</td><td>${fmt(comparison.damage)}</td><td>${fmt(reward)}</td><td>${fmt(next)}</td><td>${fmt(Math.ceil(next / reward))}</td><td>${dropLevel}</td><td>${fmt(blade.weapon!.damage)}</td></tr>`;
      }).join('')}</tbody></table></div>
    <p class="study-footnote">Kills are a reward comparison from zero XP against one repeated foe. They do not estimate combat time, mixed packs, travel, or player build strength.</p>
  </section>
  <div class="study-tables">
    <section class="ui-window study-detail"><header><p class="ui-kicker">Archetype → item kind</p><h2>${enemy.name}</h2></header>
      <p class="study-note">The enemy archetype biases equipment kind. Every equipment slot can still drop.</p>
      <div class="study-weights">${weightRows((Object.entries(ENEMY_ITEM_KIND_WEIGHTS[kind]) as [ItemKind, number][]).map(([id, weight]) => [KIND_NAMES[id], weight]), 100)}</div></section>
    <section class="ui-window study-detail"><header><p class="ui-kicker">Biome → weapon profile</p><h2>${BIOMES[biome].name}</h2></header>
      <p class="study-note">Conditional on a weapon dropping. Biomes change the mix, without excluding any weapon family.</p>
      <div class="study-weights">${weightRows(WEAPON_PROFILES.map(profile => [profile.name, BIOME_PROFILE_WEIGHTS[biome].weapon[profile.id]]), Object.values(BIOME_PROFILE_WEIGHTS[biome].weapon).reduce((sum, weight) => sum + weight, 0))}</div>
      <h3>Shield profiles</h3><div class="study-weights">${weightRows(SHIELD_PROFILES.map(profile => [profile.name, BIOME_PROFILE_WEIGHTS[biome].shield[profile.id]]), Object.values(BIOME_PROFILE_WEIGHTS[biome].shield).reduce((sum, weight) => sum + weight, 0), 'var(--ui-silver)')}</div></section>
  </div>`;
  root.querySelector<HTMLElement>('#study-results')!.innerHTML = html;
  root.querySelector<HTMLElement>('#study-announcement')!.textContent = `Area ${areaLevel}, character ${playerLevel}. ${rankInfo.name} ${enemy.name}: ${stats.maxHp} life, ${stats.damage} raw damage, ${xp} XP. Item level ${itemLevel}.`;
  root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
}

async function boot() {
  await loadGameFont();
  if (abort.signal.aborted) return;
  root.innerHTML = `<header class="study-heading"><div><p class="ui-kicker">Evergrow · Local design study</p><h1>Beyond the first clearing</h1><p>Explore how geography, enemies, experience and equipment grow together.</p></div>
    <div class="study-heading-tools"><span class="ui-badge">Live rule values</span><nav aria-label="Study sections"><a class="ui-button ui-button--quiet" href="#loot-table">Loot table</a><a class="ui-button ui-button--quiet" href="#level-curve">Level curve</a></nav></div></header>
    <form class="ui-window study-controls" aria-label="Progression parameters">
      <label>Character level<input class="ui-well" id="study-player" type="number" min="1" max="${MAX_CONTENT_LEVEL}" step="1" value="${initialPlayer}"></label>
      <label>Area level<input class="ui-well" id="study-area" type="number" min="1" max="${MAX_CONTENT_LEVEL}" step="1" value="${initialArea}"></label>
      <label>Monster<select class="ui-well" id="study-kind">${options(kinds, value => ENEMY_DEFINITIONS[value].name, valid('kind', kinds, 'stalker'))}</select></label>
      <label>Rank<select class="ui-well" id="study-rank">${options(ranks, value => ENEMY_RANKS[value].name, valid('rank', ranks, 'normal'))}</select></label>
      <label>Biome<select class="ui-well" id="study-biome">${options(biomes, value => BIOMES[value].name, valid('biome', biomes, 'deadwood'))}</select></label>
    </form><div id="study-results"></div><p class="study-announcement" id="study-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
    <footer class="study-page-footer">Shared runtime rules · no simulation or saved progress · raw incoming damage is shown before armor and shield block</footer>`;
  root.querySelector('form')!.addEventListener('submit', event => event.preventDefault(), { signal: abort.signal });
  root.querySelector('form')!.addEventListener('change', () => {
    for (const input of root.querySelectorAll<HTMLInputElement>('input[type="number"]')) input.value = String(normalizeLevel(Number(input.value)));
    render();
  }, { signal: abort.signal });
  render();
  if (['#loot-table', '#level-curve'].includes(location.hash)) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

void boot().catch(error => {
  root.textContent = error instanceof Error ? error.message : 'The progression study could not be prepared.';
  root.setAttribute('role', 'alert'); root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
});
window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(() => abort.abort());
