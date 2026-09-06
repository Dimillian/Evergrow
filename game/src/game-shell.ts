import { PORTAL_RULES } from './travel.ts';
import './travel-ui.css';
import './hud-sidebar.css';
import { GameNotifications } from './notifications.ts';
import { getHUDLayout, HUD_MENU_SHORTCUTS } from './hud.ts';
import type { HUDRect } from './hud.ts';
import { getMinimapRect, getPortalControlRect } from './map-view.ts';
import type { GamePhase } from './game-phase.ts';
import { gameMenuMarkup } from './game-menu.ts';
import { trapDialogFocus, uiIcon } from './ui-components.ts';

interface ShellActions { sound?(): void; muted?(): boolean; zoom?(factor: number): void; portal?(): void; play(): void; returnToTitle(): void; openMap(): void; openCharacter(): void; openSkills(): void; openJourneys?(): void; }

/** Owns DOM presentation and its listeners; it never reads or mutates simulation state. */
export class GameShell {
  readonly canvas: HTMLCanvasElement;
  readonly uiCanvas: HTMLCanvasElement;
  readonly mapMount: HTMLElement;
  readonly panelMount: HTMLElement;
  readonly titleMount: HTMLElement;
  private readonly element: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly status: HTMLElement;
  readonly notifications: GameNotifications;
  private readonly abort = new AbortController();
  private menuAbort = new AbortController();
  private readonly actions: ShellActions;
  private gamepadActive = false;

  setGamepadActive(active: boolean) {
    if (active === this.gamepadActive) return;
    this.gamepadActive = active;
    const key = this.controls.querySelector('kbd');
    if (key) key.textContent = active ? '↓' : 'P';
  }

  constructor(root: HTMLElement, actions: ShellActions) {
    this.actions = actions;
    root.innerHTML = `<div class="game-shell">
      <canvas id="game" tabindex="0" aria-label="Evergrow: wilderness and settlements"></canvas>
      <canvas id="game-ui" aria-hidden="true"></canvas>
      <nav id="hud-controls" class="hud-controls" aria-label="Character menus" hidden>
        ${HUD_MENU_SHORTCUTS.map(shortcut => `<button type="button" class="hud-control" data-hud="${shortcut.id}"
          aria-haspopup="dialog" aria-keyshortcuts="${shortcut.key}" aria-label="${shortcut.label}" data-tooltip="${shortcut.label}"></button>`).join('')}
        <button type="button" class="hud-control" data-hud="map" aria-label="World map" aria-keyshortcuts="M"
          aria-haspopup="dialog" data-tooltip="World map" data-tooltip-placement="left"></button>
        <button type="button" class="hud-control portal-control hud-sidebar-surface" data-hud="portal" aria-label="Town portal" aria-keyshortcuts="P" data-tooltip="Town portal · ${PORTAL_RULES.channel} second cast" data-tooltip-placement="left">${uiIcon('portal')}<span class="portal-label">Town portal</span><kbd class="hud-sidebar-key">P</kbd><i class="portal-progress" aria-hidden="true"></i></button>
      </nav>
      <div id="title-mount"></div>
      <div id="world-map-mount"></div>
      <div id="character-panels-mount"></div>
      <div id="overlay" class="overlay ui-scroll-area" role="dialog" aria-modal="true" aria-labelledby="menu-title"></div>
      <div id="save-warning" class="save-warning" role="status" hidden></div>
      <p id="state-description" class="sr-only" aria-live="polite"></p>
    </div>`;
    this.element = root.querySelector<HTMLElement>('.game-shell')!;
    this.canvas = root.querySelector<HTMLCanvasElement>('#game')!;
    this.uiCanvas = root.querySelector<HTMLCanvasElement>('#game-ui')!;
    this.mapMount = root.querySelector<HTMLElement>('#world-map-mount')!;
    this.panelMount = root.querySelector<HTMLElement>('#character-panels-mount')!;
    this.titleMount = root.querySelector<HTMLElement>('#title-mount')!;
    this.overlay = root.querySelector<HTMLElement>('#overlay')!;
    this.controls = root.querySelector<HTMLElement>('#hud-controls')!;
    this.status = root.querySelector<HTMLElement>('#state-description')!;
    this.notifications = new GameNotifications(this.element);
    const signal = this.abort.signal;
    this.element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.controls.querySelector('[data-hud="map"]')!.addEventListener('click', actions.openMap, { signal });
    this.controls.querySelector<HTMLButtonElement>('[data-hud="portal"]')!.disabled = !actions.portal;
    this.controls.querySelector('[data-hud="portal"]')!.addEventListener('click', () => actions.portal?.(), { signal });
    for (const id of ['character', 'inventory']) this.controls.querySelector(`[data-hud="${id}"]`)!.addEventListener('click', actions.openCharacter, { signal });
    this.controls.querySelector('[data-hud="skilltree"]')!.addEventListener('click', actions.openSkills, { signal });
    this.controls.querySelector('[data-hud="journal"]')!.addEventListener('click', () => actions.openJourneys?.(), { signal });
  }

  private minimapVisible = true;
  setMinimapVisible(visible: boolean): void {
    if (this.minimapVisible === visible) return;
    this.minimapVisible = visible;
    this.controls.querySelector<HTMLElement>('[data-hud="map"]')!.hidden = !visible;
  }

