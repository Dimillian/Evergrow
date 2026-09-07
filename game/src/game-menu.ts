import { pauseMenuMarkup } from './pause-menu-markup.ts';
import { escapeUI } from './ui-components.ts';
import { uiIcon } from './ui-icons.ts';

/** Presentation receives values, never the live simulation or save state. */
export function gameMenuMarkup(phase: 'paused' | 'dead',
  kills: number, time: number, location: string): string {
  const dead = phase === 'dead';
  const count = Math.max(0, Math.floor(Number.isFinite(kills) ? kills : 0));
  const seconds = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (!dead) return pauseMenuMarkup(count, duration, location);
  return `<section class="ui-window menu-window menu-window--fallen">
    <header class="ui-window-header menu-brand">
      <h1 id="menu-title" class="ui-title">YOU FELL</h1>
      <span class="menu-brand-mark" aria-hidden="true">${uiIcon('diamond')}</span>
    </header>
    <div class="ui-window-body menu-body">
      <div class="menu-seal" aria-hidden="true">${uiIcon('skull')}</div>
      <div class="menu-location"><span class="menu-location-line" aria-hidden="true"></span>
        <span>${escapeUI(location)}</span><span class="menu-location-line" aria-hidden="true"></span></div>
      <dl class="menu-stats">
        <div class="ui-stat"><dt class="ui-stat-label">Slain</dt><dd class="ui-stat-value">${count}</dd></div>
        <div class="ui-stat"><dt class="ui-stat-label">Survived</dt><dd class="ui-stat-value">${duration}</dd></div>
      </dl>
      <p class="menu-save-state" role="status"></p>
      <div class="menu-actions">
        <button type="button" class="ui-button ui-button--primary menu-primary" id="play-action">
          <span>RETURN TO THE REFUGE</span>${uiIcon('chevron')}</button>
        <button type="button" class="ui-button ui-button--quiet menu-secondary" id="title-action">SAVE & CHARACTER HALL</button>
      </div>
    </div>
    <footer class="menu-foot" aria-hidden="true"><span></span>${uiIcon('diamond')}<span></span></footer>
  </section>`;
}
