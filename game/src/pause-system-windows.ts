import { controls } from './control-preferences.ts';
import { audioControlsMarkup, bindAudioControls, type AudioControlActions } from './audio-controls.ts';
import { ControlsPanel, controlsMarkup } from './controls-panel.ts';
import { ChangelogPanel } from './changelog-panel.ts';
import { LeaderboardPanel, type LeaderboardLoader } from './leaderboard-panel.ts';
import type { GroundLootNameplates } from './ground-loot-hover.ts';
import { trapDialogFocus, uiIcon } from './ui-components.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import type { GamepadInput } from './gamepad-input.ts';
import './pause-system-windows.css';

export type SystemDestination = 'options' | 'controls' | 'changelog' | 'leaderboard';
export interface SystemWindowActions extends AudioControlActions {
  groundLootNames?(): GroundLootNameplates;
  setGroundLootNames?(mode: GroundLootNameplates): void;
  zoom?(factor: number): void;
  leaderboard?: LeaderboardLoader;
  leaderboardAvailable?(): boolean;
}

function optionsMarkup(): string {
  return `<section class="system-option-group" aria-labelledby="options-audio"><h3 id="options-audio">Audio</h3>${audioControlsMarkup(true)}</section>
    <section class="system-option-group" aria-labelledby="options-world"><h3 id="options-world">World view</h3>
      <div class="pause-option pause-option--loot"><span id="ground-loot-names-label">Loot names</span><div class="pause-loot-modes" role="group" aria-labelledby="ground-loot-names-label"><button type="button" data-loot-names="always" class="ui-button ui-button--quiet" aria-pressed="true">Always</button><button type="button" data-loot-names="ctrl" class="ui-button ui-button--quiet" aria-pressed="false" data-loot-hold>Hold key</button></div></div>
      <div class="pause-option"><span>Camera zoom</span><div class="pause-stepper"><button type="button" data-zoom="out" class="ui-button ui-button--icon" aria-label="Zoom camera out">${uiIcon('minus')}</button><button type="button" data-zoom="in" class="ui-button ui-button--icon" aria-label="Zoom camera in">${uiIcon('plus')}</button></div></div>
      <div class="pause-option" data-fullscreen-row hidden><span>Fullscreen</span><button type="button" data-fullscreen aria-label="Fullscreen" class="ui-button pause-toggle" aria-pressed="false">Off</button></div>
    </section><p class="system-window-status" role="status"></p>`;
}

/** Independent windows within the paused phase. Closing restores the menu, never gameplay. */
export class PauseSystemWindows {
  private window?: HTMLElement;
  private life?: AbortController;
  private controls?: ControlsPanel;
  private changelog?: ChangelogPanel;
  private leaderboard?: LeaderboardPanel;
  private refreshAudio?: () => void;
  private controller = new GamepadMenu();
  private lastPadTime = 0;
  private readonly root: HTMLElement;
  private readonly actions: SystemWindowActions;
  private readonly onClose: () => void;
  constructor(root: HTMLElement, actions: SystemWindowActions, onClose: () => void) {
    this.root = root; this.actions = actions; this.onClose = onClose;
  }
  get opened(): boolean { return !!this.window; }

