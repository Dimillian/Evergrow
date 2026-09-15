import { PauseSystemWindows, type SystemWindowActions } from './pause-system-windows.ts';
import './pause-menu.css';
import './game-wordmark.css';
import { controls } from './control-preferences.ts';
import type { ControlAction } from './control-bindings.ts';
import { PAUSE_CATEGORIES, type PauseCategory, type PauseDestination, type PauseNavigation } from './pause-navigation.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import type { GamepadInput } from './gamepad-input.ts';

export interface PauseActions extends SystemWindowActions {
  openChronicle?(): void;
  openLootLog?(): void;
  openCharacter?(): void; openSkills?(): void; openAppearance?(): void;
  openMap?(): void; openJourneys?(): void;
  save?(): Promise<boolean>;
  returnToTitle(): void | Promise<void>;
}
/** Category navigation and explicit save actions within the paused phase. */
export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly actions: PauseActions;
  private readonly signal: AbortSignal;
  private readonly navigation: PauseNavigation;
  private readonly windows: PauseSystemWindows;
  private controller = new GamepadMenu();
  private lastPadTime = 0;
  private busy = false;
  constructor(root: HTMLElement, actions: PauseActions, signal: AbortSignal, navigation: PauseNavigation = { category: 'character', focus: null }) {
    this.root = root; this.actions = actions; this.signal = signal;
    this.navigation = navigation;
    this.windows = new PauseSystemWindows(root, actions, () => { this.controller.clear(); this.restoreFocus(); });
    const links = { character: actions.openCharacter, skills: actions.openSkills, appearance: actions.openAppearance,
      map: actions.openMap, journeys: actions.openJourneys, chronicle: actions.openChronicle, lootLog: actions.openLootLog };
    for (const [id, action] of Object.entries(links))
      root.querySelector<HTMLButtonElement>(`[data-pause-destination="${id}"]`)!.disabled = !action;
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (button?.dataset.pauseTab) this.selectCategory(button.dataset.pauseTab as PauseCategory, true);
      if (button?.dataset.pauseDestination) this.open(button.dataset.pauseDestination as PauseDestination);
    }, { signal });
    root.addEventListener('keydown', event => {
      const tab = (event.target as Element).closest<HTMLElement>('[data-pause-tab]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const i = PAUSE_CATEGORIES.findIndex(c => c.id === this.navigation.category);
        const count = PAUSE_CATEGORIES.length;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (i + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : count - 1)) % count;
        this.selectCategory(PAUSE_CATEGORIES[next].id, true);
      } else if (this.windows.opened && event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
    }, { signal });
    signal.addEventListener('abort', () => this.windows.dispose(), { once: true });
    root.querySelector<HTMLButtonElement>('#save-action')!.disabled = !actions.save;
    root.querySelector('#save-action')!.addEventListener('click', () => { void this.save(false); }, { signal });
    root.querySelector('#title-action')!.addEventListener('click', () => { void this.save(true); }, { signal });
    this.selectCategory(navigation.category);
    this.refresh();
  }
  refresh(): void {
    for (const key of this.root.querySelectorAll<HTMLElement>('[data-pause-binding]')) key.textContent = controls.label(key.dataset.pauseBinding as ControlAction);
    const board = this.root.querySelector<HTMLButtonElement>('[data-pause-destination="leaderboard"]')!;
    board.disabled = !this.actions.leaderboard || !this.actions.leaderboardAvailable?.();
    board.querySelector('small')!.textContent = board.disabled ? 'Available in the online game' : 'Cloud character rankings';
    this.windows.refresh();
  }
  back(): boolean {
    if (this.busy) return true;
    return this.windows.back();
  }
  restoreFocus(): void {
    this.root.querySelector<HTMLElement>(this.navigation.focus ? `[data-pause-destination="${this.navigation.focus}"]` : '#play-action')?.focus();
  }
  private selectCategory(category: PauseCategory, focus = false): void {
    if (this.busy) return;
    if (category !== this.navigation.category) this.navigation.focus = null;
    this.navigation.category = category;
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>('[data-pause-tab]')) {
      const active = tab.dataset.pauseTab === category;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const page of this.root.querySelectorAll<HTMLElement>('[data-pause-page]')) page.hidden = page.dataset.pausePage !== category;
    this.root.querySelector('.pause-detail')!.scrollTop = 0;
    this.controller.clear();
  }
  private open(destination: PauseDestination): void {
    if (this.busy) return;
    this.navigation.focus = destination;
    switch (destination) {
      case 'character': this.actions.openCharacter?.(); return;
      case 'skills': this.actions.openSkills?.(); return;
      case 'appearance': this.actions.openAppearance?.(); return;
      case 'map': this.actions.openMap?.(); return;
      case 'journeys': this.actions.openJourneys?.(); return;
      case 'chronicle': this.actions.openChronicle?.(); return;
      case 'lootLog': this.actions.openLootLog?.(); return;
      case 'options': case 'controls': case 'leaderboard': case 'changelog': this.windows.open(destination); return;
    }
  }
  updateGamepad(pad: GamepadInput, now: number): void {
    if (this.windows.opened) { this.windows.updateGamepad(pad, now); return; }
    this.controller.update(this.root, pad, now, { switchTab: delta => {
      const i = PAUSE_CATEGORIES.findIndex(c => c.id === this.navigation.category);
      this.selectCategory(PAUSE_CATEGORIES[(i + delta + PAUSE_CATEGORIES.length) % PAUSE_CATEGORIES.length].id, true);
    } });
    if (this.signal.aborted) return;
    const dt = this.lastPadTime ? Math.min(.05, (now - this.lastPadTime) / 1000) : 0;
    this.lastPadTime = now;
    if (Math.abs(pad.aim.y) > .2) {
      const target = this.root.querySelector('.pause-detail');
      if (target) target.scrollTop += pad.aim.y * dt * 550;
    }
  }
  private status(message: string): void { this.root.querySelector('.menu-save-state')!.textContent = message; }
  private async save(exit: boolean): Promise<void> {
    if (this.busy || (!exit && !this.actions.save)) return;
    this.busy = true; this.root.setAttribute('aria-busy', 'true'); this.status('Saving…');
    const buttons = [...this.root.querySelectorAll<HTMLButtonElement>('button')], disabled = buttons.map(b => b.disabled);
    buttons.forEach(b => { b.disabled = true; });
    try {
      const saved = exit ? await this.actions.returnToTitle() : await this.actions.save!();
      if (!this.signal.aborted && this.root.querySelector('.menu-save-state')!.textContent === 'Saving…')
        this.status(saved === true ? 'Saved.' : 'Save failed. Please try again.');
    }
    catch { if (!this.signal.aborted) this.status('Save failed. Please try again.'); }
    finally {
      this.busy = false;
      if (!this.signal.aborted) {
        this.root.removeAttribute('aria-busy'); buttons.forEach((b, i) => { b.disabled = disabled[i]; });
        this.root.querySelector<HTMLButtonElement>(exit ? '#title-action' : '#save-action')!.focus();
      }
    }
  }
}
