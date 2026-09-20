import { controls } from './control-preferences.ts';
import { worldDifficulty, type WorldDifficulty } from './world-difficulty.ts';
import { difficultyBadgeSVG } from './world-difficulty-art.ts';
import { BuffBar } from './buff-bar.ts';
import type { ActiveBuff } from './active-buffs.ts';
import { PauseMenu, type PauseActions } from './pause-menu.ts';
import type { PauseNavigation } from './pause-navigation.ts';
import type { GamepadInput } from './gamepad-input.ts';
import './travel-ui.css';
import './hud-progression.css';
import { GameNotifications } from './notifications.ts';
import { getHUDLayout } from './hud.ts';
import { HUDShortcutMenu } from './hud-shortcut-menu.ts';
import type { HUDRect } from './hud.ts';
import { getMinimapRect, getMinimapHomeRect, getMinimapDifficultyRect, getProgressionShortcutRects } from './map-view.ts';
import type { GamePhase } from './game-phase.ts';
import { gameMenuMarkup } from './game-menu.ts';
import { trapDialogFocus, uiIcon } from './ui-components.ts';
import { PORTAL_RULES } from './travel.ts';

interface ShellActions extends PauseActions { openDifficulty?(): void; lastSavedAt?(): number | undefined; saveLocation?(): 'Local' | 'Online'; shortcutMenuChanged?(): void; homePortal?(): void; play(): void; openMap(): void; openCharacter(): void; openInventory(): void; openSkills(): void; }

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
  readonly shortcutMenu: HUDShortcutMenu;
  readonly buffs: BuffBar;
  readonly targetBuffs: BuffBar;
  private targetId: number | null = null;
  setTargetEffects(target: { id: number; buffs: readonly ActiveBuff[]; x: number; y: number; opacity: number } | null): void {
    if (target?.id !== this.targetId) this.targetBuffs.hide();
    this.targetId = target?.id ?? null;
    this.targetBuffs.update(this.controls.hidden ? [] : target?.buffs ?? []);
    if (target) {
      this.targetBuffs.element.style.left = `${target.x * 100}%`;
      this.targetBuffs.element.style.top = `${target.y * 100}%`;
      this.targetBuffs.element.style.opacity = String(target.opacity);
    }
  }
  setBuffs(buffs: readonly ActiveBuff[]): void { this.buffs.update(this.controls.hidden ? [] : buffs); }
  private gamepadActive = false;
  private progressionPoints: readonly [number, number] = [0, 0];
  private pauseMenu: PauseMenu | null = null;
  private saveMessage = '';
  private pauseNavigation: PauseNavigation = { category: 'character', focus: null };
  backInMenu(): boolean { return this.pauseMenu?.back() ?? false; }
  showDifficultyMenu(): void { this.pauseMenu?.openDifficulty(); }
  private difficultyBadge?: WorldDifficulty;
  setDifficultyBadge(id:WorldDifficulty): void {
    if(this.difficultyBadge===id)return;
    this.difficultyBadge=id;
    const button=this.controls.querySelector<HTMLButtonElement>('[data-hud="difficulty"]')!;
    button.innerHTML=difficultyBadgeSVG(id,22);
    const label=`${worldDifficulty(id).name} · World difficulty`;
    button.setAttribute('aria-label',label);button.dataset.tooltip=label;
  }
  refreshOptions(): void { this.pauseMenu?.refresh(); }
  updatePauseGamepad(pad: GamepadInput, now: number): void { this.pauseMenu?.updateGamepad(pad, now); }

  setGamepadActive(active: boolean): void {
    if (active === this.gamepadActive) return;
    this.gamepadActive = active;
    this.refreshBindings();
  }

  refreshBindings(): void {
    this.pauseMenu?.refresh();
    this.controls.querySelector('[data-hud="map"]')!.removeAttribute('aria-keyshortcuts');
    this.shortcutMenu.refreshBindings();
    this.refreshProgressionShortcuts();
  }

  constructor(root: HTMLElement, actions: ShellActions) {
    this.actions = actions;
    root.innerHTML = `<div class="game-shell">
      <canvas id="game" tabindex="0" aria-label="Evergrow: wilderness and settlements"></canvas>
      <canvas id="game-ui" aria-hidden="true"></canvas>
      <nav id="hud-controls" class="hud-controls" aria-label="Character menus" hidden>
        <button type="button" class="hud-control" data-hud="menu" aria-haspopup="dialog" aria-label="Open character menus" data-tooltip="Character menus"></button>
        <button type="button" class="hud-control" data-hud="map" aria-label="World map" aria-keyshortcuts="M"
          aria-haspopup="dialog" data-tooltip="World map" data-tooltip-placement="left"></button>
        <button type="button" class="hud-control hud-progression hud-progression--character" data-hud="character" aria-label="Character" aria-haspopup="dialog" data-tooltip-placement="left">${uiIcon('character')}<span class="hud-progression-count" aria-hidden="true" hidden></span></button>
        <button type="button" class="hud-control hud-progression hud-progression--skills" data-hud="skills" aria-label="Skill atlas" aria-haspopup="dialog" data-tooltip-placement="left">${uiIcon('skilltree')}<span class="hud-progression-count" aria-hidden="true" hidden></span></button>
        <button type="button" class="hud-control minimap-home" data-hud="home" aria-label="Home · Open town portal"
          data-tooltip="Home · Open town portal · ${PORTAL_RULES.channel} second cast" data-tooltip-placement="left" hidden>${uiIcon('home')}</button>
        <button type="button" class="hud-control minimap-difficulty" data-hud="difficulty" aria-label="World difficulty" aria-haspopup="dialog" data-tooltip="World difficulty" data-tooltip-placement="left"></button>
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
    this.buffs = new BuffBar(this.controls);
    this.targetBuffs = new BuffBar(this.controls, 'Target effects');
    this.targetBuffs.element.classList.add('target-buff-bar');
    const signal = this.abort.signal;
    this.element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.controls.querySelector('[data-hud="difficulty"]')!.addEventListener('click',()=>actions.openDifficulty?.(),{signal});
    this.controls.querySelector('[data-hud="map"]')!.addEventListener('click', actions.openMap, { signal });
    this.controls.querySelector('[data-hud="character"]')!.addEventListener('click', actions.openCharacter, { signal });
    this.controls.querySelector('[data-hud="skills"]')!.addEventListener('click', actions.openSkills, { signal });
    this.controls.querySelector('[data-hud="home"]')!.addEventListener('click', () => {
      if (this.homePortalVisible && this.navigationVisible) {
        this.canvas.focus({ preventScroll: true });
        actions.homePortal?.();
      }
    }, { signal });
    this.shortcutMenu = new HUDShortcutMenu(this.controls, this.controls.querySelector('[data-hud="menu"]')!, id => {
      if (id === 'character') actions.openCharacter();
      else if (id === 'inventory') actions.openInventory();
      else if (id === 'skilltree') actions.openSkills();
      else if (id === 'map') actions.openMap();
      else actions.openJourneys?.();
    }, () => actions.shortcutMenuChanged?.());
    this.refreshBindings();
  }

  private navigationVisible = true;
  private homePortalVisible = false;
  setHomePortalVisible(visible: boolean): void {
    this.homePortalVisible = visible && !!this.actions.homePortal;
    const button = this.controls.querySelector<HTMLButtonElement>('[data-hud="home"]')!;
    button.hidden = !this.homePortalVisible || !this.navigationVisible;
    if (button.hidden && document.activeElement === button) this.canvas.focus({ preventScroll: true });
  }
  setNavigationVisible(visible: boolean): void {
    if (this.navigationVisible === visible) return;
    this.navigationVisible = visible;
    for (const id of ['map', 'character', 'skills', 'difficulty'])
      this.controls.querySelector<HTMLElement>(`[data-hud="${id}"]`)!.hidden = !visible;
    this.setHomePortalVisible(this.homePortalVisible);
  }

  resizeControls(width: number, height: number): void {
    const place = (id: string, rect: HUDRect) => {
      const button = this.controls.querySelector<HTMLElement>(`[data-hud="${id}"]`)!;
      button.style.left = `${rect.x / width * 100}%`; button.style.top = `${rect.y / height * 100}%`;
      button.style.width = `${rect.width / width * 100}%`; button.style.height = `${rect.height / height * 100}%`;
    };
    const hud = getHUDLayout(width, height);
    this.buffs.element.style.bottom = `${(height - hud.y + 8) / height * 100}%`;
    for (const shortcut of hud.shortcuts) place(shortcut.id, shortcut);
    place('map', getMinimapRect(width, height));
    place('home', getMinimapHomeRect(width, height));
    place('difficulty', getMinimapDifficultyRect(width, height));
    for (const shortcut of getProgressionShortcutRects(width, height)) place(shortcut.id, shortcut);
    this.shortcutMenu.position();
  }

  setProgressionPoints(attributes: number, skills: number): void {
    this.shortcutMenu.setPoints(attributes, skills);
    if (this.progressionPoints[0] === attributes && this.progressionPoints[1] === skills) return;
    this.progressionPoints = [attributes, skills];
    this.refreshProgressionShortcuts();
  }

  private refreshProgressionShortcuts(): void {
    for (const [index, id] of (['character', 'skills'] as const).entries()) {
      const count = this.progressionPoints[index];
      const button = this.controls.querySelector<HTMLButtonElement>(`[data-hud="${id}"]`)!;
      const name = id === 'character' ? 'Character' : 'Skill atlas';
      const kind = id === 'character' ? 'attribute' : 'skill';
      const available = count > 0 ? ` · ${count.toLocaleString('en-US')} ${kind} ${count === 1 ? 'point' : 'points'} available` : '';
      const binding = this.gamepadActive ? id === 'character' ? 'D-pad ←' : 'D-pad ↑' : controls.label(id);
      button.classList.toggle('has-points', count > 0);
      button.setAttribute('aria-label', `${name}${available}`);
      button.dataset.tooltip = `${name} · ${binding}${available}`;
      const badge = button.querySelector<HTMLElement>('.hud-progression-count')!;
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    }
  }

  portalTransition(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.element.querySelector('.portal-transition')?.remove();
    const veil = document.createElement('div'); veil.className = 'portal-transition'; veil.setAttribute('aria-hidden', 'true');
    this.element.append(veil); veil.addEventListener('animationend', () => veil.remove(), { once: true });
  }

  setSaveStatus(message = '', failed = false): void {
    this.saveMessage = message;
    this.refreshSaveStatus();
    const warning = this.element.querySelector<HTMLElement>('#save-warning')!;
    warning.hidden = !failed;
    if (warning.textContent !== message) warning.textContent = message;
  }

  private refreshSaveStatus(): void {
    const status = this.overlay.querySelector<HTMLElement>('.menu-save-state');
    if (!status) return;
    const timestamp = this.actions.lastSavedAt?.();
    const saved = timestamp === undefined ? null : new Date(timestamp);
    if (!saved || !Number.isFinite(saved.getTime())) {
      status.textContent = this.saveMessage || 'Not saved yet.'; status.removeAttribute('title'); return;
    }
    const today = saved.toDateString() === new Date().toDateString();
    const clock = saved.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const location = this.actions.saveLocation?.() ?? 'Local';
    const lastSave = `Last saved ${today ? clock : `${saved.toLocaleDateString()} · ${clock}`} (${location})`;
    status.textContent = this.saveMessage ? `${lastSave} · ${this.saveMessage}` : lastSave;
    status.title = `Last saved ${saved.toLocaleString()} (${location})`;
  }

  setStatus(message: string): void { this.status.textContent = message; }

  showMenu(phase: GamePhase, kills: number, time: number, location = 'Deadwood'): void {
    this.shortcutMenu.close(false);
    this.menuAbort.abort(); this.menuAbort = new AbortController(); this.pauseMenu = null;
    const playing = phase === 'playing';
    if (playing || phase === 'ready' || phase === 'dead') this.pauseNavigation.focus = null;
    if (phase === 'ready') this.pauseNavigation.category = 'character';
    const panel = phase === 'map' || phase === 'character' || phase === 'inventory' || phase === 'skills' || phase === 'service' || phase === 'event' || phase === 'journeys' || phase === 'chronicle';
    this.overlay.hidden = playing || panel || phase === 'ready';
    this.controls.hidden = !playing;
    if (!playing) { this.buffs.hide(); this.targetBuffs.hide(); }
    this.element.classList.toggle('playing', playing);
    if (playing || panel || phase === 'ready') {
      this.overlay.innerHTML = '';
      if (playing) this.setStatus('Exploring the world.');
      return;
    }
    const dead = phase === 'dead';
    this.overlay.innerHTML = gameMenuMarkup(phase, kills, time, location);
    this.refreshSaveStatus();
    const signal = this.menuAbort.signal;
    const play = this.overlay.querySelector<HTMLButtonElement>('#play-action')!;
    play.addEventListener('click', this.actions.play, { signal });
    if (dead) this.overlay.querySelector('#title-action')?.addEventListener('click', this.actions.returnToTitle, { signal });
    this.overlay.querySelector('#close-menu')?.addEventListener('click', this.actions.play, { signal });
    if (!dead) this.pauseMenu = new PauseMenu(this.overlay, this.actions, signal, this.pauseNavigation);
    trapDialogFocus(this.overlay, { signal, initialFocus: play, restoreFocus: false });
    this.pauseMenu?.restoreFocus();
    this.setStatus(dead ? `You fell after defeating ${kills} enemies.`
      : phase === 'paused' ? 'Game paused.' : 'Ready to enter Deadwood.');
  }

  dispose(): void {
    this.buffs.dispose(); this.targetBuffs.dispose();
    this.shortcutMenu.dispose();
    this.notifications.dispose();
    this.menuAbort.abort(); this.abort.abort();
  }
}