  open(destination: SystemDestination): void {
    if (this.opened) return;
    if (destination === 'leaderboard' && (!this.actions.leaderboard || !this.actions.leaderboardAvailable?.())) return;
    this.life = new AbortController();
    const signal = this.life.signal;
    this.root.querySelector<HTMLElement>('.pause-menu-stack')!.hidden = true;
    this.root.setAttribute('role', 'presentation');
    this.root.removeAttribute('aria-modal'); this.root.removeAttribute('aria-labelledby');
    this.lastPadTime = 0; this.controller.clear();
    if (destination === 'changelog') {
      this.changelog = new ChangelogPanel(this.root, () => this.close());
      this.window = this.changelog.element;
      this.window.classList.add('pause-changelog');
      this.changelog.open();
    } else {
      const title = destination === 'options' ? 'Options' : destination === 'controls' ? 'Controls' : 'Leaderboard';
      this.window = document.createElement('section');
      this.window.className = `ui-window system-window system-window--${destination}`;
      this.window.setAttribute('role', 'dialog'); this.window.setAttribute('aria-modal', 'true');
      this.window.setAttribute('aria-labelledby', 'system-window-title');
      this.window.innerHTML = `<header class="ui-window-header"><h2 id="system-window-title" class="ui-title">${title}</h2><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-system-close aria-label="Close ${title}">${uiIcon('close')}</button></header>
        <div class="system-window-body ui-scroll-area">${destination === 'options' ? optionsMarkup() : destination === 'controls' ? controlsMarkup() : '<div data-system-rankings></div>'}</div>
        <footer class="ui-window-footer system-window-footer"><span>EVERGROW</span><span>Esc / B · Back to System</span></footer>`;
      this.root.append(this.window);
      this.window.querySelector('[data-system-close]')!.addEventListener('click', () => this.back(), { signal });
      if (destination === 'controls') this.controls = new ControlsPanel(this.window, signal);
      else if (destination === 'options') this.bindOptions(signal);
      else {
        this.leaderboard = new LeaderboardPanel(this.window.querySelector('[data-system-rankings]')!, this.actions.leaderboard!, () => this.close());
        this.leaderboard.open();
      }
      trapDialogFocus(this.window, { signal, restoreFocus: false, initialFocus: () => this.window?.querySelector('[data-system-close]') ?? null });
    }
    this.window.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.back(); }
      if (event.key !== 'Tab') event.stopPropagation();
    }, { signal });
  }

  private bindOptions(signal: AbortSignal): void {
    const root = this.window!;
    this.refreshAudio = bindAudioControls(root, this.actions, signal);
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
      button.disabled = !this.actions.zoom;
      button.addEventListener('click', () => this.actions.zoom?.(button.dataset.zoom === 'in' ? 1.2 : 1 / 1.2), { signal });
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-loot-names]')) {
      button.disabled = !this.actions.setGroundLootNames;
      button.addEventListener('click', () => { this.actions.setGroundLootNames?.(button.dataset.lootNames === 'ctrl' ? 'ctrl' : 'always'); this.refresh(); }, { signal });
    }
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      root.querySelector<HTMLElement>('[data-fullscreen-row]')!.hidden = false;
      root.querySelector('[data-fullscreen]')!.addEventListener('click', async () => {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
        catch { if (!signal.aborted) root.querySelector('.system-window-status')!.textContent = 'Fullscreen unavailable here.'; }
        if (!signal.aborted) this.refresh();
      }, { signal });
      document.addEventListener('fullscreenchange', () => this.refresh(), { signal });
    }
    this.refresh();
  }
  refresh(): void {
    this.refreshAudio?.(); this.controls?.refresh();
    const hold = this.window?.querySelector<HTMLButtonElement>('[data-loot-hold]');
    if (hold) {
      hold.disabled = !this.actions.setGroundLootNames || !controls.has('revealLoot');
      hold.textContent = hold.disabled ? 'Hold key (unbound)' : `Hold ${controls.label('revealLoot')}`;
    }
    for (const button of this.window?.querySelectorAll<HTMLButtonElement>('[data-loot-names]') ?? [])
      button.setAttribute('aria-pressed', String(button.dataset.lootNames === (this.actions.groundLootNames?.() ?? 'always')));
    const fullscreen = this.window?.querySelector<HTMLButtonElement>('[data-fullscreen]');
    if (fullscreen) { fullscreen.textContent = document.fullscreenElement ? 'On' : 'Off'; fullscreen.setAttribute('aria-pressed', String(!!document.fullscreenElement)); }
  }
  back(): boolean {
    if (!this.opened) return false;
    if (!this.controls?.cancel()) this.close();
    return true;
  }
  private close(notify = true): void {
    if (!this.opened) return;
    this.controls?.cancel(false); this.controls = undefined;
    this.life?.abort(); this.life = undefined;
    this.changelog?.dispose(); this.changelog = undefined;
    this.leaderboard?.dispose(); this.leaderboard = undefined;
    this.window?.remove(); this.window = undefined; this.refreshAudio = undefined;
    this.root.querySelector<HTMLElement>('.pause-menu-stack')!.hidden = false;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-labelledby', 'menu-title');
    if (notify) this.onClose();
  }
  updateGamepad(pad: GamepadInput, now: number): void {
    if (!this.window) return;
    if (this.changelog) { this.changelog.updateGamepad(pad, now); return; }
    this.controller.update(this.window, pad, now);
    const dt = this.lastPadTime ? Math.min(.05, (now - this.lastPadTime) / 1000) : 0;
    this.lastPadTime = now;
    const body = this.window?.querySelector<HTMLElement>('[data-rank-scroll], .system-window-body');
    if (body && Math.abs(pad.aim.y) > .2) body.scrollTop += pad.aim.y * dt * 550;
  }
  dispose(): void { this.close(false); }
}
