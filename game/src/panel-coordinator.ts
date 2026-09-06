import type { GamePhase } from './game-phase.ts';
export type PanelPhase = Exclude<GamePhase, 'ready' | 'playing' | 'paused' | 'dead'>;
export interface PanelLifecycle { open(): void; close(): void; }
export interface PanelHooks {
  clearInput(): void; changed(phase: GamePhase): void; resumeGameplay(): void; save(): void;
}
const OPEN_FROM: Record<PanelPhase, readonly GamePhase[]> = {
  journeys: ['playing'], event: ['playing'], service: ['playing'], map: ['playing'], character: ['playing', 'character', 'skills'], skills: ['playing', 'character', 'skills'],
};
/** One control-context owner. Panel views own their focus traps; this owner closes
 * the old trap before opening a new view and returns focus only when play resumes. */
export class PanelCoordinator {
  private current: GamePhase = 'ready';
  private readonly panels: Record<PanelPhase, PanelLifecycle>;
  private readonly hooks: PanelHooks;
  constructor(panels: Record<PanelPhase, PanelLifecycle>, hooks: PanelHooks) { this.panels = panels; this.hooks = hooks; }
  get phase(): GamePhase { return this.current; }
  get activePanel(): PanelPhase | null { return Object.hasOwn(this.panels, this.current) ? this.current as PanelPhase : null; }
  canOpen(panel: PanelPhase): boolean { return OPEN_FROM[panel].includes(this.current); }
  open(panel: PanelPhase): boolean {
    if (!this.canOpen(panel) || this.current === panel) return false;
    this.transition(panel, true); return true;
  }
  toggle(panel: PanelPhase): boolean { return this.current === panel ? this.resume() : this.open(panel); }
  pause(): boolean {
    if (this.current !== 'playing') return false;
    this.transition('paused', true); return true;
  }
  resume(): boolean {
    if (this.current !== 'paused' && !this.activePanel) return false;
    this.transition('playing'); return true;
  }
  /** Explicit lifecycle changes: character entry, title return and defeat use the same cleanup. */
  transition(next: GamePhase, save = false): void {
    this.hooks.clearInput();
    const active = this.activePanel;
    if (active) this.panels[active].close();
    this.current = next;
    this.hooks.changed(next);
    const incoming = this.activePanel;
    if (incoming) this.panels[incoming].open();
    if (next === 'playing') this.hooks.resumeGameplay();
    if (save) this.hooks.save();
  }
}
