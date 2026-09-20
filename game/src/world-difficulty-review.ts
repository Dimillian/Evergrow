import { DifficultyPanel } from './world-difficulty-panel.ts';
import { WORLD_DIFFICULTIES, difficultyEnemyStats, type WorldDifficulty } from './world-difficulty.ts';
import { scaledEnemyStats } from './zone-progression.ts';

/** Static, disposable review of the runtime selector. No character saves or gameplay. */
export function mountDifficultyReview(root: HTMLElement, signal: AbortSignal):void {
  let selected:WorldDifficulty='normal';
  root.innerHTML=`<header class="study-heading"><div><p class="ui-kicker">Evergrow · Local preview</p><h1>World difficulty</h1><p>The same selector available under Escape → Adventure. This preview never changes your character.</p></div></header>
    <section class="ui-window" style="padding:28px;max-width:1100px;margin:auto"><div data-difficulty-preview></div></section>
    <section class="ui-window study-card" style="max-width:1100px;margin:24px auto;padding:24px"><h2>Level 50 · Stalker</h2><p class="ui-muted">Same level and attack cadence. Raw values before player defenses.</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${WORLD_DIFFICULTIES.map(d=>{const s=difficultyEnemyStats(scaledEnemyStats('stalker',50,'normal'),d.id);return `<div><h3 style="color:${d.color}">${d.name}</h3><p>${Math.round(s.maxHp).toLocaleString()} life</p><p>${s.damage.toLocaleString()} damage</p><p>${s.xpReward.toLocaleString()} XP</p></div>`;}).join('')}</div></section>`;
  new DifficultyPanel(root.querySelector('[data-difficulty-preview]')!,{difficulty:()=>selected,setDifficulty:async id=>{selected=id;return {ok:true,message:'Preview selected. Your character is unchanged.'};}},signal);
  root.setAttribute('aria-busy','false');root.dataset.ready='true';
}
