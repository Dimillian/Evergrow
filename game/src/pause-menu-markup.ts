import { controls } from './control-preferences.ts';
import { uiIcon } from './ui-icons.ts';
import { escapeUI } from './ui-components.ts';
import { PAUSE_CATEGORIES } from './pause-navigation.ts';

export function pauseMenuMarkup(kills: number, duration: string, location: string): string {
  return `<div class="pause-menu-stack">
    <div class="pause-brand" aria-label="Evergrow">EVERGROW</div>
    <section class="ui-window menu-window pause-menu">
    <header class="ui-window-header pause-header">${uiIcon('journal')}<h1 id="menu-title" class="ui-title">Paused</h1>
      <span class="pause-place">${escapeUI(location)}</span>
      <button type="button" id="play-action" class="ui-button pause-resume">${uiIcon('chevron')}<span>Resume</span><kbd>Esc</kbd></button></header>
    <div class="pause-layout">
      <nav class="pause-tabs" role="tablist" aria-label="Menu categories">
        ${PAUSE_CATEGORIES.map((c,i)=>`<button type="button" id="pause-tab-${c.id}" class="ui-button pause-tab" role="tab" aria-selected="${i===0}" aria-controls="pause-page-${c.id}" tabindex="${i===0?0:-1}" data-pause-tab="${c.id}">${uiIcon(c.icon)}<span>${c.label}</span></button>`).join('')}
      </nav>
      <div class="pause-detail ui-scroll-area">
        ${PAUSE_CATEGORIES.map((c,i)=>`<section id="pause-page-${c.id}" role="tabpanel" aria-labelledby="pause-tab-${c.id}" data-pause-page="${c.id}" ${i?'hidden':''}>
          ${c.entries.map(e=>`<button type="button" class="ui-button ui-button--quiet pause-destination" data-pause-destination="${e.id}">${uiIcon(e.icon)}<span class="pause-row-text"><span>${e.label}</span><small>${e.description}</small></span>${e.binding?`<kbd data-pause-binding="${e.binding}">${escapeUI(controls.label(e.binding))}</kbd>`:''}</button>`).join('')}
        </section>`).join('')}
      </div>
    </div>
    <div class="pause-utilities"><button type="button" id="save-action" class="ui-button">${uiIcon('save')}<span>Save game</span></button><button type="button" id="title-action" class="ui-button ui-button--quiet"><span>Save & character hall</span>${uiIcon('exit')}</button></div>
    <footer class="pause-footer"><i aria-hidden="true"></i><p class="menu-save-state" role="status">Saving…</p><span class="pause-session">${kills} slain · ${duration} played</span></footer>
    </section>
  </div>`;
}
