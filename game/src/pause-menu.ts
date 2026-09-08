import { bindAudioControls, type AudioControlActions } from './audio-controls.ts';
import './pause-menu.css';

export interface PauseActions extends AudioControlActions {
  openChronicle?(): void;
  sound?(): void; muted?(): boolean; zoom?(factor: number): void;
  save?(): Promise<boolean>;
  returnToTitle(): void | Promise<void>;
}
/** A nested view of the existing paused phase; it never resumes or saves on its own. */
export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly actions: PauseActions;
  private readonly signal: AbortSignal;
  private options = false;
  private busy = false;
  constructor(root: HTMLElement, actions: PauseActions, signal: AbortSignal) {
    this.root = root; this.actions = actions; this.signal = signal;
    const chronicle=root.querySelector<HTMLButtonElement>('#chronicle-action')!;chronicle.disabled=!actions.openChronicle;chronicle.addEventListener('click',()=>actions.openChronicle?.(),{signal});
    root.querySelector('#options-action')!.addEventListener('click', () => this.showOptions(!this.options), { signal });
    root.querySelector('[data-options-back]')!.addEventListener('click', () => this.back(), { signal });
    root.querySelector('[data-sound]')!.addEventListener('click', () => { actions.sound?.(); this.refresh(); }, { signal });
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) button.addEventListener('click', () => actions.zoom?.(button.dataset.zoom === 'in' ? 1.2 : 1 / 1.2), { signal });
    const fullscreen = root.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      root.querySelector<HTMLElement>('[data-fullscreen-row]')!.hidden = false;
      fullscreen.addEventListener('click', async () => {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
        catch { this.status('Fullscreen unavailable here.'); }
        if (!signal.aborted) this.refresh();
      }, { signal });
      document.addEventListener('fullscreenchange', () => this.refresh(), { signal });
    }
    root.querySelector<HTMLButtonElement>('#save-action')!.disabled = !actions.save;
    root.querySelector('#save-action')!.addEventListener('click', () => { void this.save(false); }, { signal });
    root.querySelector('#title-action')!.addEventListener('click', () => { void this.save(true); }, { signal });
    bindAudioControls(root, actions, signal);
    this.refresh();
  }
  refresh(): void {
    const sound = this.root.querySelector<HTMLButtonElement>('[data-sound]')!;
    sound.textContent = this.actions.muted?.() ? 'Off' : 'On'; sound.setAttribute('aria-pressed', String(!this.actions.muted?.()));
    const fullscreen = this.root.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
    fullscreen.textContent = document.fullscreenElement ? 'On' : 'Off'; fullscreen.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  }
  back(): boolean {
    if (this.busy) return true;
    if (!this.options) return false;
    this.showOptions(false); return true;
  }
  private showOptions(open: boolean): void {
    if (this.busy) return;
    this.actions.panelSound?.(open);
    this.options = open;
    this.root.querySelector<HTMLElement>('#pause-options')!.hidden = !open;
    this.root.querySelector<HTMLElement>('#pause-summary')!.hidden = open;
    this.root.querySelector('#options-action')!.setAttribute('aria-expanded', String(open));
    this.root.querySelector<HTMLElement>(open ? '[data-sound]' : '#options-action')!.focus();
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
