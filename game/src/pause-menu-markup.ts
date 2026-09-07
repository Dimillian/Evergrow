import { uiIcon } from './ui-icons.ts';
import { escapeUI } from './ui-components.ts';

export function pauseMenuMarkup(kills: number, duration: string, location: string): string {
  return `<section class="ui-window menu-window pause-menu">
    <header class="ui-window-header pause-header"><h1 id="menu-title" class="ui-title">Paused</h1>
      <button type="button" id="close-menu" class="ui-button ui-button--quiet ui-button--icon" aria-label="Resume game">${uiIcon('close')}</button></header>
    <div class="pause-layout">
      <nav class="pause-actions" aria-label="Pause menu">
        <button type="button" id="play-action" class="ui-button ui-button--primary">${uiIcon('chevron')}<span>Resume</span></button>
        <button type="button" id="options-action" class="ui-button ui-button--quiet" aria-expanded="false" aria-controls="pause-options">${uiIcon('options')}<span>Options</span></button>
        <button type="button" id="chronicle-action" class="ui-button ui-button--quiet">${uiIcon('star')}<span>Chronicle</span></button>
        <button type="button" id="save-action" class="ui-button ui-button--quiet">${uiIcon('save')}<span>Save game</span></button>
        <button type="button" id="title-action" class="ui-button ui-button--quiet" aria-label="Save and exit to character hall">${uiIcon('exit')}<span>Save & exit</span></button>
      </nav>
      <div class="pause-detail">
        <section id="pause-summary" aria-label="Current run">
          <div class="pause-place">${uiIcon('leaf')}<span>${escapeUI(location)}</span></div>
          <dl class="pause-stats"><div><dt>Slain</dt><dd>${kills}</dd></div><div><dt>Time played</dt><dd>${duration}</dd></div></dl>
          <div class="pause-decoration" aria-hidden="true"><span></span>${uiIcon('star')}<span></span></div>
        </section>
        <section id="pause-options" aria-label="Options" hidden>
          <header class="pause-options-heading"><h2>Options</h2><button type="button" data-options-back class="ui-button ui-button--quiet ui-button--icon" aria-label="Back to pause menu">${uiIcon('chevron')}</button></header>
          <div class="pause-option"><span>Sound</span><button type="button" data-sound aria-label="Game sound" class="ui-button pause-toggle" aria-pressed="true">On</button></div>
          <div class="pause-option"><span>Camera zoom</span><div class="pause-stepper"><button type="button" data-zoom="out" class="ui-button ui-button--icon" aria-label="Zoom camera out">${uiIcon('minus')}</button><button type="button" data-zoom="in" class="ui-button ui-button--icon" aria-label="Zoom camera in">${uiIcon('plus')}</button></div></div>
          <div class="pause-option" data-fullscreen-row hidden><span>Fullscreen</span><button type="button" data-fullscreen aria-label="Fullscreen" class="ui-button pause-toggle" aria-pressed="false">Off</button></div>
          <details class="pause-controls"><summary>Controls</summary><dl><div><dt>Move</dt><dd>WASD · Left stick</dd></div><div><dt>Attack</dt><dd>LMB · RT</dd></div><div><dt>Dodge</dt><dd>Space · B</dd></div><div><dt>Potion</dt><dd>Q · LB</dd></div><div><dt>Interact</dt><dd>E · A</dd></div><div><dt>Pause / back</dt><dd>Esc · Menu / B</dd></div></dl></details>
        </section>
      </div>
    </div>
    <footer class="pause-footer"><i aria-hidden="true"></i><p class="menu-save-state" role="status">Saving…</p></footer>
  </section>`;
}