  resizeControls(width: number, height: number): void {
    const place = (id: string, rect: HUDRect) => {
      const button = this.controls.querySelector<HTMLElement>(`[data-hud="${id}"]`)!;
      button.style.left = `${rect.x / width * 100}%`; button.style.top = `${rect.y / height * 100}%`;
      button.style.width = `${rect.width / width * 100}%`; button.style.height = `${rect.height / height * 100}%`;
    };
    for (const shortcut of getHUDLayout(width, height).shortcuts) place(shortcut.id, shortcut);
    place('map', getMinimapRect(width, height));
    place('portal', getPortalControlRect(width, height));
  }

  setPortalState(progress: number | null, returning: boolean): void {
    const button = this.controls.querySelector<HTMLElement>('[data-hud="portal"]')!;
    button.classList.toggle('is-channeling', progress !== null); button.classList.toggle('is-return', returning);
    button.style.setProperty('--portal-progress', `${(progress ?? 0) * 100}%`);
    const label = progress !== null ? `Casting · ${(PORTAL_RULES.channel * (1 - progress)).toFixed(1)}s` : returning ? 'Return portal' : 'Town portal';
    const text = button.querySelector('.portal-label')!; if (text.textContent !== label) text.textContent = label;
    button.setAttribute('aria-label', progress !== null ? 'Cancel town portal' : returning ? 'Locate return portal' : 'Town portal');
    button.dataset.tooltip = progress !== null ? 'Cancel cast' : returning ? 'Locate your return portal' : `Town portal · ${PORTAL_RULES.channel} second cast`;
  }
  portalTransition(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.element.querySelector('.portal-transition')?.remove();
    const veil = document.createElement('div'); veil.className = 'portal-transition'; veil.setAttribute('aria-hidden', 'true');
    this.element.append(veil); veil.addEventListener('animationend', () => veil.remove(), { once: true });
  }

  setSaveStatus(message: string, failed = false): void {
    const status = this.overlay.querySelector('.menu-save-state'); if (status) status.textContent = message;
    const warning = this.element.querySelector<HTMLElement>('#save-warning')!;
    warning.hidden = !failed;
    if (warning.textContent !== message) warning.textContent = message;
  }

  setStatus(message: string): void { this.status.textContent = message; }

  showMenu(phase: GamePhase, kills: number, time: number, location = 'Deadwood'): void {
    this.menuAbort.abort(); this.menuAbort = new AbortController();
    const playing = phase === 'playing';
    const panel = phase === 'map' || phase === 'character' || phase === 'skills' || phase === 'service' || phase === 'event' || phase === 'journeys';
    this.overlay.hidden = playing || panel || phase === 'ready';
    this.controls.hidden = !playing;
    this.element.classList.toggle('playing', playing);
    if (playing || panel || phase === 'ready') {
      this.overlay.innerHTML = '';
      if (playing) this.setStatus('Exploring the world.');
      return;
    }
    const dead = phase === 'dead';
    this.overlay.innerHTML = gameMenuMarkup(phase, kills, time, location);
    const signal = this.menuAbort.signal;
    const play = this.overlay.querySelector<HTMLButtonElement>('#play-action')!;
    play.addEventListener('click', this.actions.play, { signal });
    this.overlay.querySelector('#title-action')?.addEventListener('click', this.actions.returnToTitle, { signal });
    this.overlay.querySelector('#close-menu')?.addEventListener('click', this.actions.play, { signal });
    if(!dead) {
      const controls=document.createElement('div');controls.className='touch-only touch-pause-actions';
      controls.innerHTML='<button class="ui-button" data-sound>Sound</button><button class="ui-button" data-zoom="out" aria-label="Zoom camera out">− Zoom</button><button class="ui-button" data-zoom="in" aria-label="Zoom camera in">+ Zoom</button>';
      const sound=controls.querySelector<HTMLButtonElement>('[data-sound]')!;
      const update=()=>{sound.textContent=this.actions.muted?.()?'Sound off':'Sound on';sound.setAttribute('aria-pressed',String(!this.actions.muted?.()));};update();
      sound.addEventListener('click',()=>{this.actions.sound?.();update();},{signal});
      for(const b of controls.querySelectorAll<HTMLButtonElement>('[data-zoom]'))b.addEventListener('click',()=>this.actions.zoom?.(b.dataset.zoom==='in'?1.2:1/1.2),{signal});
      const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches
        || (navigator as Navigator & {standalone?:boolean}).standalone === true;
      if (!standalone) {
        const expand = document.createElement('button'); expand.className='ui-button'; expand.type='button';
        const help = document.createElement('p'); help.className='touch-install-help'; help.hidden=true;
        if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
          expand.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
          expand.addEventListener('click', async () => {
            try {
              if(document.fullscreenElement) await document.exitFullscreen();
              else await document.documentElement.requestFullscreen();
              expand.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
            } catch { help.hidden=false; help.textContent='Fullscreen is unavailable here. Open Evergrow from your Home Screen for an app view.'; }
          }, {signal});
        } else {
          expand.textContent='Home Screen'; expand.setAttribute('aria-expanded','false');
          help.textContent='For more screen space: in Safari, tap Share → Add to Home Screen. Keep Open as Web App enabled, then launch Evergrow from its new icon.';
          expand.addEventListener('click',()=>{help.hidden=!help.hidden;expand.setAttribute('aria-expanded',String(!help.hidden));},{signal});
        }
        controls.append(expand,help);
      }
      this.overlay.querySelector('.menu-actions')!.append(controls);
    }
    trapDialogFocus(this.overlay, { signal, initialFocus: play, restoreFocus: false });
    this.setStatus(dead ? `You fell after defeating ${kills} enemies.`
      : phase === 'paused' ? 'Game paused.' : 'Ready to enter Deadwood.');
  }

  dispose(): void {
    this.notifications.dispose();
    this.menuAbort.abort(); this.abort.abort();
  }
}
