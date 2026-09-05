import { getHUDLayout, HUD_MENU_SHORTCUTS } from './hud.ts';
import type { HUDRect } from './hud.ts';
import { getMinimapRect } from './map-view.ts';
import type { GamePhase } from './game-phase.ts';
import { gameMenuMarkup } from './game-menu.ts';
import { trapDialogFocus } from './ui-components.ts';

interface ShellActions { play(): void; restart(): void; openMap(): void; openCharacter(): void; openSkills(): void; }

/** Owns DOM presentation and its listeners; it never reads or mutates simulation state. */
export class GameShell {
  readonly canvas: HTMLCanvasElement;
  readonly uiCanvas: HTMLCanvasElement;
  readonly mapMount: HTMLElement;
  readonly panelMount: HTMLElement;
  private readonly element: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly status: HTMLElement;
  private readonly toastElement: HTMLElement;
  private readonly abort = new AbortController();
  private menuAbort = new AbortController();
  private toastTimer = 0;
  private readonly actions: ShellActions;

  constructor(root: HTMLElement, actions: ShellActions) {
    this.actions = actions;
    root.innerHTML = `<div class="game-shell">
      <canvas id="game" tabindex="0" aria-label="Evergrow: wilderness and settlements"></canvas>
      <canvas id="game-ui" aria-hidden="true"></canvas>
      <nav id="hud-controls" class="hud-controls" aria-label="Character menus" hidden>
        ${HUD_MENU_SHORTCUTS.map(shortcut => `<button type="button" class="hud-control" data-hud="${shortcut.id}"
          ${shortcut.id === 'journal' ? 'disabled' : 'aria-haspopup="dialog"'} aria-keyshortcuts="${shortcut.key}" aria-label="${shortcut.label}${shortcut.id === 'journal' ? ' (unavailable)' : ''}" data-tooltip="${shortcut.label}"></button>`).join('')}
        <button type="button" class="hud-control" data-hud="map" aria-label="World map" aria-keyshortcuts="M"
          aria-haspopup="dialog" data-tooltip="World map" data-tooltip-placement="below" data-tooltip-align="end"></button>
      </nav>
      <div id="world-map-mount"></div>
      <div id="character-panels-mount"></div>
      <div id="overlay" class="overlay ui-scroll-area" role="dialog" aria-modal="true" aria-labelledby="menu-title"></div>
      <div id="toast" class="toast ui-status" role="status"></div>
      <p id="state-description" class="sr-only" aria-live="polite"></p>
    </div>`;
    this.element = root.querySelector<HTMLElement>('.game-shell')!;
    this.canvas = root.querySelector<HTMLCanvasElement>('#game')!;
    this.uiCanvas = root.querySelector<HTMLCanvasElement>('#game-ui')!;
    this.mapMount = root.querySelector<HTMLElement>('#world-map-mount')!;
    this.panelMount = root.querySelector<HTMLElement>('#character-panels-mount')!;
    this.overlay = root.querySelector<HTMLElement>('#overlay')!;
    this.controls = root.querySelector<HTMLElement>('#hud-controls')!;
    this.status = root.querySelector<HTMLElement>('#state-description')!;
    this.toastElement = root.querySelector<HTMLElement>('#toast')!;
    const signal = this.abort.signal;
    this.element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.controls.querySelector('[data-hud="map"]')!.addEventListener('click', actions.openMap, { signal });
    for (const id of ['character', 'inventory']) this.controls.querySelector(`[data-hud="${id}"]`)!.addEventListener('click', actions.openCharacter, { signal });
    this.controls.querySelector('[data-hud="skilltree"]')!.addEventListener('click', actions.openSkills, { signal });
  }

  resizeControls(width: number, height: number): void {
    const place = (id: string, rect: HUDRect) => {
      const button = this.controls.querySelector<HTMLElement>(`[data-hud="${id}"]`)!;
      button.style.left = `${rect.x / width * 100}%`; button.style.top = `${rect.y / height * 100}%`;
      button.style.width = `${rect.width / width * 100}%`; button.style.height = `${rect.height / height * 100}%`;
    };
    for (const shortcut of getHUDLayout(width, height).shortcuts) place(shortcut.id, shortcut);
    place('map', getMinimapRect(width, height));
  }

  setStatus(message: string): void { this.status.textContent = message; }

  showMenu(phase: GamePhase, kills: number, time: number, location = 'Deadwood'): void {
    this.menuAbort.abort(); this.menuAbort = new AbortController();
    const playing = phase === 'playing';
    const panel = phase === 'map' || phase === 'character' || phase === 'skills';
    this.overlay.hidden = playing || panel;
    this.controls.hidden = !playing;
    this.element.classList.toggle('playing', playing);
    if (playing || panel) {
      this.overlay.innerHTML = '';
      if (playing) this.setStatus('Exploring the world.');
      return;
    }
    const dead = phase === 'dead';
    this.overlay.innerHTML = gameMenuMarkup(phase, kills, time, location);
    const signal = this.menuAbort.signal;
    const play = this.overlay.querySelector<HTMLButtonElement>('#play-action')!;
    play.addEventListener('click', this.actions.play, { signal });
    this.overlay.querySelector('#restart-action')?.addEventListener('click', this.actions.restart, { signal });
    this.overlay.querySelector('#close-menu')?.addEventListener('click', this.actions.play, { signal });
    trapDialogFocus(this.overlay, { signal, initialFocus: play, restoreFocus: false });
    this.setStatus(dead ? `You fell after defeating ${kills} enemies.`
      : phase === 'paused' ? 'Game paused.' : 'Ready to enter Deadwood.');
  }

  toast(message: string): void {
    this.toastElement.textContent = message;
    this.toastElement.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove('visible'), 1800);
  }

  dispose(): void {
    window.clearTimeout(this.toastTimer);
    this.menuAbort.abort(); this.abort.abort();
  }
}
