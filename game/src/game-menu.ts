import { escapeUI } from './ui-components.ts';
import { uiIcon } from './ui-icons.ts';

/** Presentation receives values, never the live simulation or save state. */
export function gameMenuMarkup(phase: 'paused' | 'dead',
  kills: number, time: number, location: string): string {
  const dead = phase === 'dead';
  const count = Math.max(0, Math.floor(Number.isFinite(kills) ? kills : 0));
  const seconds = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return `<section class="ui-window menu-window${dead ? ' menu-window--fallen' : ''}">
    <header class="menu-brand">
      <span class="ui-kicker">EVERGROW</span>
      ${phase === 'paused' ? `<button type="button" id="close-menu" class="ui-button ui-button--quiet ui-button--icon"
        aria-label="Resume game" data-tooltip="Resume game" data-tooltip-placement="below" data-tooltip-align="end">${uiIcon('close')}</button>` : `<span class="menu-brand-mark" aria-hidden="true">${uiIcon('diamond')}</span>`}
    </header>
    <div class="ui-window-body menu-body">
      <div class="menu-seal" aria-hidden="true">${uiIcon(dead ? 'skull' : 'leaf')}</div>
      <h1 id="menu-title" class="ui-title menu-title">${dead ? 'YOU FELL' : 'PAUSED'}</h1>
      <div class="menu-location"><span class="menu-location-line" aria-hidden="true"></span>
        <span>${escapeUI(location)}</span><span class="menu-location-line" aria-hidden="true"></span></div>
      <dl class="menu-stats">
        <div class="ui-stat"><dt class="ui-stat-label">Slain</dt><dd class="ui-stat-value">${count}</dd></div>
        <div class="ui-stat"><dt class="ui-stat-label">${dead ? 'Survived' : 'Time in the wild'}</dt><dd class="ui-stat-value">${duration}</dd></div>
      </dl>
      <p class="menu-save-state" role="status"></p>
      <div class="menu-actions">
        <button type="button" class="ui-button ui-button--primary menu-primary" id="play-action">
          <span>${dead ? 'RETURN TO THE REFUGE' : 'RESUME'}</span>${uiIcon('chevron')}</button>
        <button type="button" class="ui-button ui-button--quiet menu-secondary" id="title-action">SAVE & CHARACTER HALL</button>
      </div>
    </div>
    <footer class="menu-foot" aria-hidden="true"><span></span>${uiIcon('diamond')}<span></span></footer>
  </section>`;
}
